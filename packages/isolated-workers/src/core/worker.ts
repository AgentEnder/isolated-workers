/**
 * Worker spawner with lifecycle management
 *
 * @packageDocumentation
 */

import { type SpawnOptions } from 'child_process';
import type {
  MessageDefs,
  Middleware,
  TransactionIdGenerator,
} from '../types/index.js';
import {
  createMetaLogger,
  type Logger,
  type LogLevel,
} from '../utils/logger.js';
import {
  defaultSerializer,
  deserializeError,
  type Serializer,
} from '../utils/serializer.js';
import type {
  ChildProcessCapabilities,
  Driver,
  DriverCapabilities,
  DriverChannel,
  WorkerThreadsCapabilities,
} from './driver.js';
import type { ChildProcessDriverOptions } from './drivers/child-process/index.js';
import type { WorkerThreadsDriverOptions } from './drivers/worker-threads/index.js';
import { getTimeoutValue, normalizeTimeoutConfig } from './internals.js';
import {
  createRequest,
  defaultTxIdGenerator,
  isErrorMessage,
  TypedResult,
} from './messaging.js';

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
 * Driver-specific options mapping
 */
export type DriverOptionsFor<TDriver extends Driver> =
  TDriver extends Driver<ChildProcessCapabilities>
    ? ChildProcessDriverOptions
    : TDriver extends Driver<WorkerThreadsCapabilities>
    ? WorkerThreadsDriverOptions
    : Record<string, unknown>;

/**
 * Worker options for spawning
 *
 * @typeParam TDefs - Message definitions type
 * @typeParam TDriver - Driver type (defaults to child_process driver)
 */
export interface WorkerOptions<
  TDefs extends MessageDefs = MessageDefs,
  TDriver extends Driver = Driver<ChildProcessCapabilities>
> {
  /** Path to worker script */
  script: string;

  /**
   * Driver to use for spawning the worker.
   *
   * If not provided, the child_process driver is dynamically loaded.
   * Pass a driver instance for explicit control over the communication backend.
   *
   * @example
   * ```typescript
   * import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
   *
   * const worker = await createWorker({
   *   script: './worker.js',
   *   driver: new WorkerThreadsDriver(),
   * });
   * ```
   */
  driver?: TDriver;

  /**
   * Driver-specific options.
   *
   * These options are passed directly to the driver's spawn method.
   * Available options depend on the driver being used.
   */
  driverOptions?: Partial<DriverOptionsFor<TDriver>>;

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

  /**
   * Connection options (child_process driver only).
   * @deprecated Use driverOptions instead for driver-specific configuration.
   */
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
 * Base worker client interface for type-safe messaging.
 *
 * The availability of certain methods depends on the driver's capabilities:
 * - `disconnect()` / `reconnect()`: Only available with child_process driver
 * - `pid`: Returns number for child_process, undefined for worker_threads
 */
export interface WorkerClient<
  TMessages extends Record<
    string,
    { payload: unknown; result?: unknown }
  > = Record<string, { payload: unknown; result?: unknown }>,
  TCapabilities extends DriverCapabilities = DriverCapabilities
> {
  /** Send a message and await response */
  send<K extends keyof TMessages>(
    type: K,
    payload: TMessages[K]['payload']
  ): Promise<TMessages[K] extends { result: infer R } ? R : void>;

  /** Close the worker gracefully */
  close(): Promise<void>;

  /**
   * Disconnect from worker but keep process alive.
   * Only available when driver supports reconnect capability.
   */
  disconnect: TCapabilities['reconnect'] extends true
    ? () => Promise<void>
    : never;

  /**
   * Reconnect to existing worker.
   * Only available when driver supports reconnect capability.
   */
  reconnect: TCapabilities['reconnect'] extends true
    ? () => Promise<void>
    : never;

  /**
   * Process ID of the worker.
   * Returns undefined for worker_threads (they share the parent's PID).
   */
  pid: number | undefined;

  /** Whether the worker process is active */
  isActive: boolean;

  /** Whether connection to worker is active */
  isConnected: boolean;

  /** The driver capabilities for this worker */
  readonly capabilities: TCapabilities;
}

// Pending requests map
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
}

