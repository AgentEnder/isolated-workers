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
