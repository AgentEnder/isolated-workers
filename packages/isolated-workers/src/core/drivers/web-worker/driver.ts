/**
 * Web Worker driver - unified driver definition
 *
 * Thin wrapper that uses dynamic imports to load host/server code on demand.
 *
 * @packageDocumentation
 */

import {
  defineWorkerDriver,
  type ServerChannel,
  type ServerOptions,
} from '../../driver.js';
import type { WebWorkerDriverOptions, WebWorkerStartupData } from './host.js';

/**
 * Web Worker driver.
 *
 * Uses the browser's Web Worker API with a dedicated MessageChannel/MessagePort
 * for IPC. Supports SharedArrayBuffer (requires COOP/COEP headers).
 *
 * @example
 * ```typescript
 * import { WebWorkerDriver } from 'isolated-workers/drivers/web-worker';
 *
 * // Host side: spawn a worker
 * const worker = await createWorker<MyMessages>({
 *   script: new URL('./worker.ts', import.meta.url),
 *   driver: WebWorkerDriver,
 * });
 *
 * // Worker side: start server
 * startWorkerServer<MyMessages>(handlers, { driver: WebWorkerDriver });
 * ```
 */
export const WebWorkerDriver = defineWorkerDriver({
  name: 'web_worker' as const,

  /**
   * Spawn a Web Worker (host side)
   *
   * @param script - URL to the worker script (must be a URL object)
   * @param options - Spawn options
   * @returns Promise resolving to a WorkerHandle
   */
  async spawn(script: string | URL, options: WebWorkerDriverOptions = {}) {
    const { spawnWorker } = await import('./host.js');
    return spawnWorker(script, options);
  },

  /**
   * Get startup data (server side)
   *
   * For Web Workers, startup data is minimal since there's no env var
   * or workerData mechanism. The driver name is returned.
   *
   * @returns The startup data
   */
  getStartupData(): WebWorkerStartupData {
    return {
      driver: 'web_worker',
    };
  },

  /**
   * Create server channel (server side)
   *
   * Waits for the init handshake from the host, which transfers a
   * MessagePort for dedicated communication.
   *
   * @param _options - Server options (reserved for future use)
   * @returns Promise resolving to a ServerChannel
   */
  async createServer(_options: ServerOptions = {}): Promise<ServerChannel> {
    const { createServer } = await import('./server.js');
    return createServer();
  },

  // Capability method - enables sharedMemory: true
  transferSharedMemory(_buffer: SharedArrayBuffer): void {
    throw new Error(
      'transferSharedMemory() is not yet implemented. ' +
        'SharedArrayBuffer can be passed directly via postMessage with transfer list.'
    );
  },
});

/** Type of the WebWorkerDriver */
export type WebWorkerDriverType = typeof WebWorkerDriver;
