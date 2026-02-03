/**
 * Image Processing Worker - Host Side
 *
 * Demonstrates spawning a worker for CPU-intensive image processing
 * with type-safe messaging and per-operation timeouts.
 */

import { createWorker } from 'isolated-workers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Messages } from './messages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Starting image processing example...\n');

  // #region create-worker
  // Spawn the worker with per-operation timeouts
  const worker = await createWorker<Messages>({
    script: join(__dirname, 'worker.ts'),
    // Configure timeouts for different operations
    timeout: {
      WORKER_STARTUP: 5000, // 5s to start
      processImage: 30000, // 30s per image
      batchProcess: 300000, // 5min for batch
    },
  });
  // #endregion create-worker

  console.log('Worker PID:', worker.pid);
  // PID is the process ID of the spawned worker
  // Returns `undefined` for worker_threads (which share parent's PID)
  // Returns a number for child_process workers (unique process ID)

  try {
    // #region process-single
    // Process a single image
    const metadata = await worker.send('processImage', {
      imagePath: './photo.jpg',
      options: { grayscale: true, quality: 85 },
    });
    console.log('Image metadata:', metadata);
    // #endregion process-single

    // #region check-status
    // Check worker status
    const status = await worker.send('getStatus', {});
    console.log('Worker status:', status);
    // #endregion check-status

    // #region batch-process
    // Batch process multiple images
    const batchResult = await worker.send('batchProcess', {
      paths: ['./a.jpg', './b.jpg', './c.jpg'],
      options: { grayscale: false, quality: 90 },
    });
    console.log('Batch result:', batchResult);
    // #endregion batch-process
  } finally {
    // Always clean up
    await worker.close();
    console.log('Worker shut down gracefully');
  }
}

main().catch(console.error);
