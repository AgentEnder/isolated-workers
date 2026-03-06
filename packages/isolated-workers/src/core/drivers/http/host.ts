/**
 * HTTP driver host module
 *
 * Contains spawn logic for the HTTP driver. This module is imported
 * only on the host side (the process that spawns workers).
 *
 * Uses child_process.fork() for lifecycle management but communicates
 * via HTTP POST requests instead of Unix domain sockets.
 *
 * @packageDocumentation
 */

import { fork, type ChildProcess, type ForkOptions } from 'child_process';
import * as http from 'http';
import type { Serializer } from '../../../utils/serializer.js';
import { defaultSerializer } from '../../../utils/serializer.js';
import {
  createMetaLogger,
  type Logger,
  type LogLevel,
} from '../../../utils/logger.js';
import type {
  DriverChannel,
  DriverMessage,
  ReconnectCapability,
  DetachCapability,
  StartupData,
} from '../../driver.js';
import type { ShutdownReason } from '../../../types/config.js';

/**
 * Environment variable key for startup data
 */
export const STARTUP_DATA_ENV_KEY = 'ISOLATED_WORKERS_STARTUP_DATA';

/**
 * IPC message type sent from worker to host to communicate the assigned port
 */
interface PortNotification {
  type: '__iw_port';
  port: number;
}

/**
 * Options for HTTP driver spawn
 */
export interface HttpDriverOptions {
  /** Environment variables to pass to worker */
  env?: Record<string, string>;

  /** Whether to detach the worker process */
  detached?: boolean;

  /** Additional spawn options (ForkOptions for child_process) */
  spawnOptions?: ForkOptions;

  /** Custom serializer (must match worker side) */
  serializer?: Serializer;

  /** Connection timeout in ms (default: 10000) */
  timeout?: number;

  /** Maximum health-check retry attempts (default: 10) */
  maxRetries?: number;

  /** Initial retry delay in ms for health-check backoff (default: 100) */
  retryDelay?: number;

  /** Maximum retry delay cap in ms (default: 5000) */
  maxDelay?: number;

  /** Server connect timeout passed to worker (default: 30000) */
  serverConnectTimeout?: number;

  /** Log level for driver operations */
  logLevel?: LogLevel;

  /** Custom logger instance */
  logger?: Logger;

  /** Preferred port for the HTTP server (0 or omit for auto-assign) */
  port?: number;

  /** Shutdown handler callback */
  onShutdown?: (reason: ShutdownReason) => void;
}

/**
 * Startup data specific to the HTTP driver.
 *
 * Extends the base StartupData with HTTP-specific fields.
 */
export interface HttpStartupData extends StartupData {
  /** Driver identifier - always 'http' for this driver */
  driver: 'http';
  /** Preferred port for the HTTP server (0 for auto-assign) */
  port: number;
}

/**
 * Encode startup data for passing to child_process via environment variable.
 *
 * @param data - The startup data to encode
 * @returns JSON string suitable for setting as an environment variable
 */
export function encodeStartupData(data: StartupData): string {
  return JSON.stringify(data);
}

/**
 * Channel implementation for HTTP driver.
 *
 * Wraps a ChildProcess and communicates via HTTP POST to the worker's
 * embedded HTTP server. Each `send()` call is a POST to `/message`
 * and the response body is parsed as the reply message.
 */
