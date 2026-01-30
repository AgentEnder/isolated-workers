# Enhanced Configuration System - Implementation Details

## Overview

This document provides the technical implementation details (HOW) for the enhanced configuration system. It covers file changes, code structure, type definitions, and implementation steps.

## File Structure

```
packages/isolated-workers/src/
├── types/
│   ├── messages.ts           # Update DefineMessages to include AnyMessage
│   ├── helpers.ts            # Update helpers to exclude AnyMessage
│   └── index.ts              # Export updated types
├── core/
│   ├── worker.ts             # Update WorkerOptions, apply per-instance middleware
│   ├── worker-server.ts      # Update WorkerServerOptions, remove socketPath param
│   ├── messaging.ts          # Remove global middleware, add per-instance support
│   └── connection.ts         # Update with reconnection options
├── utils/
│   ├── logger.ts             # Add LogLevel, MetaLogger, update interface
│   ├── serializer.ts         # Update Serializer interface with terminator
│   └── index.ts              # Export updated utilities
└── index.ts                  # Export all public APIs
```

## Phase 1: Type System Enhancements

### File: `packages/isolated-workers/src/types/helpers.ts`

**Add `AnyMessage<TDefs>` and exported helper types:**

```typescript
/**
 * Union of all message types (requests and responses).
 * Use this for middleware, transaction ID generators, and other
 * functions that handle any message type.
 * 
 * @example
 * type MyMessages = DefineMessages<{
 *   load: { payload: { config: string }; result: { loaded: true } };
 * }>;
 * 
 * function middleware(msg: AnyMessage<MyMessages>) {
 *   console.log('Handling:', msg.type);
 * }
 */
export type AnyMessage<TDefs extends MessageDefs> = 
  | AllMessages<TDefs> 
  | AllResults<TDefs>;

/**
 * Middleware function type for message inspection/transformation.
 * Applied sequentially in the order provided.
 * 
 * @example
 * const logMiddleware: Middleware<MyMessages> = (msg, direction) => {
 *   console.log(`${direction}:`, msg.type);
 *   return msg;
 * };
 */
export type Middleware<TDefs extends MessageDefs = MessageDefs> = (
  message: AnyMessage<TDefs>,
  direction: 'incoming' | 'outgoing'
) => unknown | Promise<unknown>;

/**
 * Transaction ID generator function type.
 * Receives a message and returns a unique transaction ID string.
 * 
 * @example
 * const customGen: TransactionIdGenerator<MyMessages> = (msg) => {
 *   return `${msg.type}-${Date.now()}`;
 * };
 */
export type TransactionIdGenerator<TDefs extends MessageDefs = MessageDefs> = (
  message: AnyMessage<TDefs>
) => string;
```

**Note**: Other type helpers remain unchanged - no need for `Omit` since we're not adding synthetic properties to `DefineMessages`.

### File: `packages/isolated-workers/src/types/messages.ts`

**`DefineMessages` stays simple (no changes needed):**

```typescript
/**
 * Define a set of message types with their payloads and optional results.
 * 
 * @example
 * type MyMessages = DefineMessages<{
 *   load: { payload: { config: string }; result: { loaded: true } };
 *   compute: { payload: { data: number }; result: { value: number } };
 * }>;
 */
export type DefineMessages<TDefs extends MessageDefs> = TDefs;
```

### File: `packages/isolated-workers/src/types/index.ts`

**Export helper types:**

```typescript
export type {
  DefineMessages,
  BaseMessage,
  MessageDef,
  MessageDefs
} from './messages';

export type {
  MessageOf,
  ResultOf,
  WithResult,
  AllMessages,
  AllResults,
  AnyMessage,                  // Add this export
  Middleware,                  // Add this export
  TransactionIdGenerator,      // Add this export
  Handlers,
  PayloadOf,
  ResultPayloadOf,
  MaybePromise
} from './helpers';
```

### File: `packages/isolated-workers/src/types/__tests__/messages.type-test.ts`

**Add type tests for `AnyMessage<TDefs>`:**

