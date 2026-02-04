/**
 * Shutdown Handling Example - Worker (Server) Side
 *
 * This worker demonstrates various scenarios including:
 * - Normal message processing
 * - Crashing during processing (for retry testing)
 * - Processing that takes time
 */

import { startWorkerServer, Handlers } from 'isolated-workers';
import type { Messages } from './messages.js';

const handlers: Handlers<Messages> = {
  compute: ({ value, shouldCrash = false }) => {
    console.log(`Worker: computing ${value}^2 (shouldCrash=${shouldCrash})`);

    if (shouldCrash) {
      console.log('Worker: crashing as requested');
      process.exit(1);
    }

    return { result: value * value };
  },

  processPayment: ({ paymentId, amount, shouldCrash = false }) => {
    console.log(`Worker: processing payment ${paymentId} for $${amount}`);

    if (shouldCrash) {
      console.log('Worker: crashing during payment processing');
      process.exit(1);
    }

    return { success: true };
  },

  processBatch: ({ items, crashAfterItems }) => {
    console.log(`Worker: processing batch of ${items.length} items`);

    if (crashAfterItems !== undefined && crashAfterItems >= 0) {
      console.log(
        `Worker: will crash after processing ${crashAfterItems} items`
      );
      // Process up to the crash point, then crash
      for (let i = 0; i < Math.min(crashAfterItems, items.length); i++) {
        // Simulate processing
        items[i] * 2;
      }
      console.log('Worker: crashing as requested');
      process.exit(1);
    }

    return { processed: items.length };
  },
};

async function main() {
  console.log('Worker starting...');
  console.log(`Worker PID: ${process.pid}`);

  const server = await startWorkerServer(handlers);

  console.log('Worker ready and accepting requests');

  process.on('SIGTERM', async () => {
    console.log('Worker received SIGTERM');
    await server.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
