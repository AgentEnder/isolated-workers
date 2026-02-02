/**
 * Driver implementations and utilities
 *
 * @packageDocumentation
 */

// Startup data utilities
export {
  getStartupData,
  encodeStartupData,
  STARTUP_DATA_ENV_KEY,
  STARTUP_DATA_WORKER_KEY,
  type StartupData,
} from './startup.js';

// Re-export driver types from parent
export type {
  Driver,
  DriverChannel,
  DriverMessage,
  DriverCapabilities,
  ChildProcessCapabilities,
  WorkerThreadsCapabilities,
  ReconnectCapability,
  DetachCapability,
} from '../driver.js';

// Child process driver
export {
  ChildProcessDriver,
  ChildProcessChannel,
  childProcessDriver,
  type ChildProcessDriverOptions,
} from './child-process.js';

export {
  ChildProcessServer,
  createChildProcessServer,
  isChildProcessWorker,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
  type ChildProcessServerOptions,
  type ServerChannel,
  type ResponseFunction,
} from './child-process-server.js';

// Worker threads driver
export {
  WorkerThreadsDriver,
  WorkerThreadsChannel,
  workerThreadsDriver,
  isWorkerThreadsDriverAvailable,
  type WorkerThreadsDriverOptions,
  type WorkerThreadsResourceLimits,
} from './worker-threads.js';

export {
  WorkerThreadsServer,
  createWorkerThreadsServer,
  isWorkerThreadsWorker,
  getWorkerData,
  type WorkerThreadsServerOptions,
} from './worker-threads-server.js';

/**
 * Load the default driver (child_process) via dynamic import.
 *
 * This is the recommended way to get the default driver when
 * you want to minimize initial bundle size.
 *
 * @returns Promise resolving to the child_process driver instance
 */
export async function loadDefaultDriver(): Promise<
  import('./child-process.js').ChildProcessDriver
> {
  const { ChildProcessDriver } = await import('./child-process.js');
  return new ChildProcessDriver();
}
