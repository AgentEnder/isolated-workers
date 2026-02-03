---
title: Building Your First Worker
description: A complete guide to building a production-ready worker for CPU-intensive tasks
nav:
  section: Getting Started
  order: 3
---

# Building Your First Worker

A complete guide to building a production-ready worker for CPU-intensive tasks.

## Use Case: Image Processing Worker

We'll build a worker that handles image processing operations. This demonstrates the key benefits of isolated-workers: offloading CPU-intensive work while maintaining type safety.

## Step 1: Define the Message Contract

Create a shared types file that both host and worker will use:

{% example image-processing:messages.ts#messages %}

## Step 2: Implement the Worker

Create the worker script with handlers for each message type:

{% example image-processing:worker.ts#handlers %}

## Step 3: Create the Host Process

Create the main process that spawns and communicates with the worker. Note how we configure per-operation timeouts:

{% example image-processing:host.ts#create-worker %}

Now use the worker to process images:

{% example image-processing:host.ts#process-single %}

Check worker status and batch process multiple images:

{% example image-processing:host.ts#check-status %}

{% example image-processing:host.ts#batch-process %}

### Built-in Timeout Keys

isolated-workers provides three built-in timeout keys:

- `WORKER_STARTUP`: Time to wait for worker process to start (default: 10 seconds)
- `SERVER_CONNECT`: Time for server to wait for host connection (default: 30 seconds)
- `WORKER_MESSAGE`: Default timeout for all messages (default: 5 minutes)

Per-message-type timeouts (like `processImage`) override `WORKER_MESSAGE` for specific operations.

Example:

```typescript
const timeout: TimeoutConfig<Messages> = {
  // Built-in keys
  WORKER_STARTUP: 5000, // 5s to start
  SERVER_CONNECT: 10000, // 10s to connect
  WORKER_MESSAGE: 60000, // 1min default for messages

  // Per-message overrides
  processImage: 30000, // 30s for image processing
  batchProcess: 300000, // 5min for batch operations
};
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

## Key Features Demonstrated

- **Type Safety:** Payload and result types are fully checked
- **Timeouts:** Per-message-type timeout configuration
- **Error Handling:** Try/finally ensures proper cleanup
- **Worker State:** Worker maintains internal state between messages

## Next Steps

Explore the [Guides](/docs/guides) to learn more about advanced patterns, or check out the [Examples](/examples) for more complete implementations.
