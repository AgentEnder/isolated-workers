/**
 * Environment Variable Isolation Tests
 *
 * Tests that environment variables are isolated between workers:
 * - process.env modifications don't leak between workers
 * - Each worker can have its own set of environment variables
 * - Spawn-time env options are properly isolated
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWorker } from 'isolated-workers';
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
import type { Messages as EnvMessages } from './fixtures/env-modification-worker.ts';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');
const envFixture = join(fixturesDir, 'env-modification-worker.ts');

describe.each([
  ['child-process', undefined],
  ['worker-threads', WorkerThreadsDriver],
])('Environment Variable Isolation (%s)', (driverName, Driver) => {
  const workers: Array<{ close: () => Promise<void> }> = [];

  beforeEach(() => {
    workers.length = 0;
  });

  afterEach(async () => {
    for (const worker of workers) {
      try {
        await worker.close();
      } catch (err) {
        console.error('Error closing worker:', err);
      }
    }
  });

  it('isolates process.env between workers', async () => {
    const worker1 = await createWorker<EnvMessages, typeof Driver>({
      script: envFixture,
      driver: Driver,
      spawnOptions: Driver ? undefined : { execArgv: ['--import', 'tsx'] },
    });
    workers.push(worker1);

    const worker2 = await createWorker<EnvMessages, typeof Driver>({
      script: envFixture,
      driver: Driver,
      spawnOptions: Driver ? undefined : { execArgv: ['--import', 'tsx'] },
    });
    workers.push(worker2);

    await worker1.send('setEnvVar', {
      key: 'TEST_VAR_1',
      value: 'value-from-worker-1',
      workerId: 'worker-1',
    });

    await worker2.send('setEnvVar', {
      key: 'TEST_VAR_2',
      value: 'value-from-worker-2',
      workerId: 'worker-2',
    });

    const vars1 = await worker1.send('getEnvVar', {
      workerId: 'worker-1',
    });

    expect(vars1.foundVars).toHaveLength(1);
    expect(vars1.foundVars[0].value).toBe('value-from-worker-1');

    const vars2 = await worker2.send('getEnvVar', {
      workerId: 'worker-2',
    });

    expect(vars2.foundVars).toHaveLength(1);
    expect(vars2.foundVars[0].value).toBe('value-from-worker-2');

    const test1 = await worker1.send('getEnvVar', {
      workerId: 'worker-1',
      key: 'TEST_VAR_1',
    });

    expect(test1.specificVar).not.toBeNull();
    expect(test1.specificVar?.value).toBe('value-from-worker-1');

    const test2 = await worker2.send('getEnvVar', {
      workerId: 'worker-2',
      key: 'TEST_VAR_1',
    });

    expect(test2.specificVar).toBeNull();
  });

  // worker_threads share process.env with the main thread — spawn-time env
  // isolation only works with child_process (separate processes).
  it.skipIf(driverName === 'worker-threads')('respects spawn-time environment variables', async () => {
    const worker1 = await createWorker<EnvMessages, typeof Driver>({
      script: envFixture,
      driver: Driver,
      spawnOptions: Driver ? undefined : { execArgv: ['--import', 'tsx'] },
      env: {
        SPAWN_VAR_1: 'spawn-value-1',
        SPAWN_VAR_2: 'spawn-value-2',
      },
    });
    workers.push(worker1);

    const worker2 = await createWorker<EnvMessages, typeof Driver>({
      script: envFixture,
      driver: Driver,
      spawnOptions: Driver ? undefined : { execArgv: ['--import', 'tsx'] },
      env: {
        SPAWN_VAR_3: 'spawn-value-3',
      },
    });
    workers.push(worker2);

    const allVars1 = await worker1.send('listAllEnv', {
      workerId: 'worker-1',
    });

    const allVars2 = await worker2.send('listAllEnv', {
      workerId: 'worker-2',
    });

    expect(allVars1.sampleVars).toContain('SPAWN_VAR_1');
    expect(allVars1.sampleVars).toContain('SPAWN_VAR_2');
    expect(allVars1.sampleVars).not.toContain('SPAWN_VAR_3');

    expect(allVars2.sampleVars).toContain('SPAWN_VAR_3');
    expect(allVars2.sampleVars).not.toContain('SPAWN_VAR_1');
  });

  it('clears environment variables independently', async () => {
    const worker1 = await createWorker<EnvMessages, typeof Driver>({
      script: envFixture,
      driver: Driver,
      spawnOptions: Driver ? undefined : { execArgv: ['--import', 'tsx'] },
    });
    workers.push(worker1);

    const worker2 = await createWorker<EnvMessages, typeof Driver>({
      script: envFixture,
      driver: Driver,
      spawnOptions: Driver ? undefined : { execArgv: ['--import', 'tsx'] },
    });
    workers.push(worker2);

    await worker1.send('setEnvVar', {
      key: 'VAR_1',
      value: 'value-1',
      workerId: 'worker-1',
    });

    await worker1.send('setEnvVar', {
      key: 'VAR_2',
      value: 'value-2',
      workerId: 'worker-1',
    });

    await worker2.send('setEnvVar', {
      key: 'VAR_3',
      value: 'value-3',
      workerId: 'worker-2',
    });

    const clear1 = await worker1.send('clearEnvVars', {
      workerId: 'worker-1',
    });

    expect(clear1.success).toBe(true);
    expect(clear1.clearedCount).toBe(2);

    const test1 = await worker1.send('getAllTestVars', {
      workerId: 'worker-1',
    });

    expect(test1.vars).toHaveLength(0);

    const test2 = await worker2.send('getAllTestVars', {
      workerId: 'worker-2',
    });

    expect(test2.vars).toHaveLength(1);
  });
});
