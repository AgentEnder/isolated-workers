# Driver Server Symmetry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor drivers so they own both host-side spawning and server-side startup data extraction, with `getStartupData()` that throws if called incorrectly.

**Architecture:** Split each driver into host.ts/server.ts with dynamic imports. Add `defineWorkerDriver` utility for capability inference. Update `startWorkerServer` to accept optional driver (defaults to child_process).

**Tech Stack:** TypeScript, Node.js worker_threads, child_process, dynamic imports

---

## Task 1: Create `defineWorkerDriver` Utility

**Files:**
- Modify: `packages/isolated-workers/src/core/driver.ts`

**Step 1: Add capability inference types**

Add after the existing `DetachCapability` interface (~line 141):

```typescript
/**
 * Type helpers for capability inference
 */
type HasDisconnect = { disconnect(): Promise<void> };
type HasReconnect = { reconnect(): Promise<void> };
type HasDetached = { readonly detached: boolean };
type HasTransferSharedMemory = { transferSharedMemory(buffer: SharedArrayBuffer): void };

/**
 * Infer capabilities from driver shape
 */
export type InferCapabilities<T> = {
  reconnect: T extends HasDisconnect & HasReconnect ? true : false;
  detach: T extends HasDetached ? true : false;
  sharedMemory: T extends HasTransferSharedMemory ? true : false;
};
```

**Step 2: Add ServerChannel import and ServerOptions type**

Add near the top imports area:

```typescript
import type { ServerChannel, ResponseFunction } from './drivers/child-process-server.js';

/**
 * Options for creating a server channel
 */
export interface ServerOptions {
  /** Custom serializer (must match host!) */
  serializer?: import('../utils/serializer.js').Serializer;
  /** Log level */
  logLevel?: import('../utils/logger.js').LogLevel;
  /** Custom logger */
  logger?: import('../utils/logger.js').Logger;
}

// Re-export for convenience
export type { ServerChannel, ResponseFunction };
```

**Step 3: Add StartupData type**

```typescript
/**
 * Base startup data passed from host to worker
 */
export interface StartupData {
  driver: string;
  socketPath?: string;
  serializer?: string;
  serverConnectTimeout?: number;
  [key: string]: unknown;
}
```

**Step 4: Add DriverConfig and defineWorkerDriver**

```typescript
/**
 * Configuration object for defining a worker driver
 */
export interface DriverConfig<
  TOptions = unknown,
  TStartupData extends StartupData = StartupData
> {
  /** Driver identifier */
  name: string;

  /** Spawn a worker (host side) */
  spawn(script: string, options: TOptions): Promise<DriverChannel>;

  /** Get startup data (server side) - throws if not available */
  getStartupData(): TStartupData;

  /** Create server channel (server side) */
  createServer(options: ServerOptions): ServerChannel | Promise<ServerChannel>;
}

/**
 * Define a worker driver with automatic capability inference.
 *
 * Capabilities are inferred from the presence of optional methods:
 * - `disconnect()` + `reconnect()` → reconnect: true
 * - `detached` property → detach: true
 * - `transferSharedMemory()` → sharedMemory: true
 *
 * @example
 * ```typescript
 * export const MyDriver = defineWorkerDriver({
 *   name: 'my_driver',
 *   spawn: async (script, options) => { ... },
 *   getStartupData: () => { ... },
 *   createServer: async (options) => { ... },
 *   // Optional capability methods
 *   disconnect: async () => { ... },
 *   reconnect: async () => { ... },
 * });
 * ```
 */
export function defineWorkerDriver<
  T extends DriverConfig<TOptions, TStartupData>,
  TOptions = unknown,
  TStartupData extends StartupData = StartupData
>(
  config: T
): T & {
  readonly capabilities: InferCapabilities<T>;
} {
  const capabilities = {
    reconnect: ('disconnect' in config && 'reconnect' in config) as InferCapabilities<T>['reconnect'],
    detach: ('detached' in config) as InferCapabilities<T>['detach'],
    sharedMemory: ('transferSharedMemory' in config) as InferCapabilities<T>['sharedMemory'],
  } as InferCapabilities<T>;

  return {
    ...config,
    capabilities,
  };
}
```

**Step 5: Run typecheck**

Run: `pnpm nx run isolated-workers:build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add packages/isolated-workers/src/core/driver.ts
git commit -m "$(cat <<'EOF'
feat(driver): add defineWorkerDriver utility for capability inference

Adds type helpers to automatically infer driver capabilities from the
shape of the driver object, eliminating manual capability declaration.
EOF
)"
```

---

## Task 2: Create Child Process Driver Host Module

**Files:**
- Create: `packages/isolated-workers/src/core/drivers/child-process/host.ts`
- Create: `packages/isolated-workers/src/core/drivers/child-process/index.ts`

**Step 1: Create directory structure**

Run: `mkdir -p packages/isolated-workers/src/core/drivers/child-process`

**Step 2: Create host.ts with spawn logic**

Extract spawn logic from `child-process.ts` into the new host module:

```typescript
/**
 * Child process driver - host side implementation
 *
 * Contains spawn logic that imports child_process and net modules.
 * Only loaded when spawn() is called.
 *
 * @packageDocumentation
 */

import { fork, type ChildProcess, type SpawnOptions } from 'child_process';
import type { Serializer } from '../../../utils/serializer.js';
import { defaultSerializer } from '../../../utils/serializer.js';
import { createMetaLogger, type Logger, type LogLevel } from '../../../utils/logger.js';
import { generateSocketPath, cleanupSocketPath } from '../../../platform/socket.js';
import { createConnection, type Connection } from '../../connection.js';
import type { DriverChannel, DriverMessage, StartupData } from '../../driver.js';

/** Environment variable key for startup data */
export const STARTUP_DATA_ENV_KEY = 'ISOLATED_WORKERS_STARTUP_DATA';

/**
 * Options for child process driver spawn
 */
export interface ChildProcessDriverOptions {
  env?: Record<string, string>;
  detached?: boolean;
  spawnOptions?: SpawnOptions;
  serializer?: Serializer;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  maxDelay?: number;
  serverConnectTimeout?: number;
  logLevel?: LogLevel;
  logger?: Logger;
  socketPath?: string;
}

/**
 * Startup data specific to child process driver
 */
export interface ChildProcessStartupData extends StartupData {
  driver: 'child_process';
  socketPath: string;
  serverConnectTimeout?: number;
}

/**
 * Channel implementation for child process driver.
 */
export class ChildProcessChannel implements DriverChannel {
  private _isConnected: boolean;
  private readonly _logger: Logger;
  readonly detached: boolean;

  constructor(
    private connection: Connection,
    private readonly child: ChildProcess,
    private readonly socketPath: string,
    private readonly connectionOptions: {
      timeout: number;
      maxRetries: number;
      retryDelay: number;
      maxDelay: number;
      serializer: Serializer;
    },
    options: { detached: boolean; logger: Logger }
  ) {
    this._isConnected = true;
    this.detached = options.detached;
    this._logger = options.logger;

    this.connection.onClose(() => {
      this._isConnected = false;
    });
  }

  get isConnected(): boolean {
    return this._isConnected && this.connection.isConnected;
  }

  get pid(): number | undefined {
    return this.child.pid;
  }

  async send(message: DriverMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Channel is not connected');
    }
    await this.connection.send(message);
  }

  onMessage(handler: (message: DriverMessage) => void): void {
    this.connection.onMessage(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.connection.onError(handler);
  }

  onClose(handler: () => void): void {
    this.connection.onClose(handler);
  }

  async disconnect(): Promise<void> {
    if (!this._isConnected) {
      return;
    }
    this._logger.debug('Disconnecting from worker (keeping process alive)', {
      pid: this.child.pid,
    });
    await this.connection.close();
    this._isConnected = false;
  }

  async reconnect(): Promise<void> {
    if (this._isConnected) {
      this._logger.warn('Already connected to worker');
      return;
    }
    if (this.child.killed) {
      throw new Error('Cannot reconnect: worker process is not active');
    }
    this._logger.info('Reconnecting to worker', { pid: this.child.pid });

    this.connection = await createConnection({
      socketPath: this.socketPath,
      timeout: this.connectionOptions.timeout,
      maxRetries: this.connectionOptions.maxRetries,
      retryDelay: this.connectionOptions.retryDelay,
      maxDelay: this.connectionOptions.maxDelay,
      serializer: this.connectionOptions.serializer,
      logger: this._logger,
    });

    this._isConnected = true;
    this.connection.onClose(() => {
      this._isConnected = false;
    });
    this._logger.info('Reconnected to worker', { pid: this.child.pid });
  }

  async close(): Promise<void> {
    this._logger.info('Closing channel', { pid: this.child.pid });
    await this.connection.close();
    this._isConnected = false;

    if (!this.child.killed) {
      this.child.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timeoutId = setTimeout(() => {
          if (!this.child.killed) {
            this._logger.warn('Force killing worker', { pid: this.child.pid });
            this.child.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.child.once('exit', () => {
          clearTimeout(timeoutId);
          resolve();
        });
      });
    }

    cleanupSocketPath(this.socketPath);
    this._logger.info('Channel closed', { pid: this.child.pid });
  }
}

/**
 * Encode startup data for environment variable
 */
export function encodeStartupData(data: StartupData): string {
  return JSON.stringify(data);
}

/**
 * Spawn a child process worker
 */
export async function spawnWorker(
  script: string,
  options: ChildProcessDriverOptions = {}
): Promise<ChildProcessChannel> {
  const {
    env = {},
    detached = false,
    spawnOptions = {},
    serializer = defaultSerializer,
    timeout = 10_000,
    maxRetries = 5,
    retryDelay = 100,
    maxDelay = 5000,
    serverConnectTimeout = 30_000,
    logLevel = 'error',
    logger: customLogger,
    socketPath: customSocketPath,
  } = options;

  const logger = customLogger ?? createMetaLogger(undefined, logLevel);
  const socketPath = customSocketPath ?? generateSocketPath('worker');

  logger.info('Spawning worker', { script, socketPath, detached });

  const startupData: ChildProcessStartupData = {
    driver: 'child_process',
    socketPath,
    serializer: serializer.constructor.name,
    serverConnectTimeout,
  };

  const child = fork(script, [], {
    ...spawnOptions,
    env: {
      ...process.env,
      ...env,
      [STARTUP_DATA_ENV_KEY]: encodeStartupData(startupData),
      ISOLATED_WORKERS_SOCKET_PATH: socketPath,
      ISOLATED_WORKERS_SERVER_CONNECT_TIMEOUT: String(serverConnectTimeout),
    },
    silent: false,
    detached,
  });

  if (!child.pid) {
    throw new Error('Failed to spawn worker: no process ID');
  }

  logger.debug('Worker process spawned', { pid: child.pid });

  if (detached) {
    child.unref();
    logger.debug("Worker process detached and unref'd", { pid: child.pid });
  }

  let connection: Connection;
  try {
    connection = await createConnection({
      socketPath,
      timeout,
      maxRetries,
      retryDelay,
      maxDelay,
      serializer,
      logger,
    });
    logger.info('Connected to worker', { pid: child.pid });
  } catch (err) {
    logger.error('Failed to connect to worker', {
      error: (err as Error).message,
    });
    child.kill();
    cleanupSocketPath(socketPath);
    throw err;
  }

  return new ChildProcessChannel(
    connection,
    child,
    socketPath,
    { timeout, maxRetries, retryDelay, maxDelay, serializer },
    { detached, logger }
  );
}
```

**Step 3: Create index.ts**

```typescript
/**
 * Child process driver
 *
 * @packageDocumentation
 */

export {
  spawnWorker,
  encodeStartupData,
  ChildProcessChannel,
  STARTUP_DATA_ENV_KEY,
  type ChildProcessDriverOptions,
  type ChildProcessStartupData,
} from './host.js';
```

**Step 4: Run typecheck**

