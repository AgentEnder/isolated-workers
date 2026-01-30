/**
 * Middleware Example - Host (Client) Side
 *
 * This example demonstrates how to use middleware to:
 * - Log all outgoing and incoming messages
 * - Add timestamps to messages
 * - Validate message structure
 */

import { createWorker, type Middleware } from 'isolated-workers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Messages } from './messages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Logging middleware - logs all messages with direction
 */
const loggingMiddleware: Middleware<Messages> = (message, direction) => {
  const arrow = direction === 'outgoing' ? '>>>' : '<<<';
  console.log(
    `[${direction.toUpperCase()}] ${arrow} ${message.type}`,
    message.payload
  );
  return message;
};

/**
 * Timing middleware - tracks how long messages take
 * Note: This is a simplified example; real timing would need request correlation
 */
const timingMiddleware: Middleware<Messages> = (message, direction) => {
  if (direction === 'outgoing') {
    console.log(`[TIMING] Request sent at: ${new Date().toISOString()}`);
  } else {
    console.log(`[TIMING] Response received at: ${new Date().toISOString()}`);
  }
  return message;
};

async function main() {
  console.log('Starting middleware example...\n');

  // Create worker with middleware pipeline
  // Middleware is applied in order: logging -> timing
  const worker = await createWorker<Messages>({
    script: join(__dirname, 'worker.ts'),
    timeout: 10000,
    middleware: [loggingMiddleware, timingMiddleware],
  });

  console.log(`Worker spawned with PID: ${worker.pid}\n`);

  try {
    // Send a greet message
    console.log('--- Sending greet message ---');
    const greetResult = await worker.send('greet', { name: 'World' });
    console.log('Greeting result:', greetResult.greeting, '\n');

    // Send a compute message
    console.log('--- Sending compute message ---');
    const computeResult = await worker.send('compute', {
      values: [1, 2, 3, 4, 5],
    });
    console.log('Compute result:', computeResult, '\n');
  } finally {
    await worker.close();
    console.log('Worker closed successfully');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
