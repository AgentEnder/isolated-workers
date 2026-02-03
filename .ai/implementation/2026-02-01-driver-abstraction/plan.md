# Driver Abstraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce a driver abstraction layer that supports both child_process (sockets) and worker_threads (MessagePort) as IPC mechanisms.

**Architecture:** Drivers implement a common interface (`Driver`) that handles spawning and channel creation. Core worker logic (pending requests, timeouts, middleware) remains shared. Capability types enable compile-time API narrowing.

**Tech Stack:** TypeScript, Node.js worker_threads, vitest

---

## Task 1: Define Driver Types

**Files:**
- Create: `packages/isolated-workers/src/core/driver.ts`
- Test: `packages/isolated-workers/src/core/driver.spec.ts`

**Step 1: Create the driver types file**

```typescript
// packages/isolated-workers/src/core/driver.ts
/**
 * Driver abstraction for worker communication
 *
 * @packageDocumentation
 */

/**
 * Message structure for driver communication
 */
export interface DriverMessage {
  type: string;
  payload: unknown;
  tx: string;
}

/**
 * Communication channel returned by driver spawn
 */
export interface DriverChannel {
  /** Send a message through the channel */
  send(message: DriverMessage): Promise<void>;
  /** Register a message handler */
  onMessage(handler: (message: DriverMessage) => void): void;
  /** Register an error handler */
  onError(handler: (error: Error) => void): void;
  /** Register a close handler */
  onClose(handler: () => void): void;
  /** Close the channel */
  close(): Promise<void>;
  /** Whether the channel is connected */
  readonly isConnected: boolean;
  /** Process ID (undefined for worker_threads) */
  readonly pid: number | undefined;
}

/**
 * Driver capability flags
 */
export interface DriverCapabilities {
  /** Can disconnect/reconnect to running worker */
  reconnect: boolean;
  /** Worker can outlive parent process */
  detach: boolean;
  /** Supports SharedArrayBuffer */
  sharedMemory: boolean;
}

/**
 * Driver interface for spawning workers
 */
export interface Driver<
  TCapabilities extends DriverCapabilities = DriverCapabilities,
  TOptions = unknown
> {
  /** Driver identifier */
  readonly name: string;
  /** Driver capabilities */
  readonly capabilities: TCapabilities;
  /** Spawn a worker and return communication channel */
  spawn(script: string, options: TOptions): Promise<DriverChannel>;
}

/**
 * Capability type for child_process driver
 */
export interface ChildProcessCapabilities extends DriverCapabilities {
  reconnect: true;
  detach: true;
  sharedMemory: false;
}

/**
 * Capability type for worker_threads driver
 */
export interface WorkerThreadsCapabilities extends DriverCapabilities {
  reconnect: false;
  detach: false;
  sharedMemory: true;
}

/**
 * Reconnect capability mixin
 */
export interface ReconnectCapability {
  /** Disconnect from worker but keep process alive */
  disconnect(): Promise<void>;
  /** Reconnect to existing worker */
  reconnect(): Promise<void>;
}

/**
 * Detach capability mixin
 */
export interface DetachCapability {
  /** Whether the worker is detached */
  readonly detached: boolean;
}
```

**Step 2: Create type tests for driver capabilities**

```typescript
// packages/isolated-workers/src/core/driver.spec.ts
import { describe, test, expect, expectTypeOf } from 'vitest';
import type {
  Driver,
  DriverCapabilities,
  DriverChannel,
  DriverMessage,
  ChildProcessCapabilities,
  WorkerThreadsCapabilities,
  ReconnectCapability,
  DetachCapability,
} from './driver.js';

describe('driver types', () => {
  describe('DriverMessage', () => {
    test('has required fields', () => {
      const msg: DriverMessage = {
        type: 'test',
        payload: { foo: 'bar' },
        tx: 'tx-123',
      };
      expect(msg.type).toBe('test');
      expect(msg.tx).toBe('tx-123');
    });
  });

  describe('DriverCapabilities', () => {
    test('ChildProcessCapabilities has correct flags', () => {
      const caps: ChildProcessCapabilities = {
        reconnect: true,
        detach: true,
        sharedMemory: false,
      };
      expectTypeOf(caps.reconnect).toEqualTypeOf<true>();
      expectTypeOf(caps.detach).toEqualTypeOf<true>();
      expectTypeOf(caps.sharedMemory).toEqualTypeOf<false>();
    });

    test('WorkerThreadsCapabilities has correct flags', () => {
      const caps: WorkerThreadsCapabilities = {
        reconnect: false,
        detach: false,
        sharedMemory: true,
      };
      expectTypeOf(caps.reconnect).toEqualTypeOf<false>();
      expectTypeOf(caps.detach).toEqualTypeOf<false>();
      expectTypeOf(caps.sharedMemory).toEqualTypeOf<true>();
    });
  });

  describe('type narrowing', () => {
    test('ReconnectCapability has disconnect and reconnect', () => {
      type Client = ReconnectCapability;
      expectTypeOf<Client>().toHaveProperty('disconnect');
      expectTypeOf<Client>().toHaveProperty('reconnect');
    });

    test('DetachCapability has detached property', () => {
      type Client = DetachCapability;
      expectTypeOf<Client>().toHaveProperty('detached');
    });
  });
});
```

