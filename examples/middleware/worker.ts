/**
 * Middleware Example - Worker (Server) Side
 *
 * The worker also supports middleware for processing messages.
 */

import { startWorkerServer, Handlers, type Middleware } from 'isolated-workers';
import type { Messages } from './messages.js';

// #region worker-middleware
/**
 * Worker-side logging middleware
 */
const workerLoggingMiddleware: Middleware<Messages> = (message, direction) => {
  console.log(`[WORKER ${direction}] Processing: ${message.type}`);
  return message;
};
// #endregion worker-middleware

// Define handlers
const handlers: Handlers<Messages> = {
  greet: ({ name }) => {
    console.log(`Worker: Creating greeting for "${name}"`);
    return { greeting: `Hello, ${name}!` };
  },

  compute: ({ values }) => {
    console.log(`Worker: Computing sum of ${values.length} values`);
    const sum = values.reduce((a, b) => a + b, 0);
    return { sum, count: values.length };
  },
};

async function main() {
  console.log('Worker starting with middleware...');

  // #region start-worker-with-middleware
  const server = await startWorkerServer(handlers, {
    middleware: [workerLoggingMiddleware],
  });
  // #endregion start-worker-with-middleware

  console.log('Worker ready');

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
