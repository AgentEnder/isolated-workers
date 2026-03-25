/**
 * Global Pollution Worker Fixture
 *
 * This fixture tests whether worker processes truly isolate the global namespace.
 * It sets properties on globalThis with a unique prefix and verifies that
 * global modifications in one worker don't leak into other workers.
 *
 * Expected behavior: Each worker should have its own isolated global scope.
 * Setting global variables in one worker should NOT affect other workers.
 */

import { startWorkerServer, Handlers } from 'isolated-workers';
import type { DefineMessages } from 'isolated-workers';
import { resolveDriver } from './resolve-driver.js';

const GLOBAL_PREFIX = '__isolated_workers_test__';

export type Messages = DefineMessages<{
  setGlobal: {
    payload: { key: string; value: unknown; workerId: string };
    result: { success: boolean; globalKey: string };
  };

  getGlobal: {
    payload: { workerId: string };
    result: { keys: string[]; values: Record<string, unknown> };
  };

  clearGlobals: {
    payload: { workerId: string };
    result: { success: boolean; clearedCount: number };
  };
}>;

const handlers: Handlers<Messages> = {
  setGlobal: ({ key, value, workerId }) => {
    const globalKey = `${GLOBAL_PREFIX}_${workerId}_${key}`;
    (globalThis as Record<string, unknown>)[globalKey] = value;
    console.log(
      `Worker ${workerId}: Set global ${globalKey} = ${JSON.stringify(value)}`
    );
    return { success: true, globalKey };
  },

  getGlobal: ({ workerId }) => {
    const prefix = `${GLOBAL_PREFIX}_${workerId}_`;
    const keys: string[] = [];
    const values: Record<string, unknown> = {};

    for (const key of Object.keys(globalThis)) {
      if (key.startsWith(prefix)) {
        const shortKey = key.replace(prefix, '');
        keys.push(shortKey);
        values[shortKey] = (globalThis as Record<string, unknown>)[key];
      }
    }

    return { keys, values };
  },

  clearGlobals: ({ workerId }) => {
    const prefix = `${GLOBAL_PREFIX}_${workerId}_`;
    let clearedCount = 0;

    for (const key of Object.keys(globalThis)) {
      if (key.startsWith(prefix)) {
        delete (globalThis as Record<string, unknown>)[key];
        clearedCount++;
      }
    }

    return { success: true, clearedCount };
  },
};

export async function startGlobalPollutionWorker() {
  const server = await startWorkerServer(handlers, { driver: resolveDriver() });
  console.log('Global pollution worker ready');
  return server;
}

startGlobalPollutionWorker().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