**Step 3: Run tests to verify**

```bash
pnpm nx test isolated-workers --testPathPattern=driver.spec
```

Expected: PASS

**Step 4: Commit**

```bash
git add packages/isolated-workers/src/core/driver.ts packages/isolated-workers/src/core/driver.spec.ts
git commit -m "feat(core): add driver interface types"
```

---

## Task 2: Create Startup Data Utility

**Files:**
- Create: `packages/isolated-workers/src/core/drivers/startup.ts`
- Test: `packages/isolated-workers/src/core/drivers/startup.spec.ts`

**Step 1: Create the startup data module**

```typescript
// packages/isolated-workers/src/core/drivers/startup.ts
/**
 * Startup data utilities for worker detection
 *
 * @packageDocumentation
 */

/**
 * Startup data passed from host to worker
 */
export interface StartupData {
  /** Driver name that spawned this worker */
  driver: string;
  /** Socket path (child_process only) */
  socketPath?: string;
  /** Serializer name */
  serializer?: string;
  /** Server connect timeout */
  serverConnectTimeout?: number;
  /** Additional driver-specific data */
  [key: string]: unknown;
}

/** Environment variable key for startup data */
export const STARTUP_DATA_ENV_KEY = 'ISOLATED_WORKERS_STARTUP_DATA';

/** workerData key for startup data */
export const STARTUP_DATA_WORKER_KEY = '__isolatedWorkers';

/**
 * Get startup data injected by the driver.
 * Checks workerData first (worker_threads), then env var (child_process).
 *
 * @returns StartupData or null if not in worker context
 */
export function getStartupData(): StartupData | null {
  // Try worker_threads first
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const wt = require('worker_threads');
    if (wt.parentPort && wt.workerData?.[STARTUP_DATA_WORKER_KEY]) {
      return wt.workerData[STARTUP_DATA_WORKER_KEY] as StartupData;
    }
  } catch {
    // Not in worker_threads or module unavailable
  }

  // Try env var (child_process)
  const envData = process.env[STARTUP_DATA_ENV_KEY];
  if (envData) {
    try {
      return JSON.parse(envData) as StartupData;
    } catch {
      // Malformed JSON
    }
  }

  return null;
}

/**
 * Encode startup data for child_process env var
 */
export function encodeStartupData(data: StartupData): string {
  return JSON.stringify(data);
}
```

**Step 2: Create tests**

```typescript
// packages/isolated-workers/src/core/drivers/startup.spec.ts
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getStartupData,
  encodeStartupData,
  STARTUP_DATA_ENV_KEY,
  type StartupData,
} from './startup.js';

describe('startup', () => {
  const originalEnv = process.env[STARTUP_DATA_ENV_KEY];

  beforeEach(() => {
    delete process.env[STARTUP_DATA_ENV_KEY];
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env[STARTUP_DATA_ENV_KEY] = originalEnv;
    } else {
      delete process.env[STARTUP_DATA_ENV_KEY];
    }
  });

  describe('getStartupData', () => {
    test('returns null when no startup data', () => {
      expect(getStartupData()).toBeNull();
    });

    test('parses env var for child_process', () => {
      const data: StartupData = {
        driver: 'child_process',
        socketPath: '/tmp/test.sock',
        serializer: 'json',
      };
      process.env[STARTUP_DATA_ENV_KEY] = JSON.stringify(data);

      const result = getStartupData();
      expect(result).toEqual(data);
    });

    test('returns null for malformed JSON', () => {
      process.env[STARTUP_DATA_ENV_KEY] = 'not-json';
      expect(getStartupData()).toBeNull();
    });
  });

  describe('encodeStartupData', () => {
    test('encodes startup data to JSON string', () => {
      const data: StartupData = {
        driver: 'child_process',
        socketPath: '/tmp/test.sock',
      };
      const encoded = encodeStartupData(data);
      expect(JSON.parse(encoded)).toEqual(data);
    });
  });
});
```

**Step 3: Run tests**

```bash
pnpm nx test isolated-workers --testPathPattern=startup.spec
```

Expected: PASS

**Step 4: Commit**

```bash
git add packages/isolated-workers/src/core/drivers/startup.ts packages/isolated-workers/src/core/drivers/startup.spec.ts
git commit -m "feat(drivers): add startup data utility"
```

---

## Task 3: Create Drivers Index

**Files:**
- Create: `packages/isolated-workers/src/core/drivers/index.ts`

**Step 1: Create the drivers barrel export**

```typescript
// packages/isolated-workers/src/core/drivers/index.ts
/**
 * Driver implementations and utilities
 *
 * @packageDocumentation
 */

export {
  getStartupData,
  encodeStartupData,
  STARTUP_DATA_ENV_KEY,
  STARTUP_DATA_WORKER_KEY,
  type StartupData,
} from './startup.js';

// Re-export driver types from parent
export type {
  Driver,
  DriverChannel,
  DriverMessage,
  DriverCapabilities,
  ChildProcessCapabilities,
  WorkerThreadsCapabilities,
  ReconnectCapability,
  DetachCapability,
} from '../driver.js';
```