```typescript
import { DefineMessages } from '../messages';
import type { MessageOf, ResultOf, AnyMessage } from '../helpers';

type TestMessages = DefineMessages<{
  load: { payload: { config: string }; result: { loaded: true } };
  compute: { payload: { data: number }; result: { value: number } };
  shutdown: { payload: void };
}>;

// Test: AnyMessage should include request messages
const loadMsg: AnyMessage<TestMessages> = {
  tx: '123',
  type: 'load',
  payload: { config: 'test' }
};

// Test: AnyMessage should include result messages
const loadResult: AnyMessage<TestMessages> = {
  tx: '123',
  type: 'loadResult',
  payload: { loaded: true }
};

// Test: Regular message access still works
type LoadMsg = MessageOf<TestMessages, 'load'>;
type LoadResult = ResultOf<TestMessages, 'load'>;

// Test: AnyMessage works with functions
function handleAny(msg: AnyMessage<TestMessages>): void {
  console.log(msg.type);
}

// Test: Type inference works
handleAny(loadMsg);
handleAny(loadResult);
```

## Phase 2: Serializer Enhancement

### File: `packages/isolated-workers/src/utils/serializer.ts`

**Convert to abstract class and add terminator:**

```typescript
/**
 * Abstract serializer class for custom message serialization.
 * Includes terminator sequence to delimit messages in the stream.
 * 
 * IMPORTANT: Must be a named class (not anonymous) for mismatch detection.
 */
export abstract class Serializer {
  /**
   * Serialize data to string or buffer
   */
  abstract serialize<T>(data: T): string | Buffer;
  
  /**
   * Deserialize string or buffer back to data
   */
  abstract deserialize<T>(data: string | Buffer): T;
  
  /**
   * Terminator sequence used to delimit messages in the stream.
   * Must be the same on both client and server.
   */
  abstract terminator: string | Buffer;
}

/**
 * Default JSON serializer with newline terminator
 */
export class JsonSerializer extends Serializer {
  serialize<T>(data: T): string {
    return JSON.stringify(data);
  }
  
  deserialize<T>(data: string | Buffer): T {
    return JSON.parse(data.toString());
  }
  
  terminator = '\n';
}

/**
 * Default serializer instance
 */
export const defaultSerializer = new JsonSerializer();

/**
 * Get the serializer terminator as a Buffer
 */
export function getTerminatorBuffer(serializer: Serializer): Buffer {
  if (Buffer.isBuffer(serializer.terminator)) {
    return serializer.terminator;
  }
  return Buffer.from(serializer.terminator);
}

/**
 * Validate that worker serializer matches host serializer.
 * Called on worker startup.
 */
export function validateSerializer(serializer: Serializer): void {
  const expectedName = process.env.ISOLATED_WORKERS_SERIALIZER;
  const actualName = serializer.constructor.name;
  
  if (expectedName && actualName !== expectedName) {
    throw new Error(
      `Serializer mismatch: host uses ${expectedName}, worker uses ${actualName}. ` +
      `Ensure both client and server use the same serializer class.`
    );
  }
}
```

### Update worker spawning to pass serializer class name

**File: `packages/isolated-workers/src/core/worker.ts`**

```typescript
async function spawnWorkerProcess(
  script: string,
  socketPath: string,
  env: Record<string, string>,
  serializer: Serializer,
  // ... other params
): Promise<ChildProcess> {
  const workerEnv = {
    ...process.env,
    ...env,
    ISOLATED_WORKERS_SOCKET_PATH: socketPath,
    ISOLATED_WORKERS_SERIALIZER: serializer.constructor.name  // Pass class name
  };

  // ... spawn process
}
```

### Validate serializer on worker startup

**File: `packages/isolated-workers/src/core/worker-server.ts`**

```typescript
export async function startWorkerServer<TDefs extends MessageDefs>(
  handlers: Handlers<TDefs>,
  options?: WorkerServerOptions<TDefs>
): Promise<WorkerServer> {
  const {
    serializer = defaultSerializer,
    // ... other options
  } = options ?? {};

  // Validate serializer matches host
  validateSerializer(serializer);

  // ... rest of implementation
}
```

