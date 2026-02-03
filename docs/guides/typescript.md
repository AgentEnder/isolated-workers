---
title: TypeScript Deep Dive
description: Advanced TypeScript patterns and type extraction helpers
nav:
  section: Guides
  order: 6
---

# TypeScript Deep Dive

This guide explores advanced TypeScript patterns that power isolated-workers' type safety. Understanding these patterns will help you leverage full type inference and catch errors at compile time.

## The DefineMessages Pattern

At the heart of isolated-workers is the `DefineMessages` pattern - a type constructor that defines your message contracts between host and worker.

### Basic Structure

```typescript
import { DefineMessages } from 'isolated-workers';

type Messages = DefineMessages<{
  messageName: {
    payload: {
      /* data sent to worker */
    };
    result: {
      /* data returned from worker */
    };
  };
}>;
```

Each message definition consists of:

- **payload**: The data sent with the message (required)
- **result**: The data returned from the handler (optional)

### Messages With and Without Results

Messages that expect a response include a `result`:

```typescript
type Messages = DefineMessages<{
  // Request/response pattern - has result
  compute: {
    payload: { values: number[] };
    result: { sum: number };
  };

  // Fire-and-forget pattern - no result
  logEvent: {
    payload: { event: string; timestamp: number };
  };
}>;
```

### Void Payloads

For messages that need no input data, use `void` or `Record<string, never>`:

```typescript
type Messages = DefineMessages<{
  // Using void for no payload
  shutdown: {
    payload: void;
  };

  // Using empty record (recommended for clarity)
  getStatus: {
    payload: Record<string, never>;
    result: { uptime: number };
  };
}>;
```

The empty record pattern is clearer because it explicitly shows "this message takes no data" rather than "this message takes undefined".

## Type Inference

TypeScript automatically infers types throughout the system. Here's how it flows:

### From Message Definition to Handler

When you define handlers, TypeScript infers parameter and return types:

```typescript
import { Handlers } from 'isolated-workers';

type Messages = DefineMessages<{
  greet: {
    payload: { name: string };
    result: { greeting: string };
  };
}>;

const handlers: Handlers<Messages> = {
  // TypeScript knows:
  // - payload is { name: string }
  // - return must be { greeting: string }
  greet: (payload) => {
    return { greeting: `Hello, ${payload.name}!` };
  },
};
```

### From Message Definition to Worker Client

When sending messages from the host, types flow automatically:

```typescript
const worker = await createWorker<Messages>({
  workerPath: './worker.js',
});

// TypeScript knows:
// - First argument must match 'greet' | 'compute' | etc.
// - Second argument must match that message's payload
// - Return type is a Promise of that message's result
const result = await worker.send('greet', { name: 'World' });
// result is typed as { greeting: string }
```

## Type Extraction Helpers

The library provides several helper types for extracting specific parts of your message definitions.

### MessageOf<T, K>

Extracts the full message type for a given key, including `tx` and `type` fields:

```typescript
import { DefineMessages, MessageOf } from 'isolated-workers';

type Messages = DefineMessages<{
  load: { payload: { config: string }; result: { loaded: true } };
}>;

type LoadMessage = MessageOf<Messages, 'load'>;
// Equivalent to:
// {
//   tx: string;
//   type: 'load';
//   payload: { config: string };
// }
```

This is useful for middleware or custom message handling.

### ResultOf<T, K>

Extracts the full result type for a given key:

```typescript
type LoadResult = ResultOf<Messages, 'load'>;
// Equivalent to:
// {
//   tx: string;
//   type: 'loadResult';
//   payload: { loaded: true };
// }
```

Note how the type becomes `'loadResult'` - the library automatically appends "Result" to differentiate responses.

### WithResult<T>

Extracts keys that have a result defined (useful for conditional types):

```typescript
type Messages = DefineMessages<{
  load: { payload: {}; result: {} }; // Has result
  shutdown: { payload: {} }; // No result
}>;

type MessagesWithResult = WithResult<Messages>;
// Type is: 'load'
```

### AnyMessage<T>

Creates a union of all possible message types (requests and responses):

```typescript
type AllMessages = AnyMessage<Messages>;
// Union of all MessageOf<Messages, K> and ResultOf<Messages, K>
```

This is particularly useful for middleware that needs to handle any message:

```typescript
import { Middleware, AnyMessage } from 'isolated-workers';

const logger: Middleware<Messages> = (msg: AnyMessage<Messages>, direction) => {
  console.log(`[${direction}] ${msg.type}`);
  return msg;
};
```

### PayloadOf and ResultPayloadOf

Extract just the payload or result payload types without the wrapper:

```typescript
import { PayloadOf, ResultPayloadOf } from 'isolated-workers';

type LoadPayload = PayloadOf<Messages, 'load'>;
// { config: string }

type LoadResultPayload = ResultPayloadOf<Messages, 'load'>;
// { loaded: true }
```

