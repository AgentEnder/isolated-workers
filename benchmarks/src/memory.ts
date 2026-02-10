/**
 * Memory Usage Comparison Benchmark
 *
 * Compares memory overhead between child_process (spawn) and worker_threads drivers.
 * Measures:
 * - Host process memory before/after spawning workers
 * - Per-worker memory overhead
 * - Worker-reported memory stats
 *
 * Key differences:
 * - child_process: Each worker is a separate OS process with isolated memory
 * - worker_threads: Workers share the main process, lower per-worker overhead
 */

import { createWorker, type WorkerClient } from 'isolated-workers';
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
import { HttpDriver } from 'isolated-workers/drivers/http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform, freemem, totalmem } from 'node:os';
import { writeFileSync, mkdirSync } from 'node:fs';
import { h1, h2, h3, table, unorderedList } from 'markdown-factory';
import type { BenchmarkMessages } from './messages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerPath = resolve(__dirname, 'worker.js');

const WORKER_COUNTS = [1, 5, 10, 20];
const STABILIZATION_DELAY = 100; // ms to let memory settle

interface MemoryStats {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

/**
 * OS-level memory snapshot using os.freemem() / os.totalmem().
 * Used as an independent cross-validation of per-process RSS numbers.
 */
interface OsMemorySnapshot {
  freemem: number;
  totalmem: number;
}

interface DriverResult {
  driver: string;
  workerCount: number;
  hostBaseline: MemoryStats;
  hostAfterSpawn: MemoryStats;
  hostDelta: MemoryStats;
  perWorkerOverhead: MemoryStats;
  workerStats: MemoryStats[];
  workerStatsAvg: MemoryStats;
  /**
   * Total system memory used.
   * - child_process: host baseline + sum of all worker RSS (separate processes)
   * - worker_threads: host RSS after spawn (workers share process memory)
   */
  totalSystemMemory: number;
  /**
   * OS-level memory snapshot before spawning workers.
   */
  osMemBefore: OsMemorySnapshot;
  /**
   * OS-level memory snapshot after spawning workers (and stabilization).
   */
  osMemAfter: OsMemorySnapshot;
  /**
   * OS-level memory delta (osMemBefore.freemem - osMemAfter.freemem).
   * Positive values mean memory was consumed. This is an independent
   * cross-check against the per-process totalSystemMemory calculation.
   */
  osMemDelta: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDriver = any;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getMemoryStats(): MemoryStats {
  const mem = process.memoryUsage();
  return {
    rss: mem.rss,
    heapTotal: mem.heapTotal,
    heapUsed: mem.heapUsed,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
  };
}

function subtractStats(a: MemoryStats, b: MemoryStats): MemoryStats {
  return {
    rss: a.rss - b.rss,
    heapTotal: a.heapTotal - b.heapTotal,
    heapUsed: a.heapUsed - b.heapUsed,
    external: a.external - b.external,
    arrayBuffers: a.arrayBuffers - b.arrayBuffers,
  };
}

function divideStats(stats: MemoryStats, divisor: number): MemoryStats {
  return {
    rss: stats.rss / divisor,
    heapTotal: stats.heapTotal / divisor,
    heapUsed: stats.heapUsed / divisor,
    external: stats.external / divisor,
    arrayBuffers: stats.arrayBuffers / divisor,
  };
}

function averageStats(statsArray: MemoryStats[]): MemoryStats {
  if (statsArray.length === 0) {
    return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
  }

  const sum = statsArray.reduce(
    (acc, s) => ({
      rss: acc.rss + s.rss,
      heapTotal: acc.heapTotal + s.heapTotal,
      heapUsed: acc.heapUsed + s.heapUsed,
      external: acc.external + s.external,
      arrayBuffers: acc.arrayBuffers + s.arrayBuffers,
    }),
    { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 }
  );

  return divideStats(sum, statsArray.length);
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Trigger garbage collection if available.
 * Requires --expose-gc flag, but we make it optional since
 * worker_threads doesn't support that flag being inherited.
 */
function tryGC(): void {
  try {
    if (typeof global.gc === 'function') {
      global.gc();
    }
  } catch {
    // GC not available, that's fine
  }
}

async function measureMemory(
  driverName: string,
  driver: AnyDriver,
  workerCount: number
): Promise<DriverResult> {
  // Force garbage collection if available
  tryGC();
  await delay(STABILIZATION_DELAY);

  const hostBaseline = getMemoryStats();
  const osMemBefore: OsMemorySnapshot = { freemem: freemem(), totalmem: totalmem() };

  // Spawn workers
  const workers: WorkerClient<BenchmarkMessages>[] = [];
  for (let i = 0; i < workerCount; i++) {
    const worker = await createWorker<BenchmarkMessages>({
      script: workerPath,
      driver,
    });
    workers.push(worker);
  }

  // Let memory stabilize
  await delay(STABILIZATION_DELAY);

  const hostAfterSpawn = getMemoryStats();
  const osMemAfter: OsMemorySnapshot = { freemem: freemem(), totalmem: totalmem() };
  const hostDelta = subtractStats(hostAfterSpawn, hostBaseline);

  // Get memory stats from each worker
  const workerStats: MemoryStats[] = [];
  for (const worker of workers) {
    const stats = await worker.send('memoryUsage', {});
    workerStats.push(stats);
  }

  // Calculate total system memory
  // For child_process: host baseline + sum of worker RSS (separate processes)
  // For worker_threads: just host RSS (workers share the process)
  let totalSystemMemory: number;
  if (driverName === 'child_process' || driverName === 'http') {
    // Workers are separate processes, so add their RSS to host baseline
    const workerTotalRss = workerStats.reduce((sum, s) => sum + s.rss, 0);
    totalSystemMemory = hostBaseline.rss + workerTotalRss;
  } else {
    // Workers share host memory, host RSS already includes everything
    totalSystemMemory = hostAfterSpawn.rss;
  }

  const osMemDelta = osMemBefore.freemem - osMemAfter.freemem;

  // Clean up
  await Promise.all(workers.map((w) => w.close()));

  return {
    driver: driverName,
    workerCount,
    hostBaseline,
    hostAfterSpawn,
    hostDelta,
    perWorkerOverhead: divideStats(hostDelta, workerCount),
    workerStats,
    workerStatsAvg: averageStats(workerStats),
    totalSystemMemory,
    osMemBefore,
    osMemAfter,
    osMemDelta,
  };
}

function generateMarkdownReport(results: DriverResult[]): string {
  const now = new Date().toISOString().split('T')[0];

  // Group results by worker count
  const workerCounts = [...new Set(results.map((r) => r.workerCount))].sort(
    (a, b) => a - b
  );

  // Build comparison data for main table
  const comparisonData = workerCounts.map((count) => {
    const cpResult = results.find(
      (r) => r.driver === 'child_process' && r.workerCount === count
    );
    const wtResult = results.find(
      (r) => r.driver === 'worker_threads' && r.workerCount === count
    );
    const httpResult = results.find(
      (r) => r.driver === 'http' && r.workerCount === count
    );
    const wtSavings =
      cpResult && wtResult
        ? ((cpResult.totalSystemMemory - wtResult.totalSystemMemory) /
            cpResult.totalSystemMemory) *
          100
        : 0;
    return {
      workers: count,
      childProcess: cpResult ? formatBytes(cpResult.totalSystemMemory) : 'N/A',
      workerThreads: wtResult
        ? formatBytes(wtResult.totalSystemMemory)
        : 'N/A',
      http: httpResult ? formatBytes(httpResult.totalSystemMemory) : 'N/A',
      savings: wtSavings > 0 ? `${wtSavings.toFixed(0)}%` : 'N/A',
    };
  });

  // Build child_process breakdown data
  const cpBreakdownData = workerCounts
    .map((count) => {
      const result = results.find(
        (r) => r.driver === 'child_process' && r.workerCount === count
      );
      if (!result) return null;
      const workerTotal = result.workerStats.reduce((s, w) => s + w.rss, 0);
      return {
        workers: count,
        hostProcess: formatBytes(result.hostBaseline.rss),
        workerProcesses: formatBytes(workerTotal),
        systemTotal: formatBytes(result.totalSystemMemory),
      };
    })
    .filter(
      (x): x is NonNullable<typeof x> => x !== null
    );

  // Build HTTP breakdown data
  const httpBreakdownData = workerCounts
    .map((count) => {
      const result = results.find(
        (r) => r.driver === 'http' && r.workerCount === count
      );
      if (!result) return null;
      const workerTotal = result.workerStats.reduce((s, w) => s + w.rss, 0);
      return {
        workers: count,
        hostProcess: formatBytes(result.hostBaseline.rss),
        workerProcesses: formatBytes(workerTotal),
        systemTotal: formatBytes(result.totalSystemMemory),
      };
    })
    .filter(
      (x): x is NonNullable<typeof x> => x !== null
    );

  // Build worker_threads breakdown data
  const wtBreakdownData = workerCounts
    .map((count) => {
      const result = results.find(
        (r) => r.driver === 'worker_threads' && r.workerCount === count
      );
      if (!result) return null;
      return {
        workers: count,
        hostProcess: formatBytes(result.totalSystemMemory),
      };
    })
    .filter(
      (x): x is NonNullable<typeof x> => x !== null
    );

  // Calculate per-worker costs
  const cp10 = results.find(
    (r) => r.driver === 'child_process' && r.workerCount === 10
  );
  const wt10 = results.find(
    (r) => r.driver === 'worker_threads' && r.workerCount === 10
  );
  const wt1 = results.find(
    (r) => r.driver === 'worker_threads' && r.workerCount === 1
  );
  const http10 = results.find(
    (r) => r.driver === 'http' && r.workerCount === 10
  );

  const perWorkerCostData: Array<{
    driver: string;
    cost: string;
    notes: string;
  }> = [];

  if (cp10) {
    const avgWorkerRss = cp10.workerStats.reduce((s, w) => s + w.rss, 0) / 10;
    perWorkerCostData.push({
      driver: 'child_process',
      cost: `~${formatBytes(avgWorkerRss)}`,
      notes: 'Full Node.js process per worker (Unix socket IPC)',
    });
  }
  if (http10) {
    const avgWorkerRss =
      http10.workerStats.reduce((s, w) => s + w.rss, 0) / 10;
    perWorkerCostData.push({
      driver: 'http',
      cost: `~${formatBytes(avgWorkerRss)}`,
      notes: 'Full Node.js process per worker (HTTP IPC)',
    });
  }
  if (wt10 && wt1) {
    const perWorkerDelta =
      (wt10.totalSystemMemory - wt1.totalSystemMemory) / 9;
    perWorkerCostData.push({
      driver: 'worker_threads',
      cost: `~${formatBytes(perWorkerDelta)}`,
      notes: 'V8 isolate + thread overhead',
    });
  }

  // Build OS-level cross-validation data
  const osValidationData = workerCounts.flatMap((count) => {
    const drivers = ['child_process', 'http', 'worker_threads'] as const;
    return drivers
      .map((driverName) => {
        const result = results.find(
          (r) => r.driver === driverName && r.workerCount === count
        );
        if (!result) return null;
        return {
          driver: driverName,
          workers: count,
          processLevel: formatBytes(result.totalSystemMemory),
          osFreememDelta: formatBytes(result.osMemDelta),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  });

  return h1(
    'Memory Usage Benchmark Results',

    `**Date**: ${now}  \n**Platform**: ${platform()}  \n**Node**: ${process.version}`,

    h2(
      'Overview',
      'This benchmark compares total system memory usage between `child_process` (spawn) and `worker_threads` drivers.',
      '**Key differences**:',
      unorderedList(
        '**child_process**: Each worker is a separate OS process (~87 MB each) with Unix socket IPC',
        '**http**: Each worker is a separate OS process (~87 MB each) with HTTP IPC',
        '**worker_threads**: Workers share the main process memory (~15 MB per thread added to host)'
      )
    ),

    h2(
      'Total System Memory',
      'Total memory consumed across all processes. This is the accurate comparison metric.',
      "**How it's calculated**:",
      unorderedList(
        '**child_process**: Host process RSS + sum of all worker process RSS (separate processes)',
        '**worker_threads**: Host process RSS only (workers run inside the host process)'
      ),
      table(comparisonData, [
        { label: 'Workers', field: 'workers' },
        { label: 'child_process', field: 'childProcess' },
        { label: 'http', field: 'http' },
        { label: 'worker_threads', field: 'workerThreads' },
        { label: 'wt Savings vs cp', field: 'savings' },
      ])
    ),

    h2(
      'Memory Breakdown',

      h3(
        'child_process',
        'Each worker is a separate Node.js process with its own V8 heap:',
        table(cpBreakdownData, [
          { label: 'Workers', field: 'workers' },
          { label: 'Host Process', field: 'hostProcess' },
          { label: 'Worker Processes (total)', field: 'workerProcesses' },
          { label: 'System Total', field: 'systemTotal' },
        ])
      ),

      h3(
        'http',
        'Each worker is a separate Node.js process communicating over HTTP:',
        table(httpBreakdownData, [
          { label: 'Workers', field: 'workers' },
          { label: 'Host Process', field: 'hostProcess' },
          { label: 'Worker Processes (total)', field: 'workerProcesses' },
          { label: 'System Total', field: 'systemTotal' },
        ])
      ),

      h3(
        'worker_threads',
        'Workers share the host process memory space (single process total):',
        table(wtBreakdownData, [
          { label: 'Workers', field: 'workers' },
          { label: 'Host Process (includes workers)', field: 'hostProcess' },
        ])
      )
    ),

    h2(
      'Per-Worker Memory Cost',
      'Approximate memory cost per additional worker:',
      table(perWorkerCostData, [
        { label: 'Driver', field: 'driver' },
        { label: 'Per-Worker Cost', field: 'cost' },
        { label: 'Notes', field: 'notes' },
      ])
    ),

    h2(
      'OS-Level Cross-Validation',
      'Independent validation using `os.freemem()` delta (before/after spawning workers).',
      'These numbers are inherently noisy (OS caching, other processes) but trends should match the process-level measurements.',
      table(osValidationData, [
        { label: 'Driver', field: 'driver' },
        { label: 'Workers', field: 'workers' },
        { label: 'Process-Level Total', field: 'processLevel' },
        { label: 'OS freemem Delta', field: 'osFreememDelta' },
      ])
    ),

    h2(
      'When to Use Each Driver',

      h3(
        'child_process (spawn)',
        '**Best for**:',
        unorderedList(
          "Process isolation (crash in worker doesn't affect host)",
          'Running untrusted or unstable code',
          'CPU/memory limits per worker (OS-level cgroups)',
          'Persistent workers that can reconnect after restart'
        ),
        '**Trade-off**: ~87 MB per worker, but full isolation'
      ),

      h3(
        'http',
        '**Best for**:',
        unorderedList(
          'Environments where socket file paths are problematic (length limits, networked filesystems)',
          'Process isolation like child_process but without socket file management',
          'Debugging and inspecting IPC traffic via standard HTTP tools'
        ),
        '**Trade-off**: Similar memory to child_process, slightly higher latency due to HTTP overhead'
      ),

      h3(
        'worker_threads',
        '**Best for**:',
        unorderedList(
          'Memory-constrained environments',
          'Many concurrent workers (10+)',
          'Fast startup requirements',
          'Shared memory via SharedArrayBuffer'
        ),
        '**Trade-off**: ~15 MB per thread, but crash affects entire process'
      )
    )
  );
}

function generateJsonReport(
  results: DriverResult[]
): Record<string, unknown> {
  return {
    metadata: {
      date: new Date().toISOString(),
      platform: platform(),
      nodeVersion: process.version,
      workerCounts: WORKER_COUNTS,
    },
    results: results.map((r) => ({
      driver: r.driver,
      workerCount: r.workerCount,
      totalSystemMemory: r.totalSystemMemory,
      hostBaseline: r.hostBaseline,
      hostDelta: r.hostDelta,
      perWorkerOverhead: r.perWorkerOverhead,
      workerStatsAvg: r.workerStatsAvg,
      osValidation: {
        freememBefore: r.osMemBefore.freemem,
        freememAfter: r.osMemAfter.freemem,
        freememDelta: r.osMemDelta,
        totalmem: r.osMemBefore.totalmem,
      },
    })),
  };
}

async function main() {
  console.log(
    '╔════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║           Memory Usage Comparison Benchmark                ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n'
  );

  console.log(`Worker: ${workerPath}`);
  console.log(`Worker counts: ${WORKER_COUNTS.join(', ')}`);
  console.log('');

  const results: DriverResult[] = [];

  for (const count of WORKER_COUNTS) {
    console.log(`\n─── Testing with ${count} worker(s) ───\n`);

    // Test child_process driver
    console.log(`  child_process: spawning ${count} workers...`);
    const cpResult = await measureMemory('child_process', undefined, count);
    results.push(cpResult);
    console.log(
      `    Total system memory: ${formatBytes(cpResult.totalSystemMemory)}`
    );
    console.log(
      `    (host baseline: ${formatBytes(cpResult.hostBaseline.rss)} + workers: ${formatBytes(cpResult.workerStats.reduce((s, w) => s + w.rss, 0))})`
    );
    console.log(
      `    OS freemem delta: ${formatBytes(cpResult.osMemDelta)} (cross-check)`
    );

    // Test HTTP driver
    console.log(`  http: spawning ${count} workers...`);
    const httpResult = await measureMemory('http', HttpDriver, count);
    results.push(httpResult);
    console.log(
      `    Total system memory: ${formatBytes(httpResult.totalSystemMemory)}`
    );
    console.log(
      `    (host baseline: ${formatBytes(httpResult.hostBaseline.rss)} + workers: ${formatBytes(httpResult.workerStats.reduce((s, w) => s + w.rss, 0))})`
    );
    console.log(
      `    OS freemem delta: ${formatBytes(httpResult.osMemDelta)} (cross-check)`
    );

    // Test worker_threads driver
    console.log(`  worker_threads: spawning ${count} workers...`);
    const wtResult = await measureMemory(
      'worker_threads',
      WorkerThreadsDriver,
      count
    );
    results.push(wtResult);
    console.log(
      `    Total system memory: ${formatBytes(wtResult.totalSystemMemory)}`
    );
    console.log(
      `    (single process, workers share memory)`
    );
    console.log(
      `    OS freemem delta: ${formatBytes(wtResult.osMemDelta)} (cross-check)`
    );

    // Quick comparison - total system memory
    const savings =
      ((cpResult.totalSystemMemory - wtResult.totalSystemMemory) /
        cpResult.totalSystemMemory) *
      100;
    console.log(
      `    → worker_threads saves ${savings.toFixed(0)}% memory vs child_process`
    );
  }

  // Generate reports
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const baseName = `${dateStr}-${platform()}-memory`;

  const resultsDir = resolve(__dirname, '../results');
  mkdirSync(resultsDir, { recursive: true });

  const markdownPath = resolve(resultsDir, `${baseName}.md`);
  const jsonPath = resolve(resultsDir, `${baseName}.json`);

  writeFileSync(markdownPath, generateMarkdownReport(results));
  writeFileSync(jsonPath, JSON.stringify(generateJsonReport(results), null, 2));

  // ─────────────────────────────────────────────────────────────────────────
  // Trend Validation: verify OS-level freemem deltas match process-level trends
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─── OS-Level Trend Validation ───\n');
  console.log('  Comparing process-level totals vs os.freemem() deltas:');
  console.log('  (OS numbers are noisy — trends matter, not exact match)\n');

  for (const count of WORKER_COUNTS) {
    const forCount = results.filter((r) => r.workerCount === count);
    if (forCount.length < 2) continue;

    // Sort by process-level total to get expected ranking
    const byProcessLevel = [...forCount].sort(
      (a, b) => b.totalSystemMemory - a.totalSystemMemory
    );
    const byOsDelta = [...forCount].sort(
      (a, b) => b.osMemDelta - a.osMemDelta
    );

    const processRanking = byProcessLevel.map((r) => r.driver).join(' > ');
    const osRanking = byOsDelta.map((r) => r.driver).join(' > ');
    const match = processRanking === osRanking ? '✓' : '~';

    console.log(`  ${count} worker(s):`);
    console.log(`    Process-level ranking: ${processRanking}`);
    console.log(`    OS freemem ranking:    ${osRanking} ${match}`);

    for (const r of forCount) {
      console.log(
        `      ${r.driver.padEnd(16)} process: ${formatBytes(r.totalSystemMemory).padStart(10)}  os: ${formatBytes(r.osMemDelta).padStart(10)}`
      );
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\nReports generated:');
  console.log(`  Markdown: ${markdownPath}`);
  console.log(`  JSON: ${jsonPath}`);
  console.log('');
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
