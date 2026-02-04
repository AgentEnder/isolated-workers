# ADR 011: Unexpected Worker Shutdown Handling

## Status

Accepted

## Context

When a worker process dies unexpectedly (OOM crash, SIGKILL, hard crash), pending requests may be left in limbo. The current implementation relies on socket/channel close and error events to detect worker death, but these events may not fire reliably for all crash types—particularly OOM kills (SIGKILL) and other hard terminations.

The library needs to:
1. **Detect** worker crashes reliably, even for hard terminations
2. **Handle** pending transactions when a crash occurs
3. **Provide** configurable behavior (reject immediately vs retry)
4. **Prevent** duplicate handling when multiple events fire in sequence

## Decision

### Detection via Exit Events

Listen directly to process/thread exit events, which fire reliably even for OOM crashes and SIGKILL:

- **Child process driver**: `child.on('exit', (code, signal) => ...)`
- **Worker threads driver**: `worker.on('exit', (exitCode) => ...)`

Exit metadata captured:
- `exitCode`: Process exit code (null if killed by signal)
- `signal`: Signal that killed the process (e.g., 'SIGKILL', 'SIGTERM')

### Unified Shutdown Handler

Consolidate all shutdown paths into a single idempotent handler:

```typescript
type ShutdownReason =
  | { type: 'exit'; code: number | null; signal: string | null }
  | { type: 'error'; error: Error }
  | { type: 'close' };

private shutdownHandled = false;

private handleUnexpectedShutdown(reason: ShutdownReason) {
  if (this.shutdownHandled) return;
  this.shutdownHandled = true;
  // ... apply strategy to pending requests
}
```

Wired to all event sources:
- `child.on('exit', ...)` → `handleUnexpectedShutdown({ type: 'exit', ... })`
- `socket.on('error', ...)` → `handleUnexpectedShutdown({ type: 'error', ... })`
- `socket.on('close', ...)` → `handleUnexpectedShutdown({ type: 'close' })`

Distinguish expected vs unexpected shutdowns:
- User calls `close()` → set `this.closingGracefully = true` before closing
- Shutdown handler checks this flag → expected = normal rejection, unexpected = apply configured strategy

### Configuration API

```typescript
type UnexpectedShutdownStrategy =
  | { strategy: 'reject' }
  | { strategy: 'retry'; attempts?: number };  // defaults to 1

type UnexpectedShutdownConfig<TDefs extends MessageDefinitions> =
  UnexpectedShutdownStrategy & {
    [K in MessageType<TDefs>]?: UnexpectedShutdownStrategy;
  };
```

Worker-level default with per-message-type overrides:

```typescript
const worker = await createWorker<MyMessages>({
  script: './worker.js',
  unexpectedShutdown: {
    strategy: 'reject',  // default for all
    processData: { strategy: 'retry', attempts: 3 },  // override
    fetchRemote: { strategy: 'retry' },  // uses default 1 attempt
  }
});
```

If `unexpectedShutdown` is not specified, defaults to `{ strategy: 'reject' }`—same as current behavior.

### Retry Logic

Extend `PendingRequest` to track retry state:

```typescript
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
  type: string;              // message type for strategy lookup
  payload: unknown;          // original payload for replay
  attempt: number;           // current attempt (starts at 1)
  maxAttempts: number;       // resolved from config
}
```

Retry flow:
1. Worker dies → `handleUnexpectedShutdown()` called
2. For each pending request:
   - Get strategy for message type
   - If `strategy === 'reject'` OR `attempt >= maxAttempts` → reject
   - If `strategy === 'retry'` AND `attempt < maxAttempts` → queue for retry
3. If any requests queued → spawn new worker, re-send each with `attempt++`
4. Original Promise stays the same—user awaits the same resolve/reject

### Error Types

```typescript
class WorkerCrashedError extends Error {
  name = 'WorkerCrashedError';

  constructor(
    message: string,
    public readonly reason: ShutdownReason,
    public readonly messageType: string,
    public readonly attempt: number,
    public readonly maxAttempts: number,
  ) {
    super(message);
  }
}
```

Contextual error messages:
- After retries exhausted: `"Worker crashed after 3 attempts while processing 'processData'"`
- Immediate reject: `"Worker crashed unexpectedly while processing 'processData'"`
- With exit details: `"Worker crashed (exit code 137, signal SIGKILL) while processing 'processData'"`

The `reason` property gives users access to raw exit/error details for logging or custom handling.

## Consequences

### Positive

- **Reliable detection**: Exit events fire for all crash types including OOM
- **Configurable behavior**: Users choose per-message-type retry policies
- **Idempotent handling**: Multiple event sources don't cause duplicate retries
- **Clear errors**: WorkerCrashedError provides all relevant context
- **Backwards compatible**: Default behavior matches current implementation

### Negative

- **Complexity increase**: More state tracking (attempt count, shutdown flag)
- **Per-request overhead**: Storing payload and type for all pending requests
- **Retry assumption**: Retry only works if requests are idempotent—user must configure appropriately

### Neutral

- Worker spawn time on retry: Spawning new workers adds latency to retried requests
- Memory usage: Retrying keeps original payloads in memory until completed

## File Structure

```
packages/isolated-workers/src/
├── core/
│   ├── worker.ts                # handleUnexpectedShutdown(), retry logic
│   ├── pending-request.ts        # PendingRequest interface with retry fields
│   └── drivers/
│       ├── child-process/
│       │   └── host.ts          # Wire up child.on('exit')
│       └── worker-threads/
│           └── host.ts          # Wire up worker.on('exit')
└── types/
    ├── config.ts                 # UnexpectedShutdownConfig, UnexpectedShutdownStrategy
    └── errors.ts                 # WorkerCrashedError
```

## Implementation Notes

### Per-Message Timeouts Already Handle Hung Workers

The existing per-message timeout mechanism covers stuck/hung workers (infinite loops, deadlocks). Exit event detection handles crashes. Clean separation of concerns—no heartbeat needed.

### Exit Event vs Socket Close Order

When a process crashes, events typically fire in this order:
1. `process.on('exit')` - most reliable, always fires
2. `socket.on('close')` - may fire
3. `socket.on('error')` - may fire

The `shutdownHandled` idempotency guard prevents the handler from running multiple times, regardless of event order.

### Expected Shutdown Path

When user calls `close()`:
1. Set `this.closingGracefully = true`
2. Close socket normally
3. Socket close triggers `handleUnexpectedShutdown()`
4. Handler sees flag, rejects all pending with normal "Worker closed" error (no retry logic)
