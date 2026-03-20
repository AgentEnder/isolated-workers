/**
 * Custom Driver Example — Loopback Driver
 *
 * Demonstrates how to define a custom driver using `defineWorkerDriver`.
 * This "loopback" driver runs the worker handler in-process (no child process,
 * no thread). Useful for testing or environments where process isolation
 * isn't needed.
 *
 * Key concepts:
 *  1. Implement `WorkerHandle` — the communication primitive
 *  2. Call `defineWorkerDriver()` — registers spawn/server logic
 *  3. Capabilities are inferred from method presence on the config object
 */

import type { ShutdownReason } from 'isolated-workers';
import {
  defineWorkerDriver,
  type WorkerHandle,
  type DriverMessage,
  type ServerChannel,
  type ServerOptions,
  type StartupData,
} from 'isolated-workers/drivers';

// ---------------------------------------------------------------------------
// 1. Custom spawn options — users pass these via `driverOptions`
//    TypeScript infers them automatically via `DriverOptionsFor<typeof LoopbackDriver>`
// ---------------------------------------------------------------------------

export interface LoopbackDriverOptions {
  /** Artificial delay per message (ms) for simulating latency */
  latencyMs?: number;
  /** Handler that processes messages in-process and returns a response */
  handler?: (msg: DriverMessage) => DriverMessage;
}

// ---------------------------------------------------------------------------
// 2. The "underlying worker" for this driver.
//    For child_process it's a ChildProcess, for worker_threads it's a Worker.
//    For our loopback driver, it's a simple object representing the loop.
//    Users access this via `worker.getHandle()`.
// ---------------------------------------------------------------------------

export interface LoopbackHandle {
  /** Number of messages processed */
  messagesProcessed: number;
}

// ---------------------------------------------------------------------------
// 3. WorkerHandle implementation — the communication layer
//
//    A WorkerHandle is what `driver.spawn()` returns. It bridges the host side
//    (createWorker) and whatever communication mechanism the driver uses.
// ---------------------------------------------------------------------------

class LoopbackWorkerHandle implements WorkerHandle {
  private _isConnected = true;
  private _messageHandler: ((msg: DriverMessage) => void) | null = null;
  private _closeHandlers: Array<() => void> = [];
  private readonly handle: LoopbackHandle = { messagesProcessed: 0 };

  constructor(
    private readonly latencyMs: number,
    private readonly handler: (msg: DriverMessage) => DriverMessage
  ) {}

  get isConnected(): boolean {
    return this._isConnected;
  }

  get pid(): number | undefined {
    // Loopback runs in-process — no separate PID
    return undefined;
  }

  getHandle(): LoopbackHandle {
    return this.handle;
  }

  async send(message: DriverMessage): Promise<void> {
    if (!this._isConnected) {
      throw new Error('Channel is not connected');
    }

    this.handle.messagesProcessed++;

    // Simulate latency
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }

    // In a real driver, messages cross a process/thread boundary.
    // Here we run the handler in-process and deliver the response
    // back through onMessage — the same path a real channel uses.
    const response = this.handler(message);
    if (this._messageHandler) {
      this._messageHandler(response);
    }
  }

  onMessage(handler: (message: DriverMessage) => void): void {
    this._messageHandler = handler;
  }

  onError(_handler: (error: Error) => void): void {
    // Loopback can't error in the same way — no-op
  }

  onClose(handler: () => void): void {
    this._closeHandlers.push(handler);
  }

  onShutdown(_handler: (reason: ShutdownReason) => void): void {
    // Loopback doesn't crash — no-op
  }

  async close(): Promise<void> {
    this._isConnected = false;
    for (const handler of this._closeHandlers) {
      handler();
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Startup data — passed from host to worker so the server side knows
//    which driver to use. For loopback, there's nothing to pass.
// ---------------------------------------------------------------------------

interface LoopbackStartupData extends StartupData {
  driver: 'loopback';
}

// ---------------------------------------------------------------------------
// 5. Define the driver with `defineWorkerDriver`
//
//    Capabilities are inferred from the config object's shape:
//    - No `disconnect`/`reconnect` methods → reconnect: false
//    - No `detached` property            → detach: false
//    - No `transferSharedMemory`         → sharedMemory: false
//
//    The `name` property is a string literal ('loopback' as const).
//    This is what `UnderlyingWorkerOf<TDriver>` uses for type dispatch.
//
//    Note: `getHandle()` is defined on the WorkerHandle class itself
//    (LoopbackWorkerHandle), not in the driver config.
// ---------------------------------------------------------------------------

export const LoopbackDriver = defineWorkerDriver({
  name: 'loopback' as const,

  async spawn(
    _script: string | URL,
    options: LoopbackDriverOptions = {}
  ): Promise<LoopbackWorkerHandle> {
    const {
      latencyMs = 0,
      handler = (msg) => ({ ...msg, payload: msg.payload }),
    } = options;
    return new LoopbackWorkerHandle(latencyMs, handler);
  },

  getStartupData(): LoopbackStartupData {
    return { driver: 'loopback' };
  },

  createServer(_options: ServerOptions = {}): ServerChannel {
    // Loopback doesn't need a real server — return a minimal stub
    return {
      onMessage: () => {
        // noop
      },
      onError: () => {
        // noop
      },
      stop: async () => {
        // noop
      },
      isRunning: false,
      socketPath: '',
    };
  },
});

export type LoopbackDriverType = typeof LoopbackDriver;
