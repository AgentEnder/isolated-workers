# Architecture and Component Structure

## Decision: Layered Architecture (3 Layers)

**Status**: ✅ Accepted  
**Context**: Organize library for maintainability and extensibility  
**Alternatives Considered**: Flat structure, Hexagonal architecture  
**Rationale**:

- Clear separation of concerns
- Easy to understand for new contributors
- Allows for future extensions (pools, streaming)
- Matches proven pattern from Nx isolation code

**Layers**:

1. **Public API Layer**: User-facing exports, worker lifecycle
2. **Core Components**: Worker spawner, connection manager, messaging
3. **Utilities**: Socket helpers, serialization, paths, logging

## Decision: Worker Entry Point Pattern

**Status**: ✅ Accepted  
**Context**: Define how workers are initialized  
**Alternatives Considered**: Workers as modules, Workers as standalone scripts  
**Rationale**:

- Single entry point simplifies worker startup
- Socket path passed as argument (flexible)
- Worker name for debugging/validation
- Matches Nx pattern for familiarity

## Decision: Request/Response with Transaction IDs

**Status**: ✅ Accepted  
**Context**: Handle async communication between processes  
**Alternatives Considered**: Callback pattern, Event-based only  
**Rationale**:

- Promise-based API familiar to TypeScript developers
- Transaction IDs enable correlation of requests/responses
- Timeout guards prevent hanging operations
- Matches Nx's proven approach

## Decision: Message Definition System with Type Helpers

**Status**: ✅ Accepted  
**Context**: Ensure type safety across process boundaries with a clean type system  
**Alternatives Considered**: String-based messages, Class-based messages  
**Rationale**:

- Compile-time type checking with full inference
- Simplified type system with `DefineMessages<T>` pattern
- Type extraction helpers (`MessageOf`, `ResultOf`, `MessageResult`)
- Handlers return raw payloads, infrastructure handles wrapping
- Explicit type guards for runtime validation
- Clear and explicit message contracts

## Decision: Socket Communication Pattern

**Status**: ✅ Accepted  
**Context**: Communication channel between processes  
**Alternatives Considered**: stdin/stdout pipes, HTTP server  
**Rationale**:

- Full-duplex communication
- Bidirectional messaging
- More efficient than HTTP overhead
- Matches Nx's approach (proven at scale)

## Decision: Unix Domain Sockets / Named Pipes

**Status**: ✅ Accepted
**Context**: Cross-platform IPC mechanism
**Alternatives Considered**: Named pipes only, TCP sockets
**Rationale**:

- Unix domain sockets on \*nix (fastest)
- Named pipes on Windows (native support)
- OS-specific utilities for path management
- Better performance than TCP for local communication

## Decision: Handler Payload Return Pattern

**Status**: ✅ Accepted
**Context**: Define how handlers return responses
**Alternatives Considered**: Handlers return full message objects, Handlers return void
**Rationale**:

- Handlers return just the result payload, simpler and cleaner
- Infrastructure automatically wraps in result message
- Consistent with Nx3 approach
- Reduces boilerplate in handler code

**Pattern:**

```typescript
// Handler returns raw payload
const handlers = {
  load: async (payload: { config: string }) => {
    // Process and return just the result payload
    return { loaded: true };
  },
  compute: (payload: { data: number }) => {
    // Return the computed value
    return { value: payload.data * 2 };
  },
};

// Infrastructure wraps automatically
// { type: 'loadResult', payload: { loaded: true }, tx: '...' }
```

## Decision: Type Extraction Helper Library

**Status**: ✅ Accepted
**Context**: Provide reusable type helpers for message definitions
**Alternatives Considered**: Inline types, External library
**Rationale**:

- Core helpers: `MessageOf<T, K>`, `ResultOf<T, K>`, `WithResult<T>`
- Reduces type definition boilerplate
- Consistent type extraction patterns
- Easy to test and validate
- No external dependencies