### Update messaging to use serializer's terminator

**File: `packages/isolated-workers/src/core/messaging.ts`**

Update message sending to use serializer's terminator:

```typescript
export async function sendMessage<T>(
  socket: Socket,
  message: TypedMessage<T>,
  serializer: Serializer,
  middleware?: MiddlewareFn[]
): Promise<void> {
  // Apply outgoing middleware
  let processedMessage: unknown = message;
  if (middleware) {
    processedMessage = await applyMiddleware(message, 'outgoing', middleware);
  }

  const serialized = serializer.serialize(processedMessage);
  const terminator = getTerminatorBuffer(serializer);
  
  return new Promise((resolve, reject) => {
    const data = Buffer.isBuffer(serialized) 
      ? Buffer.concat([serialized, terminator])
      : Buffer.concat([Buffer.from(serialized), terminator]);
      
    socket.write(data, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
```

## Phase 3: Per-Instance Middleware

### File: `packages/isolated-workers/src/core/messaging.ts`

**Remove global middleware, add per-instance support:**

```typescript
// Import from types
import type { Middleware, AnyMessage } from '../types';

/**
 * Apply middleware array sequentially (left-to-right).
 * If any middleware throws, propagate the error immediately.
 */
async function applyMiddleware<TDefs extends MessageDefs>(
  message: AnyMessage<TDefs>,
  direction: 'incoming' | 'outgoing',
  middleware: Middleware<TDefs>[]
): Promise<unknown> {
  let result: unknown = message;
  
  for (const mw of middleware) {
    try {
      const output = await mw(result as AnyMessage<TDefs>, direction);
      // If middleware returns a value, use it; otherwise pass through
      if (output !== undefined) {
        result = output;
      }
    } catch (error) {
      // Middleware error - fail fast
      throw new Error(
        `Middleware error (${direction}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  return result;
}

// REMOVE: Global middleware registration functions
// DELETE: export function registerMiddleware(mw: Middleware): void
// DELETE: let middleware: Middleware | undefined;
```

### File: `packages/isolated-workers/src/core/worker.ts`

**Update `WorkerOptions` to accept middleware array:**

```typescript
import type { Middleware, TransactionIdGenerator } from '../types';

/**
 * Options for creating a worker
 */
export interface WorkerOptions<TDefs extends MessageDefs = MessageDefs> {
  /** Path to worker script */
  script: string;
  
  /** Environment variables to pass to worker */
  env?: Record<string, string>;
  
  /** Worker lifecycle options */
  startupTimeout?: number;        // Time to wait for worker to start (default: 30000ms)
  detached?: boolean;             // Detach worker process (default: false)
  spawnOptions?: SpawnOptions;    // Additional child process options
  
  /** Messaging options */
  middleware?: Middleware<TDefs>[];  // Per-instance middleware pipeline
  serializer?: Serializer;           // Custom serializer (default: JsonSerializer)
  txIdGenerator?: TransactionIdGenerator<TDefs>;  // Custom TX ID generator
  
  /** Connection options */
  connection?: {
    attempts?: number;                            // Max reconnection attempts (default: 5)
    delay?: number | ((attempt: number) => number);  // Delay in ms or function (default: 100)
    maxDelay?: number;                            // Max delay cap (default: 5000ms)
  };
  
  /** Logging options */
  logLevel?: LogLevel;            // Log level (default: 'error')
  logger?: Logger;                // Custom logger instance
  
