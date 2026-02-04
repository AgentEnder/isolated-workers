# Unexpected Worker Shutdown Handling Implementation

## Overview

Implement reliable detection and configurable handling of unexpected worker shutdowns (OOM crashes, SIGKILL, hard crashes). The feature provides:
- Reliable crash detection via exit events
- Configurable retry strategies with per-message-type overrides
- Idempotent shutdown handling across multiple event sources
- Rich error context for debugging

## Implementation Approach

### Phase 1: Type Definitions

Create new types for configuration and errors.

**File**: `packages/isolated-workers/src/types/config.ts`

Add to existing types:

```typescript
// Shutdown reason types
export type ShutdownReason =
  | { type: 'exit'; code: number | null; signal: string | null }
  | { type: 'error'; error: Error }
  | { type: 'close' };

// Shutdown strategy types
export type UnexpectedShutdownStrategy =
  | { strategy: 'reject' }
  | { strategy: 'retry'; attempts?: number };

export type UnexpectedShutdownConfig<TDefs extends MessageDefinitions> =
  UnexpectedShutdownStrategy & {
    [K in MessageType<TDefs>]?: UnexpectedShutdownStrategy;
  };
```

**File**: `packages/isolated-workers/src/types/errors.ts` (new)

```typescript
export class WorkerCrashedError extends Error {
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

### Phase 2: Update WorkerOptions Interface

**File**: `packages/isolated-workers/src/types/worker.ts`

```typescript
import type { UnexpectedShutdownConfig } from './config';

export interface WorkerOptions<TDefs extends MessageDefinitions> {
  script: string;
  driver?: WorkerDriver;
  timeout?: number;
  unexpectedShutdown?: UnexpectedShutdownConfig<TDefs>;
  // ... existing options
}
```

### Phase 3: Extend PendingRequest

**File**: `packages/isolated-workers/src/core/pending-request.ts` (new or extracted from worker.ts)

```typescript
export interface PendingRequest<TDefs extends MessageDefinitions> {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
  type: MessageType<TDefs>;
  payload: MessageOf<TDefs, MessageType<TDefs>>['payload'];
  attempt: number;
  maxAttempts: number;
}
```

If extracting from existing worker.ts, update the interface there and ensure all usages are updated.

### Phase 4: Update Worker Core

**File**: `packages/isolated-workers/src/core/worker.ts`

Add new private fields:

```typescript
export class Worker<TDefs extends MessageDefinitions> {
  private pendingRequests = new Map<TransactionId, PendingRequest<TDefs>>();
  private shutdownHandled = false;
  private closingGracefully = false;

  constructor(
    private config: WorkerOptions<TDefs>,
    private driver: DriverImplementation<TDefs>,
  ) {
    // ... existing constructor logic
  }

