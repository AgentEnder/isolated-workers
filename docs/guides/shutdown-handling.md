---
title: Shutdown Handling
description: Configure how workers handle unexpected crashes and shutdowns
nav:
  section: Configuration
  order: 4
---

# Unexpected Shutdown Handling

Workers can crash unexpectedly due to out-of-memory errors, `SIGKILL` signals, or other hard crashes. This guide explains how isolated-workers detects crashes, configures recovery strategies, and handles pending operations.

## What is Unexpected Shutdown?

An unexpected shutdown occurs when a worker process terminates without going through the normal close procedure:

**Common causes:**

- **Out-of-memory (OOM) crashes** - Worker exceeds memory limits
- **SIGKILL** - Process forcibly killed (e.g., `kill -9`)
- **Segmentation faults** - Native code crashes
- **Unhandled exceptions** - Uncaught errors that terminate the process

**Detection:**
isolated-workers listens to process exit events, which fire reliably for all crash types—including OOM kills that might not trigger socket errors.

## Default Behavior

By default, pending operations are rejected immediately when a worker crashes unexpectedly:

```typescript
import { createWorker } from 'isolated-workers';

const worker = await createWorker<MyMessages>({
  script: './worker.js',
  // unexpectedShutdown defaults to: { strategy: 'reject' }
});

try {
  await worker.send('processData', { largeData });
} catch (error) {
  // Worker crashed during processing - request is rejected
  console.error('Worker crashed:', error.message);
}
```

## Configuration Strategies

isol-workers supports two strategies for handling unexpected shutdowns:

### 1. Reject Strategy (Default)

Immediately reject all pending operations when a crash is detected. Use this for non-idempotent operations where retrying could cause duplicate work or corruption.

```typescript
const worker = await createWorker<MyMessages>({
  script: './worker.js',
  unexpectedShutdown: {
    strategy: 'reject',
  },
});
```

### 2. Retry Strategy

Automatically retry failed operations up to a specified number of attempts. Use this for idempotent operations that can be safely retried.

```typescript
const worker = await createWorker<MyMessages>({
  script: './worker.js',
  unexpectedShutdown: {
    strategy: 'retry',
    attempts: 3, // Optional: defaults to 1
  },
});
```

### Per-Message-Type Overrides

Configure different strategies for different message types:

```typescript
const worker = await createWorker<MyMessages>({
  script: './worker.js',
  unexpectedShutdown: {
    strategy: 'reject', // Default for all message types
    processData: { strategy: 'retry', attempts: 3 }, // Idempotent - retry up to 3 times
    deleteRecord: { strategy: 'reject' }, // Non-idempotent - reject immediately
    fetchRemote: { strategy: 'retry' }, // Uses default of 1 attempt
  },
});
```

## Type-Safe Configuration

The `UnexpectedShutdownConfig<T>` type provides autocomplete for your message types:

```typescript
import { createWorker, type UnexpectedShutdownConfig } from 'isolated-workers';

const shutdownConfig: UnexpectedShutdownConfig<Messages> = {
  strategy: 'reject',
  processData: { strategy: 'retry', attempts: 3 }, // ← Autocomplete for your message types
  safeQuery: { strategy: 'retry' },
};
```

## Error Handling

When a worker crashes, operations are rejected with a `WorkerCrashedError` containing rich context:

### WorkerCrashedError Properties

```typescript
class WorkerCrashedError extends Error {
  readonly reason: ShutdownReason; // Why the worker crashed
  readonly messageType: string; // Which message type was processing
  readonly attempt: number; // Current attempt number
  readonly maxAttempts: number; // Maximum configured attempts
}
```

### ShutdownReason Types

```typescript
type ShutdownReason =
  | { type: 'exit'; code: number | null; signal: string | null } // Process exit (code or signal)
  | { type: 'error'; error: Error } // Socket/IPC error
  | { type: 'close' }; // Connection closed
```

### Accessing Error Details

```typescript
try {
  await worker.send('processData', { data });
} catch (error) {
  if (error instanceof WorkerCrashedError) {
    console.error('Worker crashed:', error.message);
    console.error('Processing:', error.messageType);
    console.error('Attempt:', error.attempt, '/', error.maxAttempts);

    // Access raw shutdown reason
    if (error.reason.type === 'exit') {
      console.error('Exit code:', error.reason.code);
      console.error('Signal:', error.reason.signal); // e.g., 'SIGKILL'
    }
  }
}
```

### Error Messages

The error message provides context about the crash:

- **Immediate reject**: `"Worker crashed unexpectedly while processing 'processData'"`
- **After retries exhausted**: `"Worker crashed after 3 attempts while processing 'processData'"`
- **With exit details**: `"Worker crashed (exit code 137, signal SIGKILL) while processing 'processData'"`

## Best Practices

### 1. Use Retry for Idempotent Operations

Idempotent operations can be safely retried without side effects:

```typescript
unexpectedShutdown: {
  // Idempotent: Can retry safely
  fetchUser: { strategy: 'retry', attempts: 3 },
  validateInput: { strategy: 'retry', attempts: 2 },

  // Non-idempotent: Reject to avoid duplicates
  createPayment: { strategy: 'reject' },
  sendNotification: { strategy: 'reject' },
  deleteRecord: { strategy: 'reject' },
}
```

