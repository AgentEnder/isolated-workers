# Rename and Clarify Driver/WorkerHandle Architecture

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename `DriverChannel` → `WorkerHandle` to clarify that it's the primary object representing a spawned worker, move `getHandle()` from the Driver to the WorkerHandle, and shift type inference to derive from spawn return types rather than the Driver itself.

**Architecture:** The `Driver` is a factory/config — it has `spawn()` (creates a `WorkerHandle`) and `createServer()` (creates a `ServerHandle`). The `WorkerHandle` is the spawned worker: it has `send`, `close`, `disconnect`, `reconnect`, and `getHandle()` (escape hatch to the raw underlying instance like `ChildProcess` or `Worker`). All type inference (`UnderlyingWorkerOf`, capabilities) derives from the spawn return type, not the Driver. `createWorker` interacts with the WorkerHandle exclusively after spawning.

**Tech Stack:** TypeScript, Vitest, pnpm/Nx monorepo

---

## Context

### Current Architecture (problems)

```
Driver (factory + type source)
  ├── spawn() → DriverChannel  (confusing name — IS the spawned worker)
  ├── getHandle(channel)        (on Driver, but should be on the handle)
  ├── capabilities              (runtime reflection of type-level info)
  └── createServer() → ServerChannel
```

- `DriverChannel` name doesn't convey that it's the primary worker object with all state
- `getHandle()` is on the Driver (factory), but should be on the spawned worker itself
- `underlyingWorker` property should be replaced by typed `getHandle()` method
- Type inference (`UnderlyingWorkerOf`, `DriverOptionsFor`) uses Driver config instead of spawn return types
- `ReconnectCapability` / `DetachCapability` are separate interfaces for channel classes
- `createWorker` checks `driver.capabilities.reconnect` instead of checking the handle
- `disconnect`/`reconnect` on `WorkerClient` are stubs — don't call handle methods

### Target Architecture

```
Driver (factory/config only)
  ├── spawn() → WorkerHandle  (the spawned worker, has everything)
  │    ├── send(), close(), onMessage(), etc.
  │    ├── getHandle() → ChildProcess / Worker / etc.  (typed escape hatch)
  │    └── disconnect?(), reconnect?()  (optional, present when supported)
  └── createServer() → ServerHandle
```

- `WorkerHandle` (renamed from `DriverChannel`) — the spawned worker, clear naming
- `getHandle()` on WorkerHandle — returns the typed raw underlying instance
- Type inference from spawn return type: `UnderlyingWorkerOf<TDriver>` infers from `SpawnResult<TDriver>.getHandle()` return type
- `disconnect`/`reconnect` are optional methods on `WorkerHandle`, not separate interfaces
- `createWorker` delegates to `handle.disconnect()`/`handle.reconnect()` directly
- Driver is just a factory — only used for `spawn()` and `createServer()`

### User-facing API after changes

```typescript
const worker = await createWorker<Messages, typeof ChildProcessDriver>({
  script: './worker.js',
  driver: ChildProcessDriver,
});

// send/close work as before
await worker.send('compute', { value: 42 });

// getHandle() returns typed ChildProcess (inferred from spawn return type)
const cp = worker.getHandle();
cp.stdout.pipe(process.stdout);

// disconnect is typed as available (ChildProcessDriver supports reconnect)
await worker.disconnect();
await worker.reconnect();

await worker.close();
```

### Files Overview

**Core interfaces (rename + restructure):**
- `packages/isolated-workers/src/core/driver.ts` — rename `DriverChannel` → `WorkerHandle`, add `getHandle()`, remove `underlyingWorker`, add optional `disconnect`/`reconnect`, remove `ReconnectCapability`/`DetachCapability`

**Driver hosts (rename classes, add `getHandle()`):**
- `packages/isolated-workers/src/core/drivers/child-process/host.ts`
- `packages/isolated-workers/src/core/drivers/worker-threads/host.ts`
- `packages/isolated-workers/src/core/drivers/web-worker/host.ts`
- `packages/isolated-workers/src/core/drivers/http/host.ts`

**Driver definitions (remove `getHandle()`, update return types):**
- `packages/isolated-workers/src/core/drivers/child-process/driver.ts`
- `packages/isolated-workers/src/core/drivers/worker-threads/driver.ts`
- `packages/isolated-workers/src/core/drivers/web-worker/driver.ts`
- `packages/isolated-workers/src/core/drivers/http/driver.ts`

**Consumer (update type helpers, wire disconnect/reconnect):**
- `packages/isolated-workers/src/core/worker.ts`

**Exports (rename throughout):**
- `packages/isolated-workers/src/core/drivers/index.ts`
- `packages/isolated-workers/src/core/drivers/*/index.ts`
- `packages/isolated-workers/src/core/index.ts`
- `packages/isolated-workers/src/index.ts`

