/**
 * Module-Level Isolation Tests
 *
 * Tests verify that module-level state is properly isolated between worker processes.
 * Each worker should have its own module cache and instance - modifications to
 * a shared module in one worker should NOT affect other workers.
 *
 * Test scenarios:
 * - Spawn multiple workers that require the same shared module
 * - Each worker modifies the module differently (increment counter, set data)
 * - Verify each worker sees only its own modifications
 * - Test that one worker's changes don't affect others
 * - Test both child_process and worker_threads drivers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWorker } from 'isolated-workers';
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Messages } from '../fixtures/module-pollution-worker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Module-Level Isolation', () => {
  describe.each([
    ['child_process', undefined],
    ['worker_threads', WorkerThreadsDriver],
  ])('%s driver', (driverName, driver) => {
    const workers: Array<{ worker: any; workerId: string }> = [];

    beforeEach(async () => {
      workers.length = 0;
    });

    afterEach(async () => {
      for (const { worker } of workers) {
        await worker.close();
      }
    });

    it('each worker has isolated module counter state', async () => {
      const worker1 = await createWorker<Messages, typeof driver>({
        script: join(__dirname, 'fixtures', 'module-pollution-worker.ts'),
        driver: driver,
        spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
        logLevel: 'silent',
      });
      const worker2 = await createWorker<Messages, typeof driver>({
        script: join(__dirname, 'fixtures', 'module-pollution-worker.ts'),
        driver: driver,
        spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
        logLevel: 'silent',
      });

      workers.push({ worker: worker1, workerId: 'worker-1' });
      workers.push({ worker: worker2, workerId: 'worker-2' });

      await worker1.send('modifyModule', {
        action: 'increment',
        workerId: 'worker-1',
      });
      await worker1.send('modifyModule', {
        action: 'increment',
        workerId: 'worker-1',
      });
      await worker1.send('modifyModule', {
        action: 'increment',
        workerId: 'worker-1',
      });

      await worker2.send('modifyModule', {
        action: 'increment',
        workerId: 'worker-2',
      });
      await worker2.send('modifyModule', {
        action: 'increment',
        workerId: 'worker-2',
      });

      const state1 = await worker1.send('getModuleState', {
        workerId: 'worker-1',
      });
      const state2 = await worker2.send('getModuleState', {
        workerId: 'worker-2',
      });

      expect(state1.state.counter).toBe(3);
      expect(state2.state.counter).toBe(2);
      expect(state1.state.lastModifiedBy).toBe('worker-1');
      expect(state2.state.lastModifiedBy).toBe('worker-2');
    });

    it('modifications to shared module do not leak between workers', async () => {
      const worker1 = await createWorker<Messages, typeof driver>({
        script: join(__dirname, 'fixtures', 'module-pollution-worker.ts'),
        driver: driver,
        spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
        logLevel: 'silent',
      });
      const worker2 = await createWorker<Messages, typeof driver>({
        script: join(__dirname, 'fixtures', 'module-pollution-worker.ts'),
        driver: driver,
        spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
        logLevel: 'silent',
      });
      const worker3 = await createWorker<Messages, typeof driver>({
        script: join(__dirname, 'fixtures', 'module-pollution-worker.ts'),
        driver: driver,
        spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
        logLevel: 'silent',
      });

      workers.push({ worker: worker1, workerId: 'worker-1' });
      workers.push({ worker: worker2, workerId: 'worker-2' });
      workers.push({ worker: worker3, workerId: 'worker-3' });

      await worker1.send('modifyModule', {
        action: 'set',
        key: 'config',
        value: 'worker1-config',
        workerId: 'worker-1',
      });
      await worker2.send('modifyModule', {
        action: 'set',
        key: 'config',
        value: 'worker2-config',
        workerId: 'worker-2',
      });
      await worker3.send('modifyModule', {
        action: 'set',
        key: 'config',
        value: 'worker3-config',
        workerId: 'worker-3',
      });

      const state1 = await worker1.send('getModuleState', {
        workerId: 'worker-1',
      });
      const state2 = await worker2.send('getModuleState', {
        workerId: 'worker-2',
      });
      const state3 = await worker3.send('getModuleState', {
        workerId: 'worker-3',
      });

      expect(state1.state.data.config).toBe('worker1-config');
      expect(state2.state.data.config).toBe('worker2-config');
      expect(state3.state.data.config).toBe('worker3-config');

      expect(state1.state.lastModifiedBy).toBe('worker-1');
      expect(state2.state.lastModifiedBy).toBe('worker-2');
      expect(state3.state.lastModifiedBy).toBe('worker-3');
    });

    it('resetting module state in one worker does not affect others', async () => {
      const worker1 = await createWorker<Messages, typeof driver>({
        script: join(__dirname, 'fixtures', 'module-pollution-worker.ts'),
        driver: driver,
        spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
        logLevel: 'silent',
      });
      const worker2 = await createWorker<Messages, typeof driver>({
        script: join(__dirname, 'fixtures', 'module-pollution-worker.ts'),
        driver: driver,
        spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
        logLevel: 'silent',
      });

      workers.push({ worker: worker1, workerId: 'worker-1' });
      workers.push({ worker: worker2, workerId: 'worker-2' });

      await worker1.send('modifyModule', {
        action: 'increment',
        workerId: 'worker-1',
      });
      await worker1.send('modifyModule', {
        action: 'set',
        key: 'test',
        value: 'data',
        workerId: 'worker-1',
      });

      await worker2.send('modifyModule', {
        action: 'increment',
        workerId: 'worker-2',
      });
      await worker2.send('modifyModule', {
        action: 'set',
        key: 'test',
        value: 'other',
        workerId: 'worker-2',
      });

      const beforeReset1 = await worker1.send('getModuleState', {
        workerId: 'worker-1',
      });
      const beforeReset2 = await worker2.send('getModuleState', {
        workerId: 'worker-2',
      });

      expect(beforeReset1.state.counter).toBe(1);
      expect(beforeReset1.state.data.test).toBe('data');
      expect(beforeReset2.state.counter).toBe(1);
      expect(beforeReset2.state.data.test).toBe('other');

      await worker1.send('resetModuleState', { workerId: 'worker-1' });

      const afterReset1 = await worker1.send('getModuleState', {
        workerId: 'worker-1',
      });
      const afterReset2 = await worker2.send('getModuleState', {
        workerId: 'worker-2',
      });

      expect(afterReset1.state.counter).toBe(0);
      expect(afterReset1.state.data).toEqual({});
      expect(afterReset1.state.lastModifiedBy).toBeNull();

      expect(afterReset2.state.counter).toBe(1);
      expect(afterReset2.state.data.test).toBe('other');
      expect(afterReset2.state.lastModifiedBy).toBe('worker-2');
    });

    it('concurrent module modifications maintain isolation', async () => {
      const workerIds = ['worker-a', 'worker-b', 'worker-c'];

      for (const workerId of workerIds) {
        const worker = await createWorker<Messages, typeof driver>({
          script: join(__dirname, 'fixtures', 'module-pollution-worker.ts'),
          driver: driver,
          spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
          logLevel: 'silent',
        });

        workers.push({ worker, workerId });
      }

      await Promise.all(
        workers.map(async ({ worker, workerId }) => {
          await Promise.all([
            worker.send('modifyModule', { action: 'increment', workerId }),
            worker.send('modifyModule', {
              action: 'set',
              key: 'key1',
              value: `${workerId}-val1`,
              workerId,
            }),
            worker.send('modifyModule', {
              action: 'set',
              key: 'key2',
              value: `${workerId}-val2`,
              workerId,
            }),
          ]);
        })
      );

      const states = await Promise.all(
        workers.map(async ({ worker, workerId }) => {
          return await worker.send('getModuleState', { workerId });
        })
      );

      for (let i = 0; i < workerIds.length; i++) {
        const workerId = workerIds[i];
        const state = states[i];

        expect(state.state.counter).toBe(1);
        expect(state.state.data.key1).toBe(`${workerId}-val1`);
        expect(state.state.data.key2).toBe(`${workerId}-val2`);
        expect(state.state.lastModifiedBy).toBe(workerId);

        for (let j = 0; j < workerIds.length; j++) {
          if (i !== j) {
            const otherWorkerId = workerIds[j];
            const otherState = states[j];

            expect(state.state.data).not.toEqual(otherState.state.data);
            expect(state.state.data.key1).not.toBe(`${otherWorkerId}-val1`);
            expect(state.state.data.key2).not.toBe(`${otherWorkerId}-val2`);
          }
        }
      }
    });

    it('multiple operations on same worker accumulate correctly', async () => {
      const worker = await createWorker<Messages, typeof driver>({
        script: join(__dirname, 'fixtures', 'module-pollution-worker.ts'),
        driver: driver,
        spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
        logLevel: 'silent',
      });

      workers.push({ worker, workerId: 'worker-1' });

      await worker.send('modifyModule', {
        action: 'increment',
        workerId: 'worker-1',
      });
      const after1 = await worker.send('getModuleState', {
        workerId: 'worker-1',
      });
      expect(after1.state.counter).toBe(1);

      await worker.send('modifyModule', {
        action: 'increment',
        workerId: 'worker-1',
      });
      const after2 = await worker.send('getModuleState', {
        workerId: 'worker-1',
      });
      expect(after2.state.counter).toBe(2);

      await worker.send('modifyModule', {
        action: 'set',
        key: 'a',
        value: 1,
        workerId: 'worker-1',
      });
      const after3 = await worker.send('getModuleState', {
        workerId: 'worker-1',
      });
      expect(after3.state.counter).toBe(2);
      expect(after3.state.data.a).toBe(1);

      await worker.send('modifyModule', {
        action: 'set',
        key: 'b',
        value: 2,
        workerId: 'worker-1',
      });
      const after4 = await worker.send('getModuleState', {
        workerId: 'worker-1',
      });
      expect(after4.state.counter).toBe(2);
      expect(after4.state.data).toEqual({ a: 1, b: 2 });
    });
  });
});
