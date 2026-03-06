/**
 * Web Worker Driver Example - Host
 *
 * This example demonstrates using the WebWorkerDriver for browser-based
 * workers. Web workers run in a separate thread within the browser,
 * enabling parallel computation without blocking the main thread.
 */

import { createWorker } from 'isolated-workers';
import { WebWorkerDriver } from 'isolated-workers/drivers/web-worker';
import type { Messages } from './messages.js';

async function main() {
  const worker = await createWorker<Messages>({
    script: new URL('./worker.ts', import.meta.url),
    driver: WebWorkerDriver,
  });

  try {
    const result = await worker.send('compute', { value: 21 });
    console.log('Result:', result.doubled); // 42
  } finally {
    await worker.close();
  }
}

main().catch(console.error);
