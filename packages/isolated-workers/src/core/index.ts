/**
 * Core worker components
 *
 * @packageDocumentation
 */

export {
  type MiddlewareDirection,
  type MiddlewareContext,
  type TypedMessage,
  type TypedResult,
  type MessageHandler,
  sendMessage,
  sendError,
  createMessageHandler,
  createRequest,
  createResponse,
  isResultMessage,
  isErrorMessage,
  defaultTxIdGenerator,
} from './messaging.js';

export {
  type ConnectionOptions,
  type Connection,
  createConnection,
} from './connection.js';

export {
  type BuiltInTimeoutKey,
  type TimeoutConfig,
  type WorkerOptions,
  type WorkerClient,
  type DriverOptionsFor,
  DEFAULT_STARTUP_TIMEOUT,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
  DEFAULT_MESSAGE_TIMEOUT,
  createWorker,
  shutdownWorker,
} from './worker.js';

export {
  type WorkerHandler,
  type WorkerHandlers,
  type WorkerServerOptions,
  type WorkerServer,
  startWorkerServer,
} from './worker-server.js';

// Driver types (re-exported from driver.ts)
export type {
  Driver,
  DriverChannel,
  DriverMessage,
  DriverCapabilities,
  ChildProcessCapabilities,
  WorkerThreadsCapabilities,
  ReconnectCapability,
  DetachCapability,
} from './driver.js';