### 2. Set Appropriate Retry Limits

Consider the cost and likelihood of success when setting retry limits:

```typescript
unexpectedShutdown: {
  // Quick operations: Higher retry count (transient failures)
  healthCheck: { strategy: 'retry', attempts: 5 },

  // Medium operations: Moderate retries
  fetchFromCache: { strategy: 'retry', attempts: 3 },

  // Slow operations: Lower retries (startup overhead)
  processLargeFile: { strategy: 'retry', attempts: 2 },
}
```

### 3. Log Shutdown Details for Debugging

Capture shutdown reasons to diagnose crash patterns:

```typescript
try {
  await worker.send('processData', { data });
} catch (error) {
  if (error instanceof WorkerCrashedError) {
    // Log for monitoring/alerting
    logger.error('Worker crashed', {
      messageType: error.messageType,
      attempt: error.attempt,
      maxAttempts: error.maxAttempts,
      reason: error.reason,
    });

    // Check for OOM kills
    if (error.reason.type === 'exit' && error.reason.code === 137) {
      logger.warn('Possible OOM - consider increasing memory limits');
    }
  }
}
```

### 4. Handle Expected vs Unexpected Shutdowns

The library distinguishes between expected and unexpected shutdowns:

- **Expected shutdown**: User calls `worker.close()` → Pending operations rejected with normal "Worker closed" error (no retry logic)
- **Unexpected shutdown**: Worker crashes → Operations rejected with `WorkerCrashedError` (retry logic applies)

```typescript
// Expected shutdown - no retry
await worker.close();

// Unexpected shutdown - retry logic applies
// (worker crashes due to OOM, SIGKILL, etc.)
```

## Complete Configuration Example

```typescript
import { createWorker } from 'isolated-workers';
import type { UnexpectedShutdownConfig } from 'isolated-workers';

const shutdownConfig: UnexpectedShutdownConfig<MyMessages> = {
  strategy: 'reject', // Default: reject non-idempotent operations

  // Idempotent read operations - safe to retry
  fetchData: { strategy: 'retry', attempts: 3 },
  validateSchema: { strategy: 'retry', attempts: 5 },
  healthCheck: { strategy: 'retry', attempts: 5 },

  // Idempotent writes with deduplication - can retry
  upsertRecord: { strategy: 'retry', attempts: 2 },

  // Non-idempotent writes - reject immediately
  createInvoice: { strategy: 'reject' },
  chargePayment: { strategy: 'reject' },
  publishEvent: { strategy: 'reject' },
};

const worker = await createWorker<MyMessages>({
  script: './worker.js',
  unexpectedShutdown: shutdownConfig,
  timeout: 60000, // Configure message timeout separately
});

// Usage with error handling
async function processDataSafely(data: unknown) {
  try {
    return await worker.send('fetchData', { id: data.id });
  } catch (error) {
    if (error instanceof WorkerCrashedError) {
      console.error(
        `Worker crashed on attempt ${error.attempt}/${error.maxAttempts}`
      );

      // Check if we should escalate
      if (error.reason.type === 'exit' && error.reason.signal === 'SIGKILL') {
        alert('Worker was forcibly killed - check system resources');
      }

      throw error; // Re-throw or implement fallback
    }
    throw error;
  }
}
```

## API Reference

### WorkerOptions.unexpectedShutdown

Optional configuration for handling unexpected worker shutdowns.

**Type:** `UnexpectedShutdownConfig<T> | undefined`

**Default:** `{ strategy: 'reject' }`

### UnexpectedShutdownStrategy

Strategy for handling operations when a worker crashes.

```typescript
type UnexpectedShutdownStrategy =
  | { strategy: 'reject' } // Reject pending operations immediately
  | { strategy: 'retry'; attempts?: number }; // Retry operations (default: 1 attempt)
```

### UnexpectedShutdownConfig<T>

Worker-level shutdown strategy with optional per-message-type overrides.

```typescript
type UnexpectedShutdownConfig<T extends MessageDefinitions> =
  UnexpectedShutdownStrategy & {
    [K in MessageType<T>]?: UnexpectedShutdownStrategy;
  };
```

### WorkerCrashedError

Error thrown when a worker crashes during operation processing.

```typescript
class WorkerCrashedError extends Error {
  readonly reason: ShutdownReason; // Crash details
  readonly messageType: string; // Message type being processed
  readonly attempt: number; // Current attempt number
  readonly maxAttempts: number; // Maximum configured attempts
}
```

### ShutdownReason

Details about why a worker shut down.

```typescript
type ShutdownReason =
  | { type: 'exit'; code: number | null; signal: string | null }
  | { type: 'error'; error: Error }
  | { type: 'close' };
```

## See Also

- [Error Handling](/docs/guides/error-handling) - Error propagation patterns
- [Timeout Configuration](/docs/guides/timeout-configuration) - Configure operation timeouts
- [Worker Lifecycle](/docs/guides/worker-lifecycle) - Managing worker state and cleanup
