---
title: Drivers
description: Understanding the driver abstraction for different worker backends
---

# Drivers

Isolated Workers uses a **driver abstraction** to support different worker backends. A driver controls how workers are spawned and how communication is established between the host and worker processes.

## Available Drivers

### Child Process Driver (Default)

The `child_process` driver spawns a separate Node.js process and uses Unix domain sockets (or named pipes on Windows) for IPC.

**Capabilities:**
- `reconnect: true` - Can disconnect and reconnect to running workers
- `detach: true` - Workers can outlive the parent process
- `sharedMemory: false` - No SharedArrayBuffer support

**When to use:**
- Process isolation is important
- Workers may crash and shouldn't affect the host
- Long-running workers that may be reconnected to
- Workers that need to continue after parent exits

```typescript
import { createWorker } from 'isolated-workers';

// Default - uses child_process driver
const worker = await createWorker({
  script: './worker.js',
});

// Explicit - for clarity or custom options
import { ChildProcessDriver } from 'isolated-workers/drivers/child-process';

const driver = new ChildProcessDriver();
const worker = await createWorker({
  script: './worker.js',
  driver,
});
```

### Worker Threads Driver

The `worker_threads` driver spawns workers in the same process using Node.js worker threads, communicating via MessagePort.

**Capabilities:**
- `reconnect: false` - No reconnection support
- `detach: false` - Workers terminate with parent
- `sharedMemory: true` - Supports SharedArrayBuffer

**When to use:**
- Lower overhead is important
- Shared memory (SharedArrayBuffer) is needed
- Workers don't need to outlive the parent
- CPU-intensive tasks that benefit from parallel execution

```typescript
import { createWorker } from 'isolated-workers';
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';

const driver = new WorkerThreadsDriver();
const worker = await createWorker<Messages, WorkerThreadsDriver>({
  script: './worker.js',
  driver,
});
```

## Capability-Based Type Narrowing

The `WorkerClient` type narrows based on driver capabilities:

```typescript
// With child_process driver (default)
const cpWorker = await createWorker({ script: './worker.js' });
cpWorker.disconnect(); // ✅ Available
cpWorker.reconnect();  // ✅ Available
cpWorker.pid;          // number

// With worker_threads driver
const wtWorker = await createWorker<Messages, WorkerThreadsDriver>({
  script: './worker.js',
  driver: new WorkerThreadsDriver(),
});
wtWorker.disconnect(); // ❌ Type error! Not available
wtWorker.reconnect();  // ❌ Type error! Not available
wtWorker.pid;          // undefined (worker threads share parent's PID)
```

## Worker-Side Detection

Workers don't need to specify which driver spawned them. The `startWorkerServer` function automatically detects the driver type and uses the appropriate server implementation:

```typescript
// worker.ts - works with any driver!
import { startWorkerServer, type Handlers } from 'isolated-workers';

const handlers: Handlers<Messages> = {
  myMessage: async (payload) => {
    return { result: 'ok' };
  },
};

// Automatically uses ChildProcessServer or WorkerThreadsServer
await startWorkerServer(handlers);
```

## Comparing Drivers

| Feature | child_process | worker_threads |
|---------|--------------|----------------|
| Process isolation | ✅ Separate process | ❌ Same process |
| Memory overhead | Higher (new V8 isolate) | Lower (shares memory) |
| SharedArrayBuffer | ❌ | ✅ |
| Reconnection | ✅ | ❌ |
| Detached workers | ✅ | ❌ |
| Crash isolation | ✅ Worker crash isolated | ❌ Can affect host |
| Spawn time | Slower | Faster |

## Custom Drivers

You can implement custom drivers by implementing the `Driver` interface:

```typescript
import type { Driver, DriverChannel, DriverCapabilities } from 'isolated-workers';

interface MyCapabilities extends DriverCapabilities {
  reconnect: false;
  detach: false;
  sharedMemory: false;
}

class MyCustomDriver implements Driver<MyCapabilities> {
  readonly name = 'my_driver';
  readonly capabilities: MyCapabilities = {
    reconnect: false,
    detach: false,
    sharedMemory: false,
  };

  async spawn(script: string, options: unknown): Promise<DriverChannel> {
    // Implement spawning logic
    // Return a DriverChannel for communication
  }
}
```

## See Also

- {% example id="worker-threads-driver" /%} - Using the worker_threads driver
- {% example id="basic-ping" /%} - Basic example (uses default child_process driver)
