/**
 * Worker Threads Driver Example - Host
 *
 * This example demonstrates using the worker_threads driver for in-process
 * workers. Worker threads share the same process as the host, enabling:
 * - Lower overhead for spawning
 * - SharedArrayBuffer support
 * - Faster message passing via MessagePort
 *
 * Note: Worker threads cannot outlive the parent process (no detach support)
 * and don't support reconnection.
 */

import { createWorker } from 'isolated-workers';
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Messages } from './messages.js';

async function main() {
  console.log('Using worker_threads driver for in-process workers\n');

  // WorkerThreadsDriver is a pre-configured object (not a class)
  console.log(`Driver: ${WorkerThreadsDriver.name}`);
  console.log(`Capabilities:`);
  console.log(`  - Reconnect: ${WorkerThreadsDriver.capabilities.reconnect}`);
  console.log(`  - Detach: ${WorkerThreadsDriver.capabilities.detach}`);
  console.log(`  - Shared Memory: ${WorkerThreadsDriver.capabilities.sharedMemory}`);
  console.log();

  // Create the worker using the worker_threads driver
  const workerPath = join(dirname(fileURLToPath(import.meta.url)), 'worker.ts');

  try {
    // Specify the driver in the options
    // The createWorker function will use it instead of the default child_process driver
    // Worker threads automatically inherit the host's execArgv (e.g., --import tsx)
    const worker = await createWorker<Messages, typeof WorkerThreadsDriver>({
      script: workerPath,
      driver: WorkerThreadsDriver,
      logLevel: 'info',
    });

    console.log(`Worker spawned (pid: ${worker.pid ?? 'N/A - same process'})`);
    console.log(`Worker capabilities: reconnect=${worker.capabilities.reconnect}, sharedMemory=${worker.capabilities.sharedMemory}`);

    // Send a compute request
    console.log('\nSending compute request...');
    const response = await worker.send('compute', { value: 42 });
    console.log(`Result: ${response.result}`);

    // Note: disconnect/reconnect are not available with worker_threads
    // worker.disconnect() would be a type error because capabilities.reconnect is false!

    // Clean up
    await worker.close();
    console.log('\nWorker threads driver example complete!');
  } catch (err) {
    console.error('Error:', (err as Error).message);
    process.exit(1);
  }
}

main();
