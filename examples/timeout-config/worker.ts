/**
 * Timeout Configuration Example - Worker (Server) Side
 */

import { startWorkerServer, Handlers } from 'isolated-workers';
import type { Messages } from './messages.js';

// Helper to simulate async work
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const handlers: Handlers<Messages> = {
  quickPing: ({ timestamp }) => {
    const now = Date.now();
    return { latency: now - timestamp };
  },

  slowProcess: async ({ durationMs }) => {
    console.log(`Worker: Starting slow process (${durationMs}ms)`);
    const start = Date.now();
    await sleep(durationMs);
    const actualDuration = Date.now() - start;
    console.log(`Worker: Slow process completed in ${actualDuration}ms`);
    return { completed: true, actualDuration };
  },
};

async function main() {
  console.log('Worker starting...');

  const server = await startWorkerServer(handlers);

  console.log('Worker ready');

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
