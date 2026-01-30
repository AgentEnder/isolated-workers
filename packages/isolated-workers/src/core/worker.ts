/**
 * Worker spawner with lifecycle management
 *
 * @packageDocumentation
 */

import { fork, type SpawnOptions } from 'child_process';
import {
  createMetaLogger,
  type Logger,
  type LogLevel,
} from '../utils/logger.js';
import {
  deserializeError,
  defaultSerializer,
  type Serializer,
} from '../utils/serializer.js';
import { generateSocketPath, cleanupSocketPath } from '../platform/socket.js';
import { createConnection, Connection } from './connection.js';
import {
  TypedResult,
  createRequest,
  isErrorMessage,
  defaultTxIdGenerator,
} from './messaging.js';
import type {
  MessageDefs,
  Middleware,
  TransactionIdGenerator,
} from '../types/index.js';
import { normalizeTimeoutConfig, getTimeoutValue } from './internals.js';

/**
 * Built-in timeout keys for worker lifecycle events
 */
export type BuiltInTimeoutKey =
  | 'WORKER_STARTUP'
  | 'WORKER_MESSAGE'
  | 'SERVER_CONNECT';

/**
 * Timeout configuration allowing per-message-type timeouts.
 *
 * Built-in keys:
 * - `WORKER_STARTUP`: Time to wait for worker to start (default: 10s)
 * - `SERVER_CONNECT`: Time for server to wait for host connection (default: 30s)
 * - `WORKER_MESSAGE`: Default timeout for all messages (default: 5min)
 *
 * You can also specify timeouts for specific message types by their key name.
 * Message-specific timeouts take precedence over WORKER_MESSAGE.
 *
 * @example
 * ```ts
 * const worker = await createWorker<MyMessages>({
 *   script: './worker.js',
 *   timeout: {
 *     WORKER_STARTUP: 5000,        // 5s startup
 *     SERVER_CONNECT: 10000,       // 10s for server to wait for host
 *     WORKER_MESSAGE: 60000,       // 1min default for messages
 *     'slowOperation': 600000,     // 10min for specific message type
 *   }
 * });
 * ```
 */
export type TimeoutConfig<TDefs extends MessageDefs = MessageDefs> = Partial<
  Record<BuiltInTimeoutKey | keyof TDefs, number>
>;

/** Default timeout for worker startup (10 seconds) */
export const DEFAULT_STARTUP_TIMEOUT = 10_000;

/** Default timeout for server to wait for host connection (30 seconds) */
export const DEFAULT_SERVER_CONNECT_TIMEOUT = 30_000;

/** Default timeout for worker messages (5 minutes) */
export const DEFAULT_MESSAGE_TIMEOUT = 5 * 60 * 1000;

/**
 * Worker options for spawning
 */
export interface WorkerOptions<TDefs extends MessageDefs = MessageDefs> {
  /** Path to worker script */
  script: string;

  /** Environment variables to pass to worker */
  env?: Record<string, string>;

  /** Worker lifecycle options */
  detached?: boolean; // Detach worker process (default: false)
  spawnOptions?: SpawnOptions; // Additional child process options

  /**
   * Timeout configuration for worker operations.
   *
   * Can be a number (applies to all operations) or an object with per-operation timeouts:
   * - `WORKER_STARTUP`: Time to wait for worker to start (default: 10s)
   * - `WORKER_MESSAGE`: Default timeout for all messages (default: 5min)
   * - `[messageType]`: Timeout for specific message type (overrides WORKER_MESSAGE)
   *
   * @example
   * // Simple: 30s for all operations
   * timeout: 30000
   *
   * @example
   * // Advanced: per-operation timeouts
   * timeout: {
   *   WORKER_STARTUP: 5000,
   *   WORKER_MESSAGE: 60000,
   *   'slowOperation': 600000,
   * }
   */
  timeout?: number | TimeoutConfig<TDefs>;

  /** Messaging options */
  middleware?: Middleware<TDefs>[]; // Per-instance middleware pipeline
  serializer?: Serializer; // Custom serializer (default: JsonSerializer)
  txIdGenerator?: TransactionIdGenerator<TDefs>; // Custom TX ID generator

  /** Connection options */
  connection?: {
    attempts?: number; // Max reconnection attempts (default: 5)
    delay?: number | ((attempt: number) => number); // Delay in ms or function (default: 100)
    maxDelay?: number; // Max delay cap (default: 5000ms)
  };

  /** Logging options */
  logLevel?: LogLevel; // Log level (default: 'error')
  logger?: Logger; // Custom logger instance

  /** Advanced options */
  socketPath?: string; // Override socket path (auto-generated if not provided)

  /** @deprecated Use logLevel instead */
  debug?: boolean;
}

/**
 * Worker client interface for type-safe messaging
 */
export interface WorkerClient<
  TMessages extends Record<string, { payload: unknown; result?: unknown }>