  /** Advanced options */
  socketPath?: string;            // Override socket path (auto-generated if not provided)
}
```

**Update worker creation to pass middleware to connection:**

```typescript
export async function createWorker<TDefs extends MessageDefs>(
  options: WorkerOptions<TDefs>
): Promise<WorkerClient<TDefs>> {
  const {
    script,
    env = {},
    startupTimeout = 30000,
    detached = false,
    spawnOptions = {},
    middleware = [],
    serializer = defaultSerializer,
    txIdGenerator = defaultTxIdGenerator,
    connection: connectionConfig = {},
    logLevel = 'error',
    logger,
    socketPath: customSocketPath
  } = options;

  // Extract connection config
  const {
    attempts = 5,
    delay = 100,
    maxDelay = 5000
  } = connectionConfig;

  // Create logger
  const workerLogger = createMetaLogger(logger, logLevel);

  // ... spawn worker process ...

  // Create connection with per-instance middleware
  const connection = await createConnection({
    socketPath,
    middleware,
    serializer,
    txIdGenerator,
    reconnectAttempts: attempts,
    reconnectDelay: delay,
    reconnectMaxDelay: maxDelay,
    logger: workerLogger
  });

  // ... rest of implementation ...
}
```

### File: `packages/isolated-workers/src/core/worker-server.ts`

**Update `WorkerServerOptions` and remove socketPath parameter:**

```typescript
import type { Middleware, TransactionIdGenerator } from '../types';

/**
 * Options for creating a worker server
 */
export interface WorkerServerOptions<TDefs extends MessageDefs = MessageDefs> {
  /** Lifecycle options */
  hostConnectTimeout?: number;    // Time to wait for host to connect (default: 30000ms, 0 = forever)
  disconnectBehavior?: 'shutdown' | 'keep-alive';  // Behavior on disconnect (default: 'shutdown')
  
  /** Messaging options */
  middleware?: Middleware<TDefs>[];              // Per-instance middleware pipeline
  serializer?: Serializer;                        // Custom serializer (must match client!)
  txIdGenerator?: TransactionIdGenerator<TDefs>;  // Custom TX ID generator
  
  /** Logging options */
  logLevel?: LogLevel;            // Log level (default: 'error')
  logger?: Logger;                // Custom logger instance
}
```

## Phase 4: Logger and Log Levels

### File: `packages/isolated-workers/src/utils/logger.ts`

**Add `LogLevel`, update `Logger` interface, implement `MetaLogger`:**

```typescript
/**
 * Log level enum
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger interface - must implement all log level methods
 */
export interface Logger {
  debug(...parts: unknown[]): void;
  info(...parts: unknown[]): void;
  warn(...parts: unknown[]): void;
  error(...parts: unknown[]): void;
}

/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * MetaLogger wraps a logger and filters messages based on log level.
 * Suppresses errors thrown by the underlying logger.
 */
class MetaLogger implements Logger {
  private minPriority: number;

  constructor(
    private baseLogger: Logger,
    private level: LogLevel
  ) {
    this.minPriority = LOG_LEVEL_PRIORITY[level];
  }

  debug(...parts: unknown[]): void {
    if (LOG_LEVEL_PRIORITY.debug >= this.minPriority) {
      this.safeLog(() => this.baseLogger.debug(...parts));
    }
  }

  info(...parts: unknown[]): void {
    if (LOG_LEVEL_PRIORITY.info >= this.minPriority) {
      this.safeLog(() => this.baseLogger.info(...parts));
    }
  }

  warn(...parts: unknown[]): void {
    if (LOG_LEVEL_PRIORITY.warn >= this.minPriority) {
      this.safeLog(() => this.baseLogger.warn(...parts));
    }
  }

  error(...parts: unknown[]): void {
    if (LOG_LEVEL_PRIORITY.error >= this.minPriority) {
      this.safeLog(() => this.baseLogger.error(...parts));
    }
  }

  private safeLog(logFn: () => void): void {
    try {
      logFn();
    } catch (err) {
      // Suppress logger errors - logging shouldn't break functionality
      console.error('[MetaLogger] Logger error:', err);
    }
  }
}

/**
 * Default console-based logger
 */
export const defaultLogger: Logger = {
  debug: (...parts) => console.debug(...parts),
  info: (...parts) => console.info(...parts),
  warn: (...parts) => console.warn(...parts),
  error: (...parts) => console.error(...parts)
};

/**
 * Create a MetaLogger with the specified base logger and log level
 */
export function createMetaLogger(
  logger: Logger | undefined,
  level: LogLevel
): Logger {
  return new MetaLogger(logger ?? defaultLogger, level);
}

