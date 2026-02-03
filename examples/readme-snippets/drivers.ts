/**
 * Driver examples for README - these snippets are type-checked
 */

import { createWorker, DefineMessages } from 'isolated-workers';
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';

// Shared message type for examples
type Messages = DefineMessages<{
  process: {
    payload: { data: string };
    result: { processed: string };
  };
}>;

async function childProcessExample() {
  // #region child-process-driver
  const worker = await createWorker<Messages>({
    script: './worker.js',
    // Uses child_process driver by default
  });
  // #endregion child-process-driver

  await worker.close();
}

async function workerThreadsExample() {
  // #region worker-threads-driver
  const worker = await createWorker<Messages, typeof WorkerThreadsDriver>({
    script: './worker.js',
    driver: WorkerThreadsDriver,
  });
  // #endregion worker-threads-driver

  await worker.close();
}

// Prevent unused variable warnings
void childProcessExample;
void workerThreadsExample;
