/**
 * Global Property Isolation Tests
 *
 * Tests verify that global properties are properly isolated between worker processes.
 * Each worker should have its own global scope - modifications in one worker
 * should NOT affect other workers.
 *
 * Test scenarios:
 * - Spawn 3 workers with unique IDs
 * - Each worker sets unique global properties
 * - Query each worker for its globals
 * - Verify workers only see their own properties
 * - Test both child_process and worker_threads drivers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWorker } from 'isolated-workers';
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Messages } from './fixtures/global-pollution-worker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Global Property Isolation', () => {
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

    it('isolates global properties between three workers', async () => {
      const workerIds = ['worker-1', 'worker-2', 'worker-3'];

      for (const workerId of workerIds) {
        const worker = await createWorker<Messages, typeof driver>({
          script: join(__dirname, 'fixtures', 'global-pollution-worker.ts'),
          driver: driver,
          spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
          logLevel: 'silent',
        });

        workers.push({ worker, workerId });
      }

      const testData = {
        'worker-1': { name: 'test', value: 42 },
        'worker-2': { name: 'demo', value: 'hello' },
        'worker-3': { name: 'example', value: { nested: true } },
      };

      await Promise.all(
        workers.map(async ({ worker, workerId }) => {
          const { name, value } = testData[workerId];
          await worker.send('setGlobal', { key: name, value, workerId });
        })
      );

      const globals = await Promise.all(
        workers.map(async ({ worker, workerId }) => {
          return await worker.send('getGlobal', { workerId });
        })
      );

      expect(globals[0].keys).toHaveLength(1);
      expect(globals[0].values[testData['worker-1'].name]).toEqual(
        testData['worker-1'].value
      );

      expect(globals[1].keys).toHaveLength(1);
      expect(globals[1].values[testData['worker-2'].name]).toEqual(
        testData['worker-2'].value
      );

      expect(globals[2].keys).toHaveLength(1);
      expect(globals[2].values[testData['worker-3'].name]).toEqual(
        testData['worker-3'].value
      );
    });

    it('each worker only sees its own globals', async () => {
      const worker1 = await createWorker<Messages, typeof driver>({
        script: join(__dirname, 'fixtures', 'global-pollution-worker.ts'),
        driver: driver,
        spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
        logLevel: 'silent',
      });
      const worker2 = await createWorker<Messages, typeof driver>({
        script: join(__dirname, 'fixtures', 'global-pollution-worker.ts'),
        driver: driver,
        spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
        logLevel: 'silent',
      });

      workers.push({ worker: worker1, workerId: 'worker-1' });
      workers.push({ worker: worker2, workerId: 'worker-2' });

      await worker1.send('setGlobal', {
        key: 'secret',
        value: 'worker1-data',
        workerId: 'worker-1',
      });
      await worker2.send('setGlobal', {
        key: 'secret',
        value: 'worker2-data',
        workerId: 'worker-2',
      });

      const worker1Globals = await worker1.send('getGlobal', {
        workerId: 'worker-1',
      });
      const worker2Globals = await worker2.send('getGlobal', {
        workerId: 'worker-2',
      });

      expect(worker1Globals.values.secret).toBe('worker1-data');
      expect(worker2Globals.values.secret).toBe('worker2-data');

      const worker1HasWorker2Data = Object.values(
        worker1Globals.values
      ).includes('worker2-data');
      const worker2HasWorker1Data = Object.values(
        worker2Globals.values
      ).includes('worker1-data');

      expect(worker1HasWorker2Data).toBe(false);
      expect(worker2HasWorker1Data).toBe(false);
    });

    it('clearing globals in one worker does not affect others', async () => {
      const worker1 = await createWorker<Messages, typeof driver>({
        script: join(__dirname, 'fixtures', 'global-pollution-worker.ts'),
        driver: driver,
        spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
        logLevel: 'silent',
      });
      const worker2 = await createWorker<Messages, typeof driver>({
        script: join(__dirname, 'fixtures', 'global-pollution-worker.ts'),
        driver: driver,
        spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
        logLevel: 'silent',
      });

      workers.push({ worker: worker1, workerId: 'worker-1' });
      workers.push({ worker: worker2, workerId: 'worker-2' });

      await worker1.send('setGlobal', {
        key: 'data',
        value: 'should-be-cleared',
        workerId: 'worker-1',
      });
      await worker2.send('setGlobal', {
        key: 'data',
        value: 'should-remain',
        workerId: 'worker-2',
      });

      const clearResult = await worker1.send('clearGlobals', {
        workerId: 'worker-1',
      });
      expect(clearResult.success).toBe(true);
      expect(clearResult.clearedCount).toBeGreaterThan(0);

      const worker1After = await worker1.send('getGlobal', {
        workerId: 'worker-1',
      });
      const worker2After = await worker2.send('getGlobal', {
        workerId: 'worker-2',
      });

      expect(worker1After.keys).toHaveLength(0);
      expect(worker2After.keys).toHaveLength(1);
      expect(worker2After.values.data).toBe('should-remain');
    });

    it('concurrent global modifications do not interfere', async () => {
      const workerIds = ['worker-a', 'worker-b', 'worker-c'];

      for (const workerId of workerIds) {
        const worker = await createWorker<Messages, typeof driver>({
          script: join(__dirname, 'fixtures', 'global-pollution-worker.ts'),
          driver: driver,
          spawnOptions: driver ? undefined : { execArgv: ['--import', 'tsx'] },
          logLevel: 'silent',
        });

        workers.push({ worker, workerId });
      }

      await Promise.all(
        workers.map(async ({ worker, workerId }) => {
          await Promise.all([
            worker.send('setGlobal', {
              key: 'x',
              value: `${workerId}-x`,
              workerId,
            }),
            worker.send('setGlobal', {
              key: 'y',
              value: `${workerId}-y`,
              workerId,
            }),
            worker.send('setGlobal', {
              key: 'z',
              value: `${workerId}-z`,
              workerId,
            }),
          ]);
        })
      );

      const results = await Promise.all(
        workers.map(async ({ worker, workerId }) => {
          return await worker.send('getGlobal', { workerId });
        })
      );

      for (let i = 0; i < workerIds.length; i++) {
        const workerId = workerIds[i];
        const result = results[i];

        expect(result.keys).toHaveLength(3);
        expect(result.values.x).toBe(`${workerId}-x`);
        expect(result.values.y).toBe(`${workerId}-y`);
        expect(result.values.z).toBe(`${workerId}-z`);

        for (let j = 0; j < workerIds.length; j++) {
          if (i !== j) {
            const otherWorkerId = workerIds[j];
            expect(Object.values(result.values)).not.toContain(
              `${otherWorkerId}-x`
            );
            expect(Object.values(result.values)).not.toContain(
              `${otherWorkerId}-y`
            );
            expect(Object.values(result.values)).not.toContain(
              `${otherWorkerId}-z`
            );
          }
        }
      }
    });
  });
});
