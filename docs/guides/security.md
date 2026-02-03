---
title: Security Considerations
description: Security best practices for worker-based applications
nav:
  section: Guides
  order: 9
---

# Security Considerations

This guide covers security aspects of using isolated-workers. It is important to understand both what protection process isolation provides and what it does NOT provide.

## Process Isolation

### What Process Separation Provides

When you spawn a worker with isolated-workers, it runs in a separate Node.js process. This provides several security benefits:

**Memory Isolation**: The worker process has its own V8 heap, completely separate from the host. A worker cannot directly access variables, closures, or objects in the host process. This prevents accidental data leakage between components.

**Crash Isolation**: If a worker crashes (uncaught exception, segfault, out of memory), the host process continues running. You can detect the crash and spawn a new worker:

```typescript
try {
  await worker.send('riskyOperation', data);
} catch (error) {
  if (!worker.isActive) {
    console.log('Worker crashed, spawning replacement');
    worker = await createWorker<Messages>({ script: './worker.js' });
  }
}
```

**Resource Limits**: Operating system process limits apply independently. A worker consuming excessive memory will be killed by the OS without affecting the host.

### What Process Separation Does NOT Provide

**No Sandboxing**: The worker process has full access to:

- The filesystem (same permissions as the parent process)
- Network (can make HTTP requests, open sockets)
- Environment variables
- Child process spawning (`child_process.spawn`)
- Native modules and Node.js APIs

**No Capability Restrictions**: Unlike browser workers or Deno, Node.js workers can do anything the user running the process can do. isolated-workers does not add a permission system.

**Same User Context**: Workers run as the same OS user as the host. They inherit file permissions, group memberships, and access rights.

## Socket Security

isolated-workers uses Unix domain sockets on POSIX systems and named pipes on Windows for IPC.

### Unix Socket Permissions

Unix sockets are created with the process's umask. By default, this typically means:

- Owner has read/write access
- Group and others may have read access depending on umask

For sensitive applications, consider:

```typescript
// Set restrictive umask before creating workers
const originalUmask = process.umask(0o077);
const worker = await createWorker<Messages>({ script: './worker.js' });
process.umask(originalUmask);
```

### Socket Path Location

Sockets are created in a temporary directory. The path includes random components to prevent prediction:

```
/tmp/isolated-workers-<random>/worker-<id>.sock
```

Considerations:

- `/tmp` is often world-readable on shared systems
- Symlink attacks are possible if the temp directory is predictable
- On shared hosting, other users might enumerate socket files

For high-security environments, configure a private socket directory:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  socketPath: '/run/user/1000/myapp/worker.sock',
});
```

### Named Pipes on Windows

Windows named pipes have their own ACL (Access Control List). By default, isolated-workers creates pipes accessible to the current user. Named pipes are created in the `\\.\pipe\` namespace which is system-managed.

## Message Validation

### Why Validate Even with TypeScript?

TypeScript types are erased at runtime. A malicious or buggy worker can send any data:

```typescript
// Host expects this type
type Result = { success: boolean; count: number };

// But worker could actually send
{ success: "maybe", count: "lots", __proto__: maliciousObject }
```

TypeScript won't catch this at runtime. Your application will proceed with incorrect data.

### Runtime Validation Recommendations

Use a runtime validation library for messages containing user-provided or untrusted data:

```typescript
import { z } from 'zod';

const ResultSchema = z.object({
  success: z.boolean(),
  count: z.number().int().nonnegative(),
});

// In message handler
handlers: {
  processData: async (payload) => {
    const result = await doProcessing(payload);
    return ResultSchema.parse(result); // Validates before sending
  };
}