/**
 * Dynamically loads the default child_process driver.
 * This allows tree-shaking when using a different driver.
 */
async function loadDefaultDriver(): Promise<Driver<ChildProcessCapabilities>> {
  const { ChildProcessDriver } = await import('./drivers/child-process/index.js');
  return ChildProcessDriver as unknown as Driver<ChildProcessCapabilities>;
}

/**
 * Create a worker process with type-safe messaging.
 *
 * By default, uses the child_process driver which spawns a separate Node.js process
 * and communicates via Unix domain sockets (or named pipes on Windows).
 *
 * You can pass a different driver for alternative backends:
 * - `WorkerThreadsDriver`: Uses worker_threads with MessagePort (shared memory capable)
 *
 * @param options - Worker options including script path and optional driver
 * @returns Promise resolving to WorkerClient with type-safe messaging
 *
 * @example Default (child_process driver)
 * ```typescript
 * const worker = await createWorker<MyMessages>({
 *   script: './worker.js',
 * });
 * ```
 *
 * @example With worker_threads driver
 * ```typescript
 * import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
 *
 * const worker = await createWorker<MyMessages>({
 *   script: './worker.js',
 *   driver: new WorkerThreadsDriver(),
 * });
 * ```
 */
export async function createWorker<
  TMessages extends Record<string, { payload: unknown; result?: unknown }>,
  TDriver extends Driver = Driver<ChildProcessCapabilities>
>(
  options: WorkerOptions<TMessages, TDriver>
): Promise<
  WorkerClient<
    TMessages,
    TDriver extends Driver<infer C> ? C : DriverCapabilities
  >
