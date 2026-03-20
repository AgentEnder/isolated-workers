/**
 * Core worker components
 *
 * @packageDocumentation
 */

export {
  createMessageHandler,
  createRequest,
  createResponse,
  defaultTxIdGenerator,
  isErrorMessage,
  isResultMessage,
  type MessageHandler,
  type MiddlewareContext,
  type MiddlewareDirection,
  type TypedMessage,
  type TypedResult,
} from './messaging.js';

export {
  createWorker,
  DEFAULT_MESSAGE_TIMEOUT,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
  DEFAULT_STARTUP_TIMEOUT,
  shutdownWorker,
  type BuiltInTimeoutKey,
  type CapabilitiesOf,
  type DriverOptionsFor,
  type TimeoutConfig,
  type UnderlyingWorkerOf,
  type WorkerClient,
  type WorkerOptions,
} from './worker.js';

export {
  startWorkerServer,
  type ServerDriver,
  type WorkerHandler,
  type WorkerHandlers,
  type WorkerServer,
  type WorkerServerOptions,
} from './worker-server.js';

// Driver types (re-exported from driver.ts)
export type {
  ChildProcessCapabilities,
  Driver,
  DriverCapabilities,
  DriverMessage,
  WorkerHandle,
  WorkerThreadsCapabilities,
} from './driver.js';
export type {
  ChildProcessDriverOptions,
  ServerChannel,
  ServerOptions,
  WorkerThreadsDriverOptions,
} from './drivers/index.js';
