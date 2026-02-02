/**
 * Driver abstraction for worker communication
 *
 * This module provides the core interfaces for implementing different worker
 * communication backends (child_process with sockets, worker_threads with MessagePort).
 *
 * @packageDocumentation
 */

/**
 * Message structure for driver communication.
 *
 * All messages sent through the driver layer follow this structure,
 * enabling type-safe messaging with transaction tracking.
 */
export interface DriverMessage {
  /** Message type identifier */
  type: string;
  /** Message payload data */
  payload: unknown;
  /** Transaction ID for request/response correlation */
  tx: string;
}

/**
 * Communication channel returned by driver spawn.
 *
 * The channel provides a unified interface for sending messages,
 * handling events, and managing the connection lifecycle.
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
 * Driver capability flags.
 *
 * These flags indicate what features a driver supports,
 * allowing higher-level code to make decisions based on
 * available capabilities.
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
 * Driver interface for spawning workers.
 *
 * Drivers implement this interface to provide different worker
 * communication backends.
 *
 * @typeParam TCapabilities - The specific capabilities this driver supports
 * @typeParam TOptions - Driver-specific spawn options
 *
 * @example
 * ```typescript
 * const childProcessDriver: Driver<ChildProcessCapabilities, ChildProcessOptions> = {
 *   name: 'child_process',
 *   capabilities: { reconnect: true, detach: true, sharedMemory: false },
 *   spawn: async (script, options) => { ... }
 * };
 * ```
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
 * Capability type for child_process driver.
 *
 * Child process workers support reconnection and detaching,
 * but cannot use SharedArrayBuffer across the IPC boundary.
 */
export interface ChildProcessCapabilities extends DriverCapabilities {
  reconnect: true;
  detach: true;
  sharedMemory: false;
}

/**
 * Capability type for worker_threads driver.
 *
 * Worker thread workers support SharedArrayBuffer but cannot
 * be reconnected or detached from the parent.
 */
export interface WorkerThreadsCapabilities extends DriverCapabilities {
  reconnect: false;
  detach: false;
  sharedMemory: true;
}

/**
 * Reconnect capability mixin.
 *
 * Channels that support reconnection implement this interface
 * to allow disconnecting while keeping the worker alive.
 */
export interface ReconnectCapability {
  /** Disconnect from worker but keep process alive */
  disconnect(): Promise<void>;
  /** Reconnect to existing worker */
  reconnect(): Promise<void>;
}

/**
 * Detach capability mixin.
 *
 * Channels that support detaching expose this to indicate
 * whether the worker is running detached from the parent.
 */
export interface DetachCapability {
  /** Whether the worker is detached */
  readonly detached: boolean;
}

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

/**
 * Server channel interface for worker-side communication.
 */
export interface ServerChannel {
  /** Register a message handler */
  onMessage(
    handler: (
      message: DriverMessage,
      respond: (response: DriverMessage) => Promise<void>
    ) => void
  ): void;
  /** Register an error handler */
  onError(handler: (error: Error) => void): void;
  /** Stop the server and cleanup */
  stop(): Promise<void>;
  /** Whether the server is running */
  readonly isRunning: boolean;
  /** Socket path the server is listening on (empty for worker_threads) */
  readonly socketPath: string;
}

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

/**
 * Type helpers for capability inference
 */
type HasDisconnect = { disconnect(): Promise<void> };
type HasReconnect = { reconnect(): Promise<void> };
type HasDetached = { readonly detached: boolean };
type HasTransferSharedMemory = {
  transferSharedMemory(buffer: SharedArrayBuffer): void;
};

/**
 * Infer capabilities from driver shape
 */
export type InferCapabilities<T> = {
  reconnect: T extends HasDisconnect & HasReconnect ? true : false;
  detach: T extends HasDetached ? true : false;
  sharedMemory: T extends HasTransferSharedMemory ? true : false;
};

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
    reconnect: ('disconnect' in config &&
      'reconnect' in config) as InferCapabilities<T>['reconnect'],
    detach: ('detached' in config) as InferCapabilities<T>['detach'],
    sharedMemory: ('transferSharedMemory' in
      config) as InferCapabilities<T>['sharedMemory'],
  } as InferCapabilities<T>;

  return {
    ...config,
    capabilities,
  };
}
