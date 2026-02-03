---
title: Core Concepts
description: Understanding the architecture and mental model of isolated-workers
nav:
  section: Concepts
  order: 0
---

# Core Concepts

This guide explains the fundamental concepts and architecture of isolated-workers. Understanding these concepts will help you design effective worker-based systems and troubleshoot issues when they arise.

## What is isolated-workers?

isolated-workers is a type-safe library for spawning and managing worker processes in Node.js. It provides a clean abstraction for running code in separate processes while maintaining full TypeScript type safety for the messages exchanged between them.

The library extracts proven patterns from Nx's isolated plugin architecture, bringing battle-tested solutions for:

- **Process Isolation**: Run untrusted or resource-intensive code in separate processes
- **Type-Safe IPC**: Full TypeScript inference for messages crossing process boundaries
- **Lifecycle Management**: Spawn, connect, monitor, and gracefully shutdown workers
- **Cross-Platform Support**: Works on Unix (domain sockets) and Windows (named pipes)

## The Worker Pattern

### Host and Worker Architecture

isolated-workers uses a host/worker architecture where two Node.js processes communicate over a socket connection:

```
┌─────────────────────┐          ┌─────────────────────┐
│                     │          │                     │
│        HOST         │  socket  │       WORKER        │
│    (main process)   │◄────────►│   (child process)   │
│                     │          │                     │
└─────────────────────┘          └─────────────────────┘
```

**Host Process**: Your main application that spawns and controls workers. The host sends requests and receives results.

**Worker Process**: A separate Node.js process that handles requests independently. Workers have their own memory space, event loop, and can crash without affecting the host.

### Why Process Isolation Matters

Process isolation provides several important benefits:

1. **Fault Isolation**: If a worker crashes due to unhandled exceptions or out-of-memory errors, the host process continues running. You can restart workers as needed.

2. **Resource Isolation**: Workers have their own memory heap. Memory-intensive operations in a worker do not affect the host's memory usage or garbage collection.

3. **Security Boundaries**: Workers run in separate processes with their own context. This provides a natural boundary for running less-trusted code.

4. **Parallel Execution**: Unlike Node.js worker threads, separate processes can fully utilize multiple CPU cores for CPU-bound work without sharing the event loop.

5. **Clean State**: Each worker starts fresh. There is no shared mutable state between workers, eliminating entire categories of concurrency bugs.

## How IPC Works

### Communication Channels

isolated-workers uses OS-native communication primitives for inter-process communication (IPC):

**On Unix-like Systems (Linux, macOS)**:

- Uses Unix domain sockets
- Socket file created in the filesystem (typically in `/tmp`)
- Provides bidirectional, stream-based communication
- Highest performance for local IPC

**On Windows**:

- Uses named pipes (`\\.\pipe\...`)
- Native Windows IPC mechanism
- Same bidirectional semantics as Unix sockets

The library automatically detects the platform and uses the appropriate mechanism. Your code remains unchanged across platforms.

### Message Serialization

Messages between host and worker must be serialized since they cross process boundaries. By default, isolated-workers uses JSON serialization, which handles:

- Primitive types (strings, numbers, booleans, null)
- Arrays and plain objects
- Nested structures

Messages are delimited with a terminator character (default: '\n') for streaming.

For special requirements, you can provide custom serializers that support binary formats, compression, or encryption.

**Error Serialization**: Errors receive special handling. When an error is thrown in a worker, isolated-workers serializes the error message, name, stack trace, and common properties like `code`. The error is then reconstructed on the host side, preserving debugging information.

### Transaction IDs

Every request/response pair is linked by a transaction ID. This enables:

- **Multiple In-Flight Requests**: Send several requests to a worker without waiting for each response
- **Response Correlation**: The host matches each response to its original request
- **Timeout Tracking**: Each transaction can have its own timeout

When you call a method on a worker, the library generates a unique transaction ID (using `crypto.randomUUID()`), attaches it to the message, and stores a promise resolver. When the worker responds with the same transaction ID, the promise resolves.

## Type-Safe Messaging

### The DefineMessages Pattern

The core of isolated-workers' type safety is the `DefineMessages` pattern. Instead of defining messages as loose types, you define them in a single structured definition:

```
DefineMessages<{
  [messageType]: {
    payload: [what you send];
    result?: [what you receive back];
  };
}>
```

This pattern provides:

- **Compile-Time Checking**: TypeScript verifies that you send the correct payload type and expect the correct result type
- **Exhaustive Handlers**: The worker must implement a handler for every message type
- **Automatic Inference**: The library infers types throughout - no manual type annotations needed

### Message and Result Types

Each message type can have:

- **payload**: The data sent with the message (required)
- **result**: The data returned in response (optional)

Messages without a `result` are "fire-and-forget" - the host sends them but does not wait for or expect a response. Messages with a `result` are request/response pairs where the host awaits a typed response.

### Type Extraction Helpers

The library provides helper types to extract specific parts of your message definitions:

- **MessageOf**: Extract the full message type for a specific message name
- **ResultOf**: Extract the result type for a specific message name
- **WithResult**: Filter to only message types that have results
- **AllMessages**: Union of all message types
- **AllResults**: Union of all result types

These helpers are used internally and are also available for advanced use cases where you need to reference specific message types.

### PayloadOf and ResultPayloadOf

Extract just the payload or result payload types without the wrapper:

```typescript
import { PayloadOf, ResultPayloadOf } from 'isolated-workers';

type LoadPayload = PayloadOf<Messages, 'load'>;
// { config: string }

type LoadResultPayload = ResultPayloadOf<Messages, 'load'>;
// { loaded: true }
```

### MessageResult

Map a message type to its corresponding result type:

```typescript
import { MessageResult } from 'isolated-workers';

type LoadResultType = MessageResult<Messages, 'load'>;
// { type: 'loadResult', tx: string, payload: { loaded: true } }
```

### Middleware Type

Middleware function type for intercepting messages:

```typescript
import { Middleware } from 'isolated-workers';

const logger: Middleware<Messages> = (message, direction) => {
  console.log(`[${direction}] ${message.type}`);
  return message;
};
```

### TransactionIdGenerator Type

Type for custom transaction ID generation:

```typescript
import { TransactionIdGenerator } from 'isolated-workers';

const customTxGen: TransactionIdGenerator<Messages> = (message) => {
  return `${message.type}-${Date.now()}-${Math.random()}`;
};
```

## Request/Response Flow

Here is how a typical request flows through the system:

```
HOST                                          WORKER
────                                          ──────
  │                                              │
  │  1. Call worker.send('compute', data)        │
  │                                              │
  │  2. Generate transaction ID (tx: "abc123")   │
  │                                              │
  │  3. Create pending promise for tx            │
  │                                              │
  │  4. Serialize message                        │
  │     { type: 'compute',                       │
  │       payload: data,                         │
  │       tx: 'abc123' }                         │
  │                                              │
  │  5. Send over socket ──────────────────────► │
  │                                              │
  │                        6. Deserialize message│
  │                                              │
  │                        7. Lookup handler for │
  │                           type 'compute'     │
  │                                              │
  │                        8. Execute handler    │
  │                           with payload       │
  │                                              │
  │                        9. Handler returns    │
  │                           result payload     │
  │                                              │
  │                       10. Wrap result:       │
  │                           { type: 'computeResult',
  │                             payload: result, │
  │                             tx: 'abc123' }   │
  │                                              │
  │ ◄──────────────────── 11. Send over socket   │
  │                                              │
  │ 12. Deserialize message                      │
  │                                              │
  │ 13. Match tx to pending promise              │
  │                                              │
  │ 14. Resolve promise with result              │
  │                                              │
  │ 15. Return result to caller                  │
  │                                              │
  ▼                                              ▼
```

### Timeout Handling

Each pending transaction has an associated timeout. If the worker does not respond within the timeout period:

1. The pending promise is rejected with a timeout error
2. The transaction is removed from the pending map
3. The worker continues running (it may still process the request)

This prevents indefinite hangs when workers become unresponsive.

The default timeout is 5 minutes.

## Server-Side Startup Data

When a worker starts, it can receive startup data from the host to initialize its state. This is useful for passing configuration, database connections, or other initialization data:

```typescript
// Host side
const worker = await createWorker<Messages>({
  script: './worker.js',
  startupData: {
    config: { apiEndpoint: 'https://api.example.com' },
    dbConnectionString: 'postgresql://localhost/mydb',
  },
});
```

```typescript
// Worker side
import { startWorkerServer } from 'isolated-workers';

// Access startup data via getStartupData()
const startupData = getStartupData<{ config: { apiEndpoint: string } }>();

console.log('Starting with config:', startupData.config.apiEndpoint);

startWorkerServer<Messages>({
  handlers: {
    fetchData: async () => {
      // Use configuration from startup data
      const response = await fetch(startupData.config.apiEndpoint);
      return response.json();
    },
  },
});
```

**Key points about startup data**:

- Sent during the initial handshake, before any messages
- Available immediately when the worker server starts
- Serialized and deserialized like regular messages
- Useful for one-time initialization that doesn't need to be in every message

## Key Terminology

### Host

The main Node.js process that spawns and manages workers. The host sends requests to workers and receives results.

### Worker

A child Node.js process spawned by the host. Workers register handlers for message types and process incoming requests independently.

### Handler

A function in the worker that processes a specific message type. Handlers receive the message payload and return a result payload (or nothing for fire-and-forget messages).

### Payload

The data portion of a message. Request payloads are sent from host to worker; result payloads are returned from worker to host.

### Result

The response data returned by a handler. Results are automatically wrapped in a result message and sent back to the host.

### Transaction ID (tx)

A unique identifier linking a request to its response. Generated for each send operation and included in both the request and response messages.

### Message Type

The string identifier for a category of messages (e.g., 'compute', 'load', 'shutdown'). Each message type has a corresponding handler in the worker.

### Socket

The communication channel between host and worker. Uses Unix domain sockets on Unix-like systems and named pipes on Windows.

### Middleware

An optional function that can intercept and transform messages in either direction (sending or receiving). Useful for logging, validation, or adding metadata.

### Serializer

The component responsible for converting messages to a transmittable format (and back). Default is JSON, but can be customized for binary formats or compression.

### Lifecycle

The stages a worker goes through: spawn (create process), connect (establish socket), message (exchange data), and shutdown (cleanup and exit).

## Next Steps

Now that you understand the core concepts, explore:

- [Why isolated-workers?](/docs/concepts/why-isolated-workers) - When and why to use this library
- [Getting Started](/docs/getting-started) - Create your first worker
- [Guides](/docs/guides) - Deep dives into specific topics
- [Examples](/examples) - Working code examples
