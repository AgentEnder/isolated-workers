/**
 * Worker Threads Driver Example - Worker
 *
 * This worker runs in a worker thread (same process as host).
 * Since the host spawned this worker using WorkerThreadsDriver,
 * we must specify the same driver here for the server.
 */

import { startWorkerServer, type Handlers } from 'isolated-workers';
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
import type { Messages } from './messages.js';

// Define handlers
const handlers: Handlers<Messages> = {
  compute: async ({ value }) => {
    console.log(`[Worker] Computing ${value} * 2...`);

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 100));

    return { result: value * 2 };
  },
};

// Start the worker server
// Must specify WorkerThreadsDriver to match the host
startWorkerServer<Messages>(handlers, {
  driver: WorkerThreadsDriver,
  logLevel: 'info',
}).then(() => {
  console.log('[Worker] Server started');
}).catch((err) => {
  console.error('[Worker] Failed to start server:', err);
  process.exit(1);
});
