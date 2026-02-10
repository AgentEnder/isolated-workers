/**
 * Environment Variable Modification Worker Fixture
 *
 * This fixture tests whether environment variables are isolated between worker processes.
 * It modifies process.env and verifies that changes in one worker don't leak into
 * other workers.
 *
 * Expected behavior: Each worker should have its own isolated process.env copy.
 * Modifications in one worker should NOT affect other workers.
 */

import { startWorkerServer, Handlers } from 'isolated-workers';
import type { DefineMessages } from 'isolated-workers';
import { resolveDriver } from './resolve-driver.js';

const ENV_PREFIX = '__isolated_workers_test__';

export type Messages = DefineMessages<{
  setEnvVar: {
    payload: { key: string; value: string; workerId: string };
    result: { success: boolean; envKey: string };
  };

  getEnvVar: {
    payload: { workerId: string; key?: string };
    result: {
      foundVars: Array<{ key: string; value: string }>;
      specificVar?: { key: string; value: string } | null;
    };
  };

  getAllTestVars: {
    payload: { workerId: string };
    result: { vars: Array<{ key: string; value: string }> };
  };

  clearEnvVars: {
    payload: { workerId: string };
    result: { success: boolean; clearedCount: number };
  };

  listAllEnv: {
    payload: { workerId: string };
    result: { totalVars: number; sampleVars: string[] };
  };
}>;

const handlers: Handlers<Messages> = {
  setEnvVar: ({ key, value, workerId }) => {
    const envKey = `${ENV_PREFIX}_${workerId}_${key}`;
    process.env[envKey] = value;

    console.log(`Worker ${workerId}: Set env var ${envKey} = ${value}`);

    return { success: true, envKey };
  },

  getEnvVar: ({ workerId, key }) => {
    const foundVars: Array<{ key: string; value: string }> = [];
    const prefix = `${ENV_PREFIX}_${workerId}_`;

    if (key) {
      const envKey = `${prefix}${key}`;
      const value = process.env[envKey];
      const specificVar = value !== undefined ? { key: envKey, value } : null;

      return { foundVars: [], specificVar };
    }

    for (const [envKey, value] of Object.entries(process.env)) {
      if (envKey.startsWith(prefix)) {
        foundVars.push({ key: envKey, value });
      }
    }

    console.log(`Worker ${workerId}: Found ${foundVars.length} test env vars`);

    return { foundVars, specificVar: undefined };
  },

  getAllTestVars: ({ workerId }) => {
    const vars: Array<{ key: string; value: string }> = [];

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(ENV_PREFIX)) {
        vars.push({ key, value });
      }
    }

    console.log(
      `Worker ${workerId}: Total test vars in process: ${vars.length}`
    );

    return { vars };
  },

  clearEnvVars: ({ workerId }) => {
    const prefix = `${ENV_PREFIX}_${workerId}_`;
    let clearedCount = 0;

    for (const key of Object.keys(process.env)) {
      if (key.startsWith(prefix)) {
        delete process.env[key];
        clearedCount++;
      }
    }

    console.log(`Worker ${workerId}: Cleared ${clearedCount} env vars`);

    return { success: true, clearedCount };
  },

  listAllEnv: ({ workerId }) => {
    const allVars = Object.keys(process.env);

    console.log(`Worker ${workerId}: Total env vars: ${allVars.length}`);

    return { totalVars: allVars.length, sampleVars: allVars };
  },
};

export async function startEnvModificationWorker() {
  const server = await startWorkerServer(handlers, { driver: resolveDriver() });
  console.log('Environment modification worker ready');
  return server;
}

startEnvModificationWorker().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
