# Phase 7: Enhanced Configuration System

## Overview

Enhance the worker configuration system to provide comprehensive control over worker lifecycle, messaging behavior, reconnection logic, logging, and middleware pipelines. This addresses the need for production-ready configuration options while maintaining type safety and developer experience.

## Dependencies

- Phase 5: Core Implementation (completed)
- Phase 6: Testing, Examples & Documentation (in progress)

## Goals

1. **Fine-grained control**: Users can customize worker behavior for their specific use cases
2. **Type-safe configuration**: Generic options provide full type inference
3. **Per-instance customization**: Move from global singletons to per-worker/server configuration
4. **Better DX**: Enhanced type system with `AnyMessage` property on `DefineMessages`
5. **Production-ready**: Comprehensive options for timeouts, retries, logging, and lifecycle management

## Consumer Workflows

### Workflow 1: Custom Middleware Pipeline

**User Story**: A developer wants to add logging, metrics, and validation middleware to their worker.

**Current State**: Only one global middleware can be registered at a time.

**Desired State**:

```typescript
const worker = await createWorker<MyMessages>({
  script: './worker.js',
  middleware: [loggingMiddleware, metricsMiddleware, validationMiddleware],
});
```

**Success Criteria**:

- Middleware applied sequentially (left-to-right)
- Each middleware can inspect/transform messages
- Middleware errors propagate and fail the message send/receive
- Per-worker middleware isolation (no global state)

### Workflow 2: Custom Serialization with Safe Terminators

**User Story**: A developer needs binary serialization (MessagePack) and a safe terminator sequence.

**Current State**: Hardcoded JSON serialization with `\n` terminator.

**Desired State**:

```typescript
const msgpackSerializer: Serializer = {
  serialize: (data) => msgpack.encode(data),
  deserialize: (data) => msgpack.decode(data),
  terminator: Buffer.from([0x00, 0x00]), // Null bytes
};

const worker = await createWorker({
  script: './worker.js',
  serializer: msgpackSerializer,
});

// Server side
await startWorkerServer(handlers, {
  serializer: msgpackSerializer, // Must match!
});
```

**Success Criteria**:

- Serializer configured on both client and server
- Terminator bundled with serializer (prevents mismatch)
- Works with both string and Buffer terminators
- User's responsibility to ensure both sides match

### Workflow 3: Long-Running Background Workers

**User Story**: A developer wants workers that don't prevent the parent process from exiting.

**Current State**: Workers keep parent process alive.

**Desired State**:

```typescript
const worker = await createWorker({
  script: './worker.js',
  detached: true, // Worker won't block parent exit
});
```

**Success Criteria**:

- Worker process is detached (`detached: true` in spawn options)
- Worker process is unref'd (removed from event loop reference count)
- Parent can exit without waiting for worker
- Worker continues running after parent exits

### Workflow 4: Configurable Reconnection Strategy

**User Story**: A developer needs aggressive reconnection for critical workers, conservative for optional ones.

**Current State**: Hardcoded retry logic.

**Desired State**:

```typescript
// Critical worker - aggressive retries with custom backoff
const criticalWorker = await createWorker({
  script: './critical.js',
  connection: {
    attempts: 20,
    delay: (attempt) => Math.min(50 * Math.pow(2, attempt), 2000),
    maxDelay: 2000,
  },
});

// Optional worker - minimal retries with linear backoff
const optionalWorker = await createWorker({
  script: './optional.js',
  connection: {
    attempts: 2,
    delay: (attempt) => 1000 * attempt, // 1s, 2s
  },
});
```

**Success Criteria**:

- Connection options nested under `connection` property
- Configurable retry attempts (default: 5)
- Delay can be number (exponential backoff) or function (custom curve)
- Configurable max delay cap (default: 5000ms)
- Function receives attempt number (0-indexed)

### Workflow 5: Custom Logger with Log Levels

**User Story**: A developer wants to use their application's logger (Pino, Winston) and control verbosity.

**Current State**: Built-in console logger with binary debug flag.

**Desired State**:

```typescript
const pinoLogger: Logger = {
  debug: (...parts) => pino.debug(parts.join(' ')),
  info: (...parts) => pino.info(parts.join(' ')),
  warn: (...parts) => pino.warn(parts.join(' ')),
  error: (...parts) => pino.error(parts.join(' ')),
};

const worker = await createWorker({
  script: './worker.js',
  logger: pinoLogger,
  logLevel: 'info', // Only info, warn, error (no debug)
});
```

**Success Criteria**:

- Custom logger interface (debug/info/warn/error methods)
- Log level filtering (debug < info < warn < error)
- MetaLogger wraps custom logger to handle filtering
- Works on both client and server sides
- Default logger uses console methods

### Workflow 6: Server Lifecycle Control with Manual Reconnection

**User Story**: A developer wants servers that shut down immediately when the host disconnects, or keep running for reconnections with manual control.

**Current State**: Server always shuts down on disconnect (Nx pattern).

**Desired State**:

```typescript
// Single-use worker (Nx pattern)
await startWorkerServer(handlers, {
  disconnectBehavior: 'shutdown', // Default
  hostConnectTimeout: 30000, // Wait 30s for host to connect
});

// Long-running service with manual reconnection
await startWorkerServer(handlers, {
  disconnectBehavior: 'keep-alive', // Wait for reconnection
  hostConnectTimeout: 0, // Wait forever for initial connection
});

// Host can control connection lifecycle
const worker = await createWorker({
  script: './worker.js',
});

// Later, explicitly disconnect but keep worker alive
await worker.disconnect();

// Do some other work...

// Reconnect to the same worker
await worker.reconnect();

// Finally, terminate everything
await worker.close();
```

**Success Criteria**:

- `disconnectBehavior: 'shutdown'` stops server when host disconnects
- `disconnectBehavior: 'keep-alive'` keeps server running
- `hostConnectTimeout` configures initial connection wait (0 = forever)
- Default matches Nx behavior (shutdown)
- Worker client exposes `disconnect()` method
- Worker client exposes `reconnect()` method
- Worker client has `isConnected` property (separate from `isActive`)
- `close()` terminates worker process completely

### Workflow 7: Enhanced Type System with Exported Helper Types

**User Story**: A developer writing middleware or transaction ID generators needs proper types without manually reconstructing them.

**Current State**: Must manually create unions of all message types and function signatures.

**Desired State**:

```typescript
import {
  DefineMessages,
  AnyMessage,
  Middleware,
  TransactionIdGenerator,
} from 'isolated-workers';

type MyMessages = DefineMessages<{
  load: { payload: { config: string }; result: { loaded: true } };
  compute: { payload: { data: number }; result: { value: number } };
}>;

// Use exported helper types for clean function signatures
const myMiddleware: Middleware<MyMessages> = (msg, direction) => {
  console.log(`${direction} message:`, msg.type);
  return msg;
};

const myTxIdGen: TransactionIdGenerator<MyMessages> = (msg) => {
  return `${msg.type}-${Date.now()}-${Math.random()}`;
};

const worker = await createWorker<MyMessages>({
  script: './worker.js',
  middleware: [myMiddleware],
  txIdGenerator: myTxIdGen,
});
```

**Success Criteria**:

- `AnyMessage<TDefs>` helper type exported from public API
- `Middleware<TDefs>` helper type exported for middleware functions
- `TransactionIdGenerator<TDefs>` helper type exported for TX ID generators
- Type helpers (WithResult, MessageOf, etc.) remain clean (no `Omit` needed)
- All helper types have proper JSDoc documentation

### Workflow 8: Class-Based Serializers with Mismatch Detection

**User Story**: A developer wants to use custom serialization (MessagePack) and get clear errors if client/server serializers mismatch.

**Current State**: Serializer mismatches cause cryptic deserialization errors.

**Desired State**:

