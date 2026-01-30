# Message Definition System

## Status
**✅ Accepted**

## Context
Define how messages and their type relationships are declared in the library, ensuring maximum type safety with minimal boilerplate.

## Problem
Need a way to define message types that:
- Clearly expresses message payloads and optional results
- Provides type-safe request/response pairing
- Enables exhaustive handler coverage checking
- Is easy to use and understand
- Doesn't require external dependencies

## Alternatives Considered

### Option 1: Inline Discriminated Unions
```typescript
type Message =
  | { type: "load"; payload: { config: string } }
  | { type: "compute"; payload: { data: number } };

type Result =
  | { type: "loadResult"; payload: { loaded: boolean } }
  | { type: "computeResult"; payload: { value: number } };
```

**Pros:**
- Simple to understand
- No additional types

**Cons:**
- Message/result pairing not enforced at type level
- Boilerplate when adding new messages
- Hard to extract related types

### Option 2: Class-Based Messages
```typescript
class LoadMessage {
  type = "load" as const;
  constructor(public payload: { config: string }) {}
}
```

**Pros:**
- OOP familiar pattern
- Can add methods to messages

**Cons:**
- More verbose
- Doesn't work well with IPC (serialization)
- TypeScript classes don't serialize cleanly

### Option 3: DefineMessages Pattern (Selected)
```typescript
type MessageDefs = DefineMessages<{
  load: {
    payload: { config: string };
    result: { loaded: boolean };
  };
  compute: {
    payload: { data: number };
    result: { value: number };
  };
}>;
```

**Pros:**
- Clear relationship between messages and results
- Type helpers extract needed types automatically
- Handlers can be type-checked exhaustively
- Minimal boilerplate
- No runtime overhead (type-level only)

**Cons:**
- Requires understanding of TypeScript advanced types
- Initial learning curve

## Decision

Use the `DefineMessages<T>` pattern for defining message types, supported by a comprehensive set of type extraction helpers.

## Implementation

### Core Types

```typescript
// Base message type with transaction ID
interface BaseMessage {
  tx: string;
}

// Message definition constraint
type MessageDef = {
  payload: unknown;
  result?: unknown;
};

type MessageDefs = Record<string, MessageDef>;

// Type-level construct for defining message sets
type DefineMessages<TDefs extends MessageDefs> = TDefs;
```

### Type Extraction Helpers

```typescript
// Extract keys that have results defined
type WithResult<TDefs extends MessageDefs> = {
  [K in keyof TDefs]: TDefs[K] extends { result: unknown } ? K : never;
}[keyof TDefs];

// Extract the full message type for a given key
type MessageOf<TDefs extends MessageDefs, K extends keyof TDefs> = BaseMessage & {
  type: K;
  payload: TDefs[K]['payload'];
};

// Extract the full result type for a given key
type ResultOf<TDefs extends MessageDefs, K extends WithResult<TDefs>> = BaseMessage & {
  type: `${K & string}Result`;
  payload: TDefs[K]['result'];
};

// Union of all message types
type AllMessages<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: MessageOf<TDefs, K>;
}[keyof TDefs & string];

// Union of all result types
type AllResults<TDefs extends MessageDefs> = {
  [K in WithResult<TDefs> & string]: ResultOf<TDefs, K>;
}[WithResult<TDefs> & string];

// Maps a message type to its result type
type MessageResult<T extends AllMessages<TDefs>['type'], TDefs extends MessageDefs> = ResultOf<
  TDefs,
  T & WithResult<TDefs>
>;
```

### Handler Type

```typescript
// Handler map type - handlers return just the result payload directly
type Handlers<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: (
    payload: TDefs[K]['payload']
  ) => TDefs[K] extends { result: unknown }
    ? MaybePromise<TDefs[K]['result'] | void>
    : MaybePromise<void>;
};
```

### Usage Example

```typescript
// Define all messages in one place
type WorkerMessages = DefineMessages<{
  load: {
    payload: { config: string; name: string };
    result: { loaded: true; version: string };
  };
  compute: {
    payload: { data: number };
    result: { value: number };
  };
  shutdown: {
    payload: void;
  };
}>;

// Extract derived types
type WorkerMessage = AllMessages<WorkerMessages>;
type WorkerResult = AllResults<WorkerMessages>;
type AnyMessage = WorkerMessage | WorkerResult;

// Define handlers - return raw payloads
const handlers: Handlers<WorkerMessages> = {
  load: async (payload) => {
    // Process...
    return { loaded: true, version: '1.0.0' };
  },
  compute: (payload) => {
    return { value: payload.data * 2 };
  },
  shutdown: () => {
    // No response expected
    console.log('Shutting down...');
  }
};

// Infrastructure automatically wraps responses
// { type: 'loadResult', payload: { loaded: true, version: '1.0.0' }, tx: '...' }
```

## Benefits

1. **Type Safety**: Message/result pairing enforced at compile time
2. **Minimal Boilerplate**: Define once, extract everything needed
3. **Clear Contracts**: Message definitions are self-documenting
4. **Exhaustive Handlers**: TypeScript checks that all message types have handlers
5. **Zero Runtime Overhead**: Pure type-level constructs
6. **Easy to Test**: Type helpers can be tested independently

## Consequences

### Positive
- Excellent developer experience with full type inference
- Impossible to send wrong payload type
- Impossible to receive wrong result type
- Clear error messages when types don't match
- Easy to add new message types

### Neutral
- Requires TypeScript strict mode
- Users need to understand basic TypeScript generics

### Negative
- Initial learning curve for advanced TypeScript users
- Cannot easily express dynamic message types (rarely needed)

## Related Decisions
- Handler Payload Return Pattern - Handlers return raw payloads
- Type Extraction Helper Library - Core type helpers
- Zero `any` in Public API - Full type safety

## References
- Nx3 messaging.ts implementation
- TypeScript discriminated unions documentation
