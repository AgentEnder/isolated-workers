/**
 * Error Handling Example - Host (Client) Side
 *
 * Demonstrates error propagation from worker to host.
 */

import { createWorker } from 'isolated-workers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Messages } from './messages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('=== Error Handling Example ===\n');

  const worker = await createWorker<Messages>({
    script: join(__dirname, 'worker.ts'),
    timeout: 10000,
  });

  console.log(`Worker spawned with PID: ${worker.pid}\n`);

  // Test 1: Successful division
  console.log('Test 1: 10 / 2');
  try {
    const result = await worker.send('divide', { a: 10, b: 2 });
    console.log('Result:', result.result, '\n');
  } catch (err) {
    console.error('Unexpected error:', (err as Error).message, '\n');
  }

  // Test 2: Division by zero (should error)
  console.log('Test 2: 10 / 0 (should error)');
  try {
    await worker.send('divide', { a: 10, b: 0 });
    console.log('ERROR: Should have thrown!\n');
  } catch (err) {
    console.log('Caught expected error:', (err as Error).message, '\n');
  }

  // Test 3: Cleanup
  console.log('Test 3: Cleanup');
  await worker.close();
  console.log('Worker closed successfully\n');

  console.log('=== All tests passed ===');
}

main().catch((err) => {
  console.error('Host error:', err);
  process.exit(1);
});
