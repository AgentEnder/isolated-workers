// Legacy types
export type {
  WorkerMessage,
  WorkerResult,
  AnyMessage,
  AnyResult,
} from './messages.js';

// DefineMessages system
export type {
  BaseMessage,
  MessageDef,
  MessageDefs,
  DefineMessages,
} from './messages.js';

// Type helpers
export type {
  MaybePromise,
  WithResult,
  MessageOf,
  ResultOf,
  AllMessages,
  AllResults,
  MessageResult,
  Handlers,
  PayloadOf,
  ResultPayloadOf,
} from './helpers.js';
