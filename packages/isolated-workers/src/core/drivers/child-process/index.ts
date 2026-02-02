/**
 * Child process driver
 *
 * @packageDocumentation
 */

export {
  spawnWorker,
  encodeStartupData,
  ChildProcessChannel,
  STARTUP_DATA_ENV_KEY,
  type ChildProcessDriverOptions,
  type ChildProcessStartupData,
} from './host.js';