// DEPRECATED: Remove old debug-only logger
// DELETE: export function createLogger(namespace: string): Logger
// DELETE: export function setDebugEnabled(enabled: boolean): void
// DELETE: export function isDebug(): boolean
```

## Phase 5: Worker Lifecycle Options

### File: `packages/isolated-workers/src/core/worker.ts`

**Implement detached mode:**

```typescript
async function spawnWorkerProcess(
  script: string,
  socketPath: string,
  env: Record<string, string>,
  detached: boolean,
  spawnOptions: SpawnOptions,
  logger: Logger
): Promise<ChildProcess> {
  const workerEnv = {
    ...process.env,
    ...env,
    ISOLATED_WORKERS_SOCKET_PATH: socketPath
  };

  logger.debug(`Spawning worker: ${script}`);

  const child = spawn('node', [script], {
    ...spawnOptions,
    detached,
    env: workerEnv,
    stdio: spawnOptions.stdio ?? 'inherit'
  });

  // If detached, unref the process so it doesn't block parent exit
  if (detached) {
    child.unref();
    logger.debug(`Worker process ${child.pid} detached and unref'd`);
  }

  return child;
}
```

### File: `packages/isolated-workers/src/core/worker-server.ts`

**Implement server connection timeout and disconnect behavior:**

```typescript
export async function startWorkerServer<TDefs extends MessageDefs>(
  handlers: Handlers<TDefs>,
  options?: WorkerServerOptions<TDefs>
): Promise<WorkerServer> {
  // ... extract options ...

  // Validate serializer matches host
  validateSerializer(serializer);

  const server = createServer();
  let connectionSocket: Socket | null = null;
  let isRunning = true;

  // Host connection timeout
  let connectTimeoutHandle: NodeJS.Timeout | null = null;
  if (hostConnectTimeout > 0) {
    connectTimeoutHandle = setTimeout(() => {
      if (!connectionSocket && isRunning) {
        serverLogger.error(`Host did not connect within ${hostConnectTimeout}ms, shutting down`);
        stopServer();
      }
    }, hostConnectTimeout);
  }

  server.on('connection', (socket) => {
    // Clear connection timeout - host connected
    if (connectTimeoutHandle) {
      clearTimeout(connectTimeoutHandle);
      connectTimeoutHandle = null;
    }

    connectionSocket = socket;
    serverLogger.info('Host connected to worker server');

    socket.on('close', () => {
      serverLogger.info('Host disconnected');
      connectionSocket = null;

      if (disconnectBehavior === 'shutdown') {
        serverLogger.info('Shutting down server (disconnectBehavior: shutdown)');
        stopServer();
      } else {
        serverLogger.info('Keeping server alive (disconnectBehavior: keep-alive)');
      }
    });

    // ... handle messages with per-instance middleware ...
  });

  // ... rest of implementation ...
}
```

### Update WorkerClient interface

**File: `packages/isolated-workers/src/core/worker.ts`**

Add disconnect/reconnect methods and isConnected property:

```typescript
export interface WorkerClient<TMessages extends MessageDefs> {
  /**
   * Send a message to the worker and wait for response
   */
  send<K extends keyof TMessages>(
    type: K,
    payload: PayloadOf<TMessages, K>
  ): Promise<TMessages[K] extends { result: infer R } ? R : void>;
  
  /**
   * Close connection and terminate worker process completely
   */
  close(): Promise<void>;
  
  /**
   * Disconnect from worker but keep process alive (keep-alive mode only)
   */
  disconnect(): Promise<void>;
  
  /**
   * Reconnect to existing worker (keep-alive mode only)
   */
  reconnect(): Promise<void>;
  
  /** Worker process ID */
  pid: number;
  
  /** Whether worker process is active */
  isActive: boolean;
  
