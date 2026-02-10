/**
 * Require Hook Isolation Tests
 *
 * Tests that require hooks are isolated between workers:
 * - Custom require.extensions handlers don't leak between workers
 * - Each worker can have its own set of custom extensions
 * - Modifications in one worker don't affect others
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWorker } from 'isolated-workers';
import type { Messages as RequireHookMessages } from './fixtures/require-hook-worker.ts';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');
const requireHookFixture = join(fixturesDir, 'require-hook-worker.ts');

describe('Require Hook Isolation (child-process)', () => {
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

  it('isolates require.extensions between workers', async () => {
    const worker1 = await createWorker<RequireHookMessages>({
      script: requireHookFixture,
      spawnOptions: {
        execArgv: ['--import', 'tsx'],
      },
    });
    workers.push(worker1);

    const worker2 = await createWorker<RequireHookMessages>({
      script: requireHookFixture,
      spawnOptions: {
        execArgv: ['--import', 'tsx'],
      },
    });
    workers.push(worker2);

    const worker1Id = 'worker-1';
    const worker2Id = 'worker-2';

    const ext1 = '.custom1';
    const ext2 = '.custom2';

    const result1 = await worker1.send('setRequireHook', {
      extension: ext1,
      workerId: worker1Id,
      transform: '// transformed content',
    });

    expect(result1.success).toBe(true);
    expect(result1.registeredExtensions).toContain(ext1);

    const result2 = await worker2.send('setRequireHook', {
      extension: ext2,
      workerId: worker2Id,
      transform: '// different transformed content',
    });

    expect(result2.success).toBe(true);
    expect(result2.registeredExtensions).toContain(ext2);

    const test1 = await worker1.send('testRequireHook', {
      extension: ext1,
      workerId: worker1Id,
    });

    expect(test1.hookExists).toBe(true);

    const test2 = await worker1.send('testRequireHook', {
      extension: ext2,
      workerId: worker1Id,
    });

    expect(test2.hookExists).toBe(false);

    const test3 = await worker2.send('testRequireHook', {
      extension: ext2,
      workerId: worker2Id,
    });

    expect(test3.hookExists).toBe(true);

    const test4 = await worker2.send('testRequireHook', {
      extension: ext1,
      workerId: worker2Id,
    });

    expect(test4.hookExists).toBe(false);
  });

  it('clears custom require hooks independently', async () => {
    const worker1 = await createWorker<RequireHookMessages>({
      script: requireHookFixture,
      spawnOptions: {
        execArgv: ['--import', 'tsx'],
      },
    });
    workers.push(worker1);

    const worker2 = await createWorker<RequireHookMessages>({
      script: requireHookFixture,
      spawnOptions: {
        execArgv: ['--import', 'tsx'],
      },
    });
    workers.push(worker2);

    await worker1.send('setRequireHook', {
      extension: '.custom1',
      workerId: 'worker-1',
      transform: '// transform 1',
    });

    await worker1.send('setRequireHook', {
      extension: '.custom2',
      workerId: 'worker-1',
      transform: '// transform 2',
    });

    await worker2.send('setRequireHook', {
      extension: '.custom3',
      workerId: 'worker-2',
      transform: '// transform 3',
    });

    const clear1 = await worker1.send('clearRequireHooks', {
      workerId: 'worker-1',
    });

    expect(clear1.success).toBe(true);
    expect(clear1.clearedCount).toBe(2);

    const test1 = await worker1.send('testRequireHook', {
      extension: '.custom1',
      workerId: 'worker-1',
    });

    expect(test1.hookExists).toBe(false);

    const test2 = await worker2.send('testRequireHook', {
      extension: '.custom3',
      workerId: 'worker-2',
    });

    expect(test2.hookExists).toBe(true);
  });
});