> {
  const {
    script,
    driver: providedDriver,
    driverOptions = {},
    env = {},
    timeout,
    detached = false,
    spawnOptions = {},
    middleware: _middleware = [], // TODO: Apply middleware at messaging layer
    serializer = defaultSerializer,
    txIdGenerator,
    connection: connectionConfig = {},
    logLevel = 'error',
    logger: customLogger,
    socketPath: customSocketPath,
    debug = false,
  } = options;
  void _middleware; // Suppress unused warning - will be used when middleware layer is integrated

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

  // Create logger - if debug is true, use 'debug' level
  const effectiveLogLevel = debug ? 'debug' : logLevel;
  const workerLogger = createMetaLogger(customLogger, effectiveLogLevel);

  // Load driver: use provided driver or dynamically load child_process driver
  const driver = providedDriver ?? ((await loadDefaultDriver()) as TDriver);
  const capabilities = driver.capabilities;

  workerLogger.info('Creating worker', {
    script,
    driver: driver.name,
    capabilities,
  });

  // Build driver-specific options
  // For child_process driver, we need to merge legacy options
  const mergedDriverOptions = {
    ...driverOptions,
    serializer,
    logLevel: effectiveLogLevel,
    logger: workerLogger,
  } as Record<string, unknown>;

  // Handle legacy options for child_process driver
  if (driver.name === 'child_process') {
    const { attempts = 5, delay = 100, maxDelay = 5000 } = connectionConfig;
    Object.assign(mergedDriverOptions, {
      socketPath: customSocketPath,
      env,
      spawnOptions,
      detached,
      startupTimeout,
      serverConnectTimeout,
      connection: {
        maxRetries: attempts,
        retryDelay: typeof delay === 'number' ? delay : 100,
        maxDelay,
      },
    });
  }

  // Spawn the worker using the driver
  let channel: DriverChannel;
  try {
    channel = await driver.spawn(script, mergedDriverOptions);
    workerLogger.info('Worker channel established', { pid: channel.pid });
  } catch (err) {
    workerLogger.error('Failed to spawn worker', {
      error: (err as Error).message,
    });
    throw err;
  }

  // Track pending requests
  const pendingRequests = new Map<string, PendingRequest>();
  let isActive = true;
  let isConnected = channel.isConnected;

  // Handle incoming messages
  channel.onMessage((message) => {
    const typedMessage = message as TypedResult;
    const { tx } = typedMessage;
    const pending = pendingRequests.get(tx);

    if (!pending) {
      workerLogger.warn('Received message for unknown transaction', { tx });
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeoutId);
    pendingRequests.delete(tx);

    // Check if it's an error
    if (isErrorMessage(typedMessage)) {
      const error = deserializeError(typedMessage.payload);
      workerLogger.debug('Received error response', {
        tx,
        error: error.message,
      });
      pending.reject(error);
    } else {
      workerLogger.debug('Received success response', { tx });
      pending.resolve(typedMessage.payload);
    }
  });

  // Handle channel errors
  channel.onError((err: Error) => {
    workerLogger.error('Channel error', { error: err.message });

    // Reject all pending requests
    pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error(`Channel error: ${err.message}`));
    });
    pendingRequests.clear();
  });

  // Handle channel close
  channel.onClose(() => {
    workerLogger.info('Worker channel closed');
    isActive = false;
    isConnected = false;

    // Reject all pending requests
    pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Channel closed'));
    });
    pendingRequests.clear();
  });

  // TX ID generator (use provided or default)
  const effectiveTxIdGenerator = txIdGenerator ?? defaultTxIdGenerator;

  // Build the client object based on capabilities
  type ResultCapabilities = TDriver extends Driver<infer C>
    ? C
    : DriverCapabilities;

  const client = {
    pid: channel.pid,
    capabilities: capabilities as ResultCapabilities,

    get isActive() {
      return isActive && channel.isConnected;
    },

    get isConnected() {
      return isConnected && channel.isConnected;
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

        // Send request via driver channel
        channel.send(request).catch((err) => {
          clearTimeout(timeoutId);
          pendingRequests.delete(request.tx);
          reject(err);
        });
      });
    },

    async close(): Promise<void> {
      if (!isActive) {
        return;
      }

      workerLogger.info('Shutting down worker', { pid: channel.pid });

      // Clear all pending requests (clears setTimeout refs)
      pendingRequests.forEach((pending) => {
        clearTimeout(pending.timeoutId);
        pending.reject(new Error('Worker closed'));
      });
      pendingRequests.clear();

      // Close the channel (driver handles cleanup)
      await channel.close();
      isActive = false;
      isConnected = false;

      workerLogger.info('Worker shutdown complete', { pid: channel.pid });
    },

    // Reconnect capability (only for drivers that support it)
    disconnect: capabilities.reconnect
      ? async (): Promise<void> => {
          if (!isConnected) {
            return;
          }

          workerLogger.info(
            'Disconnecting from worker (keeping process alive)',
            {
              pid: channel.pid,
            }
          );

          // Clear pending requests
          pendingRequests.forEach((pending) => {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error('Disconnected from worker'));
          });
          pendingRequests.clear();

          // For reconnectable channels, we'd use the disconnect method
          // For now, just mark as disconnected
          isConnected = false;
        }
      : undefined,

    reconnect: capabilities.reconnect
      ? async (): Promise<void> => {
          if (isConnected) {
            workerLogger.warn('Already connected to worker');
            return;
          }

          if (!isActive) {
            throw new Error('Cannot reconnect: worker process is not active');
          }

          workerLogger.info('Reconnecting to worker', { pid: channel.pid });

          // For reconnectable channels, we'd use the reconnect method
          // This requires the channel to support reconnection
          isConnected = true;

          workerLogger.info('Reconnected to worker', { pid: channel.pid });
        }
      : undefined,
  } as WorkerClient<TMessages, ResultCapabilities>;

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