Run: `pnpm nx run isolated-workers:build`
Expected: Build succeeds (may have unused export warnings, that's ok)

**Step 5: Commit**

```bash
git add packages/isolated-workers/src/core/drivers/child-process/
git commit -m "$(cat <<'EOF'
feat(driver): extract child process host logic to separate module

Moves spawn logic to child-process/host.ts for dynamic import support.
EOF
)"
```

---

## Task 3: Create Child Process Driver Server Module

**Files:**
- Create: `packages/isolated-workers/src/core/drivers/child-process/server.ts`
- Modify: `packages/isolated-workers/src/core/drivers/child-process/index.ts`

**Step 1: Create server.ts**

Move and adapt server logic from `child-process-server.ts`:

```typescript
/**
 * Child process driver - server side implementation
 *
 * Contains socket server logic for worker-side communication.
 * Only loaded when createServer() is called.
 *
 * @packageDocumentation
 */

import { Socket, Server } from 'net';
import type { Serializer } from '../../../utils/serializer.js';
import { defaultSerializer } from '../../../utils/serializer.js';
import { createMetaLogger, type Logger, type LogLevel } from '../../../utils/logger.js';
import { getSocketAdapter, cleanupSocketPath } from '../../../platform/socket.js';
import type { DriverMessage, ServerOptions, ServerChannel } from '../../driver.js';
import type { ChildProcessStartupData } from './host.js';

/** Default server connect timeout (30 seconds) */
export const DEFAULT_SERVER_CONNECT_TIMEOUT = 30_000;

/**
 * Function to send a response back to the host
 */
export type ResponseFunction = (response: DriverMessage) => Promise<void>;

/**
 * Child process server implementation.
 */
export class ChildProcessServerChannel implements ServerChannel {
  private server: Server;
  private _isRunning = false;
  private activeSocket: Socket | null = null;
  private connectTimeoutHandle: NodeJS.Timeout | null = null;
  private messageHandlers: Array<(message: DriverMessage, respond: ResponseFunction) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private readonly _socketPath: string;
  private readonly logger: Logger;
  private readonly serializer: Serializer;
  private readonly terminatorStr: string;

  constructor(
    server: Server,
    socketPath: string,
    options: { serializer: Serializer; logger: Logger }
  ) {
    this.server = server;
    this._socketPath = socketPath;
    this.serializer = options.serializer;
    this.logger = options.logger;
    this.terminatorStr =
      typeof this.serializer.terminator === 'string'
        ? this.serializer.terminator
        : this.serializer.terminator.toString();
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get socketPath(): string {
    return this._socketPath;
  }

  onMessage(handler: (message: DriverMessage, respond: ResponseFunction) => void): void {
    this.messageHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  async start(hostConnectTimeout: number): Promise<void> {
    this._isRunning = true;

    if (hostConnectTimeout > 0) {
      this.connectTimeoutHandle = setTimeout(() => {
        if (!this.activeSocket && this._isRunning) {
          this.logger.error(
            `Host did not connect within ${hostConnectTimeout}ms, shutting down`
          );
          this.stop();
        }
      }, hostConnectTimeout);
    }

    this.server.on('connection', (socket: Socket) => {
      if (this.connectTimeoutHandle) {
        clearTimeout(this.connectTimeoutHandle);
        this.connectTimeoutHandle = null;
      }

      this.logger.debug('Host connected');
      this.activeSocket = socket;
      let buffer = '';

      socket.on('data', (data: Buffer) => {
        buffer += data.toString('utf-8');

        let delimiterIndex: number;
        while ((delimiterIndex = buffer.indexOf(this.terminatorStr)) !== -1) {
          const line = buffer.slice(0, delimiterIndex);
          buffer = buffer.slice(delimiterIndex + this.terminatorStr.length);

          if (line.trim()) {
            try {
              const message = this.serializer.deserialize<DriverMessage>(line);
              this.logger.debug('Received message', {
                type: message.type,
                tx: message.tx,
              });

              const respond: ResponseFunction = async (response: DriverMessage) => {
                await this.sendMessage(socket, response);
              };

              this.messageHandlers.forEach((handler) => {
                try {
                  handler(message, respond);
                } catch (err) {
                  this.logger.error('Message handler error', {
                    error: (err as Error).message,
                  });
                }
              });
            } catch (err) {
              this.logger.error('Failed to parse message', {
                line: line.slice(0, 100),
                error: (err as Error).message,
              });
            }
          }
        }
      });

      socket.on('close', () => {
        this.logger.debug('Host disconnected');
        if (this.activeSocket === socket) {
          this.activeSocket = null;
        }
      });

      socket.on('error', (err: Error) => {
        this.logger.error('Socket error', { error: err.message });
        this.errorHandlers.forEach((handler) => {
          try {
            handler(err);
          } catch (handlerErr) {
            this.logger.error('Error handler error', {
              error: (handlerErr as Error).message,
            });
          }
        });
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server.listen(this._socketPath, () => {
        this.logger.info('Server listening', { socketPath: this._socketPath });
        resolve();
      });

      this.server.on('error', (err: Error) => {
        this.logger.error('Server error', { error: err.message });
        reject(err);
      });
    });
  }

  private async sendMessage(socket: Socket, message: DriverMessage): Promise<void> {
    this.logger.debug('Sending message', { tx: message.tx, type: message.type });

    const serialized = this.serializer.serialize(message);
    const dataStr =
      typeof serialized === 'string'
        ? serialized + this.terminatorStr
        : serialized.toString() + this.terminatorStr;

    await new Promise<void>((resolve, reject) => {
      socket.write(dataStr, (err) => {
        if (err) {
          this.logger.error('Failed to send message', { error: err.message });
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping server');
    this._isRunning = false;

    if (this.connectTimeoutHandle) {
      clearTimeout(this.connectTimeoutHandle);
      this.connectTimeoutHandle = null;
    }

    if (this.activeSocket) {
      this.activeSocket.end();
      this.activeSocket = null;
    }

    await new Promise<void>((resolve) => {
      this.server.close(() => {
        this.logger.info('Server stopped');
        cleanupSocketPath(this._socketPath);
        resolve();
      });
    });
  }
}

/**
 * Create a child process server channel
 */
export async function createServer(
  startupData: ChildProcessStartupData,
  options: ServerOptions = {}
): Promise<ChildProcessServerChannel> {
  const {
    serializer = defaultSerializer,
    logLevel = 'error',
    logger: customLogger,
  } = options;

  const logger = customLogger ?? createMetaLogger(undefined, logLevel);
  const socketPath = startupData.socketPath;
  const hostConnectTimeout = startupData.serverConnectTimeout ?? DEFAULT_SERVER_CONNECT_TIMEOUT;

  logger.info('Creating child process server', { socketPath, hostConnectTimeout });

  const adapter = getSocketAdapter();
  const netServer = adapter.createServer(socketPath);

  const server = new ChildProcessServerChannel(netServer, socketPath, {
    serializer,
    logger,
  });

  await server.start(hostConnectTimeout);

  return server;
}
```

**Step 2: Update index.ts**

```typescript
/**
 * Child process driver
 *
 * @packageDocumentation
 */

export {
  spawnWorker,
  encodeStartupData,
  ChildProcessChannel,
  STARTUP_DATA_ENV_KEY,
  type ChildProcessDriverOptions,
  type ChildProcessStartupData,
} from './host.js';

export {
  createServer,
  ChildProcessServerChannel,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
  type ResponseFunction,
} from './server.js';
```

**Step 3: Run typecheck**

Run: `pnpm nx run isolated-workers:build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/isolated-workers/src/core/drivers/child-process/
git commit -m "$(cat <<'EOF'
feat(driver): add child process server module

Moves server logic to child-process/server.ts for dynamic import support.
EOF
)"
```

---

## Task 4: Create Unified Child Process Driver

**Files:**
- Create: `packages/isolated-workers/src/core/drivers/child-process/driver.ts`
- Modify: `packages/isolated-workers/src/core/drivers/child-process/index.ts`

**Step 1: Create driver.ts**

```typescript
/**
 * Child process driver - unified driver definition
 *
 * Thin wrapper that uses dynamic imports to load host/server code on demand.
 *
 * @packageDocumentation
 */

import { defineWorkerDriver, type ServerOptions, type ServerChannel } from '../../driver.js';
import type { ChildProcessStartupData, ChildProcessDriverOptions } from './host.js';

/** Environment variable key for startup data */
const STARTUP_DATA_ENV_KEY = 'ISOLATED_WORKERS_STARTUP_DATA';

/**
 * Child process driver.
 *
 * Uses child_process.fork() with Unix domain sockets for IPC.
 * Supports disconnect/reconnect and detached workers.
 */
export const ChildProcessDriver = defineWorkerDriver({
  name: 'child_process' as const,

  /**
   * Spawn a child process worker (host side)
   */
  async spawn(script: string, options: ChildProcessDriverOptions = {}) {
    const { spawnWorker } = await import('./host.js');
    return spawnWorker(script, options);
  },

  /**
   * Get startup data (server side)
   * @throws Error if not running in a child process worker context
   */
  getStartupData(): ChildProcessStartupData {
    const envData = process.env[STARTUP_DATA_ENV_KEY];
    if (!envData) {
      throw new Error(
        'ChildProcessDriver.getStartupData() called but no startup data found. ' +
        'Ensure this worker was spawned via createWorker() with ChildProcessDriver, ' +
        'or check that ISOLATED_WORKERS_STARTUP_DATA environment variable is set.'
      );
    }

    try {
      const data = JSON.parse(envData) as ChildProcessStartupData;
      if (data.driver !== 'child_process') {
        throw new Error(
          `ChildProcessDriver.getStartupData() called but startup data indicates driver "${data.driver}". ` +
          'Use the matching driver for this worker context.'
        );
      }
      return data;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(
          'ChildProcessDriver.getStartupData() failed to parse startup data. ' +
          'The ISOLATED_WORKERS_STARTUP_DATA environment variable contains invalid JSON.'
        );
      }
      throw err;
    }
  },

  /**
   * Create server channel (server side)
   */
  async createServer(options: ServerOptions = {}): Promise<ServerChannel> {
    const { createServer } = await import('./server.js');
    const startupData = this.getStartupData();
    return createServer(startupData, options);
  },

  // Capability methods - enables reconnect: true, detach: true
  async disconnect() {
    throw new Error('disconnect() must be called on the channel, not the driver');
  },

  async reconnect() {
    throw new Error('reconnect() must be called on the channel, not the driver');
  },

  detached: false as const,
});

export type ChildProcessDriverType = typeof ChildProcessDriver;
```

**Step 2: Update index.ts to export driver**

```typescript
/**
 * Child process driver
 *
 * @packageDocumentation
 */

// Main driver export
export { ChildProcessDriver, type ChildProcessDriverType } from './driver.js';

// Host-side exports (for advanced usage)
export {
  spawnWorker,
  encodeStartupData,
  ChildProcessChannel,
  STARTUP_DATA_ENV_KEY,
  type ChildProcessDriverOptions,
  type ChildProcessStartupData,
} from './host.js';

// Server-side exports (for advanced usage)
export {
  createServer,
  ChildProcessServerChannel,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
  type ResponseFunction,
} from './server.js';
```

**Step 3: Run typecheck**

Run: `pnpm nx run isolated-workers:build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/isolated-workers/src/core/drivers/child-process/
git commit -m "$(cat <<'EOF'
feat(driver): create unified ChildProcessDriver with defineWorkerDriver

Uses dynamic imports for host/server code. getStartupData() throws if
called outside worker context.
EOF
)"
```

---

## Task 5: Create Worker Threads Driver Modules

**Files:**
- Create: `packages/isolated-workers/src/core/drivers/worker-threads/host.ts`
- Create: `packages/isolated-workers/src/core/drivers/worker-threads/server.ts`
- Create: `packages/isolated-workers/src/core/drivers/worker-threads/driver.ts`
- Create: `packages/isolated-workers/src/core/drivers/worker-threads/index.ts`

**Step 1: Create directory**

Run: `mkdir -p packages/isolated-workers/src/core/drivers/worker-threads`

**Step 2: Create host.ts**

Extract spawn logic from existing `worker-threads.ts`:

```typescript
/**
 * Worker threads driver - host side implementation
 *
 * @packageDocumentation
 */

import type { Serializer } from '../../../utils/serializer.js';
import { defaultSerializer } from '../../../utils/serializer.js';
import { createMetaLogger, type Logger, type LogLevel } from '../../../utils/logger.js';
import type { DriverChannel, DriverMessage, StartupData } from '../../driver.js';

/** workerData key for startup data */
export const STARTUP_DATA_WORKER_KEY = '__isolatedWorkers';

/**
 * Startup data specific to worker threads driver
 */
export interface WorkerThreadsStartupData extends StartupData {
  driver: 'worker_threads';
}

/**
 * Resource limits for worker threads
 */
export interface WorkerThreadsResourceLimits {
  maxYoungGenerationSizeMb?: number;
  maxOldGenerationSizeMb?: number;
  codeRangeSizeMb?: number;
  stackSizeMb?: number;
}

/**
 * Options for worker threads driver spawn
 */
export interface WorkerThreadsDriverOptions {
  workerData?: unknown;
  resourceLimits?: WorkerThreadsResourceLimits;
  transferList?: ArrayBuffer[];
  eval?: boolean;
  serializer?: Serializer;
  logLevel?: LogLevel;
  logger?: Logger;
}

/**
 * Channel implementation for worker threads driver.
 */
export class WorkerThreadsChannel implements DriverChannel {
  private _isConnected: boolean;
  private readonly _logger: Logger;
  private messageHandlers: Array<(message: DriverMessage) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private readonly serializer: Serializer;

  constructor(
    private readonly worker: InstanceType<typeof import('worker_threads').Worker>,
    options: { serializer: Serializer; logger: Logger }
  ) {
    this._isConnected = true;
    this._logger = options.logger;
    this.serializer = options.serializer;

    this.worker.on('message', (data: unknown) => {
      try {
        const message =
          typeof data === 'string'
            ? this.serializer.deserialize<DriverMessage>(data)
            : (data as DriverMessage);

        this._logger.debug('Received message', {
          type: message.type,
          tx: message.tx,
        });

        this.messageHandlers.forEach((handler) => {
          try {
            handler(message);
          } catch (err) {
            this._logger.error('Message handler error', {
              error: (err as Error).message,
            });
          }
        });
      } catch (err) {
        this._logger.error('Failed to process message', {
          error: (err as Error).message,
        });
      }
    });

    this.worker.on('error', (err: Error) => {
      this._logger.error('Worker error', { error: err.message });
      this.errorHandlers.forEach((handler) => {
        try {
          handler(err);
        } catch (handlerErr) {
          this._logger.error('Error handler error', {
            error: (handlerErr as Error).message,
          });
        }
      });
    });

    this.worker.on('exit', (code: number) => {
      this._logger.debug('Worker exited', { code });
      this._isConnected = false;
      this.closeHandlers.forEach((handler) => {
        try {
          handler();
        } catch (err) {
          this._logger.error('Close handler error', {
            error: (err as Error).message,
          });
        }
      });
    });
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get pid(): number | undefined {
    return undefined;
  }

  async send(message: DriverMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Channel is not connected');
    }
    this._logger.debug('Sending message', { type: message.type, tx: message.tx });
    const serialized = this.serializer.serialize(message);
    this.worker.postMessage(serialized);
  }

  onMessage(handler: (message: DriverMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  async close(): Promise<void> {
    this._logger.info('Closing worker thread channel');
    if (!this._isConnected) {
      return;
    }
    const terminationPromise = this.worker.terminate();
    this._isConnected = false;
    await terminationPromise;
    this._logger.info('Worker thread channel closed');
  }
}

/**
 * Spawn a worker thread
 */
export async function spawnWorker(
  script: string,
  options: WorkerThreadsDriverOptions = {}
): Promise<WorkerThreadsChannel> {
  // Dynamic import worker_threads
  const workerThreadsModule = await import('worker_threads');

  const {
    workerData: userWorkerData,
    resourceLimits,
    transferList,
    eval: evalCode = false,
    serializer = defaultSerializer,
    logLevel = 'error',
    logger: customLogger,
  } = options;

  const logger = customLogger ?? createMetaLogger(undefined, logLevel);

  logger.info('Spawning worker thread', { script: evalCode ? '<code>' : script });

  const startupData: WorkerThreadsStartupData = {
    driver: 'worker_threads',
    serializer: serializer.constructor.name,
  };

  const combinedWorkerData = {
    ...((userWorkerData as Record<string, unknown>) ?? {}),
    [STARTUP_DATA_WORKER_KEY]: startupData,
  };

  const worker = new workerThreadsModule.Worker(script, {
    workerData: combinedWorkerData,
    resourceLimits,
    transferList,
    eval: evalCode,
  });

  logger.debug('Worker thread spawned', { threadId: worker.threadId });

  await new Promise<void>((resolve, reject) => {
    const onlineHandler = () => {
      worker.removeListener('error', errorHandler);
      logger.debug('Worker thread online', { threadId: worker.threadId });
      resolve();
    };

    const errorHandler = (err: Error) => {
      worker.removeListener('online', onlineHandler);
      logger.error('Worker thread failed to start', { error: err.message });
      reject(err);
    };

    worker.once('online', onlineHandler);
    worker.once('error', errorHandler);
  });

  logger.info('Worker thread ready', { threadId: worker.threadId });

  return new WorkerThreadsChannel(worker, { serializer, logger });
}
```

**Step 3: Create server.ts**

```typescript
/**
 * Worker threads driver - server side implementation
 *
 * @packageDocumentation
 */

import type { Serializer } from '../../../utils/serializer.js';
import { defaultSerializer } from '../../../utils/serializer.js';
import { createMetaLogger, type Logger, type LogLevel } from '../../../utils/logger.js';
import type { DriverMessage, ServerOptions, ServerChannel } from '../../driver.js';
import type { WorkerThreadsStartupData } from './host.js';

/**
 * Function to send a response back to the host
 */
export type ResponseFunction = (response: DriverMessage) => Promise<void>;

/**
 * Worker threads server implementation.
 */
export class WorkerThreadsServerChannel implements ServerChannel {
  private _isRunning = false;
  private messageHandlers: Array<(message: DriverMessage, respond: ResponseFunction) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private readonly logger: Logger;
  private readonly serializer: Serializer;
  private readonly parentPort: import('worker_threads').MessagePort;

  constructor(
    parentPort: import('worker_threads').MessagePort,
    options: { serializer: Serializer; logger: Logger }
  ) {
    this.parentPort = parentPort;
    this.serializer = options.serializer;
    this.logger = options.logger;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get socketPath(): string {
    return '';
  }

  onMessage(handler: (message: DriverMessage, respond: ResponseFunction) => void): void {
    this.messageHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  start(): void {
    if (this._isRunning) {
      this.logger.warn('Server is already running');
      return;
    }

    this._isRunning = true;
    this.logger.info('Worker threads server starting');

    this.parentPort.on('message', (data: unknown) => {
      try {
        const message =
          typeof data === 'string'
            ? this.serializer.deserialize<DriverMessage>(data)
            : (data as DriverMessage);

        this.logger.debug('Received message', {
          type: message.type,
          tx: message.tx,
        });

        const respond: ResponseFunction = async (response: DriverMessage) => {
          await this.sendMessage(response);
        };

        this.messageHandlers.forEach((handler) => {
          try {
            handler(message, respond);
          } catch (err) {
            this.logger.error('Message handler error', {
              error: (err as Error).message,
            });
          }
        });
      } catch (err) {
        this.logger.error('Failed to process message', {
          error: (err as Error).message,
        });
      }
    });

    this.parentPort.on('messageerror', (err: Error) => {
      this.logger.error('Message error', { error: err.message });
      this.errorHandlers.forEach((handler) => {
        try {
          handler(err);
        } catch (handlerErr) {
          this.logger.error('Error handler error', {
            error: (handlerErr as Error).message,
          });
        }
      });
    });

    this.logger.info('Worker threads server started');
  }

  private async sendMessage(message: DriverMessage): Promise<void> {
    this.logger.debug('Sending message', { tx: message.tx, type: message.type });
    const serialized = this.serializer.serialize(message);
    this.parentPort.postMessage(serialized);
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping worker threads server');
    this._isRunning = false;
    this.parentPort.close();
    this.logger.info('Worker threads server stopped');
  }
}

/**
 * Create a worker threads server channel
 */
export function createServer(
  _startupData: WorkerThreadsStartupData,
  options: ServerOptions = {}
): WorkerThreadsServerChannel {
  // Dynamic import worker_threads
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const workerThreadsModule = require('worker_threads') as typeof import('worker_threads');

  const {
    serializer = defaultSerializer,
    logLevel = 'error',
    logger: customLogger,
  } = options;

  const logger = customLogger ?? createMetaLogger(undefined, logLevel);

  if (!workerThreadsModule.parentPort) {
    throw new Error(
      'Cannot create WorkerThreadsServer: not running inside a worker thread. ' +
      'Ensure this code is executed inside a worker spawned by WorkerThreadsDriver.'
    );
  }

  logger.info('Creating worker threads server');

  const server = new WorkerThreadsServerChannel(workerThreadsModule.parentPort, {
    serializer,
    logger,
  });

  server.start();

  return server;
}
```

**Step 4: Create driver.ts**

```typescript
/**
 * Worker threads driver - unified driver definition
 *
 * @packageDocumentation
 */

import { defineWorkerDriver, type ServerOptions, type ServerChannel } from '../../driver.js';
import type { WorkerThreadsStartupData, WorkerThreadsDriverOptions } from './host.js';

/** workerData key for startup data */
const STARTUP_DATA_WORKER_KEY = '__isolatedWorkers';

/**
 * Worker threads driver.
 *
 * Uses worker_threads module with MessagePort for IPC.
 * Supports SharedArrayBuffer for shared memory.
 */
export const WorkerThreadsDriver = defineWorkerDriver({
  name: 'worker_threads' as const,

  /**
   * Spawn a worker thread (host side)
   */
  async spawn(script: string, options: WorkerThreadsDriverOptions = {}) {
    const { spawnWorker } = await import('./host.js');
    return spawnWorker(script, options);
  },

  /**
   * Get startup data (server side)
   * @throws Error if not running in a worker thread context
   */
  getStartupData(): WorkerThreadsStartupData {
    // Must use require for synchronous access to workerData
    let workerThreadsModule: typeof import('worker_threads');
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      workerThreadsModule = require('worker_threads');
    } catch {
      throw new Error(
        'WorkerThreadsDriver.getStartupData() called but worker_threads module is not available. ' +
        'Ensure you are running in a Node.js environment that supports worker threads.'
      );
    }

    if (!workerThreadsModule.parentPort) {
      throw new Error(
        'WorkerThreadsDriver.getStartupData() called but not running inside a worker thread. ' +
        'Ensure this worker was spawned via createWorker() with WorkerThreadsDriver.'
      );
    }

    const workerData = workerThreadsModule.workerData as Record<string, unknown> | undefined;
    const startupData = workerData?.[STARTUP_DATA_WORKER_KEY] as WorkerThreadsStartupData | undefined;

    if (!startupData) {
      throw new Error(
        'WorkerThreadsDriver.getStartupData() called but no startup data found in workerData. ' +
        'Ensure this worker was spawned via createWorker() with WorkerThreadsDriver.'
      );
    }

    if (startupData.driver !== 'worker_threads') {
      throw new Error(
        `WorkerThreadsDriver.getStartupData() called but startup data indicates driver "${startupData.driver}". ` +
        'Use the matching driver for this worker context.'
      );
    }

    return startupData;
  },

  /**
   * Create server channel (server side)
   */
  createServer(options: ServerOptions = {}): ServerChannel {
    // Use require for synchronous server creation
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createServer } = require('./server.js') as typeof import('./server.js');
    const startupData = this.getStartupData();
    return createServer(startupData, options);
  },

  // Capability method - enables sharedMemory: true
  transferSharedMemory(_buffer: SharedArrayBuffer): void {
    throw new Error('transferSharedMemory() is not yet implemented');
  },
});

export type WorkerThreadsDriverType = typeof WorkerThreadsDriver;
```

**Step 5: Create index.ts**

```typescript
/**
 * Worker threads driver
 *
 * @packageDocumentation
 */

// Main driver export
export { WorkerThreadsDriver, type WorkerThreadsDriverType } from './driver.js';

// Host-side exports (for advanced usage)
export {
  spawnWorker,
  WorkerThreadsChannel,
  STARTUP_DATA_WORKER_KEY,
  type WorkerThreadsDriverOptions,
  type WorkerThreadsStartupData,
  type WorkerThreadsResourceLimits,
} from './host.js';

// Server-side exports (for advanced usage)
export {
  createServer,
  WorkerThreadsServerChannel,
  type ResponseFunction,
} from './server.js';
```

**Step 6: Run typecheck**

Run: `pnpm nx run isolated-workers:build`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add packages/isolated-workers/src/core/drivers/worker-threads/
git commit -m "$(cat <<'EOF'
feat(driver): create unified WorkerThreadsDriver with defineWorkerDriver

Uses dynamic imports for host code. getStartupData() throws if called
outside worker thread context.
EOF
)"
```

---

## Task 6: Update Drivers Index and Remove Old Files

**Files:**
- Modify: `packages/isolated-workers/src/core/drivers/index.ts`
- Delete: `packages/isolated-workers/src/core/drivers/child-process.ts`
- Delete: `packages/isolated-workers/src/core/drivers/child-process-server.ts`
- Delete: `packages/isolated-workers/src/core/drivers/worker-threads.ts`
- Delete: `packages/isolated-workers/src/core/drivers/worker-threads-server.ts`
- Delete: `packages/isolated-workers/src/core/drivers/startup.ts`

**Step 1: Update drivers/index.ts**

```typescript
/**
 * Driver implementations and utilities
 *
 * @packageDocumentation
 */

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
  ServerChannel,
  ServerOptions,
  StartupData,
  defineWorkerDriver,
  InferCapabilities,
} from '../driver.js';

