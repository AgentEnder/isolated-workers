---
title: FAQ
description: Frequently asked questions about isolated-workers
nav:
  section: Resources
  order: 0
---

# Frequently Asked Questions

Quick answers to common questions about isolated-workers.

## General

### What Node.js versions are supported?

Node.js 18.0 or later is required. The library uses modern Node.js features including native ESM support and the updated child process APIs. See the [Installation](/docs/getting-started/installation) guide for full requirements.

### Does it work with ESM and CommonJS?

Yes, isolated-workers supports both module systems. The library is published as a dual ESM/CJS package. Your worker scripts can use either format, and the host and worker can even use different module systems.

### What's the performance overhead?

The overhead is minimal for typical workloads. Message serialization uses JSON and socket communication adds microseconds of latency per message. For CPU-intensive tasks, the isolation benefit far outweighs the IPC cost. Avoid sending very large payloads frequently if latency is critical.

### Can I use it in the browser?

No, isolated-workers is designed specifically for Node.js. It relies on child processes and Unix domain sockets (or Windows named pipes), which are not available in browser environments. For browser workers, use the standard Web Workers API.

## Usage

### Can workers communicate with each other?

Not directly. Workers only communicate with the host process that spawned them. For worker-to-worker communication, route messages through the host or use a shared external store like Redis.

### How do I share state between messages?

Workers maintain state across messages. Define variables at the module level in your worker script and they will persist between message handlers. See the [Worker Lifecycle](/docs/guides/worker-lifecycle) guide for details.

### Can I have multiple workers?

> Yes, call **{% typedoc export:createWorker %}** multiple times to spawn multiple worker processes. Each worker is independent with its own state and message queue. This is useful for parallel processing or running different worker types.

```typescript
import { createWorker } from 'isolated-workers';

// Spawning multiple independent workers
const cpuWorker = await createWorker({
  script: './cpu-worker.js',
  timeout: {
    WORKER_MESSAGE: 300000, // 5 minutes for long CPU tasks
  },
});

const ioWorker = await createWorker({
  script: './io-worker.js',
});

// Use each worker independently
const cpuResult = await cpuWorker.send('process', { data: heavyData });
const ioResult = await ioWorker.send('read', { path: './file.txt' });
```

Environment variables from the parent process are inherited by default.

### Can I use npm packages in workers?

Yes, workers are regular Node.js processes. Import any npm package as you normally would. The worker has access to all dependencies installed in your project.

## TypeScript

### Do I need TypeScript to use this?

No, but TypeScript is strongly recommended. The library works with plain JavaScript, but you lose the type-safe messaging that is the primary benefit. With TypeScript, you get full autocompletion and compile-time checking for all message payloads and results.

### How do I share types between host and worker?

Define your message types in a shared file and import them in both host and worker scripts:

```typescript
// types.ts
export type WorkerMessages = DefineMessages<{
  process: { payload: { data: string }; result: { success: boolean } };
}>;
```

Both host and worker import from `./types`. See the [Quick Start](/docs/getting-started/quick-start) for a complete example.

### Why am I getting type errors?

Common causes: (1) Your handler return type doesn't match the result type in your message definition. (2) You're passing the wrong payload shape. (3) You haven't defined a result type for a message you expect a response from. Enable `strict` mode in tsconfig.json and check that your message definitions match your actual usage.

## Debugging

### How do I debug a worker process?

Pass Node.js inspector flags when creating the worker:

```typescript
const worker = await createWorker<Messages>({
  script: './worker.js',
  execArgv: ['--inspect-brk=9230'],
});
```

Then attach your debugger to port 9230. Use a different port for each worker to avoid conflicts.

### How do I see worker console.log output?

Worker stdout and stderr are inherited from the parent process by default. Any `console.log()` calls in your worker will appear in your terminal. To capture output programmatically, use the `stdio` option.

### Why is my worker not starting?

Check these common issues: (1) The script path is incorrect or the file doesn't exist. (2) The worker script has a syntax error. (3) The worker script crashes before calling `startWorkerServer()`. (4) A firewall or antivirus is blocking socket creation. Add logging at the start of your worker script to verify it runs.

## Advanced

### Can I use this for a plugin system?

Yes, isolated-workers is excellent for plugin systems. Run untrusted plugins in isolated worker processes where they cannot crash your main application or access its memory. Define a message API that plugins must implement. See the Nx plugin system for inspiration.

### How do I handle worker crashes?

Check `worker.isActive` to detect crashes, or catch errors from `send()`. Pending messages reject when a worker crashes. Implement a restart strategy by creating a new worker when a crash is detected. See the [Worker Lifecycle](/docs/guides/worker-lifecycle) guide for patterns.

### What's the maximum message size?

There is no hard limit, but very large messages (tens of megabytes) can cause performance issues and memory pressure. JSON serialization of large objects is slow. For large data transfers, consider streaming, shared files, or a database. Keep messages focused on commands and small payloads.

## See Also

- [Installation](/docs/getting-started/installation) - Setup and requirements
- [Quick Start](/docs/getting-started/quick-start) - Create your first worker
- [Guides](/docs/guides) - In-depth coverage of specific topics