// In host, after receiving
const response = await worker.send('processData', data);
const validated = ResultSchema.parse(response); // Validates after receiving
```

### Protecting Against Malformed Messages

Workers receive serialized JSON over the socket. Consider these attack vectors:

**Prototype Pollution**: Use `JSON.parse` with a reviver or a safe parsing library:

```typescript
// If using custom serialization
function safeParse(json: string) {
  return JSON.parse(json, (key, value) => {
    if (key === '__proto__' || key === 'constructor') {
      return undefined;
    }
    return value;
  });
}
```

**Large Payloads**: A malicious sender could exhaust memory with huge messages. Consider size limits in your serializer or at the application level.

**Deeply Nested Objects**: Can cause stack overflow during parsing. Limit nesting depth if accepting untrusted input.

## Sandboxing Considerations

### When You Need Additional Sandboxing

isolated-workers provides process isolation, not security sandboxing. You need additional measures when:

- Running untrusted code (user-submitted scripts, plugins)
- Processing untrusted input that could exploit Node.js vulnerabilities
- Handling sensitive data that must not reach the filesystem or network
- Operating in multi-tenant environments

### Options for Additional Sandboxing

**vm2 or isolated-vm**: For running untrusted JavaScript in a restricted context:

```typescript
// Worker code
import ivm from 'isolated-vm';

handlers: {
  runUntrusted: (code: string) => {
    const isolate = new ivm.Isolate({ memoryLimit: 128 });
    const context = await isolate.createContext();
    // Execute code in sandbox
  };
}
```

**Docker/Containers**: Run workers in containers with restricted capabilities:

```typescript
// Use child_process to spawn containerized workers
const worker = spawn('docker', [
  'run',
  '--rm',
  '--network=none',
  '--read-only',
  'worker-image',
  'node',
  '/app/worker.js',
]);
```

**Operating System Sandboxing**:

- Linux: seccomp, AppArmor, SELinux
- macOS: sandbox-exec
- Windows: AppContainer

### What isolated-workers Intentionally Does Not Do

We do not implement sandboxing because:

1. **Complexity**: Proper sandboxing is extremely difficult to get right
2. **Platform differences**: Each OS has different sandboxing mechanisms
3. **Performance**: Sandboxing adds overhead
4. **Use case mismatch**: Most worker use cases involve trusted code

If you need sandboxing, use purpose-built tools rather than expecting it from a process communication library.

## Environment Variables

### Passing Sensitive Data to Workers

Workers inherit the parent's environment by default. This includes sensitive variables like API keys:

```typescript
// Worker automatically has access to process.env.API_KEY
```

To limit exposure, explicitly pass only needed variables:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  env: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    // Explicitly omit AWS_SECRET_ACCESS_KEY, etc.
  },
});
```

### Avoiding Secrets in Message Payloads

Message payloads may be logged, serialized, or cached. Avoid including secrets:

```typescript
// Bad - secret in message
await worker.send('callApi', {
  endpoint: '/users',
  apiKey: 'sk_live_xxxxx', // Could be logged
});

// Good - worker reads secret from environment
await worker.send('callApi', {
  endpoint: '/users',
  // Worker uses process.env.API_KEY internally
});
```

If you must pass sensitive data in messages, consider:

1. Using encrypted payloads (see [Custom Serializers](/docs/guides/custom-serializers))
2. Implementing message redaction in logging middleware
3. Using short-lived tokens instead of long-lived secrets

## Best Practices

### 1. Validate All Inputs

Never trust data crossing the process boundary:

```typescript
handlers: {
  processFile: async ({ path }) => {
    // Validate path doesn't escape expected directory
    const resolved = resolve(path);
    if (!resolved.startsWith('/app/uploads/')) {
      throw new Error('Invalid file path');
    }
    return processFile(resolved);
  };
}
```

### 2. Use Timeouts to Prevent DoS

Always configure timeouts to prevent workers from hanging indefinitely:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  timeout: {
    WORKER_STARTUP: 5000,
    WORKER_MESSAGE: 30000,
    expensiveOperation: 120000,
  },
});
```

See [Timeout Configuration](/docs/guides/timeout-configuration) for details.

### 3. Clean Up Workers Properly

Leaked workers consume resources and leave socket files:

```typescript
const worker = await createWorker<Messages>({ script: './worker.js' });

try {
  await doWork(worker);
} finally {
  await worker.close(); // Always clean up
}
```

For long-lived applications, track all workers and clean up on shutdown:

```typescript
const workers: WorkerClient<Messages>[] = [];

