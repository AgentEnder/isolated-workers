/**
 * Benchmark worker (JavaScript - no transpilation overhead)
 *
 * Handles various benchmark message types for performance testing.
 * Auto-detects whether it's running in worker_threads or child_process context.
 */

import { startWorkerServer } from 'isolated-workers';
import { isMainThread, workerData } from 'worker_threads';

/** @type {import('isolated-workers').Handlers<import('./messages.js').BenchmarkMessages>} */
const handlers = {
  ping: async ({ timestamp }) => {
    return {
      timestamp,
      workerTimestamp: Date.now(),
    };
  },

  echo: async ({ data }) => {
    return { data };
  },

  compute: async ({ iterations }) => {
    const start = performance.now();

    // Simple compute-bound work
    let result = 0;
    for (let i = 0; i < iterations; i++) {
      result += Math.sqrt(i) * Math.sin(i);
    }

    const duration = performance.now() - start;
    return { result, duration };
  },

  memoryUsage: async () => {
    const mem = process.memoryUsage();
    return {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
    };
  },
};

// Auto-detect driver based on context
async function detectAndStart() {
  if (!isMainThread && workerData?.__isolatedWorkers) {
    // We're in a worker thread context, nx ignore is to avoid dynamic import warnings.
    //nx-ignore-next-line
    const { WorkerThreadsDriver } = await import(
      'isolated-workers/drivers/worker-threads'
    );
    await startWorkerServer(handlers, {
      driver: WorkerThreadsDriver,
    });
  } else if (detectHttpDriver()) {
    // We're in an HTTP driver context
    //nx-ignore-next-line
    const { HttpDriver } = await import('isolated-workers/drivers/http');
    await startWorkerServer(handlers, {
      driver: HttpDriver,
    });
  } else {
    // We're in a child process context (default)
    await startWorkerServer(handlers);
  }
}

/**
 * Check if the startup data indicates the HTTP driver
 */
function detectHttpDriver() {
  const envData = process.env.ISOLATED_WORKERS_STARTUP_DATA;
  if (!envData) return false;
  try {
    const data = JSON.parse(envData);
    return data.driver === 'http';
  } catch {
    return false;
  }
}

detectAndStart().catch((err) => {
  console.error('[Worker] Failed to start:', err);
  process.exit(1);
});
