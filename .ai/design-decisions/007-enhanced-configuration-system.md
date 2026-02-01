# ADR 007: Enhanced Configuration System

## Status

Accepted

## Context

The current worker configuration is minimal, with only basic options for socket paths, debug logging, and timeouts. As the library matures, users need more control over:

1. **Worker lifecycle** - How long to wait for connections, detached mode, process options
2. **Messaging behavior** - Middleware pipelines, custom serializers with terminators, transaction ID generation
3. **Reconnection logic** - Retry attempts, backoff delays, total timeouts
4. **Logging** - Log levels, custom logger implementations
5. **Type safety** - Better DX with `DefineMessages` providing `AnyMessage` type

The current middleware is a global singleton that gets replaced on each registration, limiting flexibility for per-worker customization.

## Decisions

### 1. Per-Instance Middleware Arrays

**Decision**: Replace global singleton middleware with per-instance middleware function arrays.

**Rationale**:

- Each worker/server can have its own middleware pipeline
- Sequential application (left-to-right) matches common expectations
- Middleware that throws/rejects should fail fast and propagate the error
- Simpler than chaining/composition patterns while maintaining flexibility

**Signature**:

```typescript
type MiddlewareFn = (
  message: unknown,
  direction: 'incoming' | 'outgoing',
) => unknown | Promise<unknown>;

interface WorkerOptions<TDefs extends MessageDefs = MessageDefs> {
  middleware?: MiddlewareFn[]; // Applied left-to-right
}
```

### 2. Serializer Includes Terminator

**Decision**: Attach the message terminator to the serializer interface, not as a separate option.

**Rationale**:

- Terminator must match on both client and server
- Serializer must match on both sides already
- Coupling them reduces likelihood of misconfiguration
- Terminator is inherently tied to serialization format
- Default: JSON serializer with `\n` terminator

**Interface**:

```typescript
interface Serializer {
  serialize<T>(data: T): string | Buffer;
  deserialize<T>(data: string | Buffer): T;
  terminator: string | Buffer; // Bundled with serializer
}
```

### 3. Server Configuration Separation

**Decision**: Server never accepts socket path directly - always reads from environment variable.

**Rationale**:

- Prevents socket path mismatches between client and server
- Client spawns server and controls the socket path via env var
- Server has no reason to override - it's spawned specifically for that path
- Simplifies server API and prevents configuration errors

### 4. Enhanced Type System with AnyMessage Helper

**Decision**: Provide `AnyMessage<TDefs>` as a separate type helper instead of modifying `DefineMessages`.

**Rationale**:

- Keeps `DefineMessages` simple - it just returns `TDefs`
- No need for `Omit<TDefs, 'AnyMessage'>` in other type helpers
- Type helpers stay clean and don't need to exclude synthetic properties
- Just as ergonomic for users: `AnyMessage<MyMessages>` vs `MyMessages['AnyMessage']`
- Follows existing pattern of type extraction helpers

**Implementation**:

```typescript
// DefineMessages stays simple
type DefineMessages<TDefs extends MessageDefs> = TDefs;

// New helper for any message type
type AnyMessage<TDefs extends MessageDefs> = AllMessages<TDefs> | AllResults<TDefs>;

// Usage
type MyMessages = DefineMessages<{...}>;
function handle(msg: AnyMessage<MyMessages>) {}
```

### 5. Generic Options with MessageDefs

**Decision**: Make options interfaces generic over `MessageDefs` for typed transaction ID generators.

**Rationale**:

- Transaction ID generator receives actual message types
- Better type inference for middleware and handlers
- Consistent with type-safe philosophy
- Defaults to `MessageDefs` for legacy/untyped usage

**Signature**:

```typescript
interface WorkerOptions<TDefs extends MessageDefs = MessageDefs> {
  txIdGenerator?: (message: AnyMessage<TDefs>) => string;
}
```

### 6. MetaLogger Pattern for Log Levels

**Decision**: Introduce `MetaLogger` wrapper that checks log levels before delegating to actual logger.

**Rationale**:

