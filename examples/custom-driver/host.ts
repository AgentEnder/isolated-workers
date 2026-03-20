/**
 * Custom Driver Example — Host
 *
 * Demonstrates the type flow when using a custom driver with createWorker:
 *
 *  - `DriverOptionsFor<typeof LoopbackDriver>` → `LoopbackDriverOptions`
 *     (inferred from spawn's options parameter — no hardcoded mapping needed)
 *
 *  - `CapabilitiesOf<typeof LoopbackDriver>` → `{ reconnect: false, detach: false, sharedMemory: false }`
 *     (inferred from method presence on the driver config)
 *
 *  - `UnderlyingWorkerOf<typeof LoopbackDriver>` → `LoopbackHandle`
 *     (inferred from the return type of the WorkerHandle's `getHandle` method)
 *
 *  - `worker.disconnect` → `never` (reconnect capability is false)
 */

import { createWorker } from 'isolated-workers';
import type { DriverMessage } from 'isolated-workers/drivers';
import { LoopbackDriver } from './loopback-driver.js';
import type { Messages } from './messages.js';

// ---- Runtime demonstration ----

async function main() {
  console.log('Custom driver example: LoopbackDriver\n');
  console.log(`Driver name: ${LoopbackDriver.name}`);

  const worker = await createWorker<Messages, typeof LoopbackDriver>({
    script: './unused-for-loopback.js',
    driver: LoopbackDriver,
    // driverOptions is typed as Partial<LoopbackDriverOptions> automatically
    driverOptions: {
      latencyMs: 10,
      // The handler processes messages in-process and returns a response
      handler: (msg: DriverMessage) => ({
        type: msg.type,
        tx: msg.tx,
        payload: { echoed: `echo: ${(msg.payload as { text: string }).text}` },
      }),
    },
  });

  // Send a message — the loopback driver processes it in-process
  const result = await worker.send('echo', { text: 'hello' });
  console.log(`Result: ${result.echoed}`);

  // @ts-expect-error the LoopbackDriver doesn't define a disconnect method,
  // so its not inferred on the worker handle.
  worker.disconnect?.();

  // getHandle() is typed as LoopbackHandle automatically —
  // inferred from the return type of LoopbackWorkerHandle.getHandle()
  const handle = worker.getHandle();
  console.log(`Messages processed: ${handle.messagesProcessed}`);

  await worker.close();
  console.log('\nCustom driver example complete!');
}

main().catch((err) => {
  console.error('Error:', (err as Error).message);
  process.exit(1);
});
