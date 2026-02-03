# Phase 9: Driver Abstraction

## Overview

Introduce a driver abstraction layer to support multiple IPC mechanisms (child_process with sockets, worker_threads with MessagePort). This enables users to choose the best approach for their use case - full process isolation vs lower-overhead threading.

## Dependencies

- Phase 5: Core implementation (worker spawner, connection manager, messaging)

## Motivation

1. **Performance**: `worker_threads` eliminates socket setup/teardown overhead and provides faster IPC via MessagePort
2. **Reliability**: Socket startup can be fragile; MessagePort is immediately available after worker creation
3. **Flexibility**: Some environments restrict child process spawning; worker_threads may be the only option

## Design Principles

### Capability-Based API

Drivers declare capabilities via TypeScript types. `createWorker()` returns a narrowed `WorkerClient` based on driver capabilities:

- `child_process`: Full API (disconnect/reconnect, detached mode)
- `worker_threads`: Subset API (no disconnect/reconnect, no detach)

### Driver-Specific Options

Each driver defines its own options type. `createWorker()` merges shared options with driver-specific ones, providing compile-time type checking.

### Dynamic Loading

Drivers are loaded dynamically to:
- Avoid bundling unused code
- Handle environments where a driver isn't available
- Provide clear error messages on load failure

## Components

### 1. Driver Interface (`packages/isolated-workers/src/core/driver.ts`)

Defines the contract all drivers must implement.

```typescript
interface DriverMessage {
  type: string;
  payload: unknown;
  tx: string;
}

interface DriverChannel {
  send(message: DriverMessage): Promise<void>;
  onMessage(handler: (message: DriverMessage) => void): void;
  onError(handler: (error: Error) => void): void;
  onClose(handler: () => void): void;
  close(): Promise<void>;
  readonly isConnected: boolean;
  readonly pid: number | undefined;
}

interface DriverCapabilities {
  reconnect: boolean;
  detach: boolean;
  sharedMemory: boolean;
}

interface Driver<
  TCapabilities extends DriverCapabilities = DriverCapabilities,
  TOptions = unknown
> {
  readonly name: string;
  readonly capabilities: TCapabilities;
  spawn(script: string, options: TOptions): Promise<DriverChannel>;
}
```

### 2. Child Process Driver (`packages/isolated-workers/src/core/drivers/child-process.ts`)

Refactors existing socket-based implementation into the driver pattern.

**Capabilities:**
- `reconnect: true` - Can disconnect and reconnect to running worker
- `detach: true` - Worker can outlive parent process
- `sharedMemory: false` - No SharedArrayBuffer support

**Options:**
```typescript
interface ChildProcessDriverOptions {
  env?: Record<string, string>;
  detached?: boolean;
  spawnOptions?: SpawnOptions;
  socketPath?: string;
  connection?: {
    attempts?: number;
    delay?: number | ((attempt: number) => number);
    maxDelay?: number;
  };
}
```

### 3. Worker Threads Driver (`packages/isolated-workers/src/core/drivers/worker-threads.ts`)

New implementation using `worker_threads` module.

**Capabilities:**
- `reconnect: false` - MessagePort doesn't support disconnect/reconnect
- `detach: false` - Worker threads can't outlive parent
- `sharedMemory: true` - Can use SharedArrayBuffer

**Options:**
```typescript
interface WorkerThreadsDriverOptions {
  workerData?: unknown;
  resourceLimits?: {
    maxYoungGenerationSizeMb?: number;
    maxOldGenerationSizeMb?: number;
    codeRangeSizeMb?: number;
    stackSizeMb?: number;
  };
  transferList?: Transferable[];
  eval?: boolean;
}
```

### 4. Startup Data (`packages/isolated-workers/src/core/drivers/startup.ts`)

Lightweight utility for workers to retrieve driver-injected configuration.

```typescript
interface StartupData {
  driver: string;
  socketPath?: string;
  serializer?: string;
  [key: string]: unknown;
}

function getStartupData(): StartupData | null;
```

### 5. Server Implementations

Each driver provides a server-side implementation:

- `child-process-server.ts` - Socket server (existing code, refactored)
- `worker-threads-server.ts` - MessagePort listener (new)

## File Structure

