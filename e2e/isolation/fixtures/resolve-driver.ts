/**
 * Resolve the driver for e2e test worker fixtures.
 *
 * Reads the startup data placed by the host to explicitly select the matching
 * driver. This is NOT auto-detection — it reads data the host explicitly provided.
 */
import { ChildProcessDriver } from 'isolated-workers/drivers/child-process';
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';

export function resolveDriver() {
  // Check if the host passed worker_threads startup data via workerData
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isMainThread, workerData } = require('worker_threads');
    if (
      !isMainThread &&
      workerData?.['__isolatedWorkers']?.driver === 'worker_threads'
    ) {
      return WorkerThreadsDriver;
    }
  } catch {
    // worker_threads not available
  }

  return ChildProcessDriver;
}
