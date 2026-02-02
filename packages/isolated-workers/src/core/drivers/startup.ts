/**
 * Startup data utilities for worker detection
 *
 * This module provides utilities for passing configuration from the host process
 * to worker processes and for workers to detect which driver spawned them.
 *
 * @packageDocumentation
 */

/**
 * Startup data passed from host to worker.
 *
 * Contains configuration needed for the worker to establish communication
 * with the host process. The `driver` field identifies which driver spawned
 * the worker, allowing it to use the appropriate communication mechanism.
 */
export interface StartupData {
  /** Driver name that spawned this worker */
  driver: string;
  /** Socket path (child_process only) */
  socketPath?: string;
  /** Serializer name */
  serializer?: string;
  /** Server connect timeout in milliseconds */
  serverConnectTimeout?: number;
  /** Additional driver-specific data */
  [key: string]: unknown;
}

/** Environment variable key for startup data (used by child_process driver) */
export const STARTUP_DATA_ENV_KEY = 'ISOLATED_WORKERS_STARTUP_DATA';

/** workerData key for startup data (used by worker_threads driver) */
export const STARTUP_DATA_WORKER_KEY = '__isolatedWorkers';

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
export function getStartupData(): StartupData | null {
  // Try worker_threads first
  try {
    // Dynamic require to avoid bundling issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const wt = require('worker_threads');
    if (wt.parentPort && wt.workerData?.[STARTUP_DATA_WORKER_KEY]) {
      return wt.workerData[STARTUP_DATA_WORKER_KEY] as StartupData;
    }
  } catch {
    // Not in worker_threads context or module unavailable
  }

  // Try env var (child_process)
  const envData = process.env[STARTUP_DATA_ENV_KEY];
  if (envData) {
    try {
      return JSON.parse(envData) as StartupData;
    } catch {
      // Malformed JSON in env var
    }
  }

  return null;
}

/**
 * Encode startup data for passing to child_process via environment variable.
 *
 * @param data - The startup data to encode
 * @returns JSON string suitable for setting as an environment variable
 *
 * @example
 * ```typescript
 * const startupData: StartupData = {
 *   driver: 'child_process',
 *   socketPath: '/tmp/worker.sock',
 *   serializer: 'json',
 * };
 *
 * spawn(script, [], {
 *   env: {
 *     ...process.env,
 *     [STARTUP_DATA_ENV_KEY]: encodeStartupData(startupData),
 *   },
 * });
 * ```
 */
export function encodeStartupData(data: StartupData): string {
  return JSON.stringify(data);
}
