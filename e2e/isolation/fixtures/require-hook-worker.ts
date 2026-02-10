/**
 * Require Hook Isolation Worker Fixture
 *
 * This fixture tests whether require hooks are isolated between worker processes.
 * It sets up custom require.extensions handlers and verifies that modifications
 * in one worker don't affect other workers.
 *
 * Expected behavior: Each worker should have its own isolated require.extensions.
 * Custom require hooks in one worker should NOT affect other workers.
 */

import { startWorkerServer, Handlers } from 'isolated-workers';
import type { DefineMessages } from 'isolated-workers';
import { resolveDriver } from './resolve-driver.js';

export type Messages = DefineMessages<{
  setRequireHook: {
    payload: { extension: string; workerId: string; transform: string };
    result: { success: boolean; registeredExtensions: string[] };
  };

  testRequireHook: {
    payload: { extension: string; workerId: string };
    result: { hookExists: boolean; allExtensions: string[] };
  };

  getExtensions: {
    payload: { workerId: string };
    result: { extensions: string[] };
  };

  clearRequireHooks: {
    payload: { workerId: string };
    result: { success: boolean; clearedCount: number };
  };
}>;

const handlers: Handlers<Messages> = {
  setRequireHook: ({ extension, workerId, transform }) => {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;

    require.extensions[ext] = function (module, filename) {
      const content = module._compile(transform, filename);
      return content;
    };

    const registeredExtensions = Object.keys(require.extensions);

    console.log(`Worker ${workerId}: Set require hook for ${ext}`);

    return { success: true, registeredExtensions };
  },

  testRequireHook: ({ extension, workerId }) => {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    const hookExists = require.extensions[ext] !== undefined;
    const allExtensions = Object.keys(require.extensions);

    console.log(
      `Worker ${workerId}: Testing ${ext} - hook exists: ${hookExists}`
    );

    return { hookExists, allExtensions };
  },

  getExtensions: ({ workerId }) => {
    const extensions = Object.keys(require.extensions);
    console.log(`Worker ${workerId}: Current extensions:`, extensions);
    return { extensions };
  },

  clearRequireHooks: ({ workerId }) => {
    let clearedCount = 0;
    const originalExtensions = ['.js', '.json', '.node'];

    // Only clear extensions that we explicitly added (starting with .custom)
    // This makes the count deterministic regardless of Node's built-in extensions
    for (const ext of Object.keys(require.extensions)) {
      if (ext.startsWith('.custom') && !originalExtensions.includes(ext)) {
        delete require.extensions[ext];
        clearedCount++;
      }
    }

    console.log(
      `Worker ${workerId}: Cleared ${clearedCount} custom require hooks`
    );

    return { success: true, clearedCount };
  },
};

export async function startRequireHookWorker() {
  const server = await startWorkerServer(handlers, { driver: resolveDriver() });
  console.log('Require hook worker ready');
  return server;
}

startRequireHookWorker().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
