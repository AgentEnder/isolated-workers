/**
 * Timeout Configuration Example - Host (Client) Side
 *
 * This example demonstrates the flexible timeout configuration:
 * - WORKER_STARTUP: Time to wait for worker to start
 * - SERVER_CONNECT: Time for server to wait for host connection
 * - WORKER_MESSAGE: Default timeout for all messages
 * - Per-message-type timeouts for fine-grained control
 */

import { createWorker, type TimeoutConfig } from 'isolated-workers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Messages } from './messages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Starting timeout configuration example...\n');

  // #region timeout-config
  // Define timeout configuration
  const timeoutConfig: TimeoutConfig<Messages> = {
    // Worker lifecycle timeouts
    WORKER_STARTUP: 5000, // 5 seconds to start
    SERVER_CONNECT: 5000, // 5 seconds for server to accept connection

    // Default message timeout
    WORKER_MESSAGE: 3000, // 3 seconds default for messages

    // Per-message-type timeouts (override WORKER_MESSAGE)
    quickPing: 1000, // 1 second for quick operations
    slowProcess: 10000, // 10 seconds for slow operations
  };
  // #endregion timeout-config

  console.log('Timeout configuration:');
  console.log('  WORKER_STARTUP:', timeoutConfig.WORKER_STARTUP, 'ms');
  console.log('  SERVER_CONNECT:', timeoutConfig.SERVER_CONNECT, 'ms');
  console.log('  WORKER_MESSAGE:', timeoutConfig.WORKER_MESSAGE, 'ms');
  console.log('  quickPing:', timeoutConfig.quickPing, 'ms');
  console.log('  slowProcess:', timeoutConfig.slowProcess, 'ms');
  console.log();

  // #region create-worker-with-timeout
  const worker = await createWorker<Messages>({
    script: join(__dirname, 'worker.ts'),
    timeout: timeoutConfig,
  });
  // #endregion create-worker-with-timeout

  console.log(`Worker spawned with PID: ${worker.pid}\n`);

  try {
    // Test 1: Quick ping (should succeed within 1s timeout)
    console.log('--- Test 1: Quick Ping ---');
    const pingStart = Date.now();
    const pingResult = await worker.send('quickPing', { timestamp: pingStart });
    console.log(`Quick ping completed in ${pingResult.latency}ms\n`);

    // Test 2: Slow process that completes within timeout
    console.log('--- Test 2: Slow Process (within timeout) ---');
    const slowResult = await worker.send('slowProcess', { durationMs: 500 });
    console.log(`Slow process completed: ${slowResult.actualDuration}ms\n`);

    // Test 3: Demonstrate timeout (commented out to not fail the example)
    // Uncomment to see timeout behavior:
    // console.log('--- Test 3: Timeout Demo ---');
    // await worker.send('slowProcess', { durationMs: 15000 }); // Would timeout

    console.log('All operations completed successfully!');
  } catch (err) {
    console.error('Error:', (err as Error).message);
  } finally {
    await worker.close();
    console.log('Worker closed successfully');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