  /** Whether connection to worker is active */
  isConnected: boolean;
}
```

**Implementation notes**:
- `disconnect()` closes socket but doesn't kill process
- `reconnect()` creates new socket connection to existing process
- Both methods check if server has `keep-alive` behavior
- Throw clear error if used with `shutdown` behavior

## Phase 6: Reconnection Configuration

### File: `packages/isolated-workers/src/core/connection.ts`

**Update connection options and retry logic with custom delay function:**

```typescript
export interface ConnectionOptions<TDefs extends MessageDefs = MessageDefs> {
  socketPath: string;
  middleware?: Middleware<TDefs>[];
  serializer?: Serializer;
  txIdGenerator?: TransactionIdGenerator<TDefs>;
  reconnectAttempts?: number;                        // Default: 5
  reconnectDelay?: number | ((attempt: number) => number);  // Default: 100ms
  reconnectMaxDelay?: number;                        // Default: 5000ms
  logger?: Logger;
}

/**
 * Calculate delay for connection retry.
 * Supports both number (exponential backoff) and function (custom curve).
 */
function calculateDelay(
  config: number | ((attempt: number) => number),
  attempt: number,
  maxDelay: number
): number {
  let delay: number;
  
  if (typeof config === 'function') {
    // Custom delay function
    delay = config(attempt);
    
    // Validate return value
    if (typeof delay !== 'number' || delay < 0 || !isFinite(delay)) {
      throw new Error(
        `Delay function must return a positive number, got: ${delay}`
      );
    }
  } else {
    // Exponential backoff: baseDelay * 2^attempt
    delay = config * Math.pow(2, attempt);
  }
  
  // Apply max delay cap
  delay = Math.min(delay, maxDelay);
  
  // Add jitter (0-100ms) to prevent thundering herd
  const jitter = Math.random() * 100;
  
  return delay + jitter;
}

