# ADR 010: Driver Server Symmetry

## Status

Accepted

## Context

The initial driver abstraction (Phase 9) implemented drivers for the host side but left the server side with auto-detection logic. This created an asymmetry:

- **Host side**: Explicit driver specification via `createWorker({ driver: new ChildProcessDriver() })`
- **Server side**: Auto-detection via `getStartupData()` which tries both worker_threads and child_process

The auto-detection approach has problems:
1. Requires importing all driver modules to check which one applies
2. Can't reliably work when drivers pass arbitrary data (like classes in `workerData`)
3. Generic `getStartupData()` returns `null` instead of throwing, leading to unclear errors

## Decision

**Drivers own both sides of startup data** — they inject it on the host and extract it on the server.

### Single Driver Class

Each driver is a single class that works on both host and server sides:

```typescript
export const ChildProcessDriver = defineWorkerDriver({
  name: 'child_process',

  // Host side
  async spawn(script, options) { /* dynamic import ./host.ts */ },

  // Server side
  getStartupData() { /* throws if not found */ },
  async createServer(options) { /* dynamic import ./server.ts */ },

  // Capability methods (presence infers capabilities)
  async disconnect() { /* ... */ },
  async reconnect() { /* ... */ },
  detached: false,
});
```

### `defineWorkerDriver` Utility

Capabilities are inferred from the shape of the driver object, not manually specified:

```typescript
type InferCapabilities<T> = {
  reconnect: T extends { disconnect: Function; reconnect: Function } ? true : false;
  detach: T extends { detached: boolean } ? true : false;
  sharedMemory: T extends { transferSharedMemory: Function } ? true : false;
};

export function defineWorkerDriver<T extends DriverConfig>(config: T): Driver<InferCapabilities<T>> & T;
```

### Dynamic Imports

Driver files are split to enable tree-shaking:

```
drivers/child-process/
├── index.ts      # Re-exports driver
├── driver.ts     # Minimal wrapper with defineWorkerDriver
├── host.ts       # spawn() implementation (imports child_process, net)
└── server.ts     # createServer() implementation (socket server)
```

The driver wrapper uses dynamic imports:
- `spawn()` → `await import('./host.js')`
- `createServer()` → `await import('./server.js')`

This ensures host bundles don't include server code and vice versa.

### Driver Option on Server Side

`startWorkerServer()` accepts an optional driver. It defaults to `ChildProcessDriver` to match the host-side default:

```typescript
// Default (child_process on both sides) - no driver needed
await startWorkerServer(handlers);

// Non-default driver - must match host side
await startWorkerServer(handlers, { driver: WorkerThreadsDriver });
```

**Rule**: If the host specifies a non-default driver, the server must specify the matching driver.

### Throwing `getStartupData()`

Each driver's `getStartupData()` throws if startup data isn't found:

```typescript
getStartupData() {
  const envData = process.env[STARTUP_DATA_ENV_KEY];
  if (!envData) {
    throw new Error(
      'ChildProcessDriver.getStartupData() called but no startup data found. ' +
      'Ensure this worker was spawned via createWorker() with ChildProcessDriver.'
    );
  }
  return JSON.parse(envData);
}
```

## Consequences

### Positive

- **Symmetry**: Same driver used on host and server
- **Clear errors**: Throws immediately if server started incorrectly
- **Tree-shakeable**: Dynamic imports keep bundles small
- **Type inference**: Capabilities inferred from driver shape

### Negative

- **Breaking change for non-default drivers**: Server-side code using worker_threads must now specify driver
- **Migration required**: Examples using worker_threads driver need updating

### Neutral

- Host-side API unchanged (driver option still optional, defaults to child_process)
- Server-side API backwards compatible for default driver (child_process)

## File Structure

```
packages/isolated-workers/src/core/
├── driver.ts                    # Driver interface, defineWorkerDriver
├── worker.ts                    # createWorker() - unchanged
├── worker-server.ts             # startWorkerServer() - requires driver
└── drivers/
    ├── index.ts
    ├── child-process/
    │   ├── index.ts
    │   ├── driver.ts
    │   ├── host.ts
    │   └── server.ts
    └── worker-threads/
        ├── index.ts
        ├── driver.ts
        ├── host.ts
        └── server.ts
```

## Removed Code

- `startup.ts` generic `getStartupData()`
- `detectDriver()` in `worker-server.ts`
- `isChildProcessWorker()` / `isWorkerThreadsWorker()` helpers
