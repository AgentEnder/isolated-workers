/**
 * Driver implementations and utilities
 *
 * @packageDocumentation
 */

// Re-export driver types from parent
export {
  defineWorkerDriver,
  type Driver,
  type DriverChannel,
  type DriverMessage,
  type DriverCapabilities,
  type ChildProcessCapabilities,
  type WorkerThreadsCapabilities,
  type ReconnectCapability,
  type DetachCapability,
  type ServerChannel,
  type ServerOptions,
  type StartupData,
  type InferCapabilities,
  type DriverConfig,
} from '../driver.js';

// Child process driver
export {
  ChildProcessDriver,
  ChildProcessChannel,
  ChildProcessServerChannel,
  STARTUP_DATA_ENV_KEY,
  encodeStartupData,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
  type ChildProcessDriverType,
  type ChildProcessDriverOptions,
  type ChildProcessStartupData,
  type ResponseFunction as ChildProcessResponseFunction,
} from './child-process/index.js';

// Worker threads driver
export {
  WorkerThreadsDriver,
  WorkerThreadsChannel,
  WorkerThreadsServerChannel,
  STARTUP_DATA_WORKER_KEY,
  type WorkerThreadsDriverType,
  type WorkerThreadsDriverOptions,
  type WorkerThreadsStartupData,
  type WorkerThreadsResourceLimits,
  type ResponseFunction as WorkerThreadsResponseFunction,
} from './worker-threads/index.js';

/**
 * Load the default driver (child_process) via dynamic import.
 */
export async function loadDefaultDriver() {
  const { ChildProcessDriver } = await import('./child-process/index.js');
  return ChildProcessDriver;
}

// =============================================================================
// Backward compatibility exports
// =============================================================================
// These functions provide the old API for code that hasn't migrated to the
// new driver-based architecture yet.

/**
 * Get startup data injected by the driver.
 *
 * This function checks for startup data in the following order:
 * 1. workerData (for worker_threads driver)
 * 2. Environment variable (for child_process driver)
 *
 * @returns StartupData if running in a worker context, null otherwise
 *
 * @example
 * ```typescript
 * const startup = getStartupData();
 * if (startup) {
 *   console.log(`Running under ${startup.driver} driver`);
 *   if (startup.socketPath) {
 *     console.log(`Connecting to socket: ${startup.socketPath}`);
 *   }
 * }
 * ```
 */
export function getStartupData(): import('../driver.js').StartupData | null {
  // Try worker_threads first
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const wt = require('worker_threads');
    const workerKey = '__isolatedWorkers';
    if (wt.parentPort && wt.workerData?.[workerKey]) {
      return wt.workerData[workerKey] as import('../driver.js').StartupData;
    }
  } catch {
    // Not in worker_threads context or module unavailable
  }

  // Try env var (child_process)
  const envKey = 'ISOLATED_WORKERS_STARTUP_DATA';
  const envData = process.env[envKey];
  if (envData) {
    try {
      return JSON.parse(envData) as import('../driver.js').StartupData;
    } catch {
      // Malformed JSON in env var
    }
  }

  return null;
}

/**
 * Check if the current process was spawned by a ChildProcessDriver.
 *
 * @returns True if running in a child process context
 */
export function isChildProcessWorker(): boolean {
  const startupData = getStartupData();
  return (
    startupData?.driver === 'child_process' ||
    process.env.ISOLATED_WORKERS_SOCKET_PATH !== undefined
  );
}

/**
 * Check if the current context is inside a worker thread.
 *
 * @returns True if running inside a worker_threads Worker
 */
export function isWorkerThreadsWorker(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const wt = require('worker_threads');
    if (!wt.parentPort) {
      return false;
    }

    // Check for startup data
    const startupData = getStartupData();
    if (startupData?.driver === 'worker_threads') {
      return true;
    }

    // Check if startup data is in workerData
    const workerKey = '__isolatedWorkers';
    if (wt.workerData?.[workerKey]) {
      return true;
    }

    // parentPort exists, so we're in a worker thread even without our startup data
    return true;
  } catch {
    return false;
  }
}

// Re-export response function type for backward compatibility
export type { ResponseFunction as ServerResponseFunction } from './child-process/index.js';

// =============================================================================
// Backward compatible server creation functions
// =============================================================================

import type { LogLevel, Logger } from '../../utils/logger.js';
import type { Serializer } from '../../utils/serializer.js';

/**
 * Options for creating a child process server (backward compatible)
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
 * Options for creating a worker threads server (backward compatible)
 */
export interface WorkerThreadsServerOptions {
  /** Custom serializer (must match host!) */
  serializer?: Serializer;
  /** Log level for server operations */
  logLevel?: LogLevel;
  /** Custom logger instance */
  logger?: Logger;
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
): Promise<import('./child-process/index.js').ChildProcessServerChannel> {
  const { createServer } = await import('./child-process/index.js');
  const { defaultSerializer } = await import('../../utils/serializer.js');
  const { createMetaLogger } = await import('../../utils/logger.js');

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
    hostConnectTimeout = startupData?.serverConnectTimeout as number | undefined;
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

  // Build startup data for the new API
  const resolvedStartupData: import('./child-process/index.js').ChildProcessStartupData =
    {
      driver: 'child_process',
      socketPath,
      serverConnectTimeout: hostConnectTimeout,
    };

  return createServer(resolvedStartupData, { serializer, logLevel, logger });
}

/**
 * Create a worker threads server for worker-side communication.
 *
 * This function uses parentPort from worker_threads to establish
 * communication with the host process.
 *
 * @param options - Server options
 * @returns WorkerThreadsServerChannel
 * @throws Error if not running inside a worker thread
 *
 * @example
 * ```typescript
 * const server = createWorkerThreadsServer();
 *
 * server.onMessage(async (message, respond) => {
 *   console.log('Received:', message);
 *   await respond({
 *     tx: message.tx,
 *     type: message.type,
 *     payload: { result: 'ok' },
 *   });
 * });
 *
 * server.start();
 * ```
 */
export function createWorkerThreadsServer(
  options: WorkerThreadsServerOptions = {}
): import('./worker-threads/index.js').WorkerThreadsServerChannel {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { createServer } =
    require('./worker-threads/index.js') as typeof import('./worker-threads/index.js');
  const { defaultSerializer } =
    require('../../utils/serializer.js') as typeof import('../../utils/serializer.js');
  const { createMetaLogger } =
    require('../../utils/logger.js') as typeof import('../../utils/logger.js');
  /* eslint-enable @typescript-eslint/no-require-imports */

  const { serializer = defaultSerializer, logLevel = 'error', logger: customLogger } =
    options;

  const logger = customLogger ?? createMetaLogger(undefined, logLevel);

  // Get startup data for worker threads
  const startupData = getStartupData();

  if (!startupData || startupData.driver !== 'worker_threads') {
    // Build minimal startup data
    const resolvedStartupData: import('./worker-threads/index.js').WorkerThreadsStartupData =
      {
        driver: 'worker_threads',
      };
    return createServer(resolvedStartupData, { serializer, logLevel, logger });
  }

  return createServer(
    startupData as import('./worker-threads/index.js').WorkerThreadsStartupData,
    { serializer, logLevel, logger }
  );
}
