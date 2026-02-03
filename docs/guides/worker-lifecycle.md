---
title: Worker Lifecycle
description: Managing worker state, status checks, and graceful shutdown
nav:
  section: Guides
  order: 5
---

# Worker Lifecycle

Understanding of worker lifecycle helps you build robust applications that properly manage resources and handle failures gracefully.

## Lifecycle Phases

A worker goes through these phases:

```
createWorker() → Starting → Connected → Active → Closing → Closed
                    ↓           ↓          ↓
                  Error       Error      Error
```

1. **Starting**: Process spawned, waiting for socket connection
2. **Connected**: Socket established, ready to receive messages
3. **Active**: Processing messages normally
4. **Closing**: Graceful shutdown initiated
5. **Closed**: Process terminated, resources released

## Checking Worker Status

The worker client exposes two status properties:

{% example worker-lifecycle:host.ts#print-status %}

| Property      | Description                                                   |
| ------------- | ------------------------------------------------------------- |
| `isActive`    | `true` if worker process is alive AND connection is active    |
| `isConnected` | `true` if both local and channel connection states are active |

A healthy worker has both `isActive: true` and `isConnected: true`.

## Worker State Persistence

Workers maintain state across messages. Variables defined at the module level persist:

{% example worker-lifecycle:worker.ts#worker-state %}

Each message handler can read and modify this shared state:

{% example worker-lifecycle:worker.ts#handlers %}

This is useful for:

- Caching computed results
- Tracking request counts
- Maintaining database connections
- Storing configuration loaded at startup

## Graceful Shutdown

Always close workers when done to release resources:

```typescript
const worker = await createWorker<Messages>({ script: './worker.js' });

try {
  // Use the worker
  await worker.send('doWork', { data });
} finally {
  // Always close, even if an error occurred
  await worker.close();
}
```

The `close()` method:

1. Rejects all pending requests (they won't complete)
2. Stops accepting new messages
3. Sends SIGTERM to worker process
4. Waits up to 5 seconds for graceful exit
5. Force-kills worker if it doesn't exit
6. Cleans up socket files

## Sending After Close

Attempting to send a message after closing throws an error:

{% example worker-lifecycle:host.ts#send-after-close %}

Check `isActive` before sending if you're unsure of the worker's state:

```typescript
if (worker.isActive) {
  await worker.send('message', payload);
} else {
  console.log('Worker is not available');
}
```

## Timeout Configuration

Workers support built-in timeout keys for controlling worker startup, connection, and message timeouts:

- `WORKER_STARTUP`: Time to wait for worker process to start (default: 10 seconds)
- `SERVER_CONNECT`: Time for server to wait for host connection (default: 30 seconds)
- `WORKER_MESSAGE`: Default timeout for all messages (default: 5 minutes)

For detailed timeout setup and per-message-type overrides, see [Timeout Configuration](/docs/guides/timeout-configuration).

## Handling Worker Crashes

If the worker process crashes unexpectedly:

- `isActive` becomes `false`
- `isConnected` becomes `false`
- Pending messages reject with an error
- The socket is cleaned up automatically

Detect crashes by checking status or catching send errors:

```typescript
try {
  await worker.send('work', data);
} catch (error) {
  if (!worker.isActive) {
    console.log('Worker crashed, restarting...');
    worker = await createWorker<Messages>({ script: './worker.js' });
    await worker.send('work', data);
  }
}
```

## Worker-Side Shutdown Handling

Workers can handle SIGTERM to clean up before exit:

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');

  // Close database connections
  await db.close();

  // Stop the worker server
  await server.stop();

  process.exit(0);
});
```

## Best Practices

### 1. Use try/finally for Cleanup

```typescript
const worker = await createWorker<Messages>({ script: './worker.js' });
try {
  await processAllItems(worker);
} finally {
  await worker.close();
}
```

### 2. Check Status Before Long Operations

```typescript
async function processItems(worker: WorkerClient<Messages>, items: Item[]) {
  for (const item of items) {
    if (!worker.isActive) {
      throw new Error('Worker died during processing');
    }
    await worker.send('process', item);
  }
}
```

### 3. Implement Health Checks

```typescript
async function healthCheck(worker: WorkerClient<Messages>): Promise<boolean> {
  if (!worker.isActive || !worker.isConnected) {
    return false;
  }
  try {
    await worker.send('ping', {});
    return true;
  } catch {
    return false;
  }
}
```

### 4. Don't Store Worker References Long-Term

Workers can crash. Store the creation parameters instead:

```typescript
// Instead of storing the worker
const workerConfig = { script: './worker.js', timeout: 10000 };

async function getWorker() {
  return createWorker<Messages>(workerConfig);
}
```

## See Also

- {% example-link worker-lifecycle %} - Complete lifecycle example
- [Timeout Configuration](/docs/guides/timeout-configuration) - Configuring startup and message timeouts
- [Error Handling](/docs/guides/error-handling) - Handling worker errors