async function connectWithRetry(
  socketPath: string,
  maxAttempts: number,
  delayConfig: number | ((attempt: number) => number),
  maxDelay: number,
  logger: Logger
): Promise<Socket> {
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      logger.debug(`Connection attempt ${attempt + 1}/${maxAttempts}`);
      return await createSocketConnection(socketPath);
    } catch (error) {
      attempt++;
      
      if (attempt >= maxAttempts) {
        throw new Error(
          `Failed to connect after ${maxAttempts} attempts: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Calculate delay with custom or exponential backoff
      const delay = calculateDelay(delayConfig, attempt, maxDelay);

      logger.debug(`Retrying in ${delay.toFixed(0)}ms...`);
      await sleep(delay);
    }
  }

  throw new Error('Unreachable'); // TypeScript exhaustiveness
}
```

## Phase 7: Transaction ID Generator

**File: `packages/isolated-workers/src/core/messaging.ts`**

**Update message creation to accept custom TX ID generator:**

```typescript
import type { TransactionIdGenerator } from '../types';

/**
 * Default transaction ID generator using crypto.randomUUID()
 */
export const defaultTxIdGenerator: TransactionIdGenerator = (_message) => {
  return randomUUID();
};

/**
 * Create a request message with transaction ID
 */
export function createRequest<TDefs extends MessageDefs, K extends keyof TDefs>(
  type: K,
  payload: PayloadOf<TDefs, K>,
  txIdGenerator: TransactionIdGenerator<TDefs> = defaultTxIdGenerator
): MessageOf<TDefs, K> {
  const message = {
    type,
    payload,
    tx: '' // Placeholder
  } as MessageOf<TDefs, K>;
  
  // Generate TX ID from the message
  message.tx = txIdGenerator(message);
  
  return message;
}
```

## Pending Message Reference Management

### File: `packages/isolated-workers/src/core/worker.ts`

**Document and maintain setTimeout refs for pending messages:**

```typescript
/**
 * Send a message to the worker and wait for the response.
 * 
 * IMPORTANT: Pending messages keep the host process alive via setTimeout
 * references. This is intentional - the process should not exit while work
 * is in flight. To exit immediately, call worker.close() to clear pending
 * messages.
 * 
 * Note: Detached workers don't block parent exit (process is unref'd), but
 * pending message timeouts DO block exit. This ensures work completes even
 * for detached workers.
 */
async send<K extends keyof TMessages>(
  type: K,
  payload: PayloadOf<TMessages, K>
): Promise<ResultPayloadOf<TMessages, K>> {
  const message = createRequest(type, payload, this.txIdGenerator);
  
  return new Promise((resolve, reject) => {
    // Set timeout for pending request - this IS ref'd (keeps process alive)
    const timeoutHandle = setTimeout(() => {
      this.pendingRequests.delete(message.tx);
      reject(new Error(`Request timeout after ${this.timeout}ms`));
    }, this.timeout);
    
    // Store pending request with timeout handle
    this.pendingRequests.set(message.tx, {
      resolve,
      reject,
      timeoutHandle
    });
    
    // Send message
    this.connection.send(message).catch(reject);
  });
}

/**
 * Close worker connection and terminate process.
 * Clears all pending messages to allow process exit.
 */
async close(): Promise<void> {
  // Clear all pending requests (clears setTimeout refs)
  for (const [tx, pending] of this.pendingRequests.entries()) {
    clearTimeout(pending.timeoutHandle);
    pending.reject(new Error('Worker closed'));
  }
  this.pendingRequests.clear();
  
  // ... close connection and kill process
}
```

**Key behaviors**:
- Pending message timeouts use `setTimeout` without `unref()` 
- This intentionally keeps the process alive while work is pending
- `close()` clears all pending messages (clears timeouts) to allow exit
- Detached workers: process is unref'd, but timeouts are not
- Document this clearly in API docs and examples

## Testing

### Unit Tests

**File: `packages/isolated-workers/src/core/__tests__/middleware.test.ts`**

Test per-instance middleware:
- Sequential application (left-to-right)
- Middleware can transform messages
- Middleware errors propagate
- Async middleware support
- Per-instance isolation

**File: `packages/isolated-workers/src/utils/__tests__/logger.test.ts`**

Test MetaLogger:
- Log level filtering works correctly
- Logger errors are suppressed
- Custom loggers are called
- Default logger uses console

**File: `packages/isolated-workers/src/utils/__tests__/serializer.test.ts`**

Test serializer with terminators:
- String terminators work
- Buffer terminators work
- Custom serializers can be provided

### Integration Tests

**File: `packages/isolated-workers/src/__tests__/detached-worker.test.ts`**

Test detached workers:
- Worker doesn't block parent exit
- Worker continues running when detached
- Unref is called correctly

**File: `packages/isolated-workers/src/__tests__/reconnection.test.ts`**

Test reconnection with custom settings:
- Retry attempts configurable
- Delay configurable
- Max delay cap works
- Exponential backoff with jitter

### Type Tests

**File: `packages/isolated-workers/src/types/__tests__/any-message.type-test.ts`**

Test AnyMessage type:
- Helper type works correctly
- Includes all request and response types
- Type helpers don't need `Omit` (cleaner implementation)
- TX ID generator typed correctly with `AnyMessage<TDefs>`

## Migration Guide

### For Library Consumers

**Before (global middleware):**
```typescript
import { registerMiddleware } from 'isolated-workers';

registerMiddleware((ctx) => {
  console.log(ctx.direction, ctx.message);
  return ctx.message;
});
```

**After (per-instance middleware):**
```typescript
const worker = await createWorker({
  script: './worker.js',
  middleware: [
    (message, direction) => {
      console.log(direction, message);
      return message;
    }
  ]
});
```

**Before (debug flag):**
```typescript
const worker = await createWorker({
  script: './worker.js',
  debug: true
});
```

**After (log level):**
```typescript
const worker = await createWorker({
  script: './worker.js',
  logLevel: 'debug'
});
```

## Summary

This implementation provides:
1. Enhanced type system with `AnyMessage` for better DX
2. Per-instance middleware arrays (breaking change from global)
3. Serializer with bundled terminator
4. Comprehensive worker lifecycle options
5. MetaLogger for log level filtering
6. Configurable reconnection strategy
7. Custom transaction ID generators
8. Server-side disconnect behavior control

All changes maintain type safety and follow the existing architectural patterns.
