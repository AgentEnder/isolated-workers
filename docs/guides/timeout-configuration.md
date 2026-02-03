---
title: Timeout Configuration
description: Configure timeouts for worker lifecycle and message operations
nav:
  section: Guides
  order: 3
---

# Timeout Configuration

isolated-workers provides flexible timeout configuration for different phases of worker operation. You can set global defaults and per-message-type overrides for fine-grained control.

## Timeout Types

There are three categories of timeouts:

| Timeout          | Default    | Purpose                              |
| ---------------- | ---------- | ------------------------------------ |
| `WORKER_STARTUP` | 10 seconds | Time for worker process to start     |
| `SERVER_CONNECT` | 30 seconds | Time for worker to accept connection |
| `WORKER_MESSAGE` | 5 minutes  | Default timeout for all messages     |

You can also set **per-message-type timeouts** that override `WORKER_MESSAGE` for specific operations.

## Basic Configuration

Pass a timeout configuration object to `createWorker`:

{% example timeout-config:host.ts#timeout-config %}

Then use it when creating the worker:

{% example timeout-config:host.ts#create-worker-with-timeout %}

## Type-Safe Configuration

The `TimeoutConfig<T>` type provides autocomplete for your message types:

```typescript
import { createWorker, type TimeoutConfig } from 'isolated-workers';

// TypeScript knows your message types and offers autocomplete
const timeout: TimeoutConfig<Messages> = {
  WORKER_STARTUP: 5000,
  WORKER_MESSAGE: 3000,
  quickPing: 1000, // ← Autocomplete for your message types
  slowProcess: 10000,
};
```

## When Timeouts Trigger

**WORKER_STARTUP** - If the worker process doesn't start within this time, `createWorker` throws. This can happen if:

- The script path is wrong
- The script has syntax errors
- Node.js can't be found

**SERVER_CONNECT** - If the worker starts but doesn't establish a connection within this time, an error is thrown. This can happen if:

- The worker script doesn't call `startWorkerServer`
- Network/socket issues prevent connection

**WORKER_MESSAGE / per-type** - If a message doesn't receive a response within its timeout, the pending promise rejects. This can happen if:

- The handler takes too long
- The worker crashes during processing
- The handler is stuck in an infinite loop

## Best Practices

### 1. Set Per-Type Timeouts for Long Operations

```typescript
const timeout: TimeoutConfig<Messages> = {
  WORKER_MESSAGE: 5000, // 5s default
  processImage: 60000, // 1 minute for image processing
  batchExport: 300000, // 5 minutes for batch operations
  healthCheck: 1000, // 1 second for quick checks
};
```

### 2. Keep Startup Timeouts Short

Workers should start quickly. A long startup timeout might mask underlying issues:

```typescript
const timeout: TimeoutConfig<Messages> = {
  WORKER_STARTUP: 5000, // 5s is usually plenty
  SERVER_CONNECT: 5000, // Connection should be fast
};
```

### 3. Handle Timeout Errors

Timeout errors are thrown as regular errors - catch and handle them appropriately:

```typescript
try {
  await worker.send('slowOperation', { data });
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('Operation took too long, retrying...');
    // Implement retry logic
  }
  throw error;
}
```

## Numeric Shorthand

If you only need a single timeout value for all operations, pass a number:

```typescript
// All operations timeout after 30 seconds
const worker = await createWorker<Messages>({
  script: './worker.js',
  timeout: 30000,
});
```

## See Also

- {% example-link timeout-config %} - Complete timeout configuration example
- [Worker Lifecycle](/docs/guides/worker-lifecycle) - Managing worker state