> {
  /** Send a message and await response */
  send<K extends keyof TMessages>(
    type: K,
    payload: TMessages[K]['payload']
  ): Promise<TMessages[K] extends { result: infer R } ? R : void>;

  /** Close the worker gracefully */
  close(): Promise<void>;

  /**
   * Disconnect from worker but keep process alive (keep-alive mode only)
   */
  disconnect(): Promise<void>;

  /**
   * Reconnect to existing worker (keep-alive mode only)
   */
  reconnect(): Promise<void>;

  /** Process ID of the worker */
  pid: number;

  /** Whether the worker process is active */
  isActive: boolean;

  /** Whether connection to worker is active */
  isConnected: boolean;
}

// Pending requests map
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
}

/**
 * Create a worker process with type-safe messaging
 * @param options - Worker options
 * @returns Promise resolving to WorkerClient
 */
export async function createWorker<
  TMessages extends Record<string, { payload: unknown; result?: unknown }>
>(options: WorkerOptions<TMessages>): Promise<WorkerClient<TMessages>> {
  const {
    script,
    env = {},
    timeout,
    detached = false,
    spawnOptions = {},
    middleware = [],
    serializer = defaultSerializer,
    txIdGenerator,
    connection: connectionConfig = {},
    logLevel = 'error',
    logger: customLogger,
    socketPath: customSocketPath,
    debug = false,
  } = options;

  // Normalize timeout config into a lookup object
  const timeoutConfig = normalizeTimeoutConfig<TMessages>(timeout);

  // Default values for timeout resolution
  const timeoutDefaults = {
    WORKER_STARTUP: DEFAULT_STARTUP_TIMEOUT,
    SERVER_CONNECT: DEFAULT_SERVER_CONNECT_TIMEOUT,
    WORKER_MESSAGE: DEFAULT_MESSAGE_TIMEOUT,
  };

  // Helper to get timeout for a specific key
  const getTimeout = (key: BuiltInTimeoutKey | keyof TMessages): number =>
    getTimeoutValue(timeoutConfig, key, timeoutDefaults);

  const startupTimeout = getTimeout('WORKER_STARTUP');
  const serverConnectTimeout = getTimeout('SERVER_CONNECT');

  // Extract connection config
  const { attempts = 5, delay = 100, maxDelay = 5000 } = connectionConfig;

  // Create logger - if debug is true, use 'debug' level
  const effectiveLogLevel = debug ? 'debug' : logLevel;
  const workerLogger = createMetaLogger(customLogger, effectiveLogLevel);

  const socketPath = customSocketPath || generateSocketPath('worker');
  workerLogger.info('Creating worker', { script, socketPath });

  // Spawn the worker process
  const child = fork(script, [], {
    ...spawnOptions,
    env: {
      ...process.env,
      ...env,
      ISOLATED_WORKERS_SOCKET_PATH: socketPath,
      ISOLATED_WORKERS_SERVER_CONNECT_TIMEOUT: String(serverConnectTimeout),
      ISOLATED_WORKERS_DEBUG: debug ? 'true' : undefined,
      ISOLATED_WORKERS_SERIALIZER: serializer.constructor.name,
    },
    silent: false,
    detached,
  });

  if (!child.pid) {
    throw new Error('Failed to spawn worker: no process ID');
  }

  const workerPid = child.pid;
  workerLogger.debug('Worker spawned', { pid: workerPid });

  // If detached, unref the process so it doesn't block parent exit
  if (detached) {
    child.unref();
    workerLogger.debug(`Worker process ${child.pid} detached and unref'd`);
  }

  // Wait for socket to be ready with timeout
  let connection: Connection;
  try {
    connection = await createConnection<TMessages>({
      socketPath,
      timeout: startupTimeout,
      maxRetries: attempts,
      retryDelay: typeof delay === 'number' ? delay : 100,
      maxDelay,
      serializer,
      middleware,
      logger: workerLogger,
    });
    workerLogger.info('Connected to worker', { pid: workerPid });
  } catch (err) {
    workerLogger.error('Failed to connect to worker', {
      error: (err as Error).message,
    });
    child.kill();
    cleanupSocketPath(socketPath);
    throw err;
  }

  // Track pending requests
  const pendingRequests = new Map<string, PendingRequest>();
  let isActive = true;
  let isConnected = true;

  // Handle incoming messages
  connection.onMessage((message: TypedResult) => {
    const { tx } = message;
    const pending = pendingRequests.get(tx);

    if (!pending) {
      workerLogger.warn('Received message for unknown transaction', { tx });
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeoutId);
    pendingRequests.delete(tx);

    // Check if it's an error
    if (isErrorMessage(message)) {
      const error = deserializeError(message.payload);
      workerLogger.debug('Received error response', {
        tx,
        error: error.message,
      });
      pending.reject(error);
    } else {
      workerLogger.debug('Received success response', { tx });
      pending.resolve(message.payload);
    }
  });

  // Handle connection errors
  connection.onError((err: Error) => {
    workerLogger.error('Connection error', { error: err.message });

    // Reject all pending requests
    pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error(`Connection error: ${err.message}`));
    });
    pendingRequests.clear();
  });

  // Handle connection close
  connection.onClose(() => {
    workerLogger.info('Worker connection closed');
    isConnected = false;

    // Reject all pending requests
    pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Connection closed'));
    });
    pendingRequests.clear();
  });

  // Handle worker exit
  child.on('exit', (code, signal) => {
    workerLogger.info('Worker exited', { code, signal });
    isActive = false;
    isConnected = false;

    // Reject all pending requests
    pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error(`Worker exited with code ${code}`));
    });
    pendingRequests.clear();

    // Cleanup socket
    cleanupSocketPath(socketPath);
  });

  // TX ID generator (use provided or default, both work with the simplified createRequest signature)
  const effectiveTxIdGenerator = txIdGenerator ?? defaultTxIdGenerator;

  // Create worker client
  const client: WorkerClient<TMessages> = {
    pid: workerPid,

    get isActive() {
      return isActive && !child.killed;
    },

    get isConnected() {
      return isConnected && connection.isConnected;
    },

    async send<K extends keyof TMessages>(
      type: K,
      payload: TMessages[K]['payload']
    ): Promise<TMessages[K] extends { result: infer R } ? R : void> {
      if (!isActive) {
        throw new Error('Worker is not active');
      }
      if (!isConnected) {
        throw new Error('Worker is not connected');
      }

      const request = createRequest(
        type as string,
        payload,
        effectiveTxIdGenerator
      );

      // Get timeout for this specific message type, falling back to WORKER_MESSAGE default
      const messageTimeout = getTimeout(type);

      return new Promise((resolve, reject) => {
        // Set up timeout - this IS ref'd (keeps process alive intentionally)
        const timeoutId = setTimeout(() => {
          pendingRequests.delete(request.tx);
          reject(
            new Error(
              `Request timeout after ${messageTimeout}ms: ${String(type)}`
            )
          );
        }, messageTimeout);

        // Store pending request
        pendingRequests.set(request.tx, {
          resolve: resolve as (value: unknown) => void,
          reject,
          timeoutId,
        });

        // Send request
        connection.send(request).catch((err) => {
          clearTimeout(timeoutId);
          pendingRequests.delete(request.tx);
          reject(err);
        });
      });
    },

    async disconnect(): Promise<void> {
      if (!isConnected) {
        return;
      }

      workerLogger.info('Disconnecting from worker (keeping process alive)', {
        pid: workerPid,
      });

      // Clear pending requests
      pendingRequests.forEach((pending) => {
        clearTimeout(pending.timeoutId);
        pending.reject(new Error('Disconnected from worker'));
      });
      pendingRequests.clear();

      await connection.close();
      isConnected = false;
    },

    async reconnect(): Promise<void> {
      if (isConnected) {
        workerLogger.warn('Already connected to worker');
        return;
      }

      if (!isActive) {
        throw new Error('Cannot reconnect: worker process is not active');
      }

      workerLogger.info('Reconnecting to worker', { pid: workerPid });

      // Create new connection
      const newConnection = await createConnection({
        socketPath,
        timeout: startupTimeout,
        maxRetries: attempts,
        retryDelay: typeof delay === 'number' ? delay : 100,
        maxDelay,
        serializer,
        middleware,
        logger: workerLogger,
      });

      // Update connection reference (this is a bit hacky but works)
      Object.assign(connection, newConnection);
      isConnected = true;

      workerLogger.info('Reconnected to worker', { pid: workerPid });
    },

    async close(): Promise<void> {
      if (!isActive && child.killed) {
        return;
      }

      workerLogger.info('Shutting down worker', { pid: workerPid });

      // Clear all pending requests (clears setTimeout refs)
      pendingRequests.forEach((pending) => {
        clearTimeout(pending.timeoutId);
        pending.reject(new Error('Worker closed'));
      });
      pendingRequests.clear();

      // Close connection first
      await connection.close();
      isConnected = false;

      // Kill the process if still running
      if (!child.killed) {
        child.kill('SIGTERM');

        // Force kill after timeout
        await new Promise<void>((resolve) => {
          const timeoutId = setTimeout(() => {
            if (!child.killed) {
              workerLogger.warn('Force killing worker', { pid: workerPid });
              child.kill('SIGKILL');
            }
            resolve();
          }, 5000);

          child.once('exit', () => {
            clearTimeout(timeoutId);
            resolve();
          });
        });
      }

      // Cleanup socket
      cleanupSocketPath(socketPath);
      isActive = false;

      workerLogger.info('Worker shutdown complete', { pid: workerPid });
    },
  };

  return client;
}

/**
 * Shutdown a worker gracefully
 * @param worker - Worker client to shutdown
 */
export async function shutdownWorker<
  TMessages extends Record<string, { payload: unknown; result?: unknown }>
>(worker: WorkerClient<TMessages>): Promise<void> {
  await worker.close();
}