```typescript
import { Serializer } from 'isolated-workers';
import msgpack from 'msgpack-lite';

// Must be a named class (not anonymous)
class MsgPackSerializer extends Serializer {
  serialize<T>(data: T): Buffer {
    return msgpack.encode(data);
  }

  deserialize<T>(data: Buffer): T {
    return msgpack.decode(data);
  }

  terminator = Buffer.from([0x00, 0x00]);
}

const serializer = new MsgPackSerializer();

// Client
const worker = await createWorker({
  script: './worker.js',
  serializer,
});

// Server (in worker.js)
await startWorkerServer(handlers, {
  serializer: new MsgPackSerializer(), // Class name passed via env, validated on startup
});

// If server uses different serializer class:
// Error: Serializer mismatch: host uses MsgPackSerializer, worker uses JsonSerializer
```

**Success Criteria**:

- `Serializer` is an abstract class (not interface)
- Serializer includes `terminator` property
- Constructor name passed to worker via `ISOLATED_WORKERS_SERIALIZER` env var
- Worker validates serializer class name on startup
- Clear error message on mismatch
- Works with both string and Buffer terminators

### Workflow 9: Process Lifecycle with Pending Messages

**User Story**: A developer needs to understand when their process will exit and how pending messages affect it.

**Current State**: Unclear whether process will wait for pending messages.

**Desired State**:

```typescript
const worker = await createWorker({
  script: './worker.js',
});

// Send message with 60s timeout
const promise = worker.send('longTask', { data: 'test' });

// Process will NOT exit here - pending message keeps it alive via setTimeout ref
// This is intentional: don't exit with work in flight

// If you need to exit immediately:
await worker.close(); // Clears pending messages, terminates worker

// promise will reject with "Worker closed"
```

**Success Criteria**:

- Pending messages keep host process alive (setTimeout not unref'd)
- Process waits for all pending messages to complete or timeout
- `close()` clears all pending messages and allows exit
- Detached workers don't prevent parent exit (process is unref'd, not timeouts)
- Documentation clearly explains this behavior

## Edge Cases

### Edge Case 1: Middleware Throws/Rejects

**Scenario**: Middleware validation fails and throws an error.

**Expected Behavior**:

- Message send/receive fails immediately
- Error propagates to caller
- Subsequent middleware in chain not executed
- Transaction cleaned up (if applicable)

### Edge Case 2: Serializer Class Name Collision

**Scenario**: Two different serializer classes have the same name.

**Expected Behavior**:

- Class name check detects mismatch (false positive)
- Error message indicates class name collision
- Documentation recommends unique class names
- Advanced: Could hash class implementation for deeper validation

### Edge Case 3: Serializer Instance vs Class

**Scenario**: User calls `startWorkerServer` without providing serializer, but worker uses custom serializer.

**Expected Behavior**:

- Server uses default JSON serializer
- Deserialization fails with clear error message
- Error indicates serializer mismatch

### Edge Case 3: Serializer Instance vs Class

**Scenario**: User provides serializer instance to client, different instance of same class to server.

**Expected Behavior**:

- Class name matches (`constructor.name`)
- Validation passes
- Both instances work correctly (assuming same implementation)
- Different instances is OK as long as class is the same

### Edge Case 4: Custom Backoff Function Returns Invalid Value

**Scenario**: User's delay function returns negative number or NaN.

**Expected Behavior**:

- Validate return value
- Throw error with clear message: "delay function must return positive number"
- Document that function must return milliseconds >= 0

### Edge Case 5: Detached Worker with Pending Messages

**Scenario**: Parent wants to exit but has detached worker with pending requests.

**Expected Behavior**:

- Worker process is detached and unref'd (doesn't block parent)
- Pending message timeouts ARE ref'd (block parent exit)
- Parent waits for pending messages to complete or timeout
- If parent needs immediate exit, must call `worker.close()` first
- This is intentional: pending work should complete even for detached workers

### Edge Case 6: Reconnection During Pending Request

**Scenario**: Connection drops while request is in-flight, then reconnects.

**Expected Behavior**:

- Pending request times out (existing behavior)
- Reconnection succeeds
- New requests work on new connection
- Old pending requests rejected with timeout error

### Edge Case 7: Logger Throws Error

**Scenario**: Custom logger implementation throws an error.

**Expected Behavior**:

