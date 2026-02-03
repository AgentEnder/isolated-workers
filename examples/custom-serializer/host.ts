/**
 * Custom Serializer Example - Host (Client) Side
 *
 * This example demonstrates how to use a custom serializer for
 * message encoding/decoding. Both host and worker must use the
 * same serializer class.
 */

import { createWorker } from 'isolated-workers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Messages } from './messages.js';
import { verboseSerializer } from './serializer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Starting custom serializer example...\n');
  console.log('Using:', verboseSerializer.constructor.name);
  console.log(
    'Terminator:',
    JSON.stringify(verboseSerializer.terminator),
    '\n'
  );

  // #region create-worker-with-serializer
  const worker = await createWorker<Messages>({
    script: join(__dirname, 'worker.ts'),
    timeout: 10000,
    serializer: verboseSerializer,
  });
  // #endregion create-worker-with-serializer

  console.log(`Worker spawned with PID: ${worker.pid}\n`);

  try {
    // Send a message using our custom serializer
    console.log('Sending message with custom serialization...');
    const result = await worker.send('echo', {
      data: 'Hello, Custom Serializer!',
    });

    console.log('\nResult received:');
    console.log('  Echoed:', result.echoed);
    console.log('  Worker serializer:', result.serializer);
  } finally {
    await worker.close();
    console.log('\nWorker closed successfully');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
