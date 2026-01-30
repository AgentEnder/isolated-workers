/**
 * Basic Ping-Pong Worker - Worker (Server) Side
 *
 * This script runs as the worker process and responds to ping messages.
 */

import { startWorkerServer, Handlers } from 'isolated-workers';
import type { Messages } from './messages.js';

// Define handlers for incoming messages with proper typing
const handlers: Handlers<Messages> = {
  ping: ({ message }) => {
    console.log(`Worker received: ${message}`);
    return { message: 'pong' };
  },
};

// Start the worker server
async function main() {
  console.log('Worker starting...');

  const server = await startWorkerServer(handlers);

  console.log('Worker ready and waiting for messages');

  // Keep the process alive until explicitly stopped
  process.on('SIGTERM', async () => {
    console.log('Worker received SIGTERM, shutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