**Step 2: Commit**

```bash
git add packages/isolated-workers/src/core/drivers/index.ts
git commit -m "feat(drivers): add drivers barrel export"
```

---

## Task 4: Extract Child Process Driver

**Files:**
- Create: `packages/isolated-workers/src/core/drivers/child-process.ts`
- Create: `packages/isolated-workers/src/core/drivers/child-process-server.ts`
- Test: `packages/isolated-workers/src/core/drivers/child-process.spec.ts`

**Step 1: Create child process driver**

```typescript
// packages/isolated-workers/src/core/drivers/child-process.ts
/**
 * Child process driver using Unix domain sockets
 *
 * @packageDocumentation
 */

import { fork, type ForkOptions } from 'child_process';
import type {
  Driver,
  DriverChannel,
  DriverMessage,
  ChildProcessCapabilities,
} from '../driver.js';
import { createConnection, type ConnectionOptions } from '../connection.js';
import { generateSocketPath, cleanupSocketPath } from '../../platform/socket.js';
import { createMetaLogger, type Logger, type LogLevel } from '../../utils/index.js';
import { defaultSerializer, type Serializer } from '../../utils/serializer.js';
import { encodeStartupData, type StartupData } from './startup.js';

/**
 * Options for child process driver
 */
export interface ChildProcessDriverOptions {
  /** Environment variables to pass to worker */
  env?: Record<string, string>;
  /** Detach worker process */
  detached?: boolean;
  /** Additional fork options */
  forkOptions?: ForkOptions;
  /** Override socket path */
  socketPath?: string;
  /** Connection retry options */
  connection?: {
    attempts?: number;
    delay?: number | ((attempt: number) => number);
    maxDelay?: number;
  };
  /** Connection timeout */
  timeout?: number;
  /** Serializer instance */
  serializer?: Serializer;
  /** Server connect timeout (passed to worker) */
  serverConnectTimeout?: number;
  /** Log level */
  logLevel?: LogLevel;
  /** Custom logger */
  logger?: Logger;
}

/**
 * Child process driver implementation
 */
export class ChildProcessDriver
  implements Driver<ChildProcessCapabilities, ChildProcessDriverOptions>
{
  readonly name = 'child_process';
  readonly capabilities: ChildProcessCapabilities = {
    reconnect: true,
    detach: true,
    sharedMemory: false,
  };

  async spawn(
    script: string,
    options: ChildProcessDriverOptions = {}
  ): Promise<DriverChannel> {
    const {
      env = {},
      detached = false,
      forkOptions = {},
      socketPath: customSocketPath,
      connection: connectionConfig = {},
      timeout = 10_000,
      serializer = defaultSerializer,
      serverConnectTimeout = 30_000,
      logLevel = 'error',
      logger: customLogger,
    } = options;

    const logger = createMetaLogger(customLogger, logLevel);
    const socketPath = customSocketPath || generateSocketPath('worker');

    logger.info('Spawning child process', { script, socketPath });

    // Prepare startup data
    const startupData: StartupData = {
      driver: 'child_process',
      socketPath,
      serializer: serializer.constructor.name,
      serverConnectTimeout,
    };

    // Spawn the child process
    const child = fork(script, [], {
      ...forkOptions,
      env: {
        ...process.env,
        ...env,
        ISOLATED_WORKERS_STARTUP_DATA: encodeStartupData(startupData),
        // Legacy env vars for backwards compatibility
        ISOLATED_WORKERS_SOCKET_PATH: socketPath,
        ISOLATED_WORKERS_SERVER_CONNECT_TIMEOUT: String(serverConnectTimeout),
      },
      silent: false,
      detached,
    });

    if (!child.pid) {
      throw new Error('Failed to spawn worker: no process ID');
    }

    const workerPid = child.pid;
    logger.debug('Child process spawned', { pid: workerPid });

    if (detached) {
      child.unref();
    }

    // Connect to worker socket
    const { attempts = 5, delay = 100, maxDelay = 5000 } = connectionConfig;

    let connection;
    try {
      connection = await createConnection({
        socketPath,
        timeout,
        maxRetries: attempts,
        retryDelay: delay,
        maxDelay,
        serializer,
        logger,
      });
      logger.info('Connected to worker', { pid: workerPid });
    } catch (err) {
      logger.error('Failed to connect to worker', {
        error: (err as Error).message,
      });
      child.kill();
      cleanupSocketPath(socketPath);
      throw err;
    }

    // Track connection state
    let isConnected = true;
    let isActive = true;

    // Handle child exit
    child.on('exit', (code, signal) => {
      logger.info('Child process exited', { code, signal });
      isActive = false;
      isConnected = false;
      cleanupSocketPath(socketPath);
    });

    // Create driver channel
    const channel: DriverChannel & {
      _child: typeof child;
      _socketPath: string;
      _connection: typeof connection;
      _detached: boolean;
    } = {
      _child: child,
      _socketPath: socketPath,
      _connection: connection,
      _detached: detached,

      get isConnected() {
        return isConnected && connection.isConnected;
      },

      get pid() {
        return workerPid;
      },

      async send(message: DriverMessage): Promise<void> {
        if (!isConnected) {
          throw new Error('Channel is not connected');
        }
        await connection.send(message);
      },

      onMessage(handler: (message: DriverMessage) => void): void {
        connection.onMessage(handler);
      },

      onError(handler: (error: Error) => void): void {
        connection.onError(handler);
      },

      onClose(handler: () => void): void {
        connection.onClose(() => {
          isConnected = false;
          handler();
        });
      },

      async close(): Promise<void> {
        logger.info('Closing child process channel', { pid: workerPid });
        isConnected = false;

        await connection.close();

        if (!child.killed && isActive) {
          child.kill('SIGTERM');

          // Force kill after timeout
          await new Promise<void>((resolve) => {
            const timeoutId = setTimeout(() => {
              if (!child.killed) {
                logger.warn('Force killing worker', { pid: workerPid });
                child.kill('SIGKILL');
              }
              resolve();
            }, 5000);

            child.once('exit', () => {
              clearTimeout(timeoutId);
              resolve();
            });
          });
        }

        cleanupSocketPath(socketPath);
        isActive = false;
      },
    };

    return channel;
  }
}

/**
 * Extended channel with child process specific properties
 */
export interface ChildProcessChannel extends DriverChannel {
  readonly detached: boolean;
  /** Disconnect but keep worker alive */
  disconnect(): Promise<void>;
  /** Reconnect to worker */
  reconnect(): Promise<void>;
}
```

