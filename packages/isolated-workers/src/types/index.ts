// DefineMessages system
export type {
  BaseMessage,
  DefineMessages,
  MessageDef,
  MessageDefs,
} from './messages.js';

// Type helpers
export type {
  AllMessages,
  AllResults,
  AnyMessage,
  Handlers,
  MaybePromise,
  MessageOf,
  MessageResult,
  Middleware,
  PayloadOf,
  ResultOf,
  ResultPayloadOf,
  TransactionIdGenerator,
  WithResult,
} from './helpers.js';

// Configuration types
export type {
  MessageType,
  ShutdownReason,
  UnexpectedShutdownStrategy,
  UnexpectedShutdownConfig,
} from './config.js';

// Error types
export { WorkerCrashedError } from './errors.js';
