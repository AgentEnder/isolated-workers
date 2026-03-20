/**
 * Web Worker driver
 *
 * @packageDocumentation
 */

// Main driver export
export { WebWorkerDriver, type WebWorkerDriverType } from './driver.js';

// Host-side exports (for advanced usage)
export {
  spawnWorker,
  WebWorkerWorkerHandle,
  type BrowserWorkerConstructorOptions,
  type WebWorkerDriverOptions,
  type WebWorkerStartupData,
} from './host.js';

// Server-side exports (for advanced usage)
export {
  createServer,
  WebWorkerServerChannel,
  type ResponseFunction,
} from './server.js';
