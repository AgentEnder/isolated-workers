/**
 * Error Handling Example - Worker (Server) Side
 *
 * Demonstrates error throwing and propagation.
 */

import { startWorkerServer, Handlers } from 'isolated-workers';
import type { Messages } from './messages.js';

// Define handlers for incoming messages with proper typing
const handlers: Handlers<Messages> = {
  divide: ({ a, b }) => {
    console.log(`Worker: dividing ${a} / ${b}`);

    if (b === 0) {
      throw new Error('Division by zero');
    }

    return { result: a / b };
  },
};

async function main() {
  console.log('Worker: starting error-handling demo worker');

  await startWorkerServer(handlers);

  console.log('Worker: ready');

  process.on('SIGTERM', () => {
    console.log('Worker: shutting down');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
