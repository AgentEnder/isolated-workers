---
title: Troubleshooting
description: Common issues and how to resolve them
nav:
  section: Guides
  order: 7
---

# Troubleshooting

This guide covers common issues you may encounter when using isolated-workers and how to resolve them.

## Connection Errors

### Worker Failed to Start

**Problem**: `createWorker` throws an error indicating the worker failed to start.

**Cause**: This typically occurs when:

- The script path is incorrect or the file doesn't exist
- The worker script has syntax errors
- The Node.js executable can't be found
- The script file doesn't have execute permissions

**Solution**: Verify your script path and ensure the file exists and is valid JavaScript/TypeScript.

```typescript
import { createWorker } from 'isolated-workers';
import { resolve } from 'path';

// Use absolute paths to avoid path resolution issues
const worker = await createWorker<Messages>({
  script: resolve(__dirname, './worker.js'),
});
```

**Debugging Steps**:

1. Try running the worker script directly: `node ./worker.js`
2. Check for syntax errors in your IDE or with `node --check ./worker.js`
3. Ensure the path is absolute or correctly relative to the current working directory

### Connection Timeout

**Problem**: Worker starts but connection times out with "Connection timeout" or similar error.

**Cause**: The worker process started but didn't establish an IPC connection. This usually means the worker script doesn't call `startWorkerServer`.

**Solution**: Ensure your worker script calls `startWorkerServer` at the top level:

```typescript
// worker.ts - CORRECT
import { startWorkerServer } from 'isolated-workers';

startWorkerServer<Messages>({
  handlers: {
    // your handlers
  },
});
```

Common mistakes to avoid:

```typescript
// WRONG - startWorkerServer inside async function that's never called
async function main() {
  startWorkerServer<Messages>({ handlers: {} });
}

// WRONG - conditional that might not execute
if (process.env.SOME_VAR) {
  startWorkerServer<Messages>({ handlers: {} });
}
```

### Socket Permission Issues

**Problem**: Error messages about socket permissions or "EACCES" errors.

**Cause**: On Unix systems, socket files are created in a temporary directory. Permission issues can occur if:

- The temp directory has restrictive permissions
- A previous socket file wasn't cleaned up and is owned by a different user
- SELinux or AppArmor policies are blocking socket creation

**Solution**:

1. Check temp directory permissions:

```bash
ls -la /tmp
```

2. Clean up stale socket files:

```bash
rm -f /tmp/isolated-workers-*
```

3. Specify a custom socket path with proper permissions:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  socketPath: '/path/to/socket.sock', // Optional - defaults to auto-generated path
});
```

## Message Errors

### Message Timeout

**Problem**: A request times out with "Message timeout" or similar error.

**Cause**: The worker handler is taking longer than the configured timeout. This can happen when:

- The operation is legitimately slow (file I/O, network requests, heavy computation)
- The handler is stuck in an infinite loop
- The handler is waiting on a resource that's not available

**Solution**: Configure appropriate timeouts for your operations:

```typescript
import { createWorker, type TimeoutConfig } from 'isolated-workers';

const timeout: TimeoutConfig<Messages> = {
  WORKER_MESSAGE: 5000, // 5s default
  processLargeFile: 120000, // 2 minutes for slow operations
  quickCheck: 1000, // 1 second for fast operations
};

const worker = await createWorker<Messages>({
  script: './worker.js',
  timeout,
});
```

For handlers that may take variable time, implement progress reporting or break the work into smaller chunks.

### Serialization Errors

**Problem**: Errors about "circular structure" or "not JSON serializable" when sending messages.

**Cause**: Messages between host and worker are serialized as JSON. Objects that can't be serialized cause errors:

- Circular references
- Functions
- BigInt values
- Symbols
- Class instances with methods

**Solution**: Ensure all message payloads are plain JSON-serializable objects:

```typescript
// WRONG - contains function and circular reference
const message = {
  data: myData,
  callback: () => console.log('done'), // Functions can't be serialized
  self: null as any,
};
message.self = message; // Circular reference

// CORRECT - plain data only
const message = {
  data: myData,
  callbackId: 'done-callback', // Use IDs instead of functions
};
```

For complex data, use a custom serializer. See [Custom Serializers](/docs/guides/custom-serializers) for details.

### Type Mismatches

**Problem**: Runtime errors about unexpected message types or missing handlers.

**Cause**: The host and worker have different message type definitions. This can happen when:

- Message definitions are duplicated instead of shared
- The worker wasn't rebuilt after message type changes
- Different versions of message definitions are used

**Solution**: Share message definitions between host and worker:

```typescript
// messages.ts - shared definitions
import { defineMessages } from 'isolated-workers';

export type Messages = defineMessages<{
  greet: { name: string } => string;
  calculate: { a: number; b: number } => number;
}>;
```

```typescript
// host.ts
import { Messages } from './messages.js';
const worker = await createWorker<Messages>({ script: './worker.js' });

// worker.ts
import { Messages } from './messages.js';
startWorkerServer<Messages>({
  handlers: {
    /* ... */
  },
});
```

Always rebuild both host and worker after changing message definitions.

## Lifecycle Issues

### Worker Crashes Unexpectedly

**Problem**: Worker process terminates without an explicit `close()` call.

**Cause**: Common causes include:

- Unhandled promise rejections in the worker
- Uncaught exceptions in handlers
- Out of memory errors
- Segmentation faults from native modules
- Process killed by system (OOM killer)

**Solution**:

1. Add error handling in your worker:

```typescript
process.on('uncaughtException', (error) => {
  console.error('Worker uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Worker unhandled rejection:', reason);
  process.exit(1);
});

