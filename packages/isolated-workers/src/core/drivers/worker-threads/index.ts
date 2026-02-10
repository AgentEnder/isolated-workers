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
  STARTUP_DATA_WORKER_KEY,
  WorkerThreadsChannel,
  type WorkerThreadsDriverOptions,
  type WorkerThreadsStartupData,
} from './host.js';

// Server-side exports (for advanced usage)
export {
  createServer,
  WorkerThreadsServerChannel,
  type ResponseFunction,
} from './server.js';
