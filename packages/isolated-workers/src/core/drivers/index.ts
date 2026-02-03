/**
 * Driver implementations and utilities
 *
 * This module exports driver implementations for different worker isolation
 * mechanisms (child process, worker threads) and the utilities for defining
 * custom drivers.
 *
 * @packageDocumentation
 */

// Re-export driver types and utilities from parent
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
 *
 * Useful for code that wants to delay loading driver dependencies
 * until they're actually needed.
 */
export async function loadDefaultDriver() {
  const { ChildProcessDriver } = await import('./child-process/index.js');
  return ChildProcessDriver;
}
