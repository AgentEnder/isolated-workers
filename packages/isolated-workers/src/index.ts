/**
 * Isolated Workers - Type-safe worker process library
 *
 * @packageDocumentation
 */

// NOTE: THIS FILE IS THE PUBLIC API SURFACE OF THE PACKAGE
// AVOID ADDING NEW MODULES / EXPORTS HERE UNLESS THEY ARE
// STABLE AND PART OF THE PUBLIC API

// All types (legacy + DefineMessages system)
export * from './types/index.js';

// Core worker components
export {
  createWorker,
  startWorkerServer,
  type Connection,
  type ConnectionOptions,
  type MessageHandler,
  type TimeoutConfig,
  type WorkerClient,
  type WorkerHandler,
  type WorkerHandlers,
  type WorkerOptions,
  type WorkerServer,
  type WorkerServerOptions,
  type DriverOptionsFor,
  // Driver types
  type Driver,
  type DriverChannel,
  type DriverMessage,
  type DriverCapabilities,
  type ChildProcessCapabilities,
  type WorkerThreadsCapabilities,
  type ReconnectCapability,
  type DetachCapability,
} from './core/index.js';

// Utilities
export {
  defaultLogger,
  JsonSerializer,
  Serializer,
  type Logger,
  type LogLevel,
} from './utils/index.js';
