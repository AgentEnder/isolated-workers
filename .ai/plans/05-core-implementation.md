# Phase 5: Core Implementation

## Overview

Implement the core worker library components: worker spawner, connection manager, and type-safe messaging layer with cross-platform support, middleware, and pluggable serialization.

## Dependencies

- Phase 3: Package structure and build setup
- Phase 4: Type safety infrastructure

## Components

### 1. Worker Spawner (`packages/isolated-workers/src/core/worker.ts`)

Spawns worker processes and manages their lifecycle.

**Responsibilities:**

- Spawn child processes with proper environment
- Create and manage socket server for IPC
- Handle process startup and graceful shutdown
- Manage socket cleanup on exit

**Key Functions:**

```typescript
interface WorkerOptions {
  script: string;
  env?: Record<string, string>;
  timeout?: number;
  socketPath?: string;
}

interface WorkerHandle {
  pid: number;
  socketPath: string;
  send: <T>(message: Message<T>) => Promise<void>;
  close: () => Promise<void>;
}

export async function createWorker(
  options: WorkerOptions
): Promise<WorkerHandle>;
export async function shutdownWorker(handle: WorkerHandle): Promise<void>;
```

### 2. Connection Manager (`packages/isolated-workers/src/core/connection.ts`)

Manages persistent connections with retry logic and timeout handling.

**Responsibilities:**

- Establish and maintain socket connections
- Reconnect on failure with exponential backoff
- Track pending operations
- Emit lifecycle events (connect, disconnect, error)

**Key Functions:**

```typescript
interface ConnectionOptions {
  socketPath: string;
  reconnect?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

interface Connection {
  socket: Socket;
  send: <T>(message: Message<T>) => Promise<void>;
  onMessage: (handler: (message: Message<unknown>) => void) => void;
  close: () => Promise<void>;
}

export async function createConnection(
  options: ConnectionOptions
): Promise<Connection>;
```

**Retry Strategy:**

- Exponential backoff: `delay = baseDelay * 2^attempt`
- Max retry limit (default: 5)
- Jitter to prevent thundering herd

### 3. Messaging Layer (`packages/isolated-workers/src/core/messaging.ts`)

Type-safe message handling with transaction IDs, middleware support, and pluggable serialization.

**Responsibilities:**

- Define message types with `DefineMessages<T>` pattern
- Serialize/deserialize messages
- Handle request/response correlation
- Error serialization across process boundaries
- Middleware for observing/transforming messages
- Pluggable serializer interface

**Key Types:**

```typescript
interface BaseMessage {
  tx: string;
}

type MessageDef = {
  payload: unknown;
  result?: unknown;
};

type MessageDefs = Record<string, MessageDef>;

type DefineMessages<TDefs extends MessageDefs> = TDefs;

type MessageOf<
  TDefs extends MessageDefs,
  K extends keyof TDefs
> = BaseMessage & {
  type: K;
  payload: TDefs[K]['payload'];
};

type ResultOf<
  TDefs extends MessageDefs,
  K extends keyof TDefs
> = BaseMessage & {
  type: `${K & string}Result`;
  payload: TDefs[K] extends { result: infer R } ? R : never;
};

type WithResult<TDefs extends MessageDefs> = {
  [K in keyof TDefs]: TDefs[K] extends { result: unknown } ? K : never;
}[keyof TDefs];
```

**Middleware Support:**

```typescript
type MiddlewareDirection = 'send' | 'receive';

interface MiddlewareContext {
  direction: MiddlewareDirection;
  message: unknown;
}

type Middleware = (context: MiddlewareContext) => unknown | Promise<unknown>;

export function registerMiddleware(middleware: Middleware): void;
```

**Serializer Interface:**

```typescript
interface Serializer {
  serialize<T>(data: T): string | Buffer;
  deserialize<T>(data: string | Buffer): T;
}

export const defaultSerializer: Serializer;
export function setSerializer(serializer: Serializer): void;
```

**Message Serializer:**

```typescript
export function serializeMessage<T>(message: Message<T>): string;
export function deserializeMessage<T>(data: string): Message<T>;
export function serializeError(error: Error): SerializedError;
export function deserializeError(serialized: SerializedError): Error;
```