**Tests (update references):**
- `packages/isolated-workers/src/core/driver.spec.ts`
- `packages/isolated-workers/src/core/worker.spec.ts`
- `packages/isolated-workers/src/core/drivers/web-worker/__tests__/host.spec.ts`
- `packages/isolated-workers/src/core/__tests__/shutdown-handling.test.ts`

**Examples:**
- `examples/custom-driver/loopback-driver.ts`
- `examples/custom-driver/host.ts`

### Important Constraints

- Server channels (`*ServerChannel`) are **not touched** — they already make sense
- Channel classes stay as classes (they carry real logic) — renamed to `*WorkerHandle` (e.g. `ChildProcessChannel` → `ChildProcessWorkerHandle`)
- `defineWorkerDriver` and capability inference stay — capabilities inferred from driver config method presence
- Tests must continue passing throughout

---

## Task 1: Rename `DriverChannel` → `WorkerHandle` in core interface

**Files:**
- Modify: `packages/isolated-workers/src/core/driver.ts`

**Step 1: Rename interface and update members**

Rename `DriverChannel` to `WorkerHandle`. Replace `underlyingWorker: unknown` with `getHandle(): unknown`. Add optional `disconnect`/`reconnect` methods:

```typescript
export interface WorkerHandle {
  /** Send a message through the handle */
  send(message: DriverMessage): Promise<void>;
  /** Register a message handler */
  onMessage(handler: (message: DriverMessage) => void): void;
  /** Register an error handler */
  onError(handler: (error: Error) => void): void;
  /** Register a close handler */
  onClose(handler: () => void): void;
  /** Register a shutdown handler */
  onShutdown(handler: (reason: ShutdownReason) => void): void;
  /** Close the handle */
  close(): Promise<void>;
  /** Whether the handle is connected */
  readonly isConnected: boolean;
  /** Process ID (undefined for worker_threads) */
  readonly pid: number | undefined;
  /**
   * Get the raw underlying worker instance (ChildProcess, Worker, etc.).
   * The return type is specific to each driver's WorkerHandle implementation.
   */
  getHandle(): unknown;
  /** Disconnect from worker, keeping it alive. Present on reconnect-capable handles. */
  disconnect?(): Promise<void>;
  /** Reconnect to a previously disconnected worker. Present on reconnect-capable handles. */
  reconnect?(): Promise<void>;
}
```

Remove `DriverChannel` entirely — no deprecated alias needed (package is not yet distributed).

**Step 2: Remove `ReconnectCapability` and `DetachCapability` interfaces**

Delete both interfaces. Remove from exports. The `disconnect`/`reconnect` methods now live directly on `WorkerHandle` as optional members.

Keep the `HasDisconnect`/`HasReconnect`/`HasDetached` type helpers — these are used by `InferCapabilities` to check driver config method presence (not WorkerHandle).

**Step 3: Remove `getHandle()` from `DriverConfig`**

Delete the `getHandle?(channel: DriverChannel): unknown` method from `DriverConfig`. It's moving to `WorkerHandle` implementations.

**Step 4: Update `Driver.spawn()` return type**

```typescript
export interface Driver<
  TCapabilities extends DriverCapabilities = DriverCapabilities,
  TOptions = unknown
> {
  readonly name: string;
  readonly capabilities: TCapabilities;
  spawn(script: string | URL, options: TOptions): Promise<WorkerHandle>;
}
```

**Step 5: Run build (expect errors — other files still use old names)**

Run: `pnpm nx run isolated-workers:build`
Expected: Errors in channel classes and consumer code (will fix in subsequent tasks)

**Step 6: Commit**

```
refactor(driver): rename DriverChannel to WorkerHandle, add getHandle() method
```

---

## Task 2: Update WorkerHandle implementations (channel classes)

**Files:**
- Modify: `packages/isolated-workers/src/core/drivers/child-process/host.ts`
- Modify: `packages/isolated-workers/src/core/drivers/worker-threads/host.ts`
- Modify: `packages/isolated-workers/src/core/drivers/web-worker/host.ts`
- Modify: `packages/isolated-workers/src/core/drivers/http/host.ts`

For each host file:

**Step 1: Rename classes and update implements**

Rename each class and update what it implements:
- `ChildProcessChannel` → `ChildProcessWorkerHandle implements WorkerHandle`
- `WorkerThreadsChannel` → `WorkerThreadsWorkerHandle implements WorkerHandle`
- `WebWorkerChannel` → `WebWorkerWorkerHandle implements WorkerHandle`
- `HttpChannel` → `HttpWorkerHandle implements WorkerHandle`

For child-process and http, also remove `, ReconnectCapability, DetachCapability` — those interfaces are gone; `disconnect`/`reconnect` are now part of `WorkerHandle`.

**Step 2: Replace `underlyingWorker` getter with `getHandle()` method**

