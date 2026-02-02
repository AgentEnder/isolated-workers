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

export {
  createServer,
  ChildProcessServerChannel,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
  type ResponseFunction,
} from './server.js';
