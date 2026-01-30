/**
 * Fixture: Union narrowing with discriminated unions
 *
 * This file demonstrates how discriminated unions enable type narrowing
 * in switch statements and if conditions.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type {
  DefineMessages,
  MessageOf,
  ResultOf,
  AllMessages,
  AllResults,
} from 'isolated-workers';

// ============================================================================
// Message Definitions with Union Types
// ============================================================================

export type ServiceMessages = DefineMessages<{
  // Message with a discriminated union payload
  processEvent: {
    payload:
      | { type: 'user'; userId: string; action: 'login' | 'logout' }
      | { type: 'system'; event: 'startup' | 'shutdown' }
      | { type: 'error'; code: number; message: string };
    result: { handled: boolean };
  };

  // Message with different result types
  fetchData: {
    payload: { resource: string };
    result:
      | { status: 'success'; data: unknown }
      | { status: 'error'; error: string }
      | { status: 'pending' };
  };

  // Message with simple payload
  ping: {
    payload: { timestamp: number };
    result: { pong: number };
  };
}>;

// ============================================================================
// Extracted Types for Testing
// ============================================================================

export type ProcessEventMessage = MessageOf<ServiceMessages, 'processEvent'>;
export type FetchDataMessage = MessageOf<ServiceMessages, 'fetchData'>;
export type PingMessage = MessageOf<ServiceMessages, 'ping'>;

export type ProcessEventResult = ResultOf<ServiceMessages, 'processEvent'>;
export type FetchDataResult = ResultOf<ServiceMessages, 'fetchData'>;

export type AllServiceMessages = AllMessages<ServiceMessages>;
export type AllServiceResults = AllResults<ServiceMessages>;

// ============================================================================
// Handler with Type Narrowing
// ============================================================================

export function handleProcessEvent(
  message: ProcessEventMessage
): ProcessEventResult['payload'] {
  const { payload } = message;

  // Type narrowing with switch statement
  switch (payload.type) {
    case 'user': {
      // TypeScript knows payload is { type: 'user'; userId: string; action: ... }
      const userId: string = payload.userId;
      const action: 'login' | 'logout' = payload.action;
      void userId;
      void action;

      return {
        handled: true,
      };
    }

    case 'system': {
      // TypeScript knows payload is { type: 'system'; event: ... }
      const event: 'startup' | 'shutdown' = payload.event;
      void event;

      return {
        handled: true,
      };
    }

    case 'error': {
      // TypeScript knows payload is { type: 'error'; code: number; message: string }
      const code: number = payload.code;
      const message: string = payload.message;
      void code;
      void message;

      return {
        handled: true,
      };
    }

    default: {
      // Exhaustiveness check - TypeScript ensures all cases are handled
      const _exhaustive: never = payload;
      return { handled: false };
    }
  }
}

// ============================================================================
// Handler with If-Based Narrowing
// ============================================================================

export function handleFetchDataResult(
  result: FetchDataResult['payload']
): string {
  // Type narrowing with if statements
  if (result.status === 'success') {
    // TypeScript knows result is { status: 'success'; data: unknown }
    return `Success: ${JSON.stringify(result.data)}`;
  } else if (result.status === 'error') {
    // TypeScript knows result is { status: 'error'; error: string }
    return `Error: ${result.error}`;
  } else if (result.status === 'pending') {
    // TypeScript knows result is { status: 'pending' }
    return 'Pending...';
  }

  // Exhaustiveness check
  const _exhaustive: never = result;
  return 'Unknown';
}

// ============================================================================
// Message Discriminator Narrowing
// ============================================================================

export function handleAnyMessage(message: AllServiceMessages): string {
  // Narrowing by message type
  switch (message.type) {
    case 'processEvent': {
      // TypeScript knows message.payload is the union type
      return `Processing event: ${message.payload.type}`;
    }

    case 'fetchData': {
      // TypeScript knows message.payload is { resource: string }
      return `Fetching: ${message.payload.resource}`;
    }

    case 'ping': {
      // TypeScript knows message.payload is { timestamp: number }
      const timestamp: number = message.payload.timestamp;
      return `Ping at ${timestamp}`;
    }

    default: {
      const _exhaustive: never = message;
      return 'Unknown';
    }
  }
}

export function handleAnyResult(result: AllServiceResults): string {
  // Narrowing by result type pattern
  switch (result.type) {
    case 'processEventResult': {
      return `Event handled: ${result.payload.handled}`;
    }

    case 'fetchDataResult': {
      // result.payload is a union, need further narrowing
      const payload = result.payload;
      if (payload.status === 'success') {
        return 'Fetch succeeded';
      } else if (payload.status === 'error') {
        return `Fetch failed: ${payload.error}`;
      } else {
        return 'Fetch pending';
      }
    }

    case 'pingResult': {
      return `Pong: ${result.payload.pong}`;
    }

    default: {
      const _exhaustive: never = result;
      return 'Unknown result';
    }
  }
}

// ============================================================================
// Compile-time type checks
// ============================================================================

// Verify ProcessEventMessage has discriminated union in payload
type _ProcessEventPayload = ProcessEventMessage['payload'];
type _PayloadHasTypeField = _ProcessEventPayload extends { type: infer T }
  ? T extends 'user' | 'system' | 'error'
    ? true
    : never
  : never;
const _payloadHasTypeField: _PayloadHasTypeField = true;

// Verify narrowing works - after checking type, we should be able to access specific fields
type _UserPayload = Extract<_ProcessEventPayload, { type: 'user' }>;
type _UserHasUserId = _UserPayload extends { userId: string } ? true : never;
const _userHasUserId: _UserHasUserId = true;

type _SystemPayload = Extract<_ProcessEventPayload, { type: 'system' }>;
type _SystemHasEvent = _SystemPayload extends { event: infer E }
  ? E extends 'startup' | 'shutdown'
    ? true
    : never
  : never;
const _systemHasEvent: _SystemHasEvent = true;

type _ErrorPayload = Extract<_ProcessEventPayload, { type: 'error' }>;
type _ErrorHasCode = _ErrorPayload extends { code: number } ? true : never;
type _ErrorHasMessage = _ErrorPayload extends { message: string }
  ? true
  : never;
const _errorHasCode: _ErrorHasCode = true;
const _errorHasMessage: _ErrorHasMessage = true;

// Verify FetchDataResult payload is a union
type _FetchDataResultPayload = FetchDataResult['payload'];
type _ResultPayloadHasStatus = _FetchDataResultPayload extends {
  status: infer S;
}
  ? S extends 'success' | 'error' | 'pending'
    ? true
    : never
  : never;
const _resultPayloadHasStatus: _ResultPayloadHasStatus = true;

// Verify AllServiceMessages is a union of all message types
type _AllMessagesTypes = AllServiceMessages['type'];
type _AllMessagesHasAllTypes = _AllMessagesTypes extends
  | 'processEvent'
  | 'fetchData'
  | 'ping'
  ? 'processEvent' | 'fetchData' | 'ping' extends _AllMessagesTypes
    ? true
    : never
  : never;
const _allMessagesHasAllTypes: _AllMessagesHasAllTypes = true;