Each class already has a typed `get underlyingWorker()`. Convert to `getHandle()`:

- child-process: `getHandle(): ChildProcess { return this.child; }`
- worker-threads: `getHandle(): InstanceType<typeof import('worker_threads').Worker> { return this.worker; }`
- web-worker: `getHandle(): Worker { return this.worker; }`
- http: `getHandle(): ChildProcess { return this.child; }`

**Step 3: Run build**

Run: `pnpm nx run isolated-workers:build`
Expected: Errors in worker.ts and driver definitions (will fix next)

**Step 4: Commit**

```
refactor: update channel classes to implement WorkerHandle with getHandle()
```

---

## Task 3: Remove `getHandle()` from driver definitions

**Files:**
- Modify: `packages/isolated-workers/src/core/drivers/child-process/driver.ts`
- Modify: `packages/isolated-workers/src/core/drivers/worker-threads/driver.ts`
- Modify: `packages/isolated-workers/src/core/drivers/web-worker/driver.ts`
- Modify: `packages/isolated-workers/src/core/drivers/http/driver.ts`

**Step 1: Remove `getHandle()` from each driver definition**

Delete the `getHandle(channel: DriverChannel): X` method from each `defineWorkerDriver()` call. Also remove the now-unnecessary `type DriverChannel` and handle-type imports that were only used for `getHandle`.

The driver definitions become even thinner — just `name`, `spawn`, `getStartupData`, `createServer`, and capability markers.

**Step 2: Run build**

Run: `pnpm nx run isolated-workers:build`
Expected: Errors in worker.ts (will fix next)

**Step 3: Commit**

```
refactor: remove getHandle() from driver definitions (now on WorkerHandle)
```

---

## Task 4: Update `worker.ts` — type helpers and `WorkerClient`

**Files:**
- Modify: `packages/isolated-workers/src/core/worker.ts`

**Step 1: Update `UnderlyingWorkerOf` to infer from spawn return type**

```typescript
/**
 * Extract the spawn return type from a Driver.
 */
type SpawnResult<TDriver extends Driver> =
  TDriver extends { spawn(...args: any[]): Promise<infer R> } ? R : WorkerHandle;

/**
 * Map a Driver type to its underlying worker instance type.
 *
 * Infers from the spawn return type's `getHandle()` return type.
 * Each WorkerHandle implementation returns its concrete underlying type.
 */
export type UnderlyingWorkerOf<TDriver extends Driver> =
  SpawnResult<TDriver> extends { getHandle(): infer THandle }
    ? THandle
    : unknown;
```

**Step 2: Replace `underlyingWorker` with `getHandle()` on `WorkerClient`**

```typescript
export interface WorkerClient<
  TMessages extends Record<string, { payload: unknown; result?: unknown }>,
  TDriver extends Driver = Driver
> {
  // ... send, close, disconnect, reconnect (unchanged) ...

  /**
   * Get the raw underlying worker instance.
   *
   * Returns a typed handle based on the driver:
   * - child_process → ChildProcess
   * - worker_threads → Worker
   * - Custom drivers → whatever their WorkerHandle.getHandle() returns
   */
  getHandle(): UnderlyingWorkerOf<TDriver>;

  // ... pid, isActive, isConnected (unchanged) ...
}
```

**Step 3: Update client object in `createWorker`**

Replace the `underlyingWorker` getter with `getHandle()`:

```typescript
const client = {
    pid: channel.pid,

    getHandle() {
      return channel.getHandle();
    },

    // ... rest unchanged
};
```

**Step 4: Wire up disconnect/reconnect to handle methods**

Replace the stubs:

```typescript
disconnect: driver.capabilities.reconnect
  ? async (): Promise<void> => {
      if (!isConnected) return;
      workerLogger.info('Disconnecting from worker', { pid: channel.pid });
      pendingRequests.forEach((pending) => {
        clearTimeout(pending.timeoutId);
        pending.reject(new Error('Disconnected from worker'));
      });
      pendingRequests.clear();
      await channel.disconnect?.();
      isConnected = false;
    }
  : undefined,

reconnect: driver.capabilities.reconnect
  ? async (): Promise<void> => {
      if (isConnected) {
        workerLogger.warn('Already connected to worker');
        return;
      }
      if (!isActive) {
        throw new Error('Cannot reconnect: worker process is not active');
      }
      workerLogger.info('Reconnecting to worker', { pid: channel.pid });
      await channel.reconnect?.();
      isConnected = true;
      workerLogger.info('Reconnected to worker', { pid: channel.pid });
    }
  : undefined,
```

**Step 5: Update imports**

Replace `DriverChannel` imports with `WorkerHandle` throughout the file.

**Step 6: Run build**

Run: `pnpm nx run isolated-workers:build`
Expected: Build passes

**Step 7: Run tests**

