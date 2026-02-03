/**
 * Driver Comparison Benchmarks
 *
 * Compares child_process vs worker_threads drivers using flexi-bench v0.2.0.
 * Results are saved to benchmarks/results/{date}-{platform}.{md,json}
 *
 * Outputs:
 * - Markdown: Human-readable report with comparison tables
 * - JSON: Machine-readable results with full metadata (for CI/CD)
 */

import {
  afterAll,
  beforeAll,
  benchmark,
  CompositeReporter,
  JsonSuiteReporter,
  MarkdownSuiteReporter,
  suite,
  Variation,
} from 'flexi-bench';
import { createWorker, type WorkerClient } from 'isolated-workers';
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
import { platform } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BenchmarkMessages } from './messages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerPath = resolve(__dirname, 'worker.js');

const ITERATIONS = 30;
const COMPUTE_ITERATIONS = 100;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDriver = any;

/**
 * Get the driver based on the BENCH_DRIVER environment variable
 */
function getDriver(): AnyDriver {
  return process.env.BENCH_DRIVER === 'worker_threads'
    ? WorkerThreadsDriver
    : undefined;
}

/**
 * Generate output filenames with date and platform
 */
function getOutputFilenames(): { markdown: string; json: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const plat = platform();
  const baseName = `${year}-${month}-${day}-${plat}`;

  return {
    markdown: resolve(__dirname, `../results/${baseName}.md`),
    json: resolve(__dirname, `../results/${baseName}.json`),
  };
}

const { markdown, json } = getOutputFilenames();

/**
 * Driver variations for benchmarks
 */
const driverVariations = [
  new Variation('child_process').withEnvironmentVariable(
    'BENCH_DRIVER',
    'child_process'
  ),
  new Variation('worker_threads').withEnvironmentVariable(
    'BENCH_DRIVER',
    'worker_threads'
  ),
];

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           isolated-workers Driver Benchmarks               ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');
console.log(`Worker: ${workerPath}`);
console.log(`Standard iterations: ${ITERATIONS}`);
console.log(`Compute iterations: ${COMPUTE_ITERATIONS} (takes ~100s)`);
console.log(`Markdown Output: ${markdown}`);
console.log(`JSON Output: ${json}\n`);

// ═══════════════════════════════════════════════════════════════════════════
// Main Suite
// ═══════════════════════════════════════════════════════════════════════════

suite('isolated-workers Driver Comparison', (s) => {
  s.withVariations(driverVariations);
  s.withReporter(
    new CompositeReporter([
      new MarkdownSuiteReporter({
        outputFile: markdown,
        title: 'isolated-workers Driver Benchmarks',
        fields: ['min', 'max', 'average', 'p95'],
      }),
      new JsonSuiteReporter({
        outputFile: json,
        pretty: true,
        includeMetadata: true,
      }),
    ])
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Startup Time - measures spawn + connect time
  // ─────────────────────────────────────────────────────────────────────────

  benchmark('Startup: spawn and connect', (b) => {
    b.withIterations(ITERATIONS).withAction(async () => {
      const worker = await createWorker<BenchmarkMessages>({
        script: workerPath,
        driver: getDriver(),
      });
      await worker.close();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Message Latency - measures single message round-trip
  // ─────────────────────────────────────────────────────────────────────────

  benchmark('Latency: single ping', (b) => {
    let worker: WorkerClient<BenchmarkMessages>;

    beforeAll(async () => {
      worker = await createWorker<BenchmarkMessages>({
        script: workerPath,
        driver: getDriver(),
      });
    });

    afterAll(async () => {
      await worker.close();
    });

    b.withIterations(ITERATIONS).withAction(async () => {
      await worker.send('ping', { timestamp: Date.now() });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Throughput - measures 100 concurrent messages
  // ─────────────────────────────────────────────────────────────────────────

  benchmark('Throughput: 100 concurrent messages', (b) => {
    let worker: WorkerClient<BenchmarkMessages>;
    const payload = 'x'.repeat(100);

    beforeAll(async () => {
      worker = await createWorker<BenchmarkMessages>({
        script: workerPath,
        driver: getDriver(),
      });
    });

    afterAll(async () => {
      await worker.close();
    });

    b.withIterations(ITERATIONS).withAction(async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(worker.send('echo', { data: payload }));
      }
      await Promise.all(promises);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Large Payload - measures 100KB data transfer
  // ─────────────────────────────────────────────────────────────────────────

  benchmark('Large Payload: 100KB echo', (b) => {
    let worker: WorkerClient<BenchmarkMessages>;
    const largePayload = 'x'.repeat(100_000);

    beforeAll(async () => {
      worker = await createWorker<BenchmarkMessages>({
        script: workerPath,
        driver: getDriver(),
      });
    });

    afterAll(async () => {
      await worker.close();
    });

    b.withIterations(ITERATIONS).withAction(async () => {
      await worker.send('echo', { data: largePayload });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-Worker - tests 15 workers with 10 messages each
  // ─────────────────────────────────────────────────────────────────────────

  benchmark('Multi-Worker: 15 workers × 10 msgs', (b) => {
    const WORKER_COUNT = 15;
    const MESSAGES_PER_WORKER = 10;
    let workers: WorkerClient<BenchmarkMessages>[];

    beforeAll(async () => {
      workers = await Promise.all(
        Array.from({ length: WORKER_COUNT }, () =>
          createWorker<BenchmarkMessages>({
            script: workerPath,
            driver: getDriver(),
          })
        )
      );
    });

    afterAll(async () => {
      await Promise.all(workers.map((w) => w.close()));
    });

    b.withIterations(ITERATIONS).withAction(async () => {
      const promises = [];
      for (const worker of workers) {
        for (let i = 0; i < MESSAGES_PER_WORKER; i++) {
          promises.push(worker.send('ping', { timestamp: Date.now() }));
        }
      }
      await Promise.all(promises);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Compute-Bound - tests ~500ms of CPU-bound work
  // ─────────────────────────────────────────────────────────────────────────

  benchmark('Compute-Bound: ~500ms work', (b) => {
    let worker: WorkerClient<BenchmarkMessages>;
    const COMPUTE_WORK = 4_500_000;

    beforeAll(async () => {
      worker = await createWorker<BenchmarkMessages>({
        script: workerPath,
        driver: getDriver(),
      });
    });

    afterAll(async () => {
      await worker.close();
    });

    b.withIterations(COMPUTE_ITERATIONS).withAction(async () => {
      await worker.send('compute', { iterations: COMPUTE_WORK });
    });
  });
});