**Step 2: Create child process server**

```typescript
// packages/isolated-workers/src/core/drivers/child-process-server.ts
/**
 * Child process server (socket-based)
 *
 * @packageDocumentation
 */

import { Socket, Server } from 'net';
import { getSocketAdapter, cleanupSocketPath } from '../../platform/socket.js';
import { createMetaLogger, type Logger, type LogLevel } from '../../utils/index.js';
import { defaultSerializer, type Serializer } from '../../utils/serializer.js';
import { getStartupData } from './startup.js';
import type { DriverMessage } from '../driver.js';

/**
 * Server channel for receiving messages
 */
export interface ServerChannel {
  /** Register message handler */
  onMessage(handler: (message: DriverMessage, reply: (response: DriverMessage) => Promise<void>) => void): void;
  /** Stop the server */
  stop(): Promise<void>;
  /** Whether server is running */
  readonly isRunning: boolean;
}

/**
 * Options for child process server
 */
export interface ChildProcessServerOptions {
  /** Socket path (defaults to startup data) */
  socketPath?: string;
  /** Serializer (must match client) */
  serializer?: Serializer;
  /** Host connect timeout (0 = forever) */
  hostConnectTimeout?: number;
  /** Log level */
  logLevel?: LogLevel;
  /** Custom logger */
  logger?: Logger;
}

/**
 * Create a socket-based server for child process driver
 */
export async function createChildProcessServer(
  options: ChildProcessServerOptions = {}
): Promise<ServerChannel> {
  const startup = getStartupData();

  const {
    socketPath = startup?.socketPath ?? process.env.ISOLATED_WORKERS_SOCKET_PATH,
    serializer = defaultSerializer,
    hostConnectTimeout = startup?.serverConnectTimeout ?? 30_000,
    logLevel = 'error',
    logger: customLogger,
  } = options;

  if (!socketPath) {
    throw new Error(
      'No socket path provided. Ensure worker was spawned via createWorker() with child_process driver.'
    );
  }

  const logger = createMetaLogger(customLogger, logLevel);
  const adapter = getSocketAdapter();
  const server: Server = adapter.createServer(socketPath);

  let isRunning = true;
  let activeSocket: Socket | null = null;
  const messageHandlers: Array<(message: DriverMessage, reply: (response: DriverMessage) => Promise<void>) => void> = [];

  // Host connection timeout
  let connectTimeoutHandle: NodeJS.Timeout | null = null;
  if (hostConnectTimeout > 0) {
    connectTimeoutHandle = setTimeout(() => {
      if (!activeSocket && isRunning) {
        logger.error(`Host did not connect within ${hostConnectTimeout}ms`);
        stopServer();
      }
    }, hostConnectTimeout);
  }

  const terminatorStr =
    typeof serializer.terminator === 'string'
      ? serializer.terminator
      : serializer.terminator.toString();

  server.on('connection', (socket: Socket) => {
    if (connectTimeoutHandle) {
      clearTimeout(connectTimeoutHandle);
      connectTimeoutHandle = null;
    }

    logger.debug('Client connected');
    activeSocket = socket;
    let buffer = '';

    socket.on('data', async (data: Buffer) => {
      buffer += data.toString('utf-8');

      let delimiterIndex: number;
      while ((delimiterIndex = buffer.indexOf(terminatorStr)) !== -1) {
        const line = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + terminatorStr.length);

        if (line.trim()) {
          try {
            const message = serializer.deserialize<DriverMessage>(line);

            const reply = async (response: DriverMessage): Promise<void> => {
              const serialized = serializer.serialize(response);
              const dataStr = typeof serialized === 'string'
                ? serialized + terminatorStr
                : serialized.toString() + terminatorStr;

              await new Promise<void>((resolve, reject) => {
                socket.write(dataStr, (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
            };

            messageHandlers.forEach((handler) => {
              try {
                handler(message, reply);
              } catch (err) {
                logger.error('Message handler error', { error: (err as Error).message });
              }
            });
          } catch (err) {
            logger.error('Failed to parse message', { error: (err as Error).message });
          }
        }
      }
    });

    socket.on('close', () => {
      logger.debug('Client disconnected');
      activeSocket = null;
    });

    socket.on('error', (err: Error) => {
      logger.error('Socket error', { error: err.message });
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(socketPath, () => {
      logger.info('Server listening', { socketPath });
      resolve();
    });
    server.on('error', reject);
  });

  const stopServer = async () => {
    isRunning = false;
    if (connectTimeoutHandle) {
      clearTimeout(connectTimeoutHandle);
    }
    if (activeSocket) {
      activeSocket.end();
    }
    server.close();
    cleanupSocketPath(socketPath);
  };

  process.on('SIGTERM', stopServer);
  process.on('SIGINT', stopServer);

  return {
    get isRunning() {
      return isRunning;
    },

    onMessage(handler) {
      messageHandlers.push(handler);
    },

    async stop() {
      await stopServer();
    },
  };
}

/**
 * Child process server class
 */
export class ChildProcessServer {
  readonly name = 'child_process';

  async create(options?: ChildProcessServerOptions): Promise<ServerChannel> {
    return createChildProcessServer(options);
  }
}
```

