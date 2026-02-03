# ADR 009: Driver Abstraction Pattern

## Status

Accepted

## Context

The current implementation uses `child_process.fork()` with Unix domain sockets for IPC. While this provides full process isolation, it has drawbacks:

1. **Socket startup fragility**: The connection dance (spawn process → create socket → wait for connection) can be timing-sensitive and occasionally fails
2. **IPC overhead**: Socket serialization adds latency for high-frequency messaging
3. **Environment restrictions**: Some environments can't spawn child processes

Node.js `worker_threads` offers an alternative with different trade-offs: lower overhead via MessagePort, instant communication channel, but no process isolation.

We need an abstraction that allows users to choose the appropriate mechanism while maintaining the same high-level API.

## Decision

### 1. Driver Interface

Introduce a `Driver` interface that abstracts how workers are spawned and how communication channels are established.

```typescript
interface Driver<
  TCapabilities extends DriverCapabilities,
  TOptions
> {
  readonly name: string;
  readonly capabilities: TCapabilities;
  spawn(script: string, options: TOptions): Promise<DriverChannel>;
}
```

**Rationale**:
- Clean separation between "how we communicate" and "what we do with messages"
- Drivers return a connected channel; spawn + connect is atomic from caller's perspective
- Capabilities declared as types enable compile-time API narrowing

### 2. Capability-Based Type Narrowing

Drivers declare capabilities via TypeScript type parameters. `createWorker()` returns a `WorkerClient` with methods conditionally included based on capabilities.

```typescript
interface DriverCapabilities {
  reconnect: boolean;   // child_process: true, worker_threads: false
  detach: boolean;      // child_process: true, worker_threads: false
  sharedMemory: boolean; // child_process: false, worker_threads: true
}

type WorkerClient<TMessages, TCaps> =
  WorkerClientBase<TMessages>
  & (TCaps['reconnect'] extends true ? { disconnect(): Promise<void>; reconnect(): Promise<void> } : {});
```

**Rationale**:
- Type errors at compile time for unsupported operations
- IDE autocomplete shows only valid methods
- No runtime checks needed for capability validation

### 3. Driver-Specific Options via Generics

Each driver defines its options type. `createWorker()` merges shared options with driver-specific ones.

```typescript
// ChildProcessDriver accepts: env, detached, spawnOptions, connection
// WorkerThreadsDriver accepts: workerData, resourceLimits, transferList

const worker = await createWorker({
  script: './worker.js',
  driver: new WorkerThreadsDriver(),
  resourceLimits: { maxOldGenerationSizeMb: 512 }, // Type-checked!
});
```

**Rationale**:
- Compile-time validation of driver-specific options
- No invalid combinations (e.g., `detached` with worker_threads)
- Options are discoverable via IDE autocomplete

### 4. Explicit Driver Import (No String Shortcuts)

Drivers must be explicitly imported; no magic string mapping.

```typescript
// NOT this:
driver: 'worker_threads'  // Magic string

// BUT this:
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
driver: new WorkerThreadsDriver()
```

**Rationale**:
- Better tree-shaking; only imported drivers are bundled
- Clear dependency chain
- Type inference flows naturally from driver instance
- No string-to-type mapping to maintain

### 5. Dynamic Import for Default Driver

When no driver is specified, `createWorker()` dynamically imports the child_process driver.

```typescript
// No driver bundled in main entry
const driver = await import('./drivers/child-process.js');
```

**Rationale**:
- Main entry stays small
- Graceful failure with clear error if driver unavailable
- Backwards compatible (existing code works unchanged)

### 6. Startup Data for Worker Detection

Drivers inject configuration via their native mechanism (env vars for child_process, workerData for worker_threads). A lightweight `getStartupData()` utility reads this without importing driver code.

```typescript
function getStartupData(): StartupData | null {
  // Check workerData first (worker_threads)
  // Then check env var (child_process)
}
```

**Rationale**:
- Worker can detect which driver spawned it
- No need to load all drivers to check
- Mismatch falls back to connection timeout (simple, reliable)

### 7. Message Channel Abstraction

Both drivers expose messages through the same `DriverChannel` interface:

```typescript
interface DriverChannel {
  send(message: DriverMessage): Promise<void>;
  onMessage(handler: (message: DriverMessage) => void): void;
  onError(handler: (error: Error) => void): void;
  onClose(handler: () => void): void;
  close(): Promise<void>;
  readonly isConnected: boolean;
}
```

**Rationale**:
- Core worker logic doesn't change between drivers
- Pending request tracking, middleware, timeouts stay in one place
- Easy to add new drivers in the future

## Alternatives Considered

### A. String Shortcuts for Drivers

```typescript
driver: 'child_process' | 'worker_threads'
```

**Rejected because**:
- Requires mapping strings to types
- Harder to tree-shake
- Less discoverable (which strings are valid?)
- Type inference is more complex

### B. Separate Factory Functions

```typescript
createWorker()        // child_process
createThreadWorker()  // worker_threads
```

**Rejected because**:
- Duplicates API surface
- Harder to write generic code that works with either
- More exports to maintain

### C. Full Abstraction (Driver Owns Everything)

Have drivers implement the entire `WorkerClient` interface.

**Rejected because**:
- Duplicates core logic (timeouts, pending requests, middleware)
- Higher maintenance burden for new drivers
- Risk of inconsistent behavior between drivers

## Consequences

### Positive

- Users can choose the right tool for their use case
- Socket reliability issues avoided with worker_threads option
- Type-safe compile-time validation of capabilities and options
- Clean separation makes adding new drivers easy
- Backwards compatible

### Negative

- Additional abstraction layer adds complexity
- Two code paths to test and maintain
- Some features (reconnect, detach) only work with one driver

## References

- Plan: `.ai/plans/09-driver-abstraction.md`
- Node.js worker_threads: https://nodejs.org/api/worker_threads.html
- Node.js child_process: https://nodejs.org/api/child_process.html