export class HttpChannel
  implements DriverChannel, ReconnectCapability, DetachCapability
{
  private _isConnected: boolean;
  private _detached: boolean;
  private readonly _logger: Logger;
  private _onShutdown?: (reason: ShutdownReason) => void;
  private readonly messageHandlers: Array<(message: DriverMessage) => void> =
    [];
  private readonly errorHandlers: Array<(error: Error) => void> = [];
  private readonly closeHandlers: Array<() => void> = [];
  private readonly baseUrl: string;

  constructor(
    private readonly child: ChildProcess,
    port: number,
    private readonly serializer: Serializer,
    options: {
      detached: boolean;
      logger: Logger;
      onShutdown?: (reason: ShutdownReason) => void;
    }
  ) {
    this._isConnected = true;
    this._detached = options.detached;
    this._logger = options.logger;
    this._onShutdown = options.onShutdown;
    this.baseUrl = `http://127.0.0.1:${port}`;

    // Register child process lifecycle events
    this.child.on('exit', (code, signal) => {
      this._isConnected = false;
      this.closeHandlers.forEach((h) => h());
      if (this._onShutdown) {
        this._onShutdown({ type: 'exit', code, signal });
      }
    });

    this.child.on('error', (error) => {
      this.errorHandlers.forEach((h) => h(error));
      if (this._onShutdown) {
        this._onShutdown({ type: 'error', error });
      }
    });
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get pid(): number | undefined {
    return this.child.pid;
  }

  get detached(): boolean {
    return this._detached;
  }

  async send(message: DriverMessage): Promise<void> {
    if (!this._isConnected) {
      throw new Error('Channel is not connected');
    }

    const body = this.serializer.serialize(message);
    const bodyStr = typeof body === 'string' ? body : body.toString();

    const response = await this.httpPost('/message', bodyStr);
    const parsed = this.serializer.deserialize<DriverMessage>(response);

    // Notify message handlers with the response
    this.messageHandlers.forEach((handler) => {
      try {
        handler(parsed);
      } catch (err) {
        this._logger.error('Message handler error', {
          error: (err as Error).message,
        });
      }
    });
  }

  onMessage(handler: (message: DriverMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  onShutdown(handler: (reason: ShutdownReason) => void): void {
    this._onShutdown = handler;
  }

  async disconnect(): Promise<void> {
    if (!this._isConnected) {
      return;
    }

    this._logger.debug('Disconnecting from worker (keeping process alive)', {
      pid: this.child.pid,
    });

    this._isConnected = false;
  }

  async reconnect(): Promise<void> {
    if (this._isConnected) {
      this._logger.warn('Already connected to worker');
      return;
    }

    if (this.child.killed) {
      throw new Error('Cannot reconnect: worker process is not active');
    }

    this._logger.info('Reconnecting to worker', { pid: this.child.pid });

    // Health-check the HTTP server to verify it's still alive
    await this.healthCheck();
    this._isConnected = true;

    this._logger.info('Reconnected to worker', { pid: this.child.pid });
  }

  async close(): Promise<void> {
    this._logger.info('Closing channel', { pid: this.child.pid });

    this._isConnected = false;

    // Kill the process if still running
    if (!this.child.killed) {
      this.child.kill('SIGTERM');

      // Force kill after timeout
      await new Promise<void>((resolve) => {
        const timeoutId = setTimeout(() => {
          if (!this.child.killed) {
            this._logger.warn('Force killing worker', {
              pid: this.child.pid,
            });
            this.child.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.child.once('exit', () => {
          clearTimeout(timeoutId);
          resolve();
        });
      });
    }

    this._logger.info('Channel closed', { pid: this.child.pid });
  }

  /**
   * Perform an HTTP POST request to the worker
   */
  private httpPost(path: string, body: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const req = http.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const responseBody = Buffer.concat(
              chunks as unknown as Uint8Array[]
            ).toString('utf-8');
            if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              resolve(responseBody);
            } else {
              reject(
                new Error(
                  `HTTP ${res.statusCode}: ${responseBody.slice(0, 200)}`
                )
              );
            }
          });
        }
      );

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * Health-check the worker HTTP server
   */
  private healthCheck(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const url = new URL('/health', this.baseUrl);
      const req = http.request(url, { method: 'GET' }, (res) => {
        // Consume body
        res.resume();
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Health check failed: HTTP ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.end();
    });
  }
}

/**
 * Spawn a worker process and establish HTTP communication channel.
 *
 * @param script - Path to the worker script
 * @param options - Spawn options
 * @returns Promise resolving to an HttpChannel
 */
export async function spawnWorker(
  script: string | URL,
  options: HttpDriverOptions = {}
): Promise<HttpChannel> {
  const resolvedScript = typeof script === 'string' ? script : (() => {
    if (script.protocol !== 'file:') {
      throw new Error(
        `http driver only supports file:// URLs or string paths, got "${script.protocol}"`
      );
    }
    const { fileURLToPath } = require('node:url') as typeof import('node:url');
    return fileURLToPath(script);
  })();

  const {
    env = {},
    detached = false,
    spawnOptions = {},
    serializer = defaultSerializer,
    timeout = 10_000,
    maxRetries = 10,
    retryDelay = 100,
    maxDelay = 5000,
    serverConnectTimeout = 30_000,
    logLevel = 'error',
    logger: customLogger,
    port: preferredPort = 0,
    onShutdown,
  } = options;

  const logger = customLogger ?? createMetaLogger(undefined, logLevel);

  logger.info('Spawning HTTP worker', { script: resolvedScript, port: preferredPort, detached });

  // Create startup data for the worker
  const startupData: HttpStartupData = {
    driver: 'http',
    port: preferredPort,
    serializer: serializer.constructor.name,
    serverConnectTimeout,
  };

  // Spawn the child process
  const child = fork(resolvedScript, [], {
    ...spawnOptions,
    env: {
      ...process.env,
      ...env,
      [STARTUP_DATA_ENV_KEY]: encodeStartupData(startupData),
    },
    silent: false,
    detached,
  });

  if (!child.pid) {
    throw new Error('Failed to spawn worker: no process ID');
  }

  logger.debug('Worker process spawned', { pid: child.pid });

  // If detached, unref the process so it doesn't block parent exit
  if (detached) {
    child.unref();
    logger.debug("Worker process detached and unref'd", { pid: child.pid });
  }

  // Wait for port notification from the worker via IPC
  let assignedPort: number;
  try {
    assignedPort = await waitForPortNotification(child, timeout);
    logger.debug('Received port notification', {
      pid: child.pid,
      port: assignedPort,
    });
  } catch (err) {
    logger.error('Failed to receive port from worker', {
      error: (err as Error).message,
    });
    child.kill();
    throw err;
  }

  // Health-check retry loop with exponential backoff
  try {
    await waitForHealthy(assignedPort, {
      maxRetries,
      retryDelay,
      maxDelay,
      timeout,
      logger,
    });
    logger.info('Worker HTTP server is healthy', {
      pid: child.pid,
      port: assignedPort,
    });
  } catch (err) {
    logger.error('Worker HTTP health check failed', {
      error: (err as Error).message,
    });
    child.kill();
    throw err;
  }

  // Create and return the channel
  return new HttpChannel(child, assignedPort, serializer, {
    detached,
    logger,
    onShutdown,
  });
}

/**
 * Wait for the worker to send its assigned port via IPC
 */
function waitForPortNotification(
  child: ChildProcess,
  timeout: number
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Timed out waiting for port notification from worker after ${timeout}ms`
        )
      );
    }, timeout);

    function onMessage(msg: unknown) {
      if (
        typeof msg === 'object' &&
        msg !== null &&
        (msg as PortNotification).type === '__iw_port' &&
        typeof (msg as PortNotification).port === 'number'
      ) {
        cleanup();
        resolve((msg as PortNotification).port);
      }
    }

    function onExit(code: number | null) {
      cleanup();
      reject(
        new Error(
          `Worker exited with code ${code} before sending port notification`
        )
      );
    }

    function onError(err: Error) {
      cleanup();
      reject(err);
    }

    function cleanup() {
      clearTimeout(timeoutId);
      child.off('message', onMessage);
      child.off('exit', onExit);
      child.off('error', onError);
    }

    child.on('message', onMessage);
    child.on('exit', onExit);
    child.on('error', onError);
  });
}

/**
 * Wait for the worker HTTP server to become healthy with exponential backoff
 */
function waitForHealthy(
  port: number,
  options: {
    maxRetries: number;
    retryDelay: number;
    maxDelay: number;
    timeout: number;
    logger: Logger;
  }
): Promise<void> {
  const { maxRetries, retryDelay, maxDelay, logger } = options;

  return new Promise<void>((resolve, reject) => {
    let attempt = 0;

    function tryHealthCheck() {
      attempt++;
      const url = new URL('/health', `http://127.0.0.1:${port}`);
      const req = http.request(url, { method: 'GET' }, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
        } else {
          retryOrFail(`Health check returned HTTP ${res.statusCode}`);
        }
      });

      req.on('error', (err) => {
        retryOrFail(err.message);
      });

      req.end();
    }

    function retryOrFail(reason: string) {
      if (attempt >= maxRetries) {
        reject(
          new Error(
            `Worker HTTP server not healthy after ${maxRetries} attempts: ${reason}`
          )
        );
        return;
      }

      const delay = Math.min(retryDelay * Math.pow(2, attempt - 1), maxDelay);
      logger.debug(
        `Health check attempt ${attempt} failed (${reason}), retrying in ${delay}ms`
      );
      setTimeout(tryHealthCheck, delay);
    }

    tryHealthCheck();
  });
}
