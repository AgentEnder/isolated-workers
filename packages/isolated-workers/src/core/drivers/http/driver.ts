/**
 * HTTP driver - unified driver definition
 *
 * Thin wrapper that uses dynamic imports to load host/server code on demand.
 *
 * @packageDocumentation
 */

import {
  defineWorkerDriver,
  type ServerOptions,
  type ServerChannel,
} from '../../driver.js';
import type { HttpStartupData, HttpDriverOptions } from './host.js';

/** Environment variable key for startup data */
const STARTUP_DATA_ENV_KEY = 'ISOLATED_WORKERS_STARTUP_DATA';

/**
 * HTTP driver.
 *
 * Uses child_process.fork() for lifecycle management with HTTP for IPC.
 * The worker runs an embedded HTTP server; the host sends POST requests.
 * Supports disconnect/reconnect and detached workers.
 *
 * @example
 * ```typescript
 * import { HttpDriver } from 'isolated-workers/drivers/http';
 *
 * // Host side: spawn a worker
 * const channel = await HttpDriver.spawn('./worker.js', {
 *   port: 0, // auto-assign
 *   timeout: 10000,
 * });
 *
 * // Worker side: create server
 * const server = await HttpDriver.createServer();
 * ```
 */
export const HttpDriver = defineWorkerDriver({
  name: 'http' as const,

  /**
   * Spawn an HTTP worker (host side)
   *
   * @param script - Path to the worker script
   * @param options - Spawn options
   * @returns Promise resolving to a WorkerHandle
   */
  async spawn(script: string | URL, options: HttpDriverOptions = {}) {
    const { spawnWorker } = await import('./host.js');
    return spawnWorker(script, options);
  },

  /**
   * Get startup data (server side)
   *
   * Parses the startup data from the environment variable set by the host.
   *
   * @throws Error if not running in an HTTP worker context
   * @returns The startup data passed from the host
   */
  getStartupData(): HttpStartupData {
    const envData = process.env[STARTUP_DATA_ENV_KEY];
    if (!envData) {
      throw new Error(
        'HttpDriver.getStartupData() called but no startup data found. ' +
          'Ensure this worker was spawned via createWorker() with HttpDriver, ' +
          'or check that ISOLATED_WORKERS_STARTUP_DATA environment variable is set.'
      );
    }

    try {
      const data = JSON.parse(envData) as HttpStartupData;
      if (data.driver !== 'http') {
        throw new Error(
          `HttpDriver.getStartupData() called but startup data indicates driver "${data.driver}". ` +
            'Use the matching driver for this worker context.'
        );
      }
      return data;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(
          'HttpDriver.getStartupData() failed to parse startup data. ' +
            'The ISOLATED_WORKERS_STARTUP_DATA environment variable contains invalid JSON.'
        );
      }
      throw err;
    }
  },

  /**
   * Create server channel (server side)
   *
   * Creates an HTTP server that listens for requests from the host process.
   *
   * @param options - Server options
   * @returns Promise resolving to a ServerChannel
   */
  async createServer(options: ServerOptions = {}): Promise<ServerChannel> {
    const { createServer } = await import('./server.js');
    const startupData = this.getStartupData();
    return createServer(startupData, options);
  },

  // Capability methods - presence enables reconnect: true, detach: true
  async disconnect() {
    throw new Error(
      'disconnect() must be called on the channel, not the driver'
    );
  },

  async reconnect() {
    throw new Error('reconnect() must be called on the channel, not the driver');
  },

  detached: false as const,
});

/** Type of the HttpDriver */
export type HttpDriverType = typeof HttpDriver;