// Child process driver
export {
  ChildProcessDriver,
  ChildProcessChannel,
  ChildProcessServerChannel,
  STARTUP_DATA_ENV_KEY,
  encodeStartupData,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
  type ChildProcessDriverType,
  type ChildProcessDriverOptions,
  type ChildProcessStartupData,
  type ResponseFunction as ChildProcessResponseFunction,
} from './child-process/index.js';

// Worker threads driver
export {
  WorkerThreadsDriver,
  WorkerThreadsChannel,
  WorkerThreadsServerChannel,
  STARTUP_DATA_WORKER_KEY,
  type WorkerThreadsDriverType,
  type WorkerThreadsDriverOptions,
  type WorkerThreadsStartupData,
  type WorkerThreadsResourceLimits,
  type ResponseFunction as WorkerThreadsResponseFunction,
} from './worker-threads/index.js';

/**
 * Load the default driver (child_process) via dynamic import.
 */
export async function loadDefaultDriver() {
  const { ChildProcessDriver } = await import('./child-process/index.js');
  return ChildProcessDriver;
}
```

**Step 2: Delete old files**

Run:
```bash
rm packages/isolated-workers/src/core/drivers/child-process.ts
rm packages/isolated-workers/src/core/drivers/child-process-server.ts
rm packages/isolated-workers/src/core/drivers/child-process.spec.ts
rm packages/isolated-workers/src/core/drivers/worker-threads.ts
rm packages/isolated-workers/src/core/drivers/worker-threads-server.ts
rm packages/isolated-workers/src/core/drivers/worker-threads.spec.ts
rm packages/isolated-workers/src/core/drivers/startup.ts
rm packages/isolated-workers/src/core/drivers/startup.spec.ts
```

**Step 3: Run typecheck**

Run: `pnpm nx run isolated-workers:build`
Expected: May have errors - fix imports in other files

**Step 4: Commit**

```bash
git add -A packages/isolated-workers/src/core/drivers/
git commit -m "$(cat <<'EOF'
refactor(driver): consolidate driver exports and remove old files

