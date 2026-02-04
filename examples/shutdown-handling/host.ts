/**
 * Shutdown Handling Example - Host (Client) Side
 *
 * Demonstrates different strategies for handling unexpected worker crashes:
 * - 'reject' strategy: Immediately reject pending requests
 * - 'retry' strategy: Automatically retry failed requests
 * - Per-message-type overrides: Different strategies for different operations
 */

import { createWorker, WorkerCrashedError } from 'isolated-workers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Messages } from './messages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// #region worker-config
async function createTestWorker() {
  return createWorker<Messages>({
    script: join(__dirname, 'worker.ts'),
    timeout: 10000,
    unexpectedShutdown: {
      strategy: 'reject', // default for all messages
      compute: { strategy: 'retry', attempts: 3 }, // retry idempotent ops up to 3 times
      processBatch: { strategy: 'retry', attempts: 3 }, // retry with limit
      // processPayment uses default 'reject' - non-idempotent
    },
  });
}
// #endregion worker-config

async function main() {
  console.log('=== Shutdown Handling Example ===\n');

  let worker = await createTestWorker();
  console.log(`Worker spawned with PID: ${worker.pid}\n`);

  // Test 1: Normal operation (no crash)
  console.log('Test 1: Normal operation');
  try {
    const result = await worker.send('compute', { value: 5 });
    console.log('✓ Result:', result.result, '\n');
  } catch (err) {
    console.error('✗ Unexpected error:', (err as Error).message, '\n');
  }

  // Test 2: Idempotent operation with crash (retry will also crash - demonstrates exhaustion)
  // Note: When a worker crashes, the retry spawns a NEW worker process.
  // If the crash condition is in the payload (shouldCrash: true), retries will also crash.
  // This demonstrates retry exhaustion for idempotent operations.
  console.log('Test 2: Idempotent operation with crash - retry exhaustion');
  try {
    const result = await worker.send('compute', {
      value: 7,
      shouldCrash: true, // Will crash on every attempt
    });
    console.log('✗ Should have crashed, got:', result, '\n');
  } catch (err) {
    if (err instanceof WorkerCrashedError) {
      console.log('✓ WorkerCrashedError after retries:', err.message);
      console.log(`  - Reason: ${err.reason.type}`);
      console.log(`  - Attempt: ${err.attempt}/${err.maxAttempts}\n`);
    } else {
      console.error('✗ Unexpected error:', (err as Error).message, '\n');
    }
  }

  // Need a fresh worker since Test 2 exhausted retries
  await worker.close();
  worker = await createTestWorker();
  console.log(`Fresh worker spawned with PID: ${worker.pid}\n`);

  // Test 3: Non-idempotent operation (should reject immediately, no retry)
  console.log('Test 3: Non-idempotent operation (should reject, not retry)');
  try {
    // This payment will crash, and since processPayment uses 'reject' strategy,
    // it should fail with WorkerCrashedError immediately (no retries)
    const result = await worker.send('processPayment', {
      paymentId: 'pay-123',
      amount: 100,
      shouldCrash: true,
    });
    console.log('✗ Payment should have been rejected, got:', result, '\n');
  } catch (err) {
    if (err instanceof WorkerCrashedError) {
      console.log('✓ WorkerCrashedError (as expected):', err.message);
      console.log(`  - Attempt: ${err.attempt}/${err.maxAttempts}`);
      console.log(`  - No retries (non-idempotent operation)\n`);
    } else {
      console.error('✗ Unexpected error:', (err as Error).message, '\n');
    }
  }

  // Need a fresh worker since Test 3 crashed
  await worker.close();
  worker = await createTestWorker();
  console.log(`Fresh worker spawned with PID: ${worker.pid}\n`);

  // Test 4: Batch processing with retry exhaustion
  console.log('Test 4: Batch processing with retry exhaustion');
  try {
    // This batch will crash immediately (crashAfterItems: 0), and will keep crashing
    // until we exhaust all 3 retry attempts
    const result = await worker.send('processBatch', {
      items: [1, 2, 3, 4, 5],
      crashAfterItems: 0, // Crash immediately every time
    });
    console.log('✗ Should have exhausted retries, got:', result, '\n');
  } catch (err) {
    if (err instanceof WorkerCrashedError) {
      console.log('✓ WorkerCrashedError after retries:', err.message);
      console.log(`  - Attempt: ${err.attempt}/${err.maxAttempts}\n`);
    } else {
      console.error('✗ Unexpected error:', (err as Error).message, '\n');
    }
  }

  // Need another fresh worker since Test 4 exhausted retries
  await worker.close();
  worker = await createTestWorker();
  console.log(`Fresh worker spawned with PID: ${worker.pid}\n`);

  // Test 5: Successful batch processing (no crash)
  console.log('Test 5: Successful batch processing');
  try {
    const result = await worker.send('processBatch', {
      items: [1, 2, 3],
      // No crashAfterItems = no crash
    });
    console.log('✓ Processed batch of', result.processed, 'items\n');
  } catch (err) {
    console.error('✗ Unexpected error:', (err as Error).message, '\n');
  }

  // Test 6: Cleanup
  console.log('Test 6: Cleanup');
  await worker.close();
  console.log('✓ Worker closed successfully\n');

  console.log('=== All tests completed ===');
}

main().catch((err) => {
  console.error('Host error:', err);
  process.exit(1);
});
