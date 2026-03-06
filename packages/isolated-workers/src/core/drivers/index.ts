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
  type ChildProcessCapabilities,
  type DetachCapability,
  type Driver,
  type DriverCapabilities,
  type DriverChannel,
  type DriverConfig,
  type DriverMessage,
  type HttpCapabilities,
  type InferCapabilities,
  type ReconnectCapability,
  type ServerChannel,
  type ServerOptions,
  type StartupData,
  type WebWorkerCapabilities,
  type WorkerThreadsCapabilities,
} from '../driver.js';

// Child process driver
export {
  ChildProcessChannel,
  ChildProcessDriver,
  ChildProcessServerChannel,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
  encodeStartupData,
  STARTUP_DATA_ENV_KEY,
  type ChildProcessDriverOptions,
  type ChildProcessDriverType,
  type ResponseFunction as ChildProcessResponseFunction,
  type ChildProcessStartupData,
} from './child-process/index.js';

// Worker threads driver
export {
  STARTUP_DATA_WORKER_KEY,
  WorkerThreadsChannel,
  WorkerThreadsDriver,
  WorkerThreadsServerChannel,
  type WorkerThreadsDriverOptions,
  type WorkerThreadsDriverType,
  type ResponseFunction as WorkerThreadsResponseFunction,
  type WorkerThreadsStartupData,
} from './worker-threads/index.js';

// HTTP driver
export {
  HttpChannel,
  HttpDriver,
  HttpServerChannel,
  DEFAULT_SERVER_CONNECT_TIMEOUT as HTTP_DEFAULT_SERVER_CONNECT_TIMEOUT,
  encodeStartupData as httpEncodeStartupData,
  STARTUP_DATA_ENV_KEY as HTTP_STARTUP_DATA_ENV_KEY,
  type HttpDriverOptions,
  type HttpDriverType,
  type ResponseFunction as HttpResponseFunction,
  type HttpStartupData,
} from './http/index.js';

// Web Worker driver
export {
  WebWorkerChannel,
  WebWorkerDriver,
  WebWorkerServerChannel,
  type WebWorkerDriverOptions,
  type WebWorkerDriverType,
  type ResponseFunction as WebWorkerResponseFunction,
  type WebWorkerStartupData,
} from './web-worker/index.js';

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
