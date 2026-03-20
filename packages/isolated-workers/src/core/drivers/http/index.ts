/**
 * HTTP driver
 *
 * @packageDocumentation
 */

// Main driver export
export { HttpDriver, type HttpDriverType } from './driver.js';

// Host-side exports (for advanced usage)
export {
  spawnWorker,
  encodeStartupData,
  HttpWorkerHandle,
  STARTUP_DATA_ENV_KEY,
  type HttpDriverOptions,
  type HttpStartupData,
} from './host.js';

// Server-side exports (for advanced usage)
export {
  createServer,
  HttpServerChannel,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
  type ResponseFunction,
} from './server.js';
