/// <reference lib="webworker" />

/**
 * Web Worker driver server module
 *
 * Contains server logic for the web worker driver. This module is imported
 * only on the worker side (inside the Web Worker).
 *
 * @packageDocumentation
 */

import type { DriverMessage, ServerChannel } from '../../driver.js';

/** Init message type - must match host.ts */
const INIT_MESSAGE_TYPE = '__iw_init';

/**
 * Function to send a response back to the host
 */
export type ResponseFunction = (response: DriverMessage) => Promise<void>;

/**
 * Web Worker server channel implementation.
 *
 * Wraps a MessagePort received from the host and provides the ServerChannel interface.
 */
export class WebWorkerServerChannel implements ServerChannel {
  private _isRunning = false;
  private messageHandlers: Array<
    (message: DriverMessage, respond: ResponseFunction) => void
  > = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private readonly port: MessagePort;

  constructor(port: MessagePort) {
    this.port = port;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  /** Web Workers don't use socket paths. Returns empty string. */
  get socketPath(): string {
    return '';
  }

  onMessage(
    handler: (message: DriverMessage, respond: ResponseFunction) => void
  ): void {
    this.messageHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Start listening for messages from the host via the dedicated port
   */
  start(): void {
    if (this._isRunning) {
      return;
    }

    this._isRunning = true;

    this.port.onmessage = (event: MessageEvent<DriverMessage>) => {
      const message = event.data;

      const respond: ResponseFunction = async (response: DriverMessage) => {
        this.port.postMessage(response);
      };

      this.messageHandlers.forEach((handler) => {
        try {
          handler(message, respond);
        } catch (err) {
          this.errorHandlers.forEach((errHandler) => {
            try {
              errHandler(err instanceof Error ? err : new Error(String(err)));
            } catch {
              // Swallow handler errors
            }
          });
        }
      });
    };

    this.port.onmessageerror = () => {
      const error = new Error('Failed to deserialize message from host');
      this.errorHandlers.forEach((handler) => {
        try {
          handler(error);
        } catch {
          // Swallow handler errors
        }
      });
    };

    this.port.start();
  }

  async stop(): Promise<void> {
    this._isRunning = false;
    this.port.close();
  }
}

/**
 * Wait for the init handshake from the host and create the server channel.
 *
 * The host sends a message via the global `postMessage` channel containing
 * a MessagePort. This function listens for that init message, extracts the
 * port, and returns a WebWorkerServerChannel.
 *
 * @returns Promise resolving to a WebWorkerServerChannel
 */
export function createServer(): Promise<WebWorkerServerChannel> {
  return new Promise<WebWorkerServerChannel>((resolve, reject) => {
    // TypeScript: `self` in a Web Worker context is DedicatedWorkerGlobalScope
    const workerSelf = self as DedicatedWorkerGlobalScope;

    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          'WebWorkerDriver: Timed out waiting for init handshake from host. ' +
            'Ensure the host is using WebWorkerDriver to spawn this worker.'
        )
      );
    }, 30_000);

    workerSelf.onmessage = (event: MessageEvent) => {
      if (
        event.data?.type === INIT_MESSAGE_TYPE &&
        event.data?.port instanceof MessagePort
      ) {
        clearTimeout(timeoutId);

        const port = event.data.port as MessagePort;

        // Clear the global listener - the library now uses the dedicated port
        workerSelf.onmessage = null;

        const server = new WebWorkerServerChannel(port);
        server.start();
        resolve(server);
      }
    };
  });
}