**Step 3: Create tests**

```typescript
// packages/isolated-workers/src/core/drivers/child-process.spec.ts
import { describe, test, expect } from 'vitest';
import { ChildProcessDriver } from './child-process.js';

describe('ChildProcessDriver', () => {
  test('has correct name', () => {
    const driver = new ChildProcessDriver();
    expect(driver.name).toBe('child_process');
  });

  test('has correct capabilities', () => {
    const driver = new ChildProcessDriver();
    expect(driver.capabilities).toEqual({
      reconnect: true,
      detach: true,
      sharedMemory: false,
    });
  });

  test('capabilities are readonly', () => {
    const driver = new ChildProcessDriver();
    // @ts-expect-error - capabilities should be readonly
    expect(() => { driver.capabilities = {} as any; }).toThrow();
  });
});
```

**Step 4: Run tests**

```bash
pnpm nx test isolated-workers --testPathPattern=child-process.spec
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/isolated-workers/src/core/drivers/child-process.ts packages/isolated-workers/src/core/drivers/child-process-server.ts packages/isolated-workers/src/core/drivers/child-process.spec.ts
git commit -m "feat(drivers): extract child process driver"
```

---

## Task 5: Create Worker Threads Driver

**Files:**
- Create: `packages/isolated-workers/src/core/drivers/worker-threads.ts`
- Create: `packages/isolated-workers/src/core/drivers/worker-threads-server.ts`
- Test: `packages/isolated-workers/src/core/drivers/worker-threads.spec.ts`

**Step 1: Create worker threads driver**