startWorkerServer<Messages>({
  handlers: {
    // Wrap handlers in try/catch for better error reporting
    riskyOperation: async (payload) => {
      try {
        return await doRiskyWork(payload);
      } catch (error) {
        console.error('Handler error:', error);
        throw error;
      }
    },
  },
});
```

2. Implement worker restart logic in the host:

```typescript
async function withWorker<T>(
  fn: (worker: WorkerClient<Messages>) => Promise<T>
): Promise<T> {
  const worker = await createWorker<Messages>({ script: './worker.js' });
  try {
    return await fn(worker);
  } catch (error) {
    if (!worker.isActive) {
      console.log('Worker crashed, this may need a retry');
    }
    throw error;
  } finally {
    await worker.close();
  }
}
```

### "Worker is Not Active" Errors

**Problem**: Sending a message throws "Worker is not active" error.

**Cause**: Attempting to send a message after the worker has been closed or crashed:

- Called `worker.close()` before sending
- Worker process crashed
- Worker was never started successfully

**Solution**: Check worker status before sending:

```typescript
if (worker.isActive && worker.isConnected) {
  await worker.send('message', payload);
} else {
  console.log('Worker unavailable, recreating...');
  worker = await createWorker<Messages>({ script: './worker.js' });
  await worker.send('message', payload);
}
```

Or use a wrapper that handles reconnection:

```typescript
class WorkerPool<T> {
  private worker: WorkerClient<T> | null = null;

  async send<K extends keyof T>(
    type: K,
    payload: MessageOf<T, K>
  ): Promise<ResultOf<T, K>> {
    if (!this.worker?.isActive) {
      this.worker = await createWorker<T>({ script: this.script });
    }
    return this.worker.send(type, payload);
  }
}
```

### Memory Leaks from Unclosed Workers

**Problem**: Memory usage grows over time, especially when creating many workers.

**Cause**: Workers that aren't properly closed leave:

- Socket files on disk
- Node.js process running in background
- IPC channels open

**Solution**: Always close workers in a `finally` block:

```typescript
const worker = await createWorker<Messages>({ script: './worker.js' });
try {
  await doWork(worker);
} finally {
  await worker.close();
}
```

For long-running applications, consider pooling and reusing workers instead of creating new ones for each operation.

To check for orphaned worker processes:

```bash
# Find isolated-workers processes
ps aux | grep "node.*worker"

# Check for stale socket files
ls -la /tmp/isolated-workers-*
```

## Debugging Tips

### Enabling Debug Logging

Configure logging using the `logLevel` parameter:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  logLevel: 'debug', // 'debug' | 'info' | 'warn' | 'error'
});
```

### Checking Worker stdout/stderr

Worker output can be captured for debugging:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  spawnOptions: { stdio: ['pipe', 'pipe', 'pipe'] }, // Capture all streams
});

// Access worker output (if exposed by your wrapper)
worker.process.stdout?.on('data', (data) => {
  console.log('Worker stdout:', data.toString());
});

worker.process.stderr?.on('data', (data) => {
  console.error('Worker stderr:', data.toString());
});
```

Or simply add console.log statements in your worker and run with inherited stdio:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  spawnOptions: { stdio: 'inherit' }, // Worker output goes to parent console
});
```

### Using Middleware for Message Inspection

Add middleware to log all messages for debugging:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  middleware: [
    {
      beforeSend: (message) => {
        console.log('Sending:', JSON.stringify(message, null, 2));
        return message;
      },
      afterReceive: (response) => {
        console.log('Received:', JSON.stringify(response, null, 2));
        return response;
      },
    },
  ],
});
```

See [Middleware](/docs/guides/middleware) for more details on the middleware system.

## Platform-Specific Issues

### Windows Named Pipe Considerations

**Problem**: Connection issues or errors on Windows systems.

**Cause**: Windows uses named pipes instead of Unix sockets. Some considerations:

- Named pipe paths have different format (`\\.\pipe\name`)
- Maximum path length differs from Unix
- Pipe cleanup works differently

**Solution**: isolated-workers handles platform differences automatically, but be aware of:

1. Pipe naming: Avoid special characters in worker identifiers
2. Permissions: Run as administrator if you encounter access issues
3. Cleanup: Named pipes are automatically cleaned up when the process exits, but stale pipes may need manual cleanup

```powershell
# List named pipes (PowerShell)
Get-ChildItem \\.\pipe\ | Where-Object { $_.Name -like "*isolated-workers*" }
```

### Unix Socket Path Length Limits

**Problem**: "ENAMETOOLONG" error when creating workers on Unix systems.

**Cause**: Unix domain sockets have a maximum path length (typically 104-108 characters on macOS, 108 on Linux). Long socket paths exceed this limit.

**Solution**:

1. Use a shorter socket directory:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  socketDir: '/tmp/iw', // Short path
});
```

2. Use shorter worker identifiers:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  id: 'w1', // Instead of 'my-very-long-worker-identifier'
});
```

3. Let isolated-workers choose the path automatically (it handles truncation):

```typescript
// Don't specify socketDir - uses optimized default
const worker = await createWorker<Messages>({
  script: './worker.js',
});
```

## Getting More Help

If you're still experiencing issues:

1. Check the [GitHub Issues](https://github.com/AgentEnder/isolated-workers/issues) for similar problems
2. Enable debug logging and capture the output
3. Create a minimal reproduction case
4. Open a new issue with your debug output and reproduction

## See Also

- [Error Handling](/docs/guides/error-handling) - How errors propagate from workers
- [Worker Lifecycle](/docs/guides/worker-lifecycle) - Managing worker state and shutdown
- [Timeout Configuration](/docs/guides/timeout-configuration) - Configuring operation timeouts
- [Middleware](/docs/guides/middleware) - Adding custom message processing