Replaces flat file structure with child-process/ and worker-threads/
directories. Old files deleted.
EOF
)"
```

---

## Task 7: Update worker-server.ts

**Files:**
- Modify: `packages/isolated-workers/src/core/worker-server.ts`

**Step 1: Rewrite to use driver parameter**

```typescript
/**
 * Worker server for handling incoming messages
 *
 * @packageDocumentation
 */

import {
  createMetaLogger,
  type Logger,
  type LogLevel,
} from '../utils/index.js';
import {
  serializeError,
  defaultSerializer,
  validateSerializer,
  type Serializer,
} from '../utils/serializer.js';
import { TypedMessage, createResponse } from './messaging.js';
import type {
  MessageDefs,
  Handlers,
  Middleware,
  TransactionIdGenerator,
  AnyMessage,
} from '../types/index.js';
import { applyMiddleware } from './internals.js';
import type { DriverMessage, ServerChannel, ServerOptions } from './driver.js';
import { ChildProcessDriver } from './drivers/child-process/driver.js';

/**
 * Handler function type for worker messages
 */
export type WorkerHandler<TPayload = unknown, TResult = unknown> = (
  payload: TPayload
) => TResult | Promise<TResult>;

/**
 * Collection of handlers for different message types
 */
export type WorkerHandlers = Record<string, WorkerHandler>;

