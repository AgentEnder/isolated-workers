# Unexpected Worker Shutdown Handling

This example demonstrates how to handle unexpected worker crashes with configurable strategies and detailed error context.

## Overview

When a worker process dies unexpectedly (OOM crash, SIGKILL, or hard crash), pending requests may be left in limbo. The shutdown handling feature provides:

- **Reliable crash detection** via exit events (works even for OOM kills)
- **Configurable strategies**: Reject immediately or retry automatically
- **Per-message-type overrides**: Different strategies for different operations
- **Rich error context**: `WorkerCrashedError` with crash details and attempt counts

## When to Use Each Strategy

### Reject Strategy (`strategy: 'reject'`)

Use for **non-idempotent operations** where retrying could cause side effects:

- Payment processing
- Database writes
- External API calls that aren't safe to replay

```typescript
unexpectedShutdown: {
  strategy: 'reject',  // default behavior
  processPayment: { strategy: 'reject' },
}
```

### Retry Strategy (`strategy: 'retry'`)

Use for **idempotent operations** that can be safely retried:

- Read-only queries
- Computations
- Data processing tasks

```typescript
unexpectedShutdown: {
  strategy: 'reject',
  compute: { strategy: 'retry', attempts: 2 },  // retry up to 2 times
  fetchData: { strategy: 'retry' },  // uses default 1 attempt
}
```

## Files

### Shared Message Definitions

Define message types that both host and worker import:

{% file messages.ts %}

### Host (Client)

Demonstrates different shutdown strategies and error handling:

{% file host.ts %}

### Worker

Worker that processes requests and can crash on specific commands:

{% file worker.ts %}

## Running the Example

```bash
cd examples && pnpm run:shutdown-handling
```

## Key Concepts

### Worker-Level Default Strategy

The top-level `unexpectedShutdown.strategy` applies to all message types by default:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  unexpectedShutdown: {
    strategy: 'reject', // default for all messages
  },
});
```

### Per-Message-Type Overrides

Override the default for specific message types:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  unexpectedShutdown: {
    strategy: 'reject', // default for most
    compute: { strategy: 'retry', attempts: 2 }, // override for compute
    processBatch: { strategy: 'retry' }, // override with default 1
  },
});
```

### WorkerCrashedError

When a crash occurs (or retries are exhausted), requests reject with `WorkerCrashedError`:

```typescript
try {
  await worker.send('processPayment', { paymentId: '123', amount: 100 });
} catch (err) {
  if (err instanceof WorkerCrashedError) {
    console.error('Worker crashed:', err.message);
    console.error('Reason:', err.reason); // exit code, signal, or error
    console.error('Attempt:', err.attempt, '/', err.maxAttempts);
  }
}
```

### Retry Flow

1. Worker crashes (exit, error, or close event)
2. `handleUnexpectedShutdown()` called for each pending request
3. For each request:
   - Look up strategy for its message type
   - If `reject` OR `attempt >= maxAttempts` → reject with `WorkerCrashedError`
   - If `retry` AND `attempt < maxAttempts` → queue for retry
4. If any requests queued → spawn new worker, re-send each with `attempt++`
5. Original Promise stays the same—user awaits the same resolve/reject

### Crash Detection

The library detects crashes via exit events, which fire reliably even for:

- OOM kills (SIGKILL)
- Hard crashes (uncaught exceptions without handlers)
- Manual termination (`kill -9 <pid>`)

```typescript
// Detection happens automatically:
child.on('exit', (code, signal) => {
  // Triggers shutdown handling for all pending requests
});
```
