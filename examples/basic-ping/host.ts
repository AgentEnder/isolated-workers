/**
 * Basic Ping-Pong Worker - Host (Client) Side
 *
 * This script spawns a worker process and sends a ping message,
 * then receives and prints the pong response.
 */

import { createWorker } from 'isolated-workers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Messages } from './messages.js';

// Get the directory of this file for spawning the worker
const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Spawning worker process...');

  // Create a worker that runs worker.ts
  const worker = await createWorker<Messages>({
    script: join(__dirname, 'worker.ts'),
    timeout: 10000,
  });

  console.log(`Worker spawned with PID: ${worker.pid}`);

  try {
    // Send a ping message
    console.log('Sending ping message...');
    const result = await worker.send('ping', { message: 'ping' });

    console.log('Received response:', result);
  } catch (err) {
    console.error('Error:', (err as Error).message);
  } finally {
    // Always close the worker
    await worker.close();
    console.log('Worker closed successfully');
  }
}

main();
