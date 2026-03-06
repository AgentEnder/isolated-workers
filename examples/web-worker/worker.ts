/**
 * Web Worker Driver Example - Worker
 *
 * This worker runs in a Web Worker context (browser).
 * Since the host spawned this worker using WebWorkerDriver,
 * we must specify the same driver here for the server.
 */

import { startWorkerServer, type Handlers } from 'isolated-workers';
import { WebWorkerDriver } from 'isolated-workers/drivers/web-worker';
import type { Messages } from './messages.js';

const handlers: Handlers<Messages> = {
  compute: ({ value }) => {
    return { doubled: value * 2 };
  },
};

startWorkerServer<Messages>(handlers, {
  driver: WebWorkerDriver,
});