/**
 * Driver interface for server-side usage
 */
interface ServerDriver {
  name: string;
  getStartupData(): unknown;
  createServer(options: ServerOptions): ServerChannel | Promise<ServerChannel>;
}

/**
 * Server configuration options
 */
export interface WorkerServerOptions<TDefs extends MessageDefs = MessageDefs> {
  /**
   * Driver to use for server communication.
   * Defaults to ChildProcessDriver if not specified.
   * Must match the driver used on the host side.
   */
  driver?: ServerDriver;

  /** Messaging options */
  middleware?: Middleware<TDefs>[];
  serializer?: Serializer;
  txIdGenerator?: TransactionIdGenerator<TDefs>;

  /** Logging options */
  logLevel?: LogLevel;
  logger?: Logger;

  /** @deprecated Use logLevel instead */
  debug?: boolean;
}

/**
 * Active worker server
 */
export interface WorkerServer {
  stop(): Promise<void>;
  isRunning: boolean;
}

/**
 * Start a worker server that listens for messages (type-safe version)
 */
export async function startWorkerServer<TDefs extends MessageDefs>(
  handlers: Handlers<TDefs>,
  options?: WorkerServerOptions<TDefs>
): Promise<WorkerServer>;

/**
 * Start a worker server that listens for messages (legacy version)
 */
