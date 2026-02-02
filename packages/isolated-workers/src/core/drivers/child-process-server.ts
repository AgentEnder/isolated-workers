/**
 * Child process server implementation for worker side
 *
 * Creates a socket server that listens for connections from the host process.
 * Used by workers spawned via the ChildProcessDriver.
 *
 * @packageDocumentation
 */

import { Socket, Server } from 'net';
import type { Serializer } from '../../utils/serializer.js';
import { defaultSerializer } from '../../utils/serializer.js';
import { createMetaLogger, type Logger, type LogLevel } from '../../utils/logger.js';
import { getSocketAdapter, cleanupSocketPath } from '../../platform/socket.js';
import type { DriverMessage } from '../driver.js';
import { getStartupData } from './startup.js';

/**
 * Default server connect timeout (30 seconds)
 */
export const DEFAULT_SERVER_CONNECT_TIMEOUT = 30_000;

/**
 * Server channel interface for worker-side communication.
 *
 * Provides methods for handling messages and managing the server lifecycle.
 */
export interface ServerChannel {
  /** Register a message handler */
  onMessage(handler: (message: DriverMessage, respond: ResponseFunction) => void): void;
  /** Register an error handler */
  onError(handler: (error: Error) => void): void;
  /** Stop the server and cleanup */
  stop(): Promise<void>;
  /** Whether the server is running */
  readonly isRunning: boolean;
  /** Socket path the server is listening on */
  readonly socketPath: string;
}

/**
 * Function to send a response back to the host
 */
export type ResponseFunction = (response: DriverMessage) => Promise<void>;

/**
 * Options for creating a child process server
 */
export interface ChildProcessServerOptions {
  /** Socket path (from startup data if not provided) */
  socketPath?: string;

  /** Time to wait for host to connect (default: from startup data or 30s, 0 = forever) */
  hostConnectTimeout?: number;

  /** Custom serializer (must match host!) */
  serializer?: Serializer;

  /** Log level for server operations */
  logLevel?: LogLevel;

  /** Custom logger instance */
  logger?: Logger;
}

/**
 * Child process server implementation.
 *
 * Wraps a net.Server and provides the ServerChannel interface.
 */
export class ChildProcessServer implements ServerChannel {
  private server: Server;
  private _isRunning = false;
  private activeSocket: Socket | null = null;
  private connectTimeoutHandle: NodeJS.Timeout | null = null;
  private messageHandlers: Array<(message: DriverMessage, respond: ResponseFunction) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private readonly _socketPath: string;
  private readonly logger: Logger;
  private readonly serializer: Serializer;
  private readonly terminatorStr: string;

  constructor(
    server: Server,
    socketPath: string,
    options: { serializer: Serializer; logger: Logger }
  ) {
    this.server = server;
    this._socketPath = socketPath;
    this.serializer = options.serializer;
    this.logger = options.logger;

    // Get terminator for message framing
    this.terminatorStr =
      typeof this.serializer.terminator === 'string'
        ? this.serializer.terminator
        : this.serializer.terminator.toString();
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get socketPath(): string {
    return this._socketPath;
  }

  onMessage(handler: (message: DriverMessage, respond: ResponseFunction) => void): void {
    this.messageHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Start listening for connections from the host
   */
  async start(hostConnectTimeout: number): Promise<void> {
    this._isRunning = true;

    // Set up host connection timeout
    if (hostConnectTimeout > 0) {
      this.connectTimeoutHandle = setTimeout(() => {
        if (!this.activeSocket && this._isRunning) {
          this.logger.error(
            `Host did not connect within ${hostConnectTimeout}ms, shutting down`
          );
          this.stop();
        }
      }, hostConnectTimeout);
    }

    // Handle incoming connections
    this.server.on('connection', (socket: Socket) => {
      // Clear connection timeout - host connected
      if (this.connectTimeoutHandle) {
        clearTimeout(this.connectTimeoutHandle);
        this.connectTimeoutHandle = null;
      }

      this.logger.debug('Host connected');
      this.activeSocket = socket;
      let buffer = '';

      socket.on('data', (data: Buffer) => {
        buffer += data.toString('utf-8');

        // Process complete messages (terminator-delimited)
        let delimiterIndex: number;
        while ((delimiterIndex = buffer.indexOf(this.terminatorStr)) !== -1) {
          const line = buffer.slice(0, delimiterIndex);
          buffer = buffer.slice(delimiterIndex + this.terminatorStr.length);

          if (line.trim()) {
            try {
              const message = this.serializer.deserialize<DriverMessage>(line);
              this.logger.debug('Received message', {
                type: message.type,
                tx: message.tx,
              });

              // Create response function for this message
              const respond: ResponseFunction = async (response: DriverMessage) => {
                await this.sendMessage(socket, response);
              };

              // Notify handlers
              this.messageHandlers.forEach((handler) => {
                try {
                  handler(message, respond);
                } catch (err) {
                  this.logger.error('Message handler error', {
                    error: (err as Error).message,
                  });
                }
              });
            } catch (err) {
              this.logger.error('Failed to parse message', {
                line: line.slice(0, 100),
                error: (err as Error).message,
              });
            }
          }
        }
      });

      socket.on('close', () => {
        this.logger.debug('Host disconnected');
        if (this.activeSocket === socket) {
          this.activeSocket = null;
        }
      });

      socket.on('error', (err: Error) => {
        this.logger.error('Socket error', { error: err.message });
        this.errorHandlers.forEach((handler) => {
          try {
            handler(err);
          } catch (handlerErr) {
            this.logger.error('Error handler error', {
              error: (handlerErr as Error).message,
            });
          }
        });
      });
    });

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.server.listen(this._socketPath, () => {
        this.logger.info('Server listening', { socketPath: this._socketPath });
        resolve();
      });

      this.server.on('error', (err: Error) => {
        this.logger.error('Server error', { error: err.message });
        reject(err);
      });
    });
  }

