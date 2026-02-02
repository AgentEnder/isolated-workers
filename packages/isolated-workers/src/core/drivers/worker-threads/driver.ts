/**
 * Worker threads driver - unified driver definition
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
  WorkerThreadsStartupData,
  WorkerThreadsDriverOptions,
} from './host.js';

/** workerData key for startup data */
const STARTUP_DATA_WORKER_KEY = '__isolatedWorkers';

/**
 * Worker threads driver.
 *
 * Uses worker_threads module with MessagePort for IPC.
 * Supports SharedArrayBuffer for shared memory.
 *
 * @example
 * ```typescript
 * import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
 *
 * // Host side: spawn a worker
 * const channel = await WorkerThreadsDriver.spawn('./worker.js', {
 *   resourceLimits: { maxOldGenerationSizeMb: 128 },
 * });
 *
 * // Worker side: create server
 * const server = WorkerThreadsDriver.createServer();
 * ```
 */
export const WorkerThreadsDriver = defineWorkerDriver({
  name: 'worker_threads' as const,

  /**
   * Spawn a worker thread (host side)
   *
   * @param script - Path to the worker script (or code if eval option is true)
   * @param options - Spawn options
   * @returns Promise resolving to a DriverChannel
   */
  async spawn(script: string, options: WorkerThreadsDriverOptions = {}) {
    const { spawnWorker } = await import('./host.js');
    return spawnWorker(script, options);
  },

  /**
   * Get startup data (server side)
   *
   * Retrieves the startup data from workerData passed by the host.
   *
   * @throws Error if not running in a worker thread context
   * @returns The startup data passed from the host
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

    const workerData = workerThreadsModule.workerData as
      | Record<string, unknown>
      | undefined;
    const startupData = workerData?.[STARTUP_DATA_WORKER_KEY] as
      | WorkerThreadsStartupData
      | undefined;

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
   *
   * Creates a server that communicates with the host process via parentPort.
   * Unlike child_process, this is synchronous because parentPort is immediately available.
   *
   * @param options - Server options
   * @returns ServerChannel (synchronous - no Promise needed)
   */
  createServer(options: ServerOptions = {}): ServerChannel {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createServer } = require('./server.js') as typeof import('./server.js');
    const startupData = this.getStartupData();
    return createServer(startupData, options);
  },

  // Capability method - enables sharedMemory: true
  transferSharedMemory(_buffer: SharedArrayBuffer): void {
    throw new Error(
      'transferSharedMemory() is not yet implemented. ' +
        'SharedArrayBuffer can be passed directly via workerData or postMessage.'
    );
  },
});

/** Type of the WorkerThreadsDriver */
export type WorkerThreadsDriverType = typeof WorkerThreadsDriver;
