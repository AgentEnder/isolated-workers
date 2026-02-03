---
title: Why isolated-workers?
description: When and why to use isolated-workers over alternatives
nav:
  section: Concepts
  order: 1
---

# Why isolated-workers?

Node.js runs JavaScript in a single-threaded event loop. While this model works well for I/O-bound operations, CPU-intensive tasks can block of event loop and degrade the responsiveness of your application.

## The Problem

Consider a web server that needs to parse large JSON files, compress images, or run complex calculations. While these operations run, the server cannot:

- Accept new connections
- Process other requests
- Respond to health checks

```typescript
// This blocks the event loop for all other operations
app.post('/process', (req, res) => {
  const result = expensiveComputation(req.body); // Blocks everything
  res.json(result);
});
```

The standard solution is to move CPU-intensive work to a separate process. Node.js provides two built-in options: `worker_threads` and `child_process`. Both work, but require significant boilerplate for production use.

## Why Not worker_threads?

Node's `worker_threads` module provides true multi-threading with shared memory support. However, using it effectively requires substantial manual work.

### No Type Safety

Communication uses `postMessage()` with no type checking:

```typescript
// host.ts
worker.postMessage({ typ: 'process', data: input }); // Typo goes unnoticed

// worker.ts
parentPort.on('message', (msg) => {
  // msg is `any` - no autocomplete, no type errors
  if (msg.type === 'process') {
    // ...
  }
});
```

### Manual Message Correlation

If you send multiple requests, you need to track which response belongs to which request:

```typescript
// You have to build this yourself
const pending = new Map<string, { resolve; reject }>();

worker.on('message', (msg) => {
  const handler = pending.get(msg.id);
  if (handler) {
    pending.delete(msg.id);
    handler.resolve(msg.result);
  }
});

function sendRequest(data) {
  const id = generateId();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, ...data });
  });
}
```

### No Timeout Handling

Long-running operations can hang forever without manual timeout implementation:

```typescript
// You need to add timeout logic yourself
function sendRequest(data, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Request timed out'));
    }, timeoutMs);

    pending.set(id, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject,
    });
    worker.postMessage({ id, ...data });
  });
}
```

## Why Not child_process?

The `child_process` module spawns separate Node.js processes. It provides better isolation than worker_threads but has similar limitations.

### Lower-Level API

`child_process` provides raw stdio streams or basic IPC, requiring you to build messaging infrastructure:

```typescript
const child = fork('./worker.js');

// Basic IPC - same problems as worker_threads
child.send({ type: 'process', data: input });
child.on('message', (msg) => {
  // Still untyped, still need manual correlation
});
```

### No Structured Messaging

You get raw message passing without any structure for request/response patterns, error propagation, or lifecycle management.

## What isolated-workers Provides

isolated-workers builds on these primitives to provide a complete, type-safe worker management solution.

### End-to-End Type Safety

Define your messages once and get full TypeScript inference everywhere:

```typescript
// messages.ts
import type { DefineMessages } from 'isolated-workers';

export type Messages = DefineMessages<{
  process: {
    payload: { data: string };
    result: { result: number };
  };
}>;
```

Both host and worker get autocomplete and type checking:

```typescript
// host.ts - TypeScript knows the response type
const response = await worker.sendRequest({
  type: 'process',
  data: 'input',
});
console.log(response.result); // Typed as number

// worker.ts - Handler must return the correct type
import { startWorkerServer, Handlers } from 'isolated-workers';
import type { Messages } from './messages.js';

const handlers: Handlers<Messages> = {
  process: async ({ data }) => {
    // data is typed as string
    return { result: data.length };
  },
};

await startWorkerServer(handlers);
```

### Automatic Request/Response Correlation

Every request is automatically tracked with a transaction ID. The infrastructure handles matching responses to requests:

```typescript
// Send multiple concurrent requests - they're automatically correlated
const [a, b, c] = await Promise.all([
  worker.sendRequest({ type: 'process', data: 'first' }),
  worker.sendRequest({ type: 'process', data: 'second' }),
  worker.sendRequest({ type: 'process', data: 'third' }),
]);
```

