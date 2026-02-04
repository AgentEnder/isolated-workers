# Phase 12: Unexpected Worker Shutdown Handling

## Overview

Implement robust handling of worker process crashes and unexpected shutdowns. Currently, pending transactions may be left in limbo when a worker dies unexpectedly (OOM crash, SIGKILL, hard process termination). The library needs reliable detection and configurable recovery strategies.

## Why This Feature?

### Current Limitations

- Socket close and error events may not fire reliably for all crash types
- OOM kills (SIGKILL) bypass normal socket shutdown
- Hard process crashes leave requests unresolved
- No user control over crash recovery strategy

### User Impact

- Pending requests hang indefinitely on hard crashes
- No way to distinguish expected vs unexpected shutdowns
- No built-in retry capability for transient failures
- Poor error visibility when workers die

## Dependencies

- ✅ Phase 5: Core Implementation (worker lifecycle, pending requests)
- ✅ Phase 9: Driver Abstraction (driver interface, host implementations)

## Key Requirements

### Functional Requirements

#### Crash Detection

- **FR1**: Detect worker crashes via process/thread exit events
- **FR2**: Capture exit metadata (code, signal) for error context
- **FR3**: Support both child_process and worker_threads drivers
- **FR4**: Distinguish expected shutdown (user calls close()) from unexpected

#### Pending Request Handling

- **FR5**: Immediate rejection of all pending requests by default
- **FR6**: Optional retry of pending requests on crash
- **FR7**: Per-message-type configuration of retry strategy
- **FR8**: Retry attempt limit to prevent infinite loops

#### Idempotency

- **FR9**: Handle multiple shutdown events without duplicate processing
- **FR10**: Socket error, close, and exit events all map to same handler
- **FR11**: Only one retry worker spawned per crash sequence

### Non-Functional Requirements

- **Type Safety**: All new APIs fully typed with TypeScript
- **Zero Breaking Changes**: Default behavior matches existing implementation
- **Performance**: Minimal overhead for request tracking
- **Error Clarity**: WorkerCrashedError provides rich context

## Success Criteria

- [x] Exit event listeners added to both drivers
- [x] Worker dies unexpectedly → all pending requests resolved
- [x] Crash detection works for OOM (SIGKILL)
- [x] Configuration API supports per-message-type overrides
- [x] Retry strategy spawns new worker and re-sends messages
- [x] Retry respects max attempts limit
- [x] Multiple events don't cause duplicate retries
- [x] Graceful shutdown uses normal rejection path
- [x] WorkerCrashedError includes exit details and attempt count
- [x] Tests cover all crash scenarios
- [x] Documentation updated with examples

## Edge Cases

### Concurrent Events

1. **Multiple events fire simultaneously**:
   - Socket error, close, and process exit all fire in quick succession
   - Handler must be idempotent
   - Only one retry worker should be spawned

2. **Retry worker also crashes**:
   - Each request has its own attempt counter
   - If retry worker crashes before completing, remaining requests retry again
   - Max attempts applies to each individual request

### Configuration Conflicts

3. **Worker-level config conflicts with per-type config**:
   - Per-type override takes precedence
   - Worker-level config is fallback for unspecified types

4. **Retry configured but driver lacks reconnect capability**:
   - Validation should reject this config
   - Or fallback to reject strategy with warning

### Request Lifecycle

5. **Request in-flight during retry spawn**:
   - Original pending request map is cleared before retry
   - Re-queued requests get fresh timeout and transaction ID
   - Original Promise stays same, user awaits same resolve/reject

6. **Request succeeds but worker crashes during response**:
   - If request already resolved, no retry needed
   - Handler only processes unresolved requests from pending map

### Expected Shutdown

7. **User calls close() while crash handler running**:
   - Flag prevents race condition
   - Both paths converge on rejection (not retry)

8. **Graceful vs unexpected shutdown**:
   - Graceful: "Worker closed" error, no retry
   - Unexpected: Apply configured strategy (retry or reject)

## Configuration API

### Worker-Level Default

```typescript
const worker = await createWorker({
  script: './worker.js',
  unexpectedShutdown: {
    strategy: 'reject',  // or 'retry'
  }
});
```

### Per-Message-Type Override

```typescript
const worker = await createWorker({
  script: './worker.js',
  unexpectedShutdown: {
    strategy: 'reject',  // default for most
    processData: { strategy: 'retry', attempts: 3 },  // idempotent operation
    updateState: { strategy: 'reject' },  // non-idempotent
  }
});
```

### Retry with Default Attempts

```typescript
// attempts defaults to 1 retry (2 total attempts)
const worker = await createWorker({
  script: './worker.js',
  unexpectedShutdown: {
    strategy: 'retry',  // 1 retry attempt
  }
});
```

## Open Questions

None - design decisions captured in ADR 011.

## Research References

- **Nx isolation patterns**: `../nx/packages/nx/src/project-graph/plugins/isolation/`
- **Design decision**: [ADR 011: Unexpected Shutdown Handling](../design-decisions/011-unexpected-shutdown-handling.md)
- **Implementation spec**: [2026-02-04-unexpected-shutdown-handling](../implementation/2026-02-04-unexpected-shutdown-handling/plan.md)