  // ... existing methods
}
```

Add shutdown handler:

```typescript
private handleUnexpectedShutdown(reason: ShutdownReason) {
  // Idempotency guard
  if (this.shutdownHandled) return;
  this.shutdownHandled = true;

  // Gather pending requests
  const pending = Array.from(this.pendingRequests.entries());

  // Clear the map
  this.pendingRequests.clear();

  if (this.closingGracefully) {
    // Expected shutdown - normal rejection
    for (const [id, req] of pending) {
      clearTimeout(req.timeoutId);
      req.reject(new Error('Worker closed'));
    }
    return;
  }

  // Unexpected shutdown - apply configured strategy
  this.applyUnexpectedShutdownStrategy(pending, reason);
}
```

Add strategy application:

```typescript
private applyUnexpectedShutdownStrategy(
  pending: [TransactionId, PendingRequest<TDefs>][],
  reason: ShutdownReason,
) {
  const config = this.config.unexpectedShutdown || { strategy: 'reject' };
  const retryQueue: Array<[TransactionId, PendingRequest<TDefs>]> = [];

  for (const [id, req] of pending) {
    clearTimeout(req.timeoutId);

    // Resolve strategy for this message type
    const strategy = req.type in config
      ? config[req.type as MessageType<TDefs>]!
      : config;

    // Check if should retry
    if (strategy.strategy === 'retry' && req.attempt < (strategy.attempts || 1)) {
      retryQueue.push([id, req]);
    } else {
      // Reject with WorkerCrashedError
      const maxAttempts = strategy.strategy === 'retry'
        ? (strategy.attempts || 1)
        : req.maxAttempts;

      req.reject(new WorkerCrashedError(
        strategy.strategy === 'retry' && req.attempt >= maxAttempts
          ? `Worker crashed after ${req.attempt} attempts while processing '${req.type}'`
          : `Worker crashed unexpectedly while processing '${req.type}'`,
        reason,
        req.type,
        req.attempt,
        maxAttempts,
      ));
    }
  }

  // Retry pending requests if any
  if (retryQueue.length > 0) {
    this.retryPendingRequests(retryQueue);
  }
}
```

Add retry logic:

```typescript
private async retryPendingRequests(
  retryQueue: Array<[TransactionId, PendingRequest<TDefs>]>,
) {
  try {
    // Spawn new worker
    await this.driver.reconnect();

    // Re-send each request
    for (const [id, req] of retryQueue) {
      // Increment attempt counter
      req.attempt++;

      // Set new timeout
      const timeout = this.config.timeout ?? DEFAULT_TIMEOUT;
      req.timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        req.reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      // Re-queue request
      this.pendingRequests.set(id, req);

      // Send message
      this.driver.send({
        type: req.type,
        payload: req.payload as any,
        transactionId: id,
      });
    }
  } catch (error) {
    // Retry failed - reject all
    for (const [id, req] of retryQueue) {
      req.reject(error as Error);
    }
  }
}
```

Update `close()` method:

```typescript
async close(): Promise<void> {
  if (this.closingGracefully) return;

  this.closingGracefully = true;

  try {
    await this.driver.disconnect();
  } finally {
    // This will trigger handleUnexpectedShutdown which respects closingGracefully flag
  }
}
```

Update `send()` method to track new request fields:

```typescript
send<K extends MessageType<TDefs>>(
  type: K,
  payload: MessageOf<TDefs, K>['payload'],
  options?: { timeout?: number },
): Promise<ResultOf<TDefs, K>> {
  // ... existing validation

  return new Promise((resolve, reject) => {
    const transactionId = generateTransactionId();

    // Resolve maxAttempts from config
    const defaultStrategy = this.config.unexpectedShutdown || { strategy: 'reject' };
    const typeStrategy = type in defaultStrategy
      ? defaultStrategy[type as K]!
      : defaultStrategy;
    const maxAttempts = typeStrategy.strategy === 'retry'
      ? (typeStrategy.attempts || 1)
      : 1;

    const timeout = options?.timeout ?? this.config.timeout ?? DEFAULT_TIMEOUT;

    const request: PendingRequest<TDefs> = {
      resolve,
      reject,
      timeoutId: setTimeout(() => {
        this.pendingRequests.delete(transactionId);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout),
      type,
      payload: payload as any,
      attempt: 1,
      maxAttempts,
    };

    this.pendingRequests.set(transactionId, request);

    this.driver.send({
      type,
      payload,
      transactionId,
    });
  });
}
```

Wire up shutdown handler in driver events (this varies by driver - see Phase 6).

### Phase 5: Update Child Process Driver

**File**: `packages/isolated-workers/src/core/drivers/child-process/host.ts`

Add exit event listener in the connect/initialization logic:

```typescript
private child: ChildProcess | null = null;
private onShutdown?: (reason: ShutdownReason) => void;

async connect(onMessage: (msg: IncomingMessage) => void, onShutdown: (reason: ShutdownReason) => void): Promise<void> {
  this.onShutdown = onShutdown;

  // ... existing spawn logic

  // Listen to exit events
  this.child.on('exit', (code, signal) => {
    onShutdown({ type: 'exit', code, signal });
  });

  // ... existing socket setup
}
```

Update socket event handlers to also call onShutdown:

```typescript
private socket: net.Socket | null = null;

// In socket setup
this.socket.on('error', (error) => {
  onShutdown({ type: 'error', error });
});

this.socket.on('close', () => {
  onShutdown({ type: 'close' });
});
```

### Phase 6: Update Worker Threads Driver

**File**: `packages/isolated-workers/src/core/drivers/worker-threads/host.ts`

Similar pattern to child process:

```typescript
private worker: Worker | null = null;
private onShutdown?: (reason: ShutdownReason) => void;

async connect(onMessage: (msg: IncomingMessage) => void, onShutdown: (reason: ShutdownReason) => void): Promise<void> {
  this.onShutdown = onShutdown;

  // ... existing spawn logic

  // Listen to exit events
  this.worker.on('exit', (exitCode) => {
    onShutdown({ type: 'exit', code: exitCode, signal: null });
  });

  // ... existing socket setup
}
```

Update socket event handlers:

```typescript
// In socket setup
this.socket.on('error', (error) => {
  onShutdown({ type: 'error', error });
});

this.socket.on('close', () => {
  onShutdown({ type: 'close' });
});
```

### Phase 7: Update Driver Interface

**File**: `packages/isolated-workers/src/core/driver.ts`

Update Driver interface to include shutdown callback:

```typescript
export interface Driver<TDefs extends MessageDefinitions> {
  // ... existing methods

  connect(
    onMessage: (msg: IncomingMessage) => void,
    onShutdown?: (reason: ShutdownReason) => void,
  ): Promise<void>;
}
```

Or add as an optional parameter to existing connect method if breaking change is acceptable.

### Phase 8: Wire Shutdown Handler in Worker

**File**: `packages/isolated-workers/src/core/worker.ts`

Update driver connection to pass shutdown handler:

```typescript
async initialize(): Promise<void> {
  await this.driver.connect(
    (msg) => this.handleIncomingMessage(msg),
    (reason) => this.handleUnexpectedShutdown(reason),
  );
}
```

Or update in constructor/initialization code accordingly.

## Success Criteria

- [ ] Exit event listeners added to both child process and worker threads drivers
- [ ] Unified `handleUnexpectedShutdown()` method implemented with idempotency guard
- [ ] Configuration types added and integrated into WorkerOptions
- [ ] WorkerCrashedError class created with all relevant context
- [ ] PendingRequest extended with retry state tracking
- [ ] Retry logic correctly re-sends messages on new worker with incremented attempt counter
- [ ] Per-message-type configuration override works correctly
- [ ] Graceful shutdown (user calls close()) uses normal rejection path
- [ ] Unexpected shutdown applies configured strategy
- [ ] Multiple events (socket error, close, exit) don't cause duplicate retries
- [ ] Error messages are informative and include attempt context
- [ ] Existing tests continue to pass
- [ ] New tests added for shutdown handling scenarios

## Files to Modify

### New Files
1. `packages/isolated-workers/src/types/errors.ts` - WorkerCrashedError
2. `packages/isolated-workers/src/core/pending-request.ts` - PendingRequest interface (or extract from worker.ts)

### Modified Files
3. `packages/isolated-workers/src/types/config.ts` - Shutdown config types
4. `packages/isolated-workers/src/types/worker.ts` - WorkerOptions interface
5. `packages/isolated-workers/src/core/worker.ts` - Main implementation
6. `packages/isolated-workers/src/core/drivers/child-process/host.ts` - Exit event listener
7. `packages/isolated-workers/src/core/drivers/worker-threads/host.ts` - Exit event listener
8. `packages/isolated-workers/src/core/driver.ts` - Driver interface update

## Test Cases to Add

### Unit Tests
1. Exit event triggers shutdown handler with correct reason
2. Socket error triggers shutdown handler with correct reason
3. Socket close triggers shutdown handler with correct reason
4. Idempotency: Multiple events don't cause duplicate handling
5. Graceful shutdown (close()) uses normal rejection, not retry logic
6. Reject strategy rejects all pending requests with WorkerCrashedError
7. Retry strategy re-queues requests below attempt limit
8. Retry strategy rejects requests at or above attempt limit
9. Per-message-type configuration overrides apply correctly
10. Retry spawns new worker and re-sends messages
11. Retry failure (new worker spawn fails) rejects all retry queue

### Integration Tests
12. OOM crash (SIGKILL) detected via exit event
13. Normal termination (SIGTERM) detected via exit event
14. Process crash handled with configured strategy
15. Multiple crashes trigger retry up to max attempts
16. Retry on new worker succeeds and resolves original promise
17. Error messages contain correct exit code, signal, and attempt info

## Implementation Order

1. **Types and Errors** - Create configuration types and WorkerCrashedError
2. **PendingRequest Interface** - Extract or extend with retry fields
3. **Worker Core** - Add shutdown handler and retry logic
4. **Driver Interface** - Update to accept shutdown callback
5. **Child Process Driver** - Add exit event listener
6. **Worker Threads Driver** - Add exit event listener
7. **Wire It Up** - Connect shutdown handler in worker initialization
8. **Tests** - Add comprehensive test coverage
9. **Documentation** - Update usage examples and API docs

## Notes

- **Backwards compatibility**: Default behavior (no config) matches existing implementation - immediate rejection
- **Retry assumption**: Retry only works if requests are idempotent - documentation should make this clear
- **Driver capability**: Reconnect capability is required for retry - check driver has this before allowing retry config
- **Performance**: Storing full payload for retry increases memory usage - consider tradeoff vs complexity of partial replay
- **Error clarity**: WorkerCrashedError includes all context (reason, type, attempts) for debugging and logging