export async function startWorkerServer(
  handlers: WorkerHandlers,
  options?: WorkerServerOptions
): Promise<WorkerServer>;

/**
 * Start a worker server that listens for messages.
 */
export async function startWorkerServer<TDefs extends MessageDefs>(
  handlers: WorkerHandlers | Handlers<TDefs>,
  options: WorkerServerOptions<TDefs> = {}
): Promise<WorkerServer> {
  const {
    driver = ChildProcessDriver,
    middleware = [],
    serializer = defaultSerializer,
    logLevel = 'error',
    logger: customLogger,
    debug = false,
  } = options;

  const effectiveLogLevel = debug ? 'debug' : logLevel;
  const serverLogger = createMetaLogger(customLogger, effectiveLogLevel);

  validateSerializer(serializer);

  serverLogger.info('Starting worker server', { driver: driver.name });

  // Driver validates startup data and creates server
  const serverChannel = await driver.createServer({
    serializer,
    logLevel: effectiveLogLevel,
    logger: serverLogger,
  });

  let isRunning = serverChannel.isRunning;

  // Set up message handling via the server channel
  serverChannel.onMessage(async (message: DriverMessage, respond) => {
    const typedMessage = message as TypedMessage;

    try {
      const processedMessage =
        middleware.length > 0
          ? await applyMiddleware(
              typedMessage as AnyMessage<TDefs>,
              'incoming',
              middleware
            )
          : typedMessage;

      serverLogger.debug('Received message', {
        type: processedMessage.type,
        tx: processedMessage.tx,
      });

      const handler = (handlers as WorkerHandlers)[processedMessage.type];
      if (!handler) {
        serverLogger.warn('No handler for message type', {
          type: processedMessage.type,
        });
        const errorResponse = {
          tx: processedMessage.tx,
          type: `${processedMessage.type}Error`,
          payload: serializeError(new Error(`Unknown message type: ${processedMessage.type}`)),
        };
        await respond(errorResponse);
        return;
      }

      try {
        const result = await handler(processedMessage.payload);

        let response = createResponse(
          processedMessage.tx,
          processedMessage.type,
          result
        );

        if (middleware.length > 0) {
          response = await applyMiddleware(
            response as AnyMessage<TDefs>,
            'outgoing',
            middleware
          );
        }

        await respond(response as DriverMessage);
      } catch (err) {
        serverLogger.error('Handler error', {
          type: processedMessage.type,
          tx: processedMessage.tx,
          error: (err as Error).message,
        });

        let errorResponse: DriverMessage = {
          tx: processedMessage.tx,
          type: `${processedMessage.type}Error`,
          payload: serializeError(err as Error),
        };

        if (middleware.length > 0) {
          errorResponse = (await applyMiddleware(
            errorResponse as AnyMessage<TDefs>,
            'outgoing',
            middleware
          )) as DriverMessage;
        }

        await respond(errorResponse);
      }
    } catch (err) {
      serverLogger.error('Failed to process message', {
        error: (err as Error).message,
      });
    }
  });

  serverChannel.onError((err: Error) => {
    serverLogger.error('Server channel error', { error: err.message });
  });

  const stopServer = async () => {
    serverLogger.info('Shutting down worker server');
    isRunning = false;
    await serverChannel.stop();
    serverLogger.info('Worker server stopped');
  };

  const signalHandler = () => {
    void stopServer();
  };
  process.on('SIGTERM', signalHandler);
  process.on('SIGINT', signalHandler);

  return {
    get isRunning() {
      return isRunning && serverChannel.isRunning;
    },

    async stop(): Promise<void> {
      return stopServer();
    },
  };
}
```

**Step 2: Run typecheck**

Run: `pnpm nx run isolated-workers:build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/isolated-workers/src/core/worker-server.ts
git commit -m "$(cat <<'EOF'
feat(server): update startWorkerServer to accept driver option

