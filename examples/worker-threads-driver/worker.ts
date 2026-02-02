/**
 * Worker Threads Driver Example - Worker
 *
 * This worker runs in a worker thread (same process as host).
 * The startWorkerServer automatically detects the driver type
 * and uses the appropriate server implementation.
 */

import { startWorkerServer, type Handlers } from 'isolated-workers';
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
// It automatically detects that this is a worker_threads worker
startWorkerServer<Messages>(handlers, {
  logLevel: 'info',
}).then(() => {
  console.log('[Worker] Server started');
}).catch((err) => {
  console.error('[Worker] Failed to start server:', err);
  process.exit(1);
});