```typescript
// packages/isolated-workers/src/core/drivers/worker-threads.ts
/**
 * Worker threads driver using MessagePort
 *
 * @packageDocumentation
 */

import type {
  Driver,
  DriverChannel,
  DriverMessage,
  WorkerThreadsCapabilities,
} from '../driver.js';
import { createMetaLogger, type Logger, type LogLevel } from '../../utils/index.js';
import { defaultSerializer, type Serializer } from '../../utils/serializer.js';
import { STARTUP_DATA_WORKER_KEY, type StartupData } from './startup.js';

// Dynamic import to avoid errors in environments without worker_threads
let Worker: typeof import('worker_threads').Worker;
let isWorkerThreadsAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const wt = require('worker_threads');
  Worker = wt.Worker;
  isWorkerThreadsAvailable = true;
} catch {
  // worker_threads not available
}

/**
 * Options for worker threads driver
 */
export interface WorkerThreadsDriverOptions {
  /** Data to pass to worker via workerData */
  workerData?: unknown;
  /** Resource limits for the worker */
  resourceLimits?: {
    maxYoungGenerationSizeMb?: number;
    maxOldGenerationSizeMb?: number;
    codeRangeSizeMb?: number;
    stackSizeMb?: number;
  };
  /** Objects to transfer to worker */
  transferList?: Transferable[];
  /** Treat script as code string instead of path */
  eval?: boolean;
  /** Serializer instance */
  serializer?: Serializer;
  /** Log level */
  logLevel?: LogLevel;
  /** Custom logger */
  logger?: Logger;
}

/**
 * Worker threads driver implementation
 */
export class WorkerThreadsDriver
  implements Driver<WorkerThreadsCapabilities, WorkerThreadsDriverOptions>
{
  readonly name = 'worker_threads';
  readonly capabilities: WorkerThreadsCapabilities = {
    reconnect: false,
    detach: false,
    sharedMemory: true,
  };

  constructor() {
    if (!isWorkerThreadsAvailable) {
      throw new Error(
        'worker_threads module not available. ' +
        'Requires Node.js 12+ with worker_threads support.'
      );
    }
  }

  async spawn(
    script: string,
    options: WorkerThreadsDriverOptions = {}
  ): Promise<DriverChannel> {
    const {
      workerData: userWorkerData,
      resourceLimits,
      transferList,
      eval: evalMode = false,
      serializer = defaultSerializer,
      logLevel = 'error',
      logger: customLogger,
    } = options;

    const logger = createMetaLogger(customLogger, logLevel);
    logger.info('Spawning worker thread', { script });

    // Prepare startup data
    const startupData: StartupData = {
      driver: 'worker_threads',
      serializer: serializer.constructor.name,
    };

    // Merge user workerData with startup data
    const workerData = {
      ...userWorkerData as object,
      [STARTUP_DATA_WORKER_KEY]: startupData,
    };

    const worker = new Worker(script, {
      workerData,
      resourceLimits,
      transferList,
      eval: evalMode,
    });

    logger.debug('Worker thread created', { threadId: worker.threadId });

    let isConnected = true;
    const messageHandlers: Array<(message: DriverMessage) => void> = [];
    const errorHandlers: Array<(error: Error) => void> = [];
    const closeHandlers: Array<() => void> = [];

    worker.on('message', (message: DriverMessage) => {
      logger.debug('Received message', { type: message.type, tx: message.tx });
      messageHandlers.forEach((handler) => {
        try {
          handler(message);
        } catch (err) {
          logger.error('Message handler error', { error: (err as Error).message });
        }
      });
    });

    worker.on('error', (err: Error) => {
      logger.error('Worker error', { error: err.message });
      errorHandlers.forEach((handler) => {
        try {
          handler(err);
        } catch (handlerErr) {
          logger.error('Error handler error', { error: (handlerErr as Error).message });
        }
      });
    });

    worker.on('exit', (code: number) => {
      logger.info('Worker exited', { code });
      isConnected = false;
      closeHandlers.forEach((handler) => {
        try {
          handler();
        } catch (err) {
          logger.error('Close handler error', { error: (err as Error).message });
        }
      });
    });

    const channel: DriverChannel = {
      get isConnected() {
        return isConnected;
      },

      get pid() {
        return undefined; // worker_threads don't have PIDs
      },

      async send(message: DriverMessage): Promise<void> {
        if (!isConnected) {
          throw new Error('Channel is not connected');
        }
        worker.postMessage(message);
      },

      onMessage(handler: (message: DriverMessage) => void): void {
        messageHandlers.push(handler);
      },

      onError(handler: (error: Error) => void): void {
        errorHandlers.push(handler);
      },

      onClose(handler: () => void): void {
        closeHandlers.push(handler);
      },

      async close(): Promise<void> {
        logger.info('Terminating worker thread');
        isConnected = false;
        await worker.terminate();
      },
    };

    return channel;
  }
}

/**
 * Check if worker_threads is available in current environment
 */
export function isWorkerThreadsDriverAvailable(): boolean {
  return isWorkerThreadsAvailable;
}
```

**Step 2: Create worker threads server**

```typescript
// packages/isolated-workers/src/core/drivers/worker-threads-server.ts
/**
 * Worker threads server (MessagePort-based)
 *
 * @packageDocumentation
 */

import { createMetaLogger, type Logger, type LogLevel } from '../../utils/index.js';
import { getStartupData } from './startup.js';
import type { DriverMessage } from '../driver.js';
import type { ServerChannel } from './child-process-server.js';

// Dynamic import
let parentPort: import('worker_threads').MessagePort | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const wt = require('worker_threads');
  parentPort = wt.parentPort;
} catch {
  // Not in worker_threads context
}

/**
 * Options for worker threads server
 */
export interface WorkerThreadsServerOptions {
  /** Log level */
  logLevel?: LogLevel;
  /** Custom logger */
  logger?: Logger;
}

/**
 * Create a MessagePort-based server for worker threads driver
 */
export async function createWorkerThreadsServer(
  options: WorkerThreadsServerOptions = {}
): Promise<ServerChannel> {
  if (!parentPort) {
    throw new Error(
      'Not running in a worker_threads context. ' +
      'Ensure worker was spawned via createWorker() with worker_threads driver.'
    );
  }

  const { logLevel = 'error', logger: customLogger } = options;
  const logger = createMetaLogger(customLogger, logLevel);

  logger.info('Starting worker threads server');

  let isRunning = true;
  const messageHandlers: Array<(message: DriverMessage, reply: (response: DriverMessage) => Promise<void>) => void> = [];

  const port = parentPort;

  port.on('message', (message: DriverMessage) => {
    logger.debug('Received message', { type: message.type, tx: message.tx });

    const reply = async (response: DriverMessage): Promise<void> => {
      port.postMessage(response);
    };

    messageHandlers.forEach((handler) => {
      try {
        handler(message, reply);
      } catch (err) {
        logger.error('Message handler error', { error: (err as Error).message });
      }
    });
  });

  return {
    get isRunning() {
      return isRunning;
    },

    onMessage(handler) {
      messageHandlers.push(handler);
    },

    async stop() {
      logger.info('Stopping worker threads server');
      isRunning = false;
      port.close();
    },
  };
}

/**
 * Worker threads server class
 */
export class WorkerThreadsServer {
  readonly name = 'worker_threads';

  async create(options?: WorkerThreadsServerOptions): Promise<ServerChannel> {
    return createWorkerThreadsServer(options);
  }
}
```