Defaults to ChildProcessDriver for backwards compatibility. Driver
creates the server channel and validates startup data.
EOF
)"
```

---

## Task 8: Update Examples

**Files:**
- Modify: `examples/worker-threads-driver/worker.ts`
- Other examples remain unchanged (use default child_process)

**Step 1: Update worker-threads example**

```typescript
/**
 * Worker Threads Driver Example - Worker
 *
 * This worker runs in a worker thread (same process as host).
 * Must specify WorkerThreadsDriver since the host uses it.
 */

import { startWorkerServer, type Handlers } from 'isolated-workers';
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
import type { Messages } from './messages.js';

const handlers: Handlers<Messages> = {
  compute: async ({ value }) => {
    console.log(`[Worker] Computing ${value} * 2...`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { result: value * 2 };
  },
};

// Must specify driver to match host side
startWorkerServer<Messages>(handlers, {
  driver: WorkerThreadsDriver,
  logLevel: 'info',
}).then(() => {
  console.log('[Worker] Server started');
}).catch((err) => {
  console.error('[Worker] Failed to start server:', err);
  process.exit(1);
});
```

**Step 2: Run example to verify**

Run: `pnpm nx run examples:worker-threads-driver`
Expected: Example runs successfully

**Step 3: Commit**

```bash
git add examples/worker-threads-driver/worker.ts
git commit -m "$(cat <<'EOF'
docs(examples): update worker-threads example to specify driver

Worker must now specify WorkerThreadsDriver to match host side.
EOF
)"
```

---

## Task 9: Update Package Exports

**Files:**
- Modify: `packages/isolated-workers/package.json`

**Step 1: Update exports map**

Ensure the exports include the new driver paths:

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./drivers/child-process": {
      "import": "./dist/core/drivers/child-process/index.js",
      "types": "./dist/core/drivers/child-process/index.d.ts"
    },
    "./drivers/worker-threads": {
      "import": "./dist/core/drivers/worker-threads/index.js",
      "types": "./dist/core/drivers/worker-threads/index.d.ts"
    }
  }
}
```

**Step 2: Run build**

Run: `pnpm nx run isolated-workers:build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/isolated-workers/package.json
git commit -m "$(cat <<'EOF'
build(package): update exports for new driver structure
EOF
)"
```

---

## Task 10: Run Full Test Suite

**Step 1: Run all tests**

Run: `pnpm nx run-many -t test,e2e`
Expected: All tests pass

**Step 2: Fix any failing tests**

Update test imports and assertions as needed.

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "$(cat <<'EOF'
test: fix tests for driver refactor
EOF
)"
```

---

## Summary

This plan refactors the driver abstraction to:
1. Add `defineWorkerDriver` utility for capability inference
2. Split drivers into host/server modules with dynamic imports
3. Move `getStartupData()` to each driver (throws if invalid)
4. Update `startWorkerServer()` to accept optional driver
5. Maintain backwards compatibility for default (child_process) usage
