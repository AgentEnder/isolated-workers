# ADR 006: Core Worker Implementation

## Status

Accepted

## Context

We need to implement the core worker infrastructure following the patterns established in the implementation plan. Key design decisions needed to be made about cross-platform support, middleware, serialization, and the worker lifecycle.

## Decisions

### 1. Cross-Platform Socket Support

**Decision**: Support both Unix domain sockets (\*nix) and Windows named pipes through a platform adapter pattern.

**Rationale**:

- Node.js abstracts most socket operations, but path generation differs
- Unix uses filesystem paths (`/tmp/...` or abstract sockets)
- Windows uses named pipe paths (`\\.\pipe\...`)
- Platform detection happens at runtime via `process.platform`

**Implementation**:

```typescript
interface SocketAdapter {
  createServer(path: string): Server;
  createClient(path: string): Socket;
  cleanup(path: string): void;
}
```

### 2. Middleware with Direction Context

**Decision**: Support a single middleware function with direction context (`'send' | 'receive'`) rather than separate pre/post hooks.

**Rationale**:

- Simpler API - one registration point
- Direction context allows observing both directions
- Can transform messages in either direction
- Reduces complexity while maintaining flexibility

**Implementation**:

```typescript
type MiddlewareDirection = 'send' | 'receive';

interface MiddlewareContext {
  direction: MiddlewareDirection;
  message: unknown;
}

type Middleware = (context: MiddlewareContext) => unknown | Promise<unknown>;
```

### 3. Pluggable Serializer Interface

**Decision**: Provide a pluggable serializer interface with a default JSON implementation.

**Rationale**:

- Users may need custom serialization (binary data, compression, etc.)
- Error serialization needs special handling to preserve stack traces
- Simple interface that can be swapped globally

**Implementation**:

```typescript
interface Serializer {
  serialize<T>(data: T): string | Buffer;
  deserialize<T>(data: string | Buffer): T;
}

interface SerializedError {
  message: string;
  name: string;
  stack?: string;
  code?: string;
}
```

### 4. Worker Lifecycle

**Decision**: Four-phase lifecycle with explicit state transitions.

**Rationale**:

- Clear separation of concerns
- Allows proper cleanup at each phase
- Easier to debug and test
- Prevents resource leaks

**Phases**:

1. **Spawn**: Create process + socket server
2. **Connect**: Establish parent-to-worker connection
3. **Message**: Send/receive with transaction IDs
4. **Shutdown**: Close connection → Stop worker → Cleanup

### 5. Transaction IDs for Request/Response

**Decision**: Use UUID-based transaction IDs for pairing requests with responses.

**Rationale**:

- Allows multiple concurrent in-flight requests
- Simple correlation mechanism
- Can use `crypto.randomUUID()` (Node.js 14.17+)
- Cleared from pending map when response received

**Implementation**:

```typescript
interface BaseMessage {
  tx: string; // Transaction ID
}
```

### 6. Error Serialization Strategy

**Decision**: Serialize errors to a plain object that can cross process boundaries, then reconstruct.

**Rationale**:

- Error instances cannot be directly serialized
- Need to preserve essential properties (message, stack, code)
- Special handling for common error types (e.g., Node.js errors with `code`)

**Implementation**:

```typescript
export function serializeError(error: Error): SerializedError;
export function deserializeError(serialized: SerializedError): Error;
```

### 7. Connection Retry with Exponential Backoff

**Decision**: Implement exponential backoff with jitter for connection retries.

**Rationale**:

- Worker startup takes time (socket creation)
- Exponential backoff prevents overwhelming the system
- Jitter prevents thundering herd when multiple workers start

**Formula**:

```
delay = baseDelay * 2^attempt + jitter(0-100ms)
```

### 8. Handler Return Value Pattern

**Decision**: Handlers return raw payloads; infrastructure wraps them automatically.

**Rationale**:

- Simpler handler code - just return the result
- Consistent with Nx's pattern
- Infrastructure handles the response message format
- Type inference works better this way

## Consequences

### Positive

- Clean separation between platform-specific code and core logic
- Flexible middleware system without over-engineering
- Users can customize serialization for their needs
- Clear lifecycle makes debugging easier
- Transaction IDs enable concurrent request handling

### Negative

- Additional complexity for cross-platform support
- Global serializer state could be problematic in multi-tenant scenarios
- Single middleware may be limiting for complex use cases

## References

- Implementation: `.ai/implementation/2026-01-30-core-worker/`
- Plan: `.ai/plans/05-core-implementation.md`
- Nx isolation patterns: `../nx/packages/nx/src/project-graph/plugins/isolation/`
