/**
 * Image Processing Worker - Worker Side
 *
 * Handles image processing operations in an isolated process.
 */

import { startWorkerServer, Handlers } from 'isolated-workers';
import type { Messages } from './messages.js';

// #region state
// Track processing statistics
let processedCount = 0;
// #endregion state

// #region simulate
// Helper to simulate work
async function simulateProcessing() {
  return new Promise((resolve) => setTimeout(resolve, 100));
}
// #endregion simulate

// #region handlers
const handlers: Handlers<Messages> = {
  processImage: async ({ imagePath }) => {
    // Simulate image processing (replace with real logic)
    console.log(`Processing: ${imagePath}`);

    // In a real implementation, you would use sharp, jimp, or similar
    await simulateProcessing();

    processedCount++;

    return {
      width: 1920,
      height: 1080,
      format: 'jpeg',
      size: 256000,
    };
  },

  batchProcess: async ({ paths }) => {
    const results = [];

    for (const path of paths) {
      try {
        await simulateProcessing();
        results.push({ path, success: true });
      } catch {
        results.push({ path, success: false });
      }
    }

    return {
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  },

  getStatus: async () => {
    return {
      active: true,
      processedCount,
    };
  },
};
// #endregion handlers

async function main() {
  const server = await startWorkerServer(handlers);

  console.log(
    'Image worker started on',
    process.env.ISOLATED_WORKERS_SOCKET_PATH
  );

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
