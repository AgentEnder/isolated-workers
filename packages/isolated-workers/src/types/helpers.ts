/**
 * Type extraction helpers for message definitions
 *
 * These types extract specific message/result types from a DefineMessages declaration.
 *
 * @packageDocumentation
 */

import type { BaseMessage, MessageDefs } from './messages.js';

/**
 * Utility type for values that may be promises
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Extract keys that have a result defined.
 *
 * @category Types
 * @example
 * ```typescript
 * type Messages = DefineMessages<{
 *   load: { payload: {}; result: {} };  // Has result
 *   shutdown: { payload: {} };          // No result
 * }>;
 * type WithRes = WithResult<Messages>; // 'load'
 * ```
 */
export type WithResult<TDefs extends MessageDefs> = {
  [K in keyof TDefs]: TDefs[K] extends { result: unknown } ? K : never;
}[keyof TDefs];

/**
 * Extract the full message type for a given key.
 *
 * @example
 * ```typescript
 * type LoadMessage = MessageOf<MyMessages, 'load'>;
 * // { tx: string; type: 'load'; payload: { config: string } }
 * ```
 */
export type MessageOf<
  TDefs extends MessageDefs,
  K extends keyof TDefs
> = BaseMessage & {
  type: K;
  payload: TDefs[K]['payload'];
};

/**
 * Extract the full result type for a given key.
 *
 * @example
 * ```typescript
 * type LoadResult = ResultOf<MyMessages, 'load'>;
 * // { tx: string; type: 'loadResult'; payload: { loaded: true } }
 * ```
 */
export type ResultOf<
  TDefs extends MessageDefs,
  K extends WithResult<TDefs>
> = BaseMessage & {
  type: `${K & string}Result`;
  payload: TDefs[K] extends { result: unknown } ? TDefs[K]['result'] : never;
};

/**
 * Union of all message types in the definition.
 *
 * @example
 * ```typescript
 * type AllMsgs = AllMessages<MyMessages>;
 * // MessageOf<MyMessages, 'load'> | MessageOf<MyMessages, 'compute'> | ...
 * ```
 */
export type AllMessages<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: MessageOf<TDefs, K>;
}[keyof TDefs & string];

/**
 * Union of all result types in the definition.
 *
 * @example
 * ```typescript
 * type AllRes = AllResults<MyMessages>;
 * // ResultOf<MyMessages, 'load'> | ResultOf<MyMessages, 'compute'> | ...
 * ```
 */
export type AllResults<TDefs extends MessageDefs> = {
  [K in WithResult<TDefs> & string]: ResultOf<TDefs, K>;
}[WithResult<TDefs> & string];

/**
 * Map a message type to its corresponding result type.
 *
 * @example
 * ```typescript
 * type LoadResponse = MessageResult<'load', MyMessages>;
 * // ResultOf<MyMessages, 'load'>
 * ```
 */
export type MessageResult<
  TMessageType extends string,
  TDefs extends MessageDefs
> = TMessageType extends WithResult<TDefs>
  ? ResultOf<TDefs, TMessageType>
  : never;

/**
 * Handler function type for a message definition.
 *
 * Handlers receive the payload and return the result (or void if no result).
 *
 * @category Configuration
 * @example
 * ```typescript
 * const handlers: Handlers<MyMessages> = {
 *   load: async (payload) => ({ loaded: true }),
 *   shutdown: () => { console.log('bye'); }
 * };
 * ```
 */
export type Handlers<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: (
    payload: TDefs[K]['payload']
  ) => TDefs[K] extends { result: unknown }
    ? MaybePromise<TDefs[K]['result'] | void>
    : MaybePromise<void>;
};

/**
 * Extract the payload type for a given message key.
 */
export type PayloadOf<
  TDefs extends MessageDefs,
  K extends keyof TDefs
> = TDefs[K]['payload'];

/**
 * Extract the result type for a given message key.
 */
export type ResultPayloadOf<
  TDefs extends MessageDefs,
  K extends WithResult<TDefs>
> = TDefs[K] extends { result: unknown } ? TDefs[K]['result'] : never;

/**
 * Union of all message types (requests and responses).
 * Use this for middleware, transaction ID generators, and other
 * functions that handle any message type.
 *
 * @example
 * type MyMessages = DefineMessages<{
 *   load: { payload: { config: string }; result: { loaded: true } };
 * }>;
 *
 * function middleware(msg: AnyMessage<MyMessages>) {
 *   console.log('Handling:', msg.type);
 * }
 */
export type AnyMessage<TDefs extends MessageDefs> =
  | AllMessages<TDefs>
  | AllResults<TDefs>;

/**
 * Middleware function type for message inspection/transformation.
 * Applied sequentially in the order provided.
 *
 * Messages are sealed before being passed to middleware, so you can
 * modify existing properties but cannot add new ones.
 *
 * @category Configuration
 * @example
 * const logMiddleware: Middleware<MyMessages> = (msg, direction) => {
 *   console.log(`${direction}:`, msg.type);
 *   return msg;
 * };
 */
export type Middleware<TDefs extends MessageDefs = MessageDefs> = (
  message: AnyMessage<TDefs>,
  direction: 'incoming' | 'outgoing'
) => AnyMessage<TDefs> | void | Promise<AnyMessage<TDefs> | void>;

/**
 * Transaction ID generator function type.
 * Receives a message and returns a unique transaction ID string.
 *
 * @example
 * const customGen: TransactionIdGenerator<MyMessages> = (msg) => {
 *   return `${msg.type}-${Date.now()}`;
 * };
 */
export type TransactionIdGenerator<TDefs extends MessageDefs = MessageDefs> = (
  message: AnyMessage<TDefs>
) => string;