### Timeout Handling

Configure timeouts at the worker level or per message type:

```typescript
const worker = await createWorker({
  workerPath: './worker.js',
  timeouts: {
    default: 30_000, // 30 seconds default
    startup: 5_000, // 5 seconds to start
    perMessage: {
      heavyComputation: 300_000, // 5 minutes for specific operations
    },
  },
});
```

Timeouts trigger automatic cleanup and clear error messages.

### Middleware Support

Add cross-cutting concerns like logging, validation, or timing without modifying handlers:

```typescript
createWorkerHost({
  messages,
  middleware: [
    // Log all messages
    async (msg, next) => {
      console.log('Received:', msg.type);
      const result = await next(msg);
      console.log('Completed:', msg.type);
      return result;
    },
    // Add timing
    async (msg, next) => {
      const start = Date.now();
      const result = await next(msg);
      console.log(`${msg.type} took ${Date.now() - start}ms`);
      return result;
    },
  ],
  handlers: {
    /* ... */
  },
});
```

### Cross-Platform Socket Management

isolated-workers automatically uses the best IPC mechanism for your platform:

- Unix domain sockets on Linux/macOS
- Named pipes on Windows

Socket lifecycle, cleanup, and reconnection are handled automatically.

## When to Use isolated-workers

isolated-workers is a good fit when you need:

### CPU-Intensive Tasks

Offload heavy computation without blocking your main process:

- Image processing and resizing
- PDF generation
- Data transformation and parsing
- Cryptographic operations

### Plugin Systems

Run third-party code in isolated processes:

- Build tool plugins (like Nx's isolated plugins)
- User-provided transformations
- Extensible processing pipelines

### Sandboxed Code Execution

Execute potentially risky code with process-level isolation:

- User-submitted code evaluation
- Template rendering
- Script execution

### Long-Running Background Jobs

Manage persistent worker processes for ongoing tasks:

- Queue processors
- File watchers
- Background sync operations

## When NOT to Use isolated-workers

isolated-workers adds overhead that may not be justified in all scenarios.

### Simple Async Operations

If your work is I/O-bound (network requests, database queries, file reads), use Promises directly. Process spawning overhead provides no benefit:

```typescript
// Just use async/await - no worker needed
const data = await fetch(url);
const result = await db.query(sql);
```

### Shared Memory Requirements

If you need to share large buffers between threads without copying, use `worker_threads` with `SharedArrayBuffer`:

```typescript
// When you need zero-copy shared memory
const buffer = new SharedArrayBuffer(1024 * 1024);
const worker = new Worker('./worker.js', { workerData: { buffer } });
```

isolated-workers communicates via message passing, which involves serialization.

### Very High-Frequency Messaging

If you're sending thousands of small messages per second, the serialization and IPC overhead may be significant. Consider:

- Batching messages to reduce round trips
- Using worker_threads with SharedArrayBuffer for high-frequency data sharing
- Keeping high-frequency work in the main thread if it's fast enough

## Trade-offs Summary

| Aspect              | worker_threads          | child_process | isolated-workers |
| ------------------- | ----------------------- | ------------- | ---------------- |
| Type safety         | Manual                  | Manual        | Built-in         |
| Message correlation | Manual                  | Manual        | Automatic        |
| Timeouts            | Manual                  | Manual        | Built-in         |
| Shared memory       | Yes (SharedArrayBuffer) | No            | No               |
| Process isolation   | Same process            | Full          | Full             |
| Setup complexity    | Medium                  | Medium        | Low              |
| Overhead            | Low                     | Medium        | Medium           |

## See Also

- [Quick Start](/docs/getting-started/quick-start) - Create your first worker
- [Worker Lifecycle](/docs/guides/worker-lifecycle) - Managing worker state
- [Timeout Configuration](/docs/guides/timeout-configuration) - Configure timeouts