- Logging error caught and suppressed
- Original operation continues (logging shouldn't break functionality)
- Fallback to console.error for the logging error itself

### Edge Case 8: Host Never Connects to Server

**Scenario**: Worker server starts but host never connects (e.g., parent crashed).

**Expected Behavior**:

- `hostConnectTimeout` expires (default 30s)
- Server shuts down gracefully
- Process exits with clean shutdown
- If timeout is 0, server waits forever

### Edge Case 9: Disconnect/Reconnect with Shutdown Behavior

**Scenario**: User calls `worker.disconnect()` but server has `disconnectBehavior: 'shutdown'`.

**Expected Behavior**:

- Server shuts down when connection closes
- Worker process terminates
- `worker.reconnect()` fails with clear error: "Worker process terminated"
- Documentation clarifies `disconnect()`/`reconnect()` only work with `keep-alive` mode

### Edge Case 10: AnyMessage Type Usage

**Scenario**: User needs to handle any message type in middleware or custom logic.

**Expected Behavior**:

- `AnyMessage<TDefs>` provides union of all messages (requests and responses)
- Works seamlessly with type inference
- No runtime implications (type-only helper)
- Other type helpers remain clean (no `Omit` needed)

## Success Criteria

### Type Safety

- [ ] `WorkerOptions<TDefs>` and `WorkerServerOptions<TDefs>` are generic over `MessageDefs`
- [ ] `AnyMessage<TDefs>` helper type exported from public API
- [ ] `Middleware<TDefs>` helper type exported from public API
- [ ] `TransactionIdGenerator<TDefs>` helper type exported from public API
- [ ] `AnyMessage<TDefs>` returns union of `AllMessages<TDefs> | AllResults<TDefs>`
- [ ] Type helpers remain clean (no `Omit` for synthetic properties)
- [ ] Transaction ID generator typed as `TransactionIdGenerator<TDefs>`
- [ ] Middleware typed with `Middleware<TDefs>`
- [ ] No `any` types in public API

### Middleware

- [ ] Middleware is array of functions per worker/server instance
- [ ] Applied sequentially left-to-right
- [ ] Middleware errors propagate immediately
- [ ] Supports both sync and async middleware
- [ ] No global middleware state

### Serializer

- [ ] `Serializer` is an abstract class (not interface)
- [ ] Serializer includes `terminator` property
- [ ] Configurable on both client and server
- [ ] Default JSON serializer with `\n` terminator
- [ ] Works with both string and Buffer terminators
- [ ] Constructor name passed via `ISOLATED_WORKERS_SERIALIZER` env var
- [ ] Worker validates serializer class name on startup
- [ ] Clear error message on class name mismatch

### Worker Lifecycle

- [ ] `detached` option sets spawn option and calls `unref()`
- [ ] `startupTimeout` configurable (default 30s)
- [ ] `spawnOptions` passed through to `child_process.spawn`
- [ ] Server `hostConnectTimeout` configurable (0 = forever)
- [ ] Server `disconnectBehavior` ('shutdown' | 'keep-alive')
- [ ] Worker client exposes `disconnect()` method
- [ ] Worker client exposes `reconnect()` method
- [ ] Worker client has `isConnected` property
- [ ] `disconnect()`/`reconnect()` only work with `keep-alive` mode
- [ ] Pending messages keep host process alive (timeouts are ref'd)
- [ ] `close()` clears pending messages and allows exit

### Reconnection

- [ ] Connection options nested under `connection` property
- [ ] `connection.attempts` configurable (default 5)
- [ ] `connection.delay` accepts number or function `(attempt: number) => number`
- [ ] `connection.maxDelay` caps delay value (default 5000ms)
- [ ] Number delay uses exponential backoff with jitter
- [ ] Function delay receives 0-indexed attempt number
- [ ] Delay function return value validated (must be >= 0)

### Logging

- [ ] `Logger` interface with debug/info/warn/error methods
- [ ] `logLevel` option ('debug' | 'info' | 'warn' | 'error')
- [ ] `MetaLogger` wraps custom logger and filters by level
- [ ] Custom logger configurable on both client and server
- [ ] Default console-based logger

### Transaction IDs

- [ ] `txIdGenerator` configurable function
- [ ] Receives full message (request or response)
- [ ] Default continues to use `crypto.randomUUID()`

### Documentation

- [ ] All new options documented in README
- [ ] Examples for common configuration scenarios
- [ ] Migration guide for breaking changes (global middleware)
- [ ] Type documentation for `AnyMessage` usage

### Testing

- [ ] Unit tests for per-instance middleware
- [ ] Type tests for `AnyMessage` property
- [ ] Unit tests for `MetaLogger` log level filtering
- [ ] Integration tests for custom serializer
- [ ] E2E tests for detached workers
- [ ] E2E tests for reconnection with custom settings

## Implementation Phases

### Phase 1: Type System Enhancements

- Add `AnyMessage<TDefs>` helper type to `helpers.ts`
- Add `Middleware<TDefs>` helper type
- Add `TransactionIdGenerator<TDefs>` helper type
- Update generic signatures for options interfaces
- Add type tests for helper types
- Export all helper types from public API

### Phase 2: Serializer Enhancement

- Convert `Serializer` from interface to abstract class
- Add `terminator` property to `Serializer`
- Update default serializer to extend class
- Add serializer class name to worker env vars (`ISOLATED_WORKERS_SERIALIZER`)
- Add serializer validation on worker startup
- Update connection/messaging to use serializer's terminator

### Phase 3: Per-Instance Middleware

- Change middleware from global singleton to per-instance arrays
- Update `WorkerOptions` and `WorkerServerOptions` to accept `middleware: Middleware<TDefs>[]`
- Update message send/receive to apply middleware sequentially
- Remove global `registerMiddleware` functions
- Add middleware error handling

### Phase 4: Logger and Log Levels

- Change `debug` boolean option to `logLevel` enum
- Add `logger` option to both interfaces
- Implement `MetaLogger` wrapper for level filtering
- Update all internal logging to use MetaLogger

### Phase 5: Worker Lifecycle Options

- Add `detached`, `spawnOptions`, `startupTimeout` to `WorkerOptions`
- Add `hostConnectTimeout`, `disconnectBehavior` to `WorkerServerOptions`
- Implement detached mode (spawn option + unref)
- Implement server disconnect behaviors
- Implement server connection timeout
- Add `disconnect()` and `reconnect()` methods to `WorkerClient`
- Add `isConnected` property to `WorkerClient`
- Document pending message ref behavior

### Phase 6: Reconnection Configuration

- Nest connection options under `connection` property in `WorkerOptions`
- Add `connection.attempts`, `connection.delay`, `connection.maxDelay`
- Support both number and function for `delay`
- Update connection retry logic to use configurable values
- Implement delay function validation
- Implement max delay cap for both number and function delays

### Phase 7: Transaction ID Generator

- Add `txIdGenerator: TransactionIdGenerator<TDefs>` to both options interfaces
- Update message creation to use custom generator if provided

### Phase 8: Testing and Documentation

- Write unit and integration tests for all new features
- Update examples to demonstrate new configuration options
- Write migration guide for breaking changes
- Update API documentation
- Add type tests for helper types
- Document serializer class name requirement
- Document pending message ref behavior

## Migration Notes

### Breaking Changes

1. **Global Middleware Removed**:
   - Old: `registerMiddleware(fn)` (global)
   - New: `{ middleware: [fn1, fn2] }` (per-instance)

2. **Debug Boolean Replaced**:
   - Old: `{ debug: true }`
   - New: `{ logLevel: 'debug' }`

3. **Server Socket Path**:
   - Old: Could be passed in options
   - New: Always read from `ISOLATED_WORKERS_SOCKET_PATH` env var

4. **Serializer Interface**:
   - Old: No terminator property
   - New: Includes `terminator` property

### Backward Compatibility

Where possible, maintain backward compatibility:

- Default values preserve existing behavior
- New options are all optional
- Type system changes are additive (intersection type)

## References

- Design Decision: `.ai/design-decisions/007-enhanced-configuration-system.md`
- Current implementation: `packages/isolated-workers/src/core/`
- Nx patterns: `../nx/packages/nx/src/project-graph/plugins/isolation/`