  /**
   * Send a message to the host
   */
  private async sendMessage(socket: Socket, message: DriverMessage): Promise<void> {
    this.logger.debug('Sending message', { tx: message.tx, type: message.type });

    const serialized = this.serializer.serialize(message);
    const dataStr =
      typeof serialized === 'string'
        ? serialized + this.terminatorStr
        : serialized.toString() + this.terminatorStr;

    await new Promise<void>((resolve, reject) => {
      socket.write(dataStr, (err) => {
        if (err) {
          this.logger.error('Failed to send message', { error: err.message });
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping server');
    this._isRunning = false;

    if (this.connectTimeoutHandle) {
      clearTimeout(this.connectTimeoutHandle);
      this.connectTimeoutHandle = null;
    }

    if (this.activeSocket) {
      this.activeSocket.end();
      this.activeSocket = null;
    }

    await new Promise<void>((resolve) => {
      this.server.close(() => {
        this.logger.info('Server stopped');
        cleanupSocketPath(this._socketPath);
        resolve();
      });
    });
  }
}

/**
 * Create a child process server for worker-side communication.
 *
 * This function reads startup data to determine the socket path and configuration,
 * then creates a server listening for host connections.
 *
 * @param options - Server options (overrides startup data if provided)
 * @returns Promise resolving to a ServerChannel
 *
 * @example
 * ```typescript
 * const server = await createChildProcessServer();
 *
 * server.onMessage(async (message, respond) => {
 *   console.log('Received:', message);
 *   await respond({
 *     tx: message.tx,
 *     type: message.type,
 *     payload: { result: 'ok' },
 *   });
 * });
 * ```
 */
export async function createChildProcessServer(
  options: ChildProcessServerOptions = {}
): Promise<ChildProcessServer> {
  const {
    socketPath: customSocketPath,
    hostConnectTimeout: customHostConnectTimeout,
    serializer = defaultSerializer,
    logLevel = 'error',
    logger: customLogger,
  } = options;

  const logger = customLogger ?? createMetaLogger(undefined, logLevel);

  // Get startup data if available
  const startupData = getStartupData();

  // Resolve socket path: option > startup data > env var
  const socketPath =
    customSocketPath ??
    startupData?.socketPath ??
    process.env.ISOLATED_WORKERS_SOCKET_PATH;

  if (!socketPath) {
    throw new Error(
      'No socket path provided. Set ISOLATED_WORKERS_SOCKET_PATH env var, ' +
      'pass socketPath option, or ensure worker was spawned with startup data.'
    );
  }

  // Resolve host connect timeout: option > startup data > env var > default
  let hostConnectTimeout = customHostConnectTimeout;
  if (hostConnectTimeout === undefined) {
    hostConnectTimeout = startupData?.serverConnectTimeout;
  }
  if (hostConnectTimeout === undefined) {
    const envTimeout = process.env.ISOLATED_WORKERS_SERVER_CONNECT_TIMEOUT;
    if (envTimeout) {
      const parsed = parseInt(envTimeout, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        hostConnectTimeout = parsed;
      }
    }
  }
  if (hostConnectTimeout === undefined) {
    hostConnectTimeout = DEFAULT_SERVER_CONNECT_TIMEOUT;
  }

  logger.info('Creating child process server', { socketPath, hostConnectTimeout });

  // Validate startup data driver if present
  if (startupData && startupData.driver !== 'child_process') {
    logger.warn('Startup data indicates different driver', {
      expected: 'child_process',
      actual: startupData.driver,
    });
  }

  // Create the server
  const adapter = getSocketAdapter();
  const netServer = adapter.createServer(socketPath);

  const server = new ChildProcessServer(netServer, socketPath, {
    serializer,
    logger,
  });

  // Start listening
  await server.start(hostConnectTimeout);

  return server;
}

/**
 * Check if the current process was spawned by a ChildProcessDriver.
 *
 * @returns True if running in a child process context with appropriate startup data
 */
export function isChildProcessWorker(): boolean {
  const startupData = getStartupData();
  return startupData?.driver === 'child_process' ||
    process.env.ISOLATED_WORKERS_SOCKET_PATH !== undefined;
}
