/**
 * Child process driver implementation
 *
 * Uses child_process.fork() with Unix domain sockets (or Windows named pipes)
 * for IPC communication.
 *
 * @packageDocumentation
 */

import { fork, type ChildProcess, type SpawnOptions } from 'child_process';
import type { Serializer } from '../../utils/serializer.js';
import { defaultSerializer } from '../../utils/serializer.js';
import { createMetaLogger, type Logger, type LogLevel } from '../../utils/logger.js';
import { generateSocketPath, cleanupSocketPath } from '../../platform/socket.js';
import { createConnection, type Connection } from '../connection.js';
import type {
  Driver,
  DriverChannel,
  DriverMessage,
  ChildProcessCapabilities,
  ReconnectCapability,
  DetachCapability,
} from '../driver.js';
import {
  encodeStartupData,
  STARTUP_DATA_ENV_KEY,
  type StartupData,
} from './startup.js';

/**
 * Options for child process driver spawn
 */
export interface ChildProcessDriverOptions {
  /** Environment variables to pass to worker */
  env?: Record<string, string>;

  /** Whether to detach the worker process */
  detached?: boolean;

  /** Additional spawn options */
  spawnOptions?: SpawnOptions;

  /** Custom serializer (must match worker side) */
  serializer?: Serializer;

  /** Connection timeout in ms (default: 10000) */
  timeout?: number;

  /** Maximum connection retry attempts (default: 5) */
  maxRetries?: number;

  /** Retry delay in ms (default: 100) */
  retryDelay?: number;

  /** Maximum retry delay cap (default: 5000) */
  maxDelay?: number;

  /** Server connect timeout passed to worker (default: 30000) */
  serverConnectTimeout?: number;

  /** Log level for driver operations */
  logLevel?: LogLevel;

  /** Custom logger instance */
  logger?: Logger;

  /** Override socket path (auto-generated if not provided) */
  socketPath?: string;
}

/**
 * Channel implementation for child process driver.
 *
 * Wraps a Connection and ChildProcess, providing the DriverChannel interface
 * with optional reconnect and detach capabilities.
 */
export class ChildProcessChannel
  implements DriverChannel, ReconnectCapability, DetachCapability
{
  private _isConnected: boolean;
  private _detached: boolean;
  private readonly _logger: Logger;

  constructor(
    private connection: Connection,
    private readonly child: ChildProcess,
    private readonly socketPath: string,
    private readonly connectionOptions: {
      timeout: number;
      maxRetries: number;
      retryDelay: number;
      maxDelay: number;
      serializer: Serializer;
    },
    options: { detached: boolean; logger: Logger }
  ) {
    this._isConnected = true;
    this._detached = options.detached;
    this._logger = options.logger;

    // Track connection state
    this.connection.onClose(() => {
      this._isConnected = false;
    });
  }

  get isConnected(): boolean {
    return this._isConnected && this.connection.isConnected;
  }

  get pid(): number | undefined {
    return this.child.pid;
  }

  get detached(): boolean {
    return this._detached;
  }

  async send(message: DriverMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Channel is not connected');
    }
    await this.connection.send(message);
  }

  onMessage(handler: (message: DriverMessage) => void): void {
    this.connection.onMessage(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.connection.onError(handler);
  }

  onClose(handler: () => void): void {
    this.connection.onClose(handler);
  }

  async disconnect(): Promise<void> {
    if (!this._isConnected) {
      return;
    }

    this._logger.debug('Disconnecting from worker (keeping process alive)', {
      pid: this.child.pid,
    });

    await this.connection.close();
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

    // Create new connection
    this.connection = await createConnection({
      socketPath: this.socketPath,
      timeout: this.connectionOptions.timeout,
      maxRetries: this.connectionOptions.maxRetries,
      retryDelay: this.connectionOptions.retryDelay,
      maxDelay: this.connectionOptions.maxDelay,
      serializer: this.connectionOptions.serializer,
      logger: this._logger,
    });

    this._isConnected = true;

    // Re-register connection state tracking
    this.connection.onClose(() => {
      this._isConnected = false;
    });

    this._logger.info('Reconnected to worker', { pid: this.child.pid });
  }

  async close(): Promise<void> {
    this._logger.info('Closing channel', { pid: this.child.pid });

    // Close connection first
    await this.connection.close();
    this._isConnected = false;

    // Kill the process if still running
    if (!this.child.killed) {
      this.child.kill('SIGTERM');

      // Force kill after timeout
      await new Promise<void>((resolve) => {
        const timeoutId = setTimeout(() => {
          if (!this.child.killed) {
            this._logger.warn('Force killing worker', { pid: this.child.pid });
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

    // Cleanup socket
    cleanupSocketPath(this.socketPath);

    this._logger.info('Channel closed', { pid: this.child.pid });
  }
}

/**
 * Child process driver implementation.
 *
 * Spawns workers using child_process.fork() and communicates via
 * Unix domain sockets (or Windows named pipes).
 */
export class ChildProcessDriver
  implements Driver<ChildProcessCapabilities, ChildProcessDriverOptions>
{
  readonly name = 'child_process';

  readonly capabilities: ChildProcessCapabilities = {
    reconnect: true,
    detach: true,
    sharedMemory: false,
  };

  /**
   * Spawn a worker process and establish communication channel.
   *
   * @param script - Path to the worker script
   * @param options - Spawn options
   * @returns Promise resolving to a DriverChannel
   */
  async spawn(
    script: string,
    options: ChildProcessDriverOptions = {}
  ): Promise<ChildProcessChannel> {
    const {
      env = {},
      detached = false,
      spawnOptions = {},
      serializer = defaultSerializer,
      timeout = 10_000,
      maxRetries = 5,
      retryDelay = 100,
      maxDelay = 5000,
      serverConnectTimeout = 30_000,
      logLevel = 'error',
      logger: customLogger,
      socketPath: customSocketPath,
    } = options;

    const logger = customLogger ?? createMetaLogger(undefined, logLevel);
    const socketPath = customSocketPath ?? generateSocketPath('worker');

    logger.info('Spawning worker', { script, socketPath, detached });

    // Create startup data for the worker
    const startupData: StartupData = {
      driver: this.name,
      socketPath,
      serializer: serializer.constructor.name,
      serverConnectTimeout,
    };

    // Spawn the child process
    const child = fork(script, [], {
      ...spawnOptions,
      env: {
        ...process.env,
        ...env,
        [STARTUP_DATA_ENV_KEY]: encodeStartupData(startupData),
        // Legacy env vars for backwards compatibility
        ISOLATED_WORKERS_SOCKET_PATH: socketPath,
        ISOLATED_WORKERS_SERVER_CONNECT_TIMEOUT: String(serverConnectTimeout),
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
      logger.debug('Worker process detached and unref\'d', { pid: child.pid });
    }

    // Connect to the worker via socket
    let connection: Connection;
    try {
      connection = await createConnection({
        socketPath,
        timeout,
        maxRetries,
        retryDelay,
        maxDelay,
        serializer,
        logger,
      });
      logger.info('Connected to worker', { pid: child.pid });
    } catch (err) {
      logger.error('Failed to connect to worker', {
        error: (err as Error).message,
      });
      child.kill();
      cleanupSocketPath(socketPath);
      throw err;
    }

    // Create and return the channel
    return new ChildProcessChannel(
      connection,
      child,
      socketPath,
      { timeout, maxRetries, retryDelay, maxDelay, serializer },
      { detached, logger }
    );
  }
}

/**
 * Default child process driver instance
 */
export const childProcessDriver = new ChildProcessDriver();
