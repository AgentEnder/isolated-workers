# Phase 2: Architecture Design

## Overview

Define architecture for isolated-workers library, balancing type safety, performance, and developer experience.

## Core Architecture

### Layered Design

Following cli-forge pattern, the library will have three conceptual layers:

```
┌─────────────────────────────────────────────────────┐
│                  isolated-workers                     │
│  - Public API (createWorker, types)              │
│  - Worker lifecycle management                     │
│  - Pool management (future)                      │
├─────────────────────────────────────────────────────┤
│                     Core Components                     │
│  - Worker spawner                               │
│  - Connection manager                            │
│  - Messaging layer                               │
│  - Socket utilities                               │
└─────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
src/
├── index.ts                    # Public API exports
├── core/
│   ├── worker.ts            # Worker process script
│   ├── connection.ts        # Client connection manager
│   ├── messaging.ts         # Type-safe messaging layer
│   └── lifecycle.ts         # Worker lifecycle (future: pool)
├── utils/
│   ├── socket.ts            # Socket utilities
│   ├── serializer.ts        # Error serialization
│   ├── paths.ts             # OS-specific paths
│   └── logger.ts            # Debug logging
└── types/
    ├── public-api.ts        # User-facing types
    ├── internal.ts          # Internal types
    └── worker-api.ts       # Worker communication types
```

## Core Components

### 1. Worker Spawner (`core/worker.ts`)

**Responsibilities:**

- Fork worker process with custom entry point
- Set up Unix domain socket server (or named pipe on Windows)
- Route incoming messages to registered handlers
- Handle connection timeouts and startup errors
- Graceful shutdown on disconnect

**Key patterns from Nx:**

- `setErrorTimeout()` for timeout management with NX_PLUGIN_NO_TIMEOUTS bypass
- `consumeMessagesFromSocket()` wrapper for TCP-safe message handling
- Event-driven architecture (connection, data, end events)

**Worker Entry Point:**

```typescript
// Worker script entry
const socketPath = process.argv[2];
const expectedWorkerName = process.argv[3];

// Define handlers - return raw payloads, infrastructure wraps them
const handlers: Handlers<MyMessageDefs> = {
  load: async (payload) => {
    // Process and return raw result payload
    return { loaded: true, version: '1.0.0' };
  },
  compute: (payload) => {
    // Return computed value
    return { result: payload.data * 2 };
  },
  shutdown: () => {
    // Fire-and-forget, no response
    console.log('Shutting down...');
  }
};

// Set up socket server
const server = createServer((socket) => {
  // Route messages via consumeMessage
  socket.on(
    "data",
    consumeMessagesFromSocket((raw) => {
      const message = JSON.parse(raw.toString());
      if (isWorkerMessage(message)) {
        consumeMessage(socket, message, handlers);
      }
    }),
  );

  socket.on("end", () => {
    // Cleanup and exit
  });
});

server.listen(socketPath);
```

### 2. Connection Manager (`core/connection.ts`)

**Responsibilities:**

- Spawn worker process with correct environment
- Connect to worker socket with retry logic
- Manage transaction IDs for request/response pattern
- Track pending operations count
- Handle timeouts with configurable guards
- Clean shutdown (unref, close socket, kill process)

**Key patterns from Nx:**

- Transaction-based messaging with unique IDs (e.g., `${name}:${pid}:${type}:${seq}`)
- Promise-based request/response pattern
- Event emitter for lifecycle events
- `ensureAlive()` lazy reconnection

**Request/Response Pattern:**

```typescript
request<K extends WithResult<TDefs> & string>(
  type: K,
  payload: TDefs[K]['payload']
): Promise<ResultOf<TDefs, K>['payload']> {
  const tx = generateTxId(type);
  this.pendingCount++;

  return new Promise((resolve, reject) => {
    // Register promise resolver
    this.pendingPromises.set(tx, { resolve, reject });

    // Send message
    sendMessageOverSocket(socket, {
      type,
      payload,
      tx,
    } as MessageOf<TDefs, K>);

    // Timeout guard
    const timeout = setTimeout(() => {
      this.pendingPromises.delete(tx);
      reject(new Error(`Timeout: ${type} after 10 minutes`));
    }, MAX_MESSAGE_WAIT);
  });
}
```

### 3. Messaging Layer (`core/messaging.ts`)

**Responsibilities:**

- Define all message definitions using `DefineMessages<T>` pattern
- Provide type extraction helpers (`MessageOf`, `ResultOf`, `MessageResult`)
- Implement `consumeMessage()` that automatically wraps handler responses
- Type guards: `isWorkerMessage()`, `isWorkerResult()`
- Send messages with proper formatting over sockets

**Key patterns from Nx:**

- `DefineMessages<T>` for type-level message definitions
- Type extraction helpers: `MessageOf<T, K>`, `ResultOf<T, K>`, `WithResult<T>`
- Handlers return raw payloads, infrastructure wraps in result messages
- Explicit message type and result type arrays for type guards
- `sendMessageOverSocket()` with MESSAGE_END_SEQ delimiter