**Step 3: Create tests**

```typescript
// packages/isolated-workers/src/core/drivers/worker-threads.spec.ts
import { describe, test, expect } from 'vitest';
import { WorkerThreadsDriver, isWorkerThreadsDriverAvailable } from './worker-threads.js';

describe('WorkerThreadsDriver', () => {
  test('isWorkerThreadsDriverAvailable returns boolean', () => {
    expect(typeof isWorkerThreadsDriverAvailable()).toBe('boolean');
  });

  // Only run these tests if worker_threads is available
  const describeIfAvailable = isWorkerThreadsDriverAvailable() ? describe : describe.skip;

  describeIfAvailable('when worker_threads available', () => {
    test('has correct name', () => {
      const driver = new WorkerThreadsDriver();
      expect(driver.name).toBe('worker_threads');
    });

    test('has correct capabilities', () => {
      const driver = new WorkerThreadsDriver();
      expect(driver.capabilities).toEqual({
        reconnect: false,
        detach: false,
        sharedMemory: true,
      });
    });

    test('pid is undefined for worker threads', async () => {
      const driver = new WorkerThreadsDriver();
      // Create a simple worker script
      const channel = await driver.spawn(
        `
        const { parentPort } = require('worker_threads');
        parentPort.on('message', () => {});
        `,
        { eval: true }
      );

      expect(channel.pid).toBeUndefined();
      await channel.close();
    });
  });
});
```

**Step 4: Run tests**

```bash
pnpm nx test isolated-workers --testPathPattern=worker-threads.spec
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/isolated-workers/src/core/drivers/worker-threads.ts packages/isolated-workers/src/core/drivers/worker-threads-server.ts packages/isolated-workers/src/core/drivers/worker-threads.spec.ts
git commit -m "feat(drivers): add worker threads driver"
```

---

## Task 6: Update Drivers Index with All Exports

**Files:**
- Modify: `packages/isolated-workers/src/core/drivers/index.ts`

**Step 1: Update the drivers index**

```typescript
// packages/isolated-workers/src/core/drivers/index.ts
/**
 * Driver implementations and utilities
 *
 * @packageDocumentation
 */

// Startup data utilities
export {
  getStartupData,
  encodeStartupData,
  STARTUP_DATA_ENV_KEY,
  STARTUP_DATA_WORKER_KEY,
  type StartupData,
} from './startup.js';

// Re-export driver types from parent
export type {
  Driver,
  DriverChannel,
  DriverMessage,
  DriverCapabilities,
  ChildProcessCapabilities,
  WorkerThreadsCapabilities,
  ReconnectCapability,
  DetachCapability,
} from '../driver.js';

// Child process driver
export {
  ChildProcessDriver,
  type ChildProcessDriverOptions,
  type ChildProcessChannel,
} from './child-process.js';

export {
  ChildProcessServer,
  createChildProcessServer,
  type ChildProcessServerOptions,
  type ServerChannel,
} from './child-process-server.js';

// Worker threads driver
export {
  WorkerThreadsDriver,
  isWorkerThreadsDriverAvailable,
  type WorkerThreadsDriverOptions,
} from './worker-threads.js';

export {
  WorkerThreadsServer,
  createWorkerThreadsServer,
  type WorkerThreadsServerOptions,
} from './worker-threads-server.js';

// Default driver loader (dynamic import)
export async function loadDefaultDriver(): Promise<
  import('./child-process.js').ChildProcessDriver
> {
  const { ChildProcessDriver } = await import('./child-process.js');
  return new ChildProcessDriver();
}
```

**Step 2: Commit**

```bash
git add packages/isolated-workers/src/core/drivers/index.ts
git commit -m "feat(drivers): complete drivers index exports"
```

---

## Task 7: Update createWorker to Use Drivers

**Files:**
- Modify: `packages/isolated-workers/src/core/worker.ts`

**Step 1: Update createWorker signature and implementation**

This is a larger refactor. The key changes:
1. Accept optional `driver` parameter
2. If no driver, dynamically load child_process driver
3. Use driver.spawn() instead of direct fork()
4. Return WorkerClient narrowed by driver capabilities

```typescript
// At the top of worker.ts, add imports:
import type {
  Driver,
  DriverChannel,
  DriverCapabilities,
  ChildProcessCapabilities,
  ReconnectCapability,
} from './driver.js';
import { loadDefaultDriver } from './drivers/index.js';
```

The full implementation update is extensive - update `WorkerOptions` to accept a driver, modify `createWorker` to delegate to the driver, and narrow the return type based on capabilities.

**Step 2: Run existing tests to ensure backwards compatibility**

```bash
pnpm nx test isolated-workers
```

Expected: All existing tests PASS

**Step 3: Commit**

```bash
git add packages/isolated-workers/src/core/worker.ts
git commit -m "feat(core): integrate driver abstraction into createWorker"
```

---

## Task 8: Update startWorkerServer to Route to Drivers

**Files:**
- Modify: `packages/isolated-workers/src/core/worker-server.ts`

**Step 1: Add driver routing to startWorkerServer**

Update to detect driver from startup data and route to appropriate server implementation.