Run: `pnpm nx run isolated-workers:test`
Expected: All tests pass

**Step 8: Commit**

```
refactor(worker): use WorkerHandle, add getHandle(), wire disconnect/reconnect
```

---

## Task 5: Update exports throughout the package

**Files:**
- Modify: `packages/isolated-workers/src/core/drivers/index.ts`
- Modify: `packages/isolated-workers/src/core/drivers/*/index.ts`
- Modify: `packages/isolated-workers/src/core/index.ts`
- Modify: `packages/isolated-workers/src/index.ts`

**Step 1: Replace `DriverChannel` exports with `WorkerHandle`**

In each index file, replace `DriverChannel` with `WorkerHandle`. Remove `DriverChannel` entirely — no deprecated alias.

**Step 2: Remove `ReconnectCapability` and `DetachCapability` exports**

Remove from `drivers/index.ts`, `core/index.ts`, and `src/index.ts`.

**Step 3: Remove `getHandle` from Driver-level exports if any**

Clean up any driver-config-level `getHandle` references.

**Step 4: Run full build + lint + test**

Run: `pnpm nx run-many -t lint,build,test`
Expected: All pass

**Step 5: Commit**

```
refactor: update exports for WorkerHandle rename
```

---

## Task 6: Update tests and type tests

**Files:**
- Modify: `packages/isolated-workers/src/core/driver.spec.ts`
- Modify: `packages/isolated-workers/src/core/worker.spec.ts`
- Modify: `packages/isolated-workers/src/core/drivers/web-worker/__tests__/host.spec.ts`
- Modify: `packages/isolated-workers/src/core/__tests__/shutdown-handling.test.ts`

**Step 1: Update `driver.spec.ts`**

- Remove type tests for `ReconnectCapability` and `DetachCapability`
- Update `DriverChannel` references to `WorkerHandle`
- Add type test: `WorkerHandle` has `getHandle()` method
- Add type test: `WorkerHandle` has optional `disconnect`/`reconnect`

**Step 2: Update `worker.spec.ts`**

- Update references from `underlyingWorker` to `getHandle()`
- Verify `UnderlyingWorkerOf` type tests still work

**Step 3: Update `host.spec.ts`**

- Update `DriverChannel` references to `WorkerHandle`

**Step 4: Update `shutdown-handling.test.ts`**

- Ensure mock handles conform to `WorkerHandle` interface (add `getHandle()` to mocks)

**Step 5: Run full validation**

Run: `pnpm nx run-many -t lint,build,test`
Expected: All pass

**Step 6: Run e2e tests**

Run: `pnpm nx run-many -t e2e`
Expected: Same results as before (8 pass, 1 pre-existing failure)

**Step 7: Commit**

```
test: update tests for WorkerHandle rename
```

---

## Task 7: Update examples

**Files:**
- Modify: `examples/custom-driver/loopback-driver.ts`
- Modify: `examples/custom-driver/host.ts`

**Step 1: Update loopback driver**

- `LoopbackChannel` → `LoopbackWorkerHandle implements WorkerHandle`
- Replace `get underlyingWorker()` with `getHandle(): LoopbackHandle`
- Remove `getHandle()` from `defineWorkerDriver()` call (it's on the class now)

**Step 2: Update host**

- Replace `worker.underlyingWorker` with `worker.getHandle()`
- Update JSDoc comments

**Step 3: Type-check and run**

Run: `npx tsc -p examples/tsconfig.json --noEmit`
Expected: Clean

Run: `node --import tsx examples/custom-driver/host.ts`
Expected: Same output as before

**Step 4: Commit**

```
docs(examples): update custom-driver for WorkerHandle rename
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `pnpm nx run-many -t lint,build,test` — all green
- [ ] `pnpm nx run-many -t e2e` — same as baseline (8 pass, 1 pre-existing fail)
- [ ] `npx tsc -p examples/tsconfig.json --noEmit` — clean
- [ ] `node --import tsx examples/custom-driver/host.ts` — runs successfully
- [ ] `DriverChannel` no longer exists anywhere in the codebase
- [ ] Channel classes renamed: `ChildProcessWorkerHandle`, `WorkerThreadsWorkerHandle`, `WebWorkerWorkerHandle`, `HttpWorkerHandle`
- [ ] `WorkerHandle` has `getHandle()` method (not `underlyingWorker` property)
- [ ] `getHandle()` is NOT on Driver/DriverConfig — only on WorkerHandle
- [ ] `UnderlyingWorkerOf<TDriver>` infers from spawn return type's `getHandle()`
- [ ] `WorkerClient.getHandle()` returns correctly typed underlying instance
- [ ] `disconnect`/`reconnect` on WorkerClient properly call handle methods
- [ ] No `ReconnectCapability` or `DetachCapability` interfaces exist
- [ ] Server channels (`*ServerChannel`) are untouched
