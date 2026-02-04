---
title: Quick Start
description: Create your first type-safe worker in under 5 minutes
nav:
  section: Getting Started
  order: 2
---

# Quick Start

Create your first type-safe worker in under 5 minutes.

## Step 1: Define Your Messages

The `DefineMessages` type creates a type-safe contract between your host and worker. This ensures that:

- Payload types match on both sides
- Result types are inferred correctly
- TypeScript catches mismatches at compile time
- All message types are properly documented

This is the foundation of isolated-workers' type safety system.

First, define the message contract between your host and worker:

```typescript
import { createWorker } from 'isolated-workers';

type WorkerMessages = DefineMessages<{
  add: {
    payload: { a: number; b: number };
    result: { sum: number };
  };
  log: {
    payload: { message: string };
  };
}>;
```

### Built-in Timeout Keys

isolated-workers provides three built-in timeout keys that can be configured when creating a worker:

- `WORKER_STARTUP`: Time to wait for worker process to start (default: 10 seconds)
- `SERVER_CONNECT`: Time for server to wait for host connection (default: 30 seconds)
- `WORKER_MESSAGE`: Default timeout for all messages (default: 5 minutes)

You can override these defaults or add per-message-type timeouts. See the [Timeout Configuration](/docs/guides/timeout-configuration) guide for details.

## Step 2: Create the Worker

Create a worker file that handles the messages:

```typescript
import { startWorkerServer } from 'isolated-workers';
import type { WorkerMessages } from './types';

const server = await startWorkerServer<WorkerMessages>({
  add: async ({ a, b }) => {
    // The result type is checked - returning invalid data will cause a type error
    return { sum: a + b };
  },
  log: async ({ message }) => {
    console.log('[Worker]', message);
    // No result needed for one-way messages
    // One-way message (still waits for acknowledgment from worker)
  },
});

console.log('Worker server started');
```

## Worker Server Options

The `startWorkerServer` function accepts an optional options object:

```typescript
import { startWorkerServer } from 'isolated-workers';

const server = await startWorkerServer(handlers, {
  logLevel: 'debug',        // Enable debug logging
  middleware: [...],           // Middleware pipeline for message processing
  serializer: customSerializer,  // Custom message serializer
  txIdGenerator: customGen,    // Custom transaction ID generator
});
```

**Available Options**:

- `logLevel`: 'debug' | 'info' | 'warn' | 'error' - Control logging verbosity
- `middleware`: Middleware[] - Array of middleware functions to process messages
- `serializer`: Serializer - Custom serializer for message serialization
- `txIdGenerator`: Function - Custom transaction ID generator

These options are optional. Most workers work fine with just the handlers argument.

## Step 3: Spawn the Worker

In your main process, create and communicate with the worker:

```typescript
import { createWorker } from 'isolated-workers';
import type { WorkerMessages } from './types';

// Spawn the worker process
const worker = await createWorker<WorkerMessages>({
  script: './worker.js',
});

// Send messages with full type safety
const result = await worker.send('add', { a: 5, b: 3 });
console.log(result.sum); // 8

// One-way message
await worker.send('log', { message: 'Hello from host!' });

// Clean up when done
await worker.close();
```

### Error Handling

Always handle errors when working with workers:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
});

try {
  const result = await worker.send('add', { a: 5, b: 3 });
  console.log(result.sum);
} catch (err) {
  // Handle worker errors (timeout, process crash, handler error)
  console.error('Worker error:', err.message);
} finally {
  // Always close the worker when done
  await worker.close();
}
```

## Graceful Shutdown

Always close workers when done to ensure clean shutdown:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
});

try {
  await doWork(worker);
} finally {
  // Always close to terminate worker process and clean up resources
  await worker.close();
}
```

The `close()` method:

- Rejects all pending requests
- Sends SIGTERM to worker process
- Waits up to 5 seconds for graceful exit
- Force-kills if needed
- Cleans up socket files

This prevents resource leaks and orphaned processes.

## That's It!

You now have a type-safe worker running in a separate process. The key benefits:

- Full type inference on both host and worker sides
- Autocomplete for payloads and results
- Compile-time type checking for all message contracts
- True process isolation

## Next Steps

Continue to [First Worker](/docs/getting-started/first-worker) for a more complete example, or explore the [Guides](/docs/guides) for advanced patterns.
