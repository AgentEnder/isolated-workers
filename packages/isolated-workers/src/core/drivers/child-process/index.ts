/**
 * Child process driver
 *
 * @packageDocumentation
 */

// Main driver export
export { ChildProcessDriver, type ChildProcessDriverType } from './driver.js';

// Host-side exports (for advanced usage)
export {
  spawnWorker,
  encodeStartupData,
  ChildProcessChannel,
  STARTUP_DATA_ENV_KEY,
  type ChildProcessDriverOptions,
  type ChildProcessStartupData,
} from './host.js';

// Server-side exports (for advanced usage)
export {
  createServer,
  ChildProcessServerChannel,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
  type ResponseFunction,
} from './server.js';