- Logger interface stays simple with `debug/info/warn/error` methods
- Log level filtering happens in wrapper, not in every logger implementation
- Users can provide custom logger without implementing filtering logic
- Default logger uses console methods

**Structure**:

```typescript
interface Logger {
  debug(...parts: unknown[]): void;
  info(...parts: unknown[]): void;
  warn(...parts: unknown[]): void;
  error(...parts: unknown[]): void;
}

// Internal wrapper
class MetaLogger {
  constructor(
    private logger: Logger,
    private level: LogLevel,
  ) {}
  // Filters calls based on configured level
}
```

### 7. Configuration Distribution

**Decision**: Split options between `createWorker` (client-side) and `createWorkerServer` (server-side) based on where they're used.

**Rationale**:

- Some options only make sense on one side (e.g., `detached` for client, `disconnectBehavior` for server)
- Shared options (logger, serializer, middleware) configured on both sides
- User's responsibility to ensure shared options match
- Clear separation prevents confusion about where configuration takes effect

**Client-side** (`WorkerOptions`):

- Worker spawning: `script`, `env`, `spawnOptions`, `detached`
- Connection: `startupTimeout`, `reconnectAttempts`, `reconnectDelay`, `reconnectMaxDelay`
- Messaging: `middleware`, `serializer`, `txIdGenerator`
- Logging: `logLevel`, `logger`

**Server-side** (`WorkerServerOptions`):

- Lifecycle: `hostConnectTimeout`, `disconnectBehavior`
- Messaging: `middleware`, `serializer`, `txIdGenerator`
- Logging: `logLevel`, `logger`

### 8. Detached Mode Behavior

**Decision**: `detached: true` sets both the `detached` spawn option AND calls `unref()` on the child process.

**Rationale**:

- Detached workers shouldn't prevent parent from exiting
- `detached` flag alone doesn't prevent parent blocking
- `unref()` removes process from event loop's reference count
- Together they enable true background workers

### 9. Reconnection Configuration with Custom Backoff

**Decision**: Nest connection options under `connection` property with flexible delay function.

**Rationale**:

- Groups related options together (attempts, delay, maxDelay)
- Cleaner API surface with nested configuration
- Delay function allows custom backoff curves (exponential, linear, polynomial, etc.)
- Falls back to simple number for common exponential backoff case
- Users have full control over retry strategy

**Options**:

```typescript
interface ConnectionConfig {
  attempts?: number; // Default: 5
  delay?: number | ((attempt: number) => number); // Default: 100ms or exponential fn
  maxDelay?: number; // Default: 5000ms cap
}

interface WorkerOptions {
  connection?: ConnectionConfig;
}
```

**Examples**:

```typescript
// Exponential backoff (default behavior)
connection: { delay: 100, maxDelay: 5000 }

// Custom backoff curve
connection: {
  attempts: 10,
  delay: (attempt) => Math.min(100 * Math.pow(1.5, attempt), 5000)
}
```

### 10. Server Disconnect Behavior with Worker Control Methods

**Decision**: Allow configuration of server behavior when host disconnects, and expose `disconnect()`/`reconnect()` methods on worker client for `keep-alive` scenarios.

**Rationale**:

- Nx pattern: shutdown on first disconnect (single-use workers)
- Long-running services may want to keep-alive for reconnections
- Users with `keep-alive` need explicit control to disconnect/reconnect
- Enables connection lifecycle management from host side
- Future: pooling scenarios may need different behaviors
- Default to `'shutdown'` to match Nx behavior

**Server Options**:

- `'shutdown'`: Server stops when host disconnects (default)
- `'keep-alive'`: Server continues running, waits for reconnection

**Worker Client API**:

```typescript
interface WorkerClient<TMessages> {
  send<K extends keyof TMessages>(...): Promise<...>;
  close(): Promise<void>;
  disconnect(): Promise<void>;  // Close connection but keep worker alive (keep-alive mode)
  reconnect(): Promise<void>;   // Reconnect to existing worker (keep-alive mode)
  pid: number;
  isActive: boolean;
  isConnected: boolean;  // New: distinguish between active process and active connection
}
```

### 11. Exported Helper Types for User Code

