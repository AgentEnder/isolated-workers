/**
 * Worker Lifecycle Example - Worker (Server) Side
 *
 * This worker maintains state across requests to demonstrate
 * that the worker process persists between messages.
 */

import { startWorkerServer, Handlers } from 'isolated-workers';
import type { Messages } from './messages.js';

// Worker state - persists across requests
const startTime = Date.now();
let requestCount = 0;
let counter = 0;

const handlers: Handlers<Messages> = {
  getStatus: () => {
    requestCount++;
    return {
      uptime: Date.now() - startTime,
      requestCount,
    };
  },

  incrementCounter: ({ amount }) => {
    requestCount++;
    counter += amount;
    console.log(`Worker: Counter incremented by ${amount}, now ${counter}`);
    return { newValue: counter };
  },
};

async function main() {
  console.log('Worker starting...');
  console.log(`Worker PID: ${process.pid}`);

  const server = await startWorkerServer(handlers);

  console.log('Worker ready and accepting requests');

  process.on('SIGTERM', async () => {
    console.log('Worker received SIGTERM');
    console.log(`Final stats: ${requestCount} requests, counter=${counter}`);
    await server.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
