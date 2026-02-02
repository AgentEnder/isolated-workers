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
