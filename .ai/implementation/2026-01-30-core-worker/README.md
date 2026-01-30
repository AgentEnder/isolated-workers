# Core Worker Implementation - Phase 3

## Overview

Implement the core worker process functionality: spawning, connection management, and type-safe messaging.

## Status: 📋 PLANNING

This phase implements the worker infrastructure defined in the architecture plan.

## Dependencies

- ✅ Package structure complete
- ✅ Type safety infrastructure (DefineMessages, type-tests)
- ✅ Build system working

## What We're Building

Based on the architecture plan (`02-architecture.md`), we need to implement:

### Core Components

#### 1. Worker Spawner (`core/worker.ts`)

- Worker process spawning using Node.js child_process
- Cross-platform socket path generation (Unix domain sockets / named pipes)
- Platform detection and automatic adapter selection
- Worker entry point script
- Process lifecycle management (spawn, monitor, shutdown)

#### 2. Connection Manager (`core/connection.ts`)

- Client-side connection to worker socket
- Connection establishment with retry logic
- Timeout handling
- Error recovery

#### 3. Messaging Layer (`core/messaging.ts`)

- Message serialization/deserialization
- Transaction ID management for request/response pairing
- Type-safe message sending and receiving
- Handler dispatch system
- Middleware support (single handler with direction context)
- Pluggable serializer interface

## Implementation Details

### Worker Lifecycle

```
1. Spawn: Parent creates worker process + socket server
2. Connect: Parent connects to worker's socket
3. Message: Send request → Process → Receive response
4. Shutdown: Close connection → Stop worker → Cleanup
```

### Key Files to Create

```
packages/isolated-workers/src/
├── core/
│   ├── worker.ts         # Worker spawner
│   ├── connection.ts     # Connection manager
│   ├── messaging.ts      # Message layer
│   └── index.ts          # Barrel exports
├── platform/
│   ├── socket.ts         # Socket adapter interface
│   ├── unix.ts           # Unix domain socket implementation
│   └── windows.ts        # Named pipe implementation
├── utils/
│   ├── serializer.ts     # Pluggable serialization (default: JSON)
│   └── logger.ts         # Debug logging
└── index.ts              # Update public exports
```

## Public API

The goal is to provide:

```typescript
// Create and manage a worker
const worker = await createWorker({
  workerScript: './my-worker.js',
  timeout: 60000,
});

// Send type-safe messages
const result = await worker.send('compute', { data: [1, 2, 3] });
// result typed as { sum: number }

// Clean shutdown
await worker.shutdown();
```

## Success Criteria

- [ ] Worker spawns successfully
- [ ] Socket connection established (cross-platform)
- [ ] Messages sent and received with type safety
- [ ] Request/response pairing works (transaction IDs)
- [ ] Proper error handling and serialization
- [ ] Clean shutdown sequence
- [ ] Unit tests for all components
- [ ] E2E test: full spawn → message → shutdown workflow
- [ ] **Cross-platform**: Works on Unix and Windows
- [ ] **Middleware**: Single middleware with direction context functional
- [ ] **Custom serializer**: Users can inject custom serialization

## In Scope for This Phase

### Cross-Platform Support

- Unix domain sockets (\*nix)
- Named pipes (Windows)
- Platform detection and automatic adapter selection

### Middleware Support

- Single middleware function with direction context ('send' | 'receive')
- Observing and transforming messages/responses
- Simple registration API

### Customizable Serializer

- Pluggable serialization interface
- Default JSON serializer with error serialization support
- Allow users to provide custom serializers (e.g., for binary data)

## Notes

- Keep it simple for MVP - single worker, basic lifecycle
- Follow patterns from Nx isolation code
- Use existing type infrastructure (DefineMessages)
- Cross-platform from day one: Unix sockets + Windows named pipes
- Middleware allows observability without core complexity
- Serializer interface enables custom protocols and binary data