```
packages/isolated-workers/src/core/
├── worker.ts              # createWorker() - uses drivers
├── worker-server.ts       # startWorkerServer() - routes to driver servers
├── driver.ts              # Driver interface, DriverChannel, capabilities
├── connection.ts          # Retained for socket utilities
├── messaging.ts           # Message types (unchanged)
├── internals.ts           # Shared helpers
└── drivers/
    ├── index.ts           # resolveDriver(), type exports
    ├── startup.ts         # getStartupData()
    ├── child-process.ts   # ChildProcessDriver
    ├── child-process-server.ts
    ├── worker-threads.ts  # WorkerThreadsDriver
    └── worker-threads-server.ts
```

## Public API

### Host Side

```typescript
// Default: dynamically loads child_process driver
const worker = await createWorker<MyMessages>({
  script: './worker.js',
});

// Explicit driver: user imports the module
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';

const worker = await createWorker<MyMessages>({
  script: './worker.js',
  driver: new WorkerThreadsDriver(),
  resourceLimits: { maxOldGenerationSizeMb: 512 },
});

// Type narrowing based on capabilities
worker.disconnect(); // Only available with child_process driver
```

### Worker Side

```typescript
// Default: infers from startup data
await startWorkerServer<MyMessages>(handlers);

// Explicit driver
import { WorkerThreadsServer } from 'isolated-workers/drivers/worker-threads';

await startWorkerServer<MyMessages>(handlers, {
  driver: new WorkerThreadsServer(),
});
```

### Package Exports

```typescript
// Main entry: isolated-workers
export { createWorker, startWorkerServer } from './core';
export type { Driver, DriverChannel, DriverCapabilities } from './core/driver';

// Driver entry: isolated-workers/drivers/child-process
export { ChildProcessDriver, ChildProcessServer } from './core/drivers/child-process';

// Driver entry: isolated-workers/drivers/worker-threads
export { WorkerThreadsDriver, WorkerThreadsServer } from './core/drivers/worker-threads';
```

## Type Safety

### Capability-Narrowed WorkerClient

```typescript
type WorkerClient<TMessages, TCapabilities extends DriverCapabilities> =
  WorkerClientBase<TMessages>
  & (TCapabilities['reconnect'] extends true ? ReconnectCapability : {})
  & (TCapabilities['detach'] extends true ? DetachCapability : {});
```

### Driver-Specific Options

```typescript
type WorkerOptions<TMessages, TDriver extends Driver<any, any>> =
  SharedWorkerOptions<TMessages>
  & { driver?: TDriver }
  & (TDriver extends Driver<any, infer TOpts> ? TOpts : {});
```

## Implementation Order

1. **Driver interface** - Define types in `driver.ts`
2. **Refactor child_process** - Extract existing code into driver pattern
3. **Startup data** - Implement `getStartupData()` utility
4. **Update createWorker** - Add driver resolution and capability typing
5. **Update startWorkerServer** - Add driver routing
6. **Implement worker_threads driver** - New driver with MessagePort
7. **Package exports** - Add driver entry points
8. **Tests** - Unit tests for both drivers, type tests for capability narrowing

## Error Handling

### Driver Unavailable

```typescript
// WorkerThreadsDriver constructor
if (!isWorkerThreadsAvailable()) {
  throw new Error(
    'worker_threads module not available. ' +
    'Requires Node.js 12+ or check --experimental-worker flag.'
  );
}
```

### Driver Mismatch

If worker uses wrong server driver, connection timeout catches it with clear error message.

## Success Criteria

- [ ] Driver interface defined with capability types
- [ ] Child process driver extracted (backwards compatible)
- [ ] Worker threads driver implemented
- [ ] `createWorker()` accepts driver instances
- [ ] `startWorkerServer()` routes to correct server
- [ ] Type narrowing works for capabilities (disconnect/reconnect hidden for worker_threads)
- [ ] Type safety for driver-specific options
- [ ] Dynamic imports work (no driver bundled by default)
- [ ] Existing tests pass (backwards compatible)
- [ ] New tests for worker_threads driver
- [ ] E2E test with both drivers

## Backwards Compatibility

- Default behavior unchanged (child_process driver)
- No API changes for existing users
- New `driver` option is optional
- Existing examples continue to work

## Next Steps

After driver abstraction:

1. Performance benchmarks comparing drivers
2. Documentation for driver selection guidance
3. SharedArrayBuffer utilities for worker_threads