**Step 2: Run tests**

```bash
pnpm nx test isolated-workers
```

Expected: PASS

**Step 3: Commit**

```bash
git add packages/isolated-workers/src/core/worker-server.ts
git commit -m "feat(core): add driver routing to startWorkerServer"
```

---

## Task 9: Add Package Entry Points for Drivers

**Files:**
- Modify: `packages/isolated-workers/package.json`

**Step 1: Add exports for driver entry points**

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./drivers/child-process": {
      "import": "./dist/core/drivers/child-process.js",
      "types": "./dist/core/drivers/child-process.d.ts"
    },
    "./drivers/worker-threads": {
      "import": "./dist/core/drivers/worker-threads.js",
      "types": "./dist/core/drivers/worker-threads.d.ts"
    }
  }
}
```

**Step 2: Build to verify**

```bash
pnpm nx build isolated-workers
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/isolated-workers/package.json
git commit -m "feat(package): add driver entry points"
```

---

## Task 10: Update Core Exports

**Files:**
- Modify: `packages/isolated-workers/src/core/index.ts`
- Modify: `packages/isolated-workers/src/index.ts`

**Step 1: Export driver types from core index**

**Step 2: Export driver types from main index**

**Step 3: Commit**

```bash
git add packages/isolated-workers/src/core/index.ts packages/isolated-workers/src/index.ts
git commit -m "feat(exports): add driver types to public API"
```

---

## Task 11: Unit Tests for Driver Integration

**Files:**
- Create: `packages/isolated-workers/src/core/worker.spec.ts`
- Modify existing tests as needed

**Step 1: Write unit tests for createWorker with drivers**

Test:
- Default driver (child_process) is loaded when no driver specified
- Explicit driver is used when provided
- Driver options are passed through correctly
- WorkerClient methods work with both drivers

**Step 2: Run tests**

```bash
pnpm nx test isolated-workers
```

Expected: All tests PASS

**Step 3: Commit**

```bash
git add packages/isolated-workers/src/core/worker.spec.ts
git commit -m "test(core): add unit tests for driver integration"
```

---

## Task 12: E2E Tests and Documentation

**Files:**
- Create: `e2e/isolated-workers-e2e/src/drivers.spec.ts`
- Create: `docs/guides/drivers.md`
- Modify: `docs/concepts/why-isolated-workers.md` (update trade-offs table)

**Step 1: Create E2E tests for both drivers**

Test full workflow with each driver:
- Spawn worker
- Send messages
- Receive responses
- Handle errors
- Graceful shutdown

```typescript
// e2e/isolated-workers-e2e/src/drivers.spec.ts
describe('Driver Abstraction E2E', () => {
  describe('child_process driver', () => {
    test('full message round-trip');
    test('handles handler errors');
    test('graceful shutdown');
  });

  describe('worker_threads driver', () => {
    test('full message round-trip');
    test('handles handler errors');
    test('graceful shutdown');
    test('pid is undefined');
  });

  describe('backwards compatibility', () => {
    test('existing examples still work');
  });
});
```

**Step 2: Run E2E tests**

```bash
pnpm nx e2e isolated-workers-e2e --testPathPattern=drivers.spec
```

Expected: PASS

**Step 3: Create driver guide documentation**

```markdown
# docs/guides/drivers.md
---
title: Driver Selection
description: Choosing between child_process and worker_threads drivers
nav:
  section: Guides
  order: 10
---

# Driver Selection

isolated-workers supports two driver implementations...

## child_process (default)
- Full process isolation
- Supports disconnect/reconnect
- Workers can outlive parent (detached mode)

## worker_threads
- Lower IPC overhead
- More reliable startup (no socket dance)
- SharedArrayBuffer support

## When to use each...
```

**Step 4: Update why-isolated-workers.md**

Add driver comparison to the trade-offs section.

**Step 5: Commit**

```bash
git add e2e/isolated-workers-e2e/src/drivers.spec.ts docs/guides/drivers.md docs/concepts/why-isolated-workers.md
git commit -m "docs: add driver selection guide and e2e tests"
```

---

## Summary

After completing all tasks:

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Driver interface types | Type tests in driver.spec.ts |
| 2 | Startup data utility | Unit tests in startup.spec.ts |
| 3 | Drivers index | N/A (barrel export) |
| 4 | Child process driver | Unit tests in child-process.spec.ts |
| 5 | Worker threads driver | Unit tests in worker-threads.spec.ts |
| 6 | Drivers index exports | N/A (barrel export) |
| 7 | createWorker integration | Existing tests + new coverage |
| 8 | startWorkerServer routing | Existing tests + new coverage |
| 9 | Package entry points | Build verification |
| 10 | Core exports | Build verification |
| 11 | Unit tests for integration | worker.spec.ts |
| 12 | E2E tests + documentation | drivers.spec.ts + guides |

**Verification checkpoints:**

After Task 6:
```bash
pnpm nx test isolated-workers --testPathPattern="(driver|startup|child-process|worker-threads).spec"
```

After Task 10:
```bash
pnpm nx run-many -t lint,build,test
```

After Task 12:
```bash
pnpm nx run-many -t lint,build,test
pnpm nx e2e isolated-workers-e2e
```