**Decision**: Export generic helper types for common function signatures.

**Rationale**:

- Users writing middleware/generators need proper types
- Prevents users from manually reconstructing complex types
- Better DX - import and use directly
- Maintains type safety across user code
- Consistent with TypeScript best practices

**Exported Types**:

```typescript
export type Middleware<TDefs extends MessageDefs = MessageDefs> = (
  message: AnyMessage<TDefs>,
  direction: 'incoming' | 'outgoing',
) => unknown | Promise<unknown>;

export type TransactionIdGenerator<TDefs extends MessageDefs = MessageDefs> = (
  message: AnyMessage<TDefs>,
) => string;
```

### 12. Class-Based Serializers with Mismatch Detection

**Decision**: Enforce class-based serializers and use constructor name for mismatch detection across process boundaries.

**Rationale**:

- Serializers must match on both sides but can't be sent over IPC
- Class name provides reliable identifier that can be passed via env var
- Enables automatic detection of mismatches on worker startup
- Fails fast with clear error message
- Users must export named classes (not anonymous)
- Prevents subtle bugs from serializer mismatches

**Implementation**:

```typescript
abstract class Serializer {
  abstract serialize<T>(data: T): string | Buffer;
  abstract deserialize<T>(data: string | Buffer): T;
  abstract terminator: string | Buffer;
}

class JsonSerializer extends Serializer {
  serialize<T>(data: T): string {
    return JSON.stringify(data);
  }
  deserialize<T>(data: string | Buffer): T {
    return JSON.parse(data.toString());
  }
  terminator = '\n';
}

// Host passes serializer class name to worker
env.ISOLATED_WORKERS_SERIALIZER = serializer.constructor.name;

// Worker validates on startup
if (serializer.constructor.name !== process.env.ISOLATED_WORKERS_SERIALIZER) {
  throw new Error(
    `Serializer mismatch: host uses ${process.env.ISOLATED_WORKERS_SERIALIZER}, ` +
      `worker uses ${serializer.constructor.name}`,
  );
}
```

### 13. Pending Message Reference Management

**Decision**: Pending messages keep host process alive via `setTimeout` references (not unref'd).

**Rationale**:

- Pending messages represent active work that should complete
- Unreffing timeouts could cause unexpected process shutdown mid-operation
- Node.js ref counting ensures process stays alive while work is pending
- Users can explicitly `close()` worker if immediate shutdown needed
- Aligns with expected behavior: don't exit with work in flight
- Timeout cleanup happens when message completes or times out

**Behavior**:

- Each pending message increments Node's ref counter via `setTimeout`
- Process will not exit until all pending messages complete or timeout
- Explicit `close()` clears pending messages and allows exit
- Detached workers can still exit parent immediately (unref'd process, not timeouts)

## Consequences

### Positive

- Users have fine-grained control over worker behavior
- Per-instance middleware enables worker-specific pipelines
- Serializer+terminator coupling prevents misconfiguration
- Class-based serializers enable automatic mismatch detection
- Enhanced type system improves DX significantly
- Generic options provide better type inference
- Separation of concerns between client and server config
- Nested connection config groups related options
- Custom backoff functions enable flexible retry strategies
- Disconnect/reconnect methods enable connection lifecycle control
- Exported helper types improve user code type safety
- Pending messages prevent unexpected shutdown mid-operation

### Negative

- More configuration options increase API surface area
- Users must ensure shared options (serializer, logger) match across boundaries
- Breaking change from global middleware to per-instance
- More complex implementation for MetaLogger pattern
- Class-based serializer requirement may be restrictive for some use cases
- Serializer mismatch detection relies on class names (must be unique)
- Pending messages keep process alive (users must explicitly close)

### Migration Path

- Global middleware: Move to per-worker/server configuration
- Debug flag: Replace with `logLevel: 'debug'`
- Default behavior preserved where possible

## References

- Previous ADR: `.ai/design-decisions/006-core-worker-implementation.md`
- Implementation plan: `.ai/plans/07-enhanced-configuration.md` (to be created)
- Current implementation: `packages/isolated-workers/src/core/`
