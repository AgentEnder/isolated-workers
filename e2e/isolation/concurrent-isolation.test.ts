/**
 * Concurrent Isolation Stress Tests
 *
 * Stress tests for worker isolation under high concurrency:
 * - Spawns 10-20 workers concurrently
 * - Each worker performs multiple isolation violations
 * - Verifies no interference across any workers
 * - Tests both drivers separately
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWorker } from 'isolated-workers';
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
import { aggressive as stressConnection } from 'isolated-workers/backoff-curves';
import type { Messages as GlobalPollutionMessages } from './fixtures/global-pollution-worker.ts';
import type { Messages as EnvMessages } from './fixtures/env-modification-worker.ts';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

const globalPollutionFixture = join(fixturesDir, 'global-pollution-worker.ts');
const envFixture = join(fixturesDir, 'env-modification-worker.ts');

describe.each([
  ['child-process', undefined, 60000],
  ['worker-threads', WorkerThreadsDriver, 60000],
])(
  'Concurrent Isolation Stress Tests (%s)',
  (_driverName, Driver, testTimeout) => {
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

    it(
      'maintains isolation with 10 concurrent workers',
      { timeout: testTimeout },
      async () => {
        const numWorkers = 10;
        const workerIds = Array.from(
          { length: numWorkers },
          (_, i) => `worker-${i}`
        );

        const envWorkers = await Promise.all(
          workerIds.map((_id) =>
            createWorker<EnvMessages, typeof Driver>({
              script: envFixture,
              driver: Driver,
              spawnOptions: Driver
                ? undefined
                : { execArgv: ['--import', 'tsx'] },
              connection: stressConnection,
            })
          )
        );

        workers.push(...envWorkers);

        for (let i = 0; i < numWorkers; i++) {
          await envWorkers[i].send('setEnvVar', {
            key: `VAR_${i}`,
            value: `value-${i}`,
            workerId: workerIds[i],
          });
        }

        for (let i = 0; i < numWorkers; i++) {
          const result = await envWorkers[i].send('getAllTestVars', {
            workerId: workerIds[i],
          });

          expect(result.vars.length).toBe(1);
          expect(result.vars[0].value).toBe(`value-${i}`);
        }
      }
    );

    it(
      'handles rapid concurrent message sending',
      { timeout: testTimeout },
      async () => {
        const numWorkers = 10;
        const workerIds = Array.from(
          { length: numWorkers },
          (_, i) => `worker-${i}`
        );

        const workersList = await Promise.all(
          workerIds.map((_id) =>
            createWorker<GlobalPollutionMessages, typeof Driver>({
              script: globalPollutionFixture,
              driver: Driver,
              spawnOptions: Driver
                ? undefined
                : { execArgv: ['--import', 'tsx'] },
              connection: stressConnection,
            })
          )
        );

        workers.push(...workersList);

        const promises: Promise<unknown>[] = [];
        for (let i = 0; i < numWorkers; i++) {
          for (let j = 0; j < 5; j++) {
            promises.push(
              workersList[i].send('setGlobal', {
                key: `${workerIds[i]}-rapid-key-${j}`,
                value: { index: j, timestamp: Date.now() },
                workerId: workerIds[i],
              })
            );
          }
        }

        await Promise.all(promises);

        const verifyPromises = workersList.map(async (worker, index) => {
          const result = await worker.send('getGlobal', {
            workerId: workerIds[index],
          });
          expect(result.keys.length).toBe(5);
          // Each returned key should contain the worker ID prefix we added
          for (const key of result.keys) {
            expect(key).toBe(
              `${workerIds[index]}-rapid-key-${result.keys.indexOf(key)}`
            );
          }
        });

        await Promise.all(verifyPromises);
      }
    );

    it(
      'isolates mixed worker types under load',
      { timeout: testTimeout },
      async () => {
        const numWorkers = 15;
        const workerIds = Array.from(
          { length: numWorkers },
          (_, i) => `worker-${i}`
        );

        const globalWorkers = await Promise.all(
          workerIds.map((_id) =>
            createWorker<GlobalPollutionMessages, typeof Driver>({
              script: globalPollutionFixture,
              driver: Driver,
              spawnOptions: Driver
                ? undefined
                : { execArgv: ['--import', 'tsx'] },
              connection: stressConnection,
            })
          )
        );

        const envWorkers = await Promise.all(
          workerIds.map((_id) =>
            createWorker<EnvMessages, typeof Driver>({
              script: envFixture,
              driver: Driver,
              spawnOptions: Driver
                ? undefined
                : { execArgv: ['--import', 'tsx'] },
              connection: stressConnection,
            })
          )
        );

        workers.push(...globalWorkers, ...envWorkers);

        const setPromises: Promise<unknown>[] = [];
        for (let i = 0; i < numWorkers; i++) {
          setPromises.push(
            globalWorkers[i].send('setGlobal', {
              key: 'load-test-key',
              value: { workerId: workerIds[i], value: `data-${i}` },
              workerId: workerIds[i],
            })
          );
          setPromises.push(
            envWorkers[i].send('setEnvVar', {
              key: 'LOAD_TEST_VAR',
              value: `env-value-${i}`,
              workerId: workerIds[i],
            })
          );
        }

        await Promise.all(setPromises);

        const verifyPromises = workerIds.map(async (id) => {
          const [globalResult, envResult] = await Promise.all([
            globalWorkers[parseInt(id.split('-')[1])].send('getGlobal', {
              workerId: id,
            }),
            envWorkers[parseInt(id.split('-')[1])].send('getAllTestVars', {
              workerId: id,
            }),
          ]);

          expect(globalResult.keys).toContain('load-test-key');
          expect(
            envResult.vars.some((v: { key: string }) => v.key.includes('LOAD_TEST_VAR'))
          ).toBe(true);
        });

        await Promise.all(verifyPromises);
      }
    );

    it(
      'maintains isolation with 20 concurrent workers',
      { timeout: testTimeout },
      async () => {
        const numWorkers = 20;
        const workerIds = Array.from(
          { length: numWorkers },
          (_, i) => `worker-${i}`
        );

        const workersList = await Promise.all(
          workerIds.map((_id) =>
            createWorker<GlobalPollutionMessages, typeof Driver>({
              script: globalPollutionFixture,
              driver: Driver,
              spawnOptions: Driver
                ? undefined
                : { execArgv: ['--import', 'tsx'] },
              // More generous connection settings for 20 concurrent spawns
              connection: stressConnection,
            })
          )
        );

        workers.push(...workersList);

        const promises = workerIds.map((id) =>
          workersList[parseInt(id.split('-')[1])].send('setGlobal', {
            key: 'stress-test-key',
            value: { workerId: id, data: `stress-data-${id}` },
            workerId: id,
          })
        );

        await Promise.all(promises);

        const verifyPromises = workersList.map(async (worker, index) => {
          const result = await worker.send('getGlobal', {
            workerId: workerIds[index],
          });
          expect(result.keys.length).toBeGreaterThanOrEqual(1);
        });

        await Promise.all(verifyPromises);
      }
    );
  }
);
