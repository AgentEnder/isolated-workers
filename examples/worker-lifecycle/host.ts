/**
 * Worker Lifecycle Example - Host (Client) Side
 *
 * This example demonstrates worker lifecycle management:
 * - Checking worker status (isActive, isConnected)
 * - Graceful shutdown
 * - Worker state across multiple requests
 */

import { createWorker } from 'isolated-workers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Messages } from './messages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function printStatus(worker: {
  isActive: boolean;
  isConnected: boolean;
  pid: number;
}) {
  console.log(`  PID: ${worker.pid}`);
  console.log(`  isActive: ${worker.isActive}`);
  console.log(`  isConnected: ${worker.isConnected}`);
}

async function main() {
  console.log('Starting worker lifecycle example...\n');

  const worker = await createWorker<Messages>({
    script: join(__dirname, 'worker.ts'),
    timeout: 10000,
  });

  console.log('--- Worker Created ---');
  printStatus(worker);
  console.log();

  try {
    // Make several requests to show state persistence
    console.log('--- Making Requests ---');

    for (let i = 1; i <= 3; i++) {
      await worker.send('incrementCounter', { amount: i * 10 });
      console.log(`Request ${i}: Incremented counter by ${i * 10}`);
    }

    const status = await worker.send('getStatus', {});
    console.log(`\nWorker status after requests:`);
    console.log(`  Uptime: ${status.uptime}ms`);
    console.log(`  Request count: ${status.requestCount}`);
    console.log();

    // Check status before closing
    console.log('--- Before Close ---');
    printStatus(worker);
    console.log();

    // Graceful shutdown
    console.log('--- Closing Worker ---');
    await worker.close();

    // Check status after closing
    console.log('--- After Close ---');
    printStatus(worker);
    console.log();

    // Attempting to send after close should fail
    console.log('--- Attempting Request After Close ---');
    try {
      await worker.send('getStatus', {});
      console.log('ERROR: Should have thrown!');
    } catch (err) {
      console.log(`Expected error: ${(err as Error).message}`);
    }

    console.log('\nWorker lifecycle demonstration complete!');
  } catch (err) {
    console.error('Unexpected error:', err);
    await worker.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