**Message Definition Pattern:**

```typescript
// Base message type with transaction ID
interface BaseMessage {
  tx: string;
}

// Message definition constraint
type MessageDef = {
  payload: unknown;
  result?: unknown;
};

type MessageDefs = Record<string, MessageDef>;

// Type-level construct for defining message sets
type DefineMessages<TDefs extends MessageDefs> = TDefs;

// Type extraction helpers
type WithResult<TDefs extends MessageDefs> = {
  [K in keyof TDefs]: TDefs[K] extends { result: unknown } ? K : never;
}[keyof TDefs];

type MessageOf<TDefs extends MessageDefs, K extends keyof TDefs> = BaseMessage & {
  type: K;
  payload: TDefs[K]['payload'];
};

type ResultOf<TDefs extends MessageDefs, K extends WithResult<TDefs>> = BaseMessage & {
  type: `${K & string}Result`;
  payload: TDefs[K]['result'];
};

type AllMessages<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: MessageOf<TDefs, K>;
}[keyof TDefs & string];

type AllResults<TDefs extends MessageDefs> = {
  [K in WithResult<TDefs> & string]: ResultOf<TDefs, K>;
}[WithResult<TDefs> & string];

// Handler type - returns just the result payload
type Handlers<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: (
    payload: TDefs[K]['payload']
  ) => TDefs[K] extends { result: unknown }
    ? MaybePromise<TDefs[K]['result'] | void>
    : MaybePromise<void>;
};

// Example message definitions
type WorkerMessageDefs = DefineMessages<{
  load: {
    payload: { config: string };
    result: { loaded: true };
  };
  compute: {
    payload: { data: number };
    result: { value: number };
  };
  shutdown: {
    payload: void;
  };
}>;

// Derived types
export type WorkerMessage = AllMessages<WorkerMessageDefs>;
export type WorkerResult = AllResults<WorkerMessageDefs>;
export type AnyMessage = WorkerMessage | WorkerResult;

// Map message type to its result type
export type MessageResult<T extends WorkerMessage['type']> = ResultOf<
  WorkerMessageDefs,
  T & WithResult<WorkerMessageDefs>
>;
```

**Message Handling Pattern:**

```typescript
// Explicit type arrays for type guards
const MESSAGE_TYPES: ReadonlyArray<WorkerMessage['type']> = [
  'load',
  'compute',
  'shutdown',
];

const RESULT_TYPES: ReadonlyArray<WorkerResult['type']> = [
  'loadResult',
  'computeResult',
];

export function isWorkerMessage(message: Serializable): message is WorkerMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    typeof message.type === 'string' &&
    (MESSAGE_TYPES as readonly string[]).includes(message.type)
  );
}

export function isWorkerResult(message: Serializable): message is WorkerResult {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    typeof message.type === 'string' &&
    (RESULT_TYPES as readonly string[]).includes(message.type)
  );
}

// Consume message and dispatch to handler
export async function consumeMessage(
  socket: Socket,
  raw: WorkerMessage,
  handlers: Handlers<WorkerMessageDefs>
): Promise<void> {
  const type = raw.type as keyof WorkerMessageDefs & string;
  const handler = handlers[type];

  // Type widening for dynamic dispatch - safe because types guarantee
  // message.type always indexes into the matching handler
  const resultPayload = await (
    handler as (
      payload: WorkerMessage['payload']
    ) => MaybePromise<unknown>
  )(raw.payload);

  // Infrastructure automatically wraps response
  if (resultPayload !== undefined && resultPayload !== null) {
    sendMessageOverSocket(socket, {
      type: `${type}Result` as WorkerResult['type'],
      payload: resultPayload,
      tx: raw.tx,
    } as WorkerResult);
  }
}

export function sendMessageOverSocket(
  socket: Socket,
  message: WorkerMessage | WorkerResult
): void {
  socket.write(JSON.stringify(message) + MESSAGE_END_SEQ);
}
```

### 4. Socket Utilities (`utils/socket.ts`)

**Responsibilities:**

- `MESSAGE_END_SEQ` constant for TCP packet handling
- `consumeMessagesFromSocket()` higher-order function
- Handle TCP packet fragmentation (messages split across packets)
- `isJsonMessage()` type guard

**Key patterns from Nx:**

- MESSAGE_END_SEQ with special character (code point 4) for safety
- Accumulate chunks until delimiter found
- Split multiple messages in single chunk by delimiter

### 5. Error Serialization (`utils/serializer.ts`)

**Responsibilities:**

- Convert errors to serializable format
- Preserve stack traces, error codes, and messages
- Support custom error properties

**Key patterns from Nx:**

- `createSerializableError()` function
- Extract error name, message, stack, code
- Handle special error types (e.g., EvalError)

## Type System Design

### Public API Types