process.on('SIGTERM', async () => {
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});
```

### 4. Limit Worker Permissions When Possible

Run workers with reduced privileges:

```typescript
// Drop privileges in worker after startup
// (Linux only, requires starting as root)
if (process.getuid() === 0) {
  process.setgid(1000);
  process.setuid(1000);
}
```

### 5. Avoid Dynamic Script Paths

Never construct worker script paths from user input:

```typescript
// DANGEROUS - path injection
const worker = await createWorker({
  script: `./workers/${userInput}.js`,
});

// SAFE - whitelist allowed workers
const allowedWorkers = {
  image: './workers/image-processor.js',
  pdf: './workers/pdf-generator.js',
};

const script = allowedWorkers[userInput];
if (!script) {
  throw new Error('Unknown worker type');
}
const worker = await createWorker({ script });
```

### 6. Monitor Worker Resource Usage

In production, monitor workers for anomalies:

```typescript
// Periodically check worker health
setInterval(async () => {
  if (!worker.isActive) {
    metrics.increment('worker.crash');
    worker = await createWorker<Messages>({ script: './worker.js' });
  }
}, 5000);
```

## Summary

| Aspect            | What isolated-workers Provides       | What You Must Handle            |
| ----------------- | ------------------------------------ | ------------------------------- |
| Memory            | Complete isolation between processes | N/A                             |
| Crashes           | Host survives worker crashes         | Restart logic                   |
| Filesystem        | N/A                                  | Access control, path validation |
| Network           | N/A                                  | Firewall rules, if needed       |
| Code execution    | Process-level separation             | Sandboxing for untrusted code   |
| Message integrity | Type definitions                     | Runtime validation              |
| Secrets           | Environment isolation option         | Avoiding secrets in payloads    |

isolated-workers makes it easy to run code in separate processes with type-safe communication. It does not attempt to be a security sandbox. For threat models involving untrusted code or hostile input, combine isolated-workers with appropriate security tools for your platform.

## Driver Security Considerations

### child_process vs worker_threads

isolated-workers defaults to using `child_process` for spawning workers, but you can configure it to use `worker_threads`. Each driver has different security implications:

**child_process (default)**:

- Spawns a completely separate Node.js process with its own V8 instance
- Full OS-level process isolation and memory separation
- Can be sandboxed using OS-level mechanisms (seccomp, AppArmor, containers)
- Higher memory overhead per worker
- More isolation but slower message passing

**worker_threads**:

- Runs workers as threads within the same Node.js process
- Shared memory access between threads (can be both a feature and a risk)
- No OS-level process boundary
- Lower memory overhead and faster message passing
- Less isolation - thread crashes can affect the main process
- Cannot use OS-level sandboxing mechanisms

When choosing a driver for security-sensitive applications:

- Use `child_process` for running untrusted code requiring strong isolation
- Use `worker_threads` for trusted code where performance and shared memory are beneficial
- Remember that `worker_threads` provides no security boundary beyond code-level isolation

### Using Resource Limits with Worker Threads

When using the `worker_threads` driver, you can set resource limits to constrain worker resource usage:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  driver: 'worker_threads',
  resourceLimits: {
    maxOldGenerationSizeMb: 128, // Maximum size of the heap in MB
    maxYoungGenerationSizeMb: 16, // Maximum size of the young generation in MB
    codeRangeSizeMb: 16, // Size of pre-allocated memory for code
    stackSizeMb: 4, // Maximum stack size in MB
  },
});
```

These limits help prevent workers from consuming excessive memory:

- Set `maxOldGenerationSizeMb` based on expected memory usage
- Use lower limits for multiple concurrent workers to share system memory
- Monitor workers that hit limits - they may be OOM or have memory leaks
- Limits only apply to `worker_threads` driver (not `child_process`)

For `child_process`, use OS-level resource limits via `ulimit` or container constraints.

## See Also

- [Error Handling](/docs/guides/error-handling) - Handling errors across process boundaries
- [Worker Lifecycle](/docs/guides/worker-lifecycle) - Proper worker cleanup
- [Timeout Configuration](/docs/guides/timeout-configuration) - Preventing denial of service
- [Custom Serializers](/docs/guides/custom-serializers) - Encryption for sensitive data