## The Handlers Type

The `Handlers<T>` type enforces that you implement handlers for every message in your definition:

```typescript
import { Handlers } from 'isolated-workers';

type Messages = DefineMessages<{
  ping: { payload: { message: string }; result: { message: string } };
  shutdown: { payload: void };
}>;

// TypeScript ensures all handlers are present and correctly typed
const handlers: Handlers<Messages> = {
  ping: (payload) => {
    // payload is { message: string }
    return { message: 'pong' }; // Must return { message: string }
  },

  shutdown: () => {
    // payload is void, return is void
    console.log('Shutting down...');
  },
};
```

### Handler Return Types

Handlers support both synchronous and asynchronous returns:

```typescript
const handlers: Handlers<Messages> = {
  // Sync handler
  ping: (payload) => ({ message: 'pong' }),

  // Async handler
  compute: async (payload) => {
    const result = await heavyComputation(payload.values);
    return { sum: result };
  },
};
```

The `MaybePromise<T>` utility type handles this automatically.

### Missing Handler Detection

If you forget a handler, TypeScript catches it:

```typescript
const handlers: Handlers<Messages> = {
  ping: (payload) => ({ message: 'pong' }),
  // Error: Property 'shutdown' is missing in type...
};
```

### Incorrect Return Type Detection

Wrong return types are caught at compile time:

```typescript
const handlers: Handlers<Messages> = {
  ping: (payload) => {
    return { msg: 'pong' }; // Error: 'msg' does not exist, expected 'message'
  },
  shutdown: () => {},
};
```

## Strict Mode Benefits

We strongly recommend enabling TypeScript strict mode for isolated-workers projects:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### strictNullChecks

Catches potential null/undefined errors in payloads:

```typescript
type Messages = DefineMessages<{
  process: {
    payload: { value: number | null };
    result: { doubled: number };
  };
}>;

const handlers: Handlers<Messages> = {
  process: (payload) => {
    // Error: Object is possibly 'null'
    return { doubled: payload.value * 2 };

    // Correct:
    if (payload.value === null) {
      return { doubled: 0 };
    }
    return { doubled: payload.value * 2 };
  },
};
```

### noImplicitAny

Ensures all types are explicitly defined:

```typescript
// Without noImplicitAny, this would silently be 'any'
const handlers: Handlers<Messages> = {
  ping: (payload) => {
    // payload is properly typed, not 'any'
    return { message: payload.message.toUpperCase() };
  },
};
```

## Common Type Patterns

### Discriminated Unions

For messages with multiple variants, use discriminated unions:

```typescript
type Result =
  | { success: true; data: string }
  | { success: false; error: string };

type Messages = DefineMessages<{
  fetch: {
    payload: { url: string };
    result: Result;
  };
}>;

const handlers: Handlers<Messages> = {
  fetch: async (payload) => {
    try {
      const data = await fetchData(payload.url);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
};
```

### Generic Patterns

You can build generic message sets:

```typescript
type CRUDMessages<T> = DefineMessages<{
  create: { payload: Omit<T, 'id'>; result: T };
  read: { payload: { id: string }; result: T | null };
  update: { payload: T; result: T };
  delete: { payload: { id: string }; result: { deleted: boolean } };
}>;

interface User {
  id: string;
  name: string;
  email: string;
}

type UserMessages = CRUDMessages<User>;
```

### Complex Nested Payloads

For complex data, define types separately for clarity:

```typescript
interface ImageOptions {
  grayscale: boolean;
  quality: number;
}

interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

type Messages = DefineMessages<{
  processImage: {
    payload: {
      imagePath: string;
      options: ImageOptions;
    };
    result: ImageMetadata;
  };
}>;
```

### Optional Fields in Payloads

Use TypeScript's optional syntax for optional fields:

```typescript
type Messages = DefineMessages<{
  query: {
    payload: {
      search: string;
      limit?: number; // Optional
      offset?: number; // Optional
    };
    result: { items: string[] };
  };
}>;
```

## Middleware Types

For type-safe middleware, use the `Middleware<T>` and `TransactionIdGenerator<T>` types:

```typescript
import {
  Middleware,
  TransactionIdGenerator,
  AnyMessage,
} from 'isolated-workers';

// Type-safe middleware
const logMiddleware: Middleware<Messages> = (message, direction) => {
  console.log(`[${direction}] ${message.type}`);
  return message;
};

// Custom transaction ID generator
const customTxGen: TransactionIdGenerator<Messages> = (message) => {
  return `${message.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};
```

## See Also

- [Middleware](/docs/guides/middleware) - Using middleware for message inspection
- [Error Handling](/docs/guides/error-handling) - Type-safe error propagation
- {% example-link basic-ping %} - Simple typed message example
- {% example-link image-processing %} - Complex payload example