```typescript
// Message definition type (user provides this)
export type MessageDefinitions = Record<string, {
  payload: unknown;
  result?: unknown;
}>;

// Worker options
export interface WorkerOptions<TDefs extends MessageDefinitions = never> {
  workerScript: string | URL;
  env?: Record<string, string>;
  timeout?: number;
  maxWorkers?: number; // Future
}

// Worker client with type-safe messaging
export interface WorkerClient<TDefs extends MessageDefinitions = never> {
  send<K extends keyof TDefs & string>(
    type: K,
    payload: TDefs[K]['payload']
  ): Promise<void>;

  request<K extends WithResult<TDefs> & string>(
    type: K,
    payload: TDefs[K]['payload']
  ): Promise<ResultOf<TDefs, K>['payload']>;

  shutdown(): Promise<void>;
  destroy(): void;

  readonly alive: boolean;
  readonly pendingCount: number;
}
```

### Internal Types

```typescript
// Base message type
type BaseMessage = { tx: string };

// Type extraction helpers
type MessageDefs = Record<string, { payload: unknown; result?: unknown }>;

type MessageOf<TDefs extends MessageDefs, K extends keyof TDefs> = BaseMessage & {
  type: K;
  payload: TDefs[K]['payload'];
};

type ResultOf<TDefs extends MessageDefs, K extends WithResult<TDefs>> = BaseMessage & {
  type: `${K & string}Result`;
  payload: TDefs[K]['result'];
};

type WithResult<TDefs extends MessageDefs> = {
  [K in keyof TDefs]: TDefs[K] extends { result: unknown } ? K : never;
}[keyof TDefs];

// Handler type - returns raw payload
type Handlers<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: (
    payload: TDefs[K]['payload']
  ) => TDefs[K] extends { result: unknown }
    ? MaybePromise<TDefs[K]['result'] | void>
    : MaybePromise<void>;
};

type PendingPromise = {
  promise: Promise<unknown>;
  resolve: (result?: any) => void;
  reject: (err: any) => void;
};
```

## Worker Lifecycle

### Startup Sequence

1. **Parent Process**
   - Generate unique socket path
   - Spawn worker process with socket path argument
   - Wait for socket to be available (poll with exponential backoff)
   - Send initial "load" message

2. **Worker Process**
   - Create socket server at specified path
   - Listen for connections
   - On first connection, route messages to handlers
   - Handle connection timeout (default 5s, configurable via env)

### Message Flow

1. **Request/Response:**
   - Parent: Generate transaction ID → Send message → Wait for response
   - Worker: Receive message → Process → Send response with same tx ID
   - Parent: Match response to pending promise → Resolve

2. **Fire-and-Forget:**
   - Parent: Send message without waiting for response
   - Worker: Receive → Process (no response)

### Shutdown Sequence

1. **Graceful Shutdown:**
   - Parent: Send shutdown message → Wait for acknowledgment (optional)
   - Worker: Stop accepting new connections → Process pending → Close socket → Exit(0)
   - Parent: Unref socket → Remove from pool (if pooling)

2. **Forced Shutdown:**
   - Parent: Kill process → Cleanup socket file
   - Worker: Exit immediately (cleanup in process.on('exit'))

## Performance Considerations

### Optimizations

1. **Message Batching**: Consider supporting batch operations to reduce IPC roundtrips
2. **Worker Reuse**: In future, pool workers instead of spawning per request
3. **Binary Serialization**: Consider using MessagePack/protobuf for large payloads (future)

### Metrics Hooks

- `onWorkerSpawn(worker)` - Called when worker starts
- `onWorkerShutdown(worker, duration)` - Called when worker exits
- `onMessage(message, duration)` - Called for each message (debug mode)

## Error Handling Strategy

### Error Categories

1. **Connection Errors**
   - Socket not available → Retry with backoff
   - Connection timeout → Fail with clear message
   - Permission denied → Fail with actionable message

2. **Message Errors**
   - Parse errors → Log and drop (corrupted message)
   - Timeout → Reject promise, clean up handler
   - Unknown message type → Log warning, drop

3. **Process Errors**
   - Worker exit code non-zero → Reconstruct worker if pooling
   - Worker crash (uncaughtException) → Report, don't respawn (safety)
   - Out of memory → Document scaling requirements

### Error Propagation

- Worker errors: Serialize via `createSerializableError()` → Send to parent → Parent throws
- Parent errors: Log, optionally send to worker (for monitoring)

## Future Extensions

### Phase 3+ Considerations

1. **Worker Pool**
   - Multiple requests to same worker type
   - Load balancing across workers
   - Idle timeout and max pool size

2. **Streaming**
   - Large data transfer via streams
   - Progress callbacks
   - Cancellation support

3. **Monitoring**
   - Health check messages
   - Performance metrics collection
   - Worker resource usage

## Architecture Principles

1. **Type Safety First**: All APIs fully typed, no `any` in public API
2. **Explicit Over Magic**: Clear APIs, no implicit behavior
3. **Fail Fast**: Errors detected early with actionable messages
4. **Zero Dependency**: Minimal dependencies (only Node.js built-ins initially)
5. **Cross-Platform**: Works on Linux, macOS, Windows
