/// <reference lib="webworker" />

/**
 * Web Worker driver host module
 *
 * Contains spawn logic for the web worker driver. This module is imported
 * only on the host side (the page/main thread that spawns workers).
 *
 * @packageDocumentation
 */

import type { ShutdownReason } from '../../../types/config.js';
import type {
  DriverChannel,
  DriverMessage,
  StartupData,
} from '../../driver.js';

/** Init message type sent from host to worker via global postMessage */
const INIT_MESSAGE_TYPE = '__iw_init';

/**
 * Startup data specific to web_worker driver.
 */
export interface WebWorkerStartupData extends StartupData {
  /** Driver identifier - always 'web_worker' for this driver */
  driver: 'web_worker';
}

/**
 * Options passed to the browser Worker constructor.
 *
 * Defined locally to avoid conflicts with Node's WorkerOptions type
 * from worker_threads.
 */
export interface BrowserWorkerConstructorOptions {
  /** Worker type - defaults to 'module' */
  type?: 'classic' | 'module';
  /** Worker name for debugging */
  name?: string;
  /** Credentials mode */
  credentials?: RequestCredentials;
}

/**
 * Options for web worker driver spawn
 */
export interface WebWorkerDriverOptions {
  /**
   * Options passed to the browser Worker constructor.
   * `type` defaults to 'module' if not specified.
   */
  workerOptions?: BrowserWorkerConstructorOptions;
}

/**
 * Channel implementation for web worker driver.
 *
 * Wraps a Worker and a MessagePort to provide the DriverChannel interface.
 * Communication happens through a dedicated MessagePort, not the global
 * postMessage channel.
 */
export class WebWorkerChannel implements DriverChannel {
  private _isConnected: boolean;
  private messageHandlers: Array<(message: DriverMessage) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private shutdownHandlers: Array<(reason: ShutdownReason) => void> = [];

  constructor(
    private readonly worker: Worker,
    private readonly port: MessagePort
  ) {
    this._isConnected = true;

    // Route messages from the dedicated port
    this.port.onmessage = (event: MessageEvent<DriverMessage>) => {
      const message = event.data;
      this.messageHandlers.forEach((handler) => {
        try {
          handler(message);
        } catch {
          // Handler errors are swallowed to prevent breaking the message loop
        }
      });
    };

    this.port.onmessageerror = () => {
      const error = new Error('Failed to deserialize message from worker');
      this.errorHandlers.forEach((handler) => {
        try {
          handler(error);
        } catch {
          // Swallow handler errors
        }
      });
    };

    // Worker error and termination handling
    this.worker.onerror = (event: ErrorEvent) => {
      const error = new Error(event.message);
      this.errorHandlers.forEach((handler) => {
        try {
          handler(error);
        } catch {
          // Swallow handler errors
        }
      });

      const reason: ShutdownReason = { type: 'error', error };
      this.shutdownHandlers.forEach((handler) => {
        try {
          handler(reason);
        } catch {
          // Swallow handler errors
        }
      });
    };
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  /** Web Workers don't have PIDs. Returns undefined. */
  get pid(): number | undefined {
    return undefined;
  }

  async send(message: DriverMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Channel is not connected');
    }
    this.port.postMessage(message);
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

  onShutdown(handler: (reason: ShutdownReason) => void): void {
    this.shutdownHandlers.push(handler);
  }

  async close(): Promise<void> {
    if (!this._isConnected) {
      return;
    }

    this._isConnected = false;
    this.port.close();
    this.worker.terminate();

    this.closeHandlers.forEach((handler) => {
      try {
        handler();
      } catch {
        // Swallow handler errors
      }
    });
  }
}

/**
 * Spawn a web worker and establish a MessageChannel for communication.
 *
 * @param script - URL to the worker script (must be a URL object)
 * @param options - Spawn options
 * @returns Promise resolving to a WebWorkerChannel
 */
export function spawnWorker(
  script: string | URL,
  options: WebWorkerDriverOptions = {}
): Promise<WebWorkerChannel> {
  if (typeof script === 'string') {
    throw new Error(
      'WebWorkerDriver requires a URL object for the script parameter. ' +
        'Use: new URL("./worker.ts", import.meta.url)'
    );
  }

  const workerOptions: BrowserWorkerConstructorOptions = {
    type: 'module' as const,
    ...options.workerOptions,
  };

  const worker = new Worker(script, workerOptions);

  // Create a dedicated MessageChannel for library communication
  const { port1, port2 } = new MessageChannel();

  // Transfer port2 to the worker via the global postMessage
  const initMessage = { type: INIT_MESSAGE_TYPE, port: port2 };
  worker.postMessage(initMessage, [port2]);

  // port1 stays on the host side
  port1.start();

  return Promise.resolve(new WebWorkerChannel(worker, port1));
}
