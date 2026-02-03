/**
 * Core message type definitions
 *
 * @packageDocumentation
 */

// ============================================================================
// DefineMessages Type System
// ============================================================================

/**
 * Base message with transaction ID for request/response pairing
 */
export interface BaseMessage {
  /** Transaction ID */
  tx: string;
}

/**
 * Message definition shape - each message has a payload and optional result
 */
export interface MessageDef {
  /** Payload type for the message */
  payload: unknown;
  /** Optional result type (if message expects a response) */
  result?: unknown;
}

/**
 * Collection of message definitions
 */
export type MessageDefs = Record<string, MessageDef>;

/**
 * Type constructor for defining message sets.
 *
 * Use this to define your worker's message contract with full type safety.
 *
 * @category Types
 * @example
 * ```typescript
 * type MyMessages = DefineMessages<{
 *   load: { payload: { config: string }; result: { loaded: true } };
 *   compute: { payload: { data: number }; result: { value: number } };
 *   shutdown: { payload: void };
 * }>;
 * ```
 */
export type DefineMessages<TDefs extends MessageDefs> = TDefs;