### 4. Platform Layer (`packages/isolated-workers/src/platform/`)

Cross-platform socket support with automatic adapter selection.

**Socket Adapter Interface (`socket.ts`):**

```typescript
interface SocketAdapter {
  createServer(path: string): Server;
  createClient(path: string): Socket;
  cleanup(path: string): void;
}

export function getSocketAdapter(): SocketAdapter;
export function getSocketPath(): string;
```

**Unix Implementation (`unix.ts`):**

```typescript
export const unixSocketAdapter: SocketAdapter;
```

**Windows Implementation (`windows.ts`):**

```typescript
export const windowsSocketAdapter: SocketAdapter;
```

### 5. Utilities

#### Error Serialization (`packages/isolated-workers/src/utils/serializer.ts`)

```typescript
export interface SerializedError {
  message: string;
  name: string;
  stack?: string;
  code?: string;
}

export function serializeError(error: Error): SerializedError;
export function deserializeError(serialized: SerializedError): Error;
```

#### Path Utilities (`packages/isolated-workers/src/utils/paths.ts`)

```typescript
export function getTempDir(): string;
export function generateSocketPath(): string;
export function cleanupSocketPath(path: string): void;
```

#### Logger (`packages/isolated-workers/src/utils/logger.ts`)

```typescript
export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

export function createLogger(namespace: string): Logger;
```

## File Structure

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
│   ├── paths.ts          # Path utilities
│   └── logger.ts         # Debug logging
└── index.ts              # Public exports
```

## Worker Lifecycle

```
1. Spawn: Parent creates worker process + socket server
2. Connect: Parent connects to worker's socket
3. Message: Send request → Process → Receive response
4. Shutdown: Close connection → Stop worker → Cleanup
```

## Public API

### Worker Client

```typescript
export interface WorkerClient<TMessages extends MessageDefs> {
  send<K extends keyof TMessages>(
    type: K,
    payload: TMessages[K]['payload']
  ): Promise<TMessages[K] extends { result: infer R } ? R : void>;
  close(): Promise<void>;
}

export async function createWorkerClient<TMessages extends MessageDefs>(
  options: WorkerOptions
): Promise<WorkerClient<TMessages>>;
```

### Worker Server

```typescript
export type Handlers<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: (
    payload: TDefs[K]['payload']
  ) => TDefs[K] extends { result: infer R }
    ? MaybePromise<R | void>
    : MaybePromise<void>;
};

export function startWorkerServer<TMessages extends MessageDefs>(
  handlers: Handlers<TMessages>
): void;
```

## Implementation Order

1. **Platform layer** - Socket adapters for Unix/Windows
2. **Serializer** - Pluggable serialization with default JSON
3. **Logger** - Debug support
4. **Messaging layer** - Type definitions, middleware, serialization
5. **Connection manager** - Socket connections with retry
6. **Worker spawner** - Process lifecycle management
7. **Public API** - Worker client/server exports

## Error Handling

### Connection Errors

- Connection refused → Retry with backoff
- Timeout → Abort with clear error message
- Socket closed → Attempt reconnect if configured

### Worker Errors

- Spawn failure → Throw with process error details
- Startup timeout → Kill process and throw
- Runtime errors → Serialize and propagate

### Message Errors

- Invalid message format → Throw parse error
- Unknown message type → Log warning, continue
- Handler error → Serialize and return as result error

## Success Criteria

- [ ] Worker spawns successfully
- [ ] Socket connection established (cross-platform)
- [ ] Messages sent and received with type safety
- [ ] Request/response pairing works (transaction IDs)
- [ ] **Middleware**: Single middleware with direction context functional
- [ ] **Custom serializer**: Users can inject custom serialization
- [ ] Proper error handling and serialization
- [ ] Clean shutdown sequence
- [ ] Unit tests for all components
- [ ] E2E test: full spawn → message → shutdown workflow
- [ ] **Cross-platform**: Works on Unix and Windows

## Next Steps

After core implementation:

1. Add comprehensive unit tests
2. Build E2E test suite
3. Create usage examples
4. Set up documentation site
