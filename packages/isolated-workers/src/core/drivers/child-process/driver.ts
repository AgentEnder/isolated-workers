/**
 * Child process driver - unified driver definition
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
import type {
  ChildProcessStartupData,
  ChildProcessDriverOptions,
} from './host.js';

/** Environment variable key for startup data */
const STARTUP_DATA_ENV_KEY = 'ISOLATED_WORKERS_STARTUP_DATA';

/**
 * Child process driver.
 *
 * Uses child_process.fork() with Unix domain sockets for IPC.
 * Supports disconnect/reconnect and detached workers.
 *
 * @example
 * ```typescript
 * import { ChildProcessDriver } from 'isolated-workers/drivers/child-process';
 *
 * // Host side: spawn a worker
 * const channel = await ChildProcessDriver.spawn('./worker.js', {
 *   detached: false,
 *   timeout: 10000,
 * });
 *
 * // Worker side: create server
 * const server = await ChildProcessDriver.createServer();
 * ```
 */
export const ChildProcessDriver = defineWorkerDriver({
  name: 'child_process' as const,

  /**
   * Spawn a child process worker (host side)
   *
   * @param script - Path to the worker script
   * @param options - Spawn options
   * @returns Promise resolving to a DriverChannel
   */
  async spawn(script: string, options: ChildProcessDriverOptions = {}) {
    const { spawnWorker } = await import('./host.js');
    return spawnWorker(script, options);
  },

  /**
   * Get startup data (server side)
   *
   * Parses the startup data from the environment variable set by the host.
   *
   * @throws Error if not running in a child process worker context
   * @returns The startup data passed from the host
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
   *
   * Creates a server that listens for connections from the host process.
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

/** Type of the ChildProcessDriver */
export type ChildProcessDriverType = typeof ChildProcessDriver;
