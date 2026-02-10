/**
 * HTTP driver server module
 *
 * Contains server logic for the HTTP driver. This module is imported
 * only on the worker side (the process that was spawned).
 *
 * Creates an HTTP server that handles POST /message requests from the host
 * and responds with the handler's result in the HTTP response body.
 *
 * @packageDocumentation
 */

import * as http from 'http';
import type { Serializer } from '../../../utils/serializer.js';
import { defaultSerializer } from '../../../utils/serializer.js';
import { createMetaLogger, type Logger } from '../../../utils/logger.js';
import type {
  DriverMessage,
  ServerChannel,
  ServerOptions,
} from '../../driver.js';
import type { HttpStartupData } from './host.js';

/**
 * Default server connect timeout (30 seconds)
 */
export const DEFAULT_SERVER_CONNECT_TIMEOUT = 30_000;

/**
 * Function to send a response back to the host
 */
export type ResponseFunction = (response: DriverMessage) => Promise<void>;

/**
 * HTTP server channel implementation.
 *
 * Wraps an http.Server and provides the ServerChannel interface.
 * Routes:
 * - POST /message — receives a message, calls handlers, responds with result
 * - GET /health — returns 200 OK for health checks
 */
export class HttpServerChannel implements ServerChannel {
  private _isRunning = false;
  private connectTimeoutHandle: NodeJS.Timeout | null = null;
  private messageHandlers: Array<
    (message: DriverMessage, respond: ResponseFunction) => void
  > = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private _port: number;
  private readonly logger: Logger;
  private readonly serializer: Serializer;
  private hasReceivedMessage = false;

  constructor(
    private readonly server: http.Server,
    preferredPort: number,
    options: { serializer: Serializer; logger: Logger }
  ) {
    this._port = preferredPort;
    this.serializer = options.serializer;
    this.logger = options.logger;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get port(): number {
    return this._port;
  }

  get socketPath(): string {
    return `http://127.0.0.1:${this._port}`;
  }

  onMessage(
    handler: (message: DriverMessage, respond: ResponseFunction) => void
  ): void {
    this.messageHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Start listening for HTTP requests from the host
   */
  async start(hostConnectTimeout: number): Promise<void> {
    this._isRunning = true;

    // Set up host connection timeout
    if (hostConnectTimeout > 0) {
      this.connectTimeoutHandle = setTimeout(() => {
        if (!this.hasReceivedMessage && this._isRunning) {
          this.logger.error(
            `Host did not connect within ${hostConnectTimeout}ms, shutting down`
          );
          this.stop();
        }
      }, hostConnectTimeout);
    }

    // Set up request handling
    this.server.on('request', (req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
        return;
      }

      if (req.method === 'POST' && req.url === '/message') {
        // Clear connection timeout on first message
        if (!this.hasReceivedMessage) {
          this.hasReceivedMessage = true;
          if (this.connectTimeoutHandle) {
            clearTimeout(this.connectTimeoutHandle);
            this.connectTimeoutHandle = null;
          }
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          const body = Buffer.concat(
            chunks as unknown as Uint8Array[]
          ).toString('utf-8');

          try {
            const message = this.serializer.deserialize<DriverMessage>(body);
            this.logger.debug('Received message', {
              type: message.type,
              tx: message.tx,
            });

            // Create response function that writes to the HTTP response
            let responseSent = false;
            const respond: ResponseFunction = async (
              response: DriverMessage
            ) => {
              if (responseSent) {
                this.logger.warn('Response already sent for this request', {
                  tx: message.tx,
                });
                return;
              }
              responseSent = true;
              const serialized = this.serializer.serialize(response);
              const responseStr =
                typeof serialized === 'string'
                  ? serialized
                  : serialized.toString();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(responseStr);
            };

            // Notify handlers
            this.messageHandlers.forEach((handler) => {
              try {
                handler(message, respond);
              } catch (err) {
                this.logger.error('Message handler error', {
                  error: (err as Error).message,
                });
                if (!responseSent) {
                  responseSent = true;
                  res.writeHead(500, { 'Content-Type': 'text/plain' });
                  res.end('Internal handler error');
                }
              }
            });

            // If no handler sent a response, return 204
            // Use a short delay to allow async handlers to respond
            setTimeout(() => {
              if (!responseSent) {
                responseSent = true;
                res.writeHead(204);
                res.end();
              }
            }, 0);
          } catch (err) {
            this.logger.error('Failed to parse message', {
              body: body.slice(0, 100),
              error: (err as Error).message,
            });
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid message format');
          }
        });
        return;
      }

      // Unknown route
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.server.listen(this._port, '127.0.0.1', () => {
        // Get the actual assigned port
        const address = this.server.address();
        if (address && typeof address !== 'string') {
          this._port = address.port;
        }
        this.logger.info('HTTP server listening', { port: this._port });
        resolve();
      });

      this.server.on('error', (err: Error) => {
        this.logger.error('Server error', { error: err.message });
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping HTTP server');
    this._isRunning = false;

    if (this.connectTimeoutHandle) {
      clearTimeout(this.connectTimeoutHandle);
      this.connectTimeoutHandle = null;
    }

    await new Promise<void>((resolve) => {
      this.server.close(() => {
        this.logger.info('HTTP server stopped');
        resolve();
      });
    });
  }
}

/**
 * Create an HTTP server for worker-side communication.
 *
 * @param startupData - Startup data from the host process
 * @param options - Server options
 * @returns Promise resolving to an HttpServerChannel
 */
export async function createServer(
  startupData: HttpStartupData,
  options: ServerOptions = {}
): Promise<HttpServerChannel> {
  const {
    serializer = defaultSerializer,
    logLevel = 'error',
    logger: customLogger,
  } = options;

  const logger = customLogger ?? createMetaLogger(undefined, logLevel);

  const { port: preferredPort = 0, serverConnectTimeout } = startupData;

  const hostConnectTimeout =
    serverConnectTimeout ?? DEFAULT_SERVER_CONNECT_TIMEOUT;

  logger.info('Creating HTTP server', {
    port: preferredPort,
    hostConnectTimeout,
  });

  // Create the HTTP server
  const httpServer = http.createServer();

  const server = new HttpServerChannel(httpServer, preferredPort, {
    serializer,
    logger,
  });

  // Start listening
  await server.start(hostConnectTimeout);

  // Send the assigned port back to the host via IPC
  if (process.send) {
    process.send({ type: '__iw_port', port: server.port });
  } else {
    throw new Error(
      'No IPC channel available. Ensure worker was spawned with fork().'
    );
  }

  return server;
}
