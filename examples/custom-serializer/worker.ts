/**
 * Custom Serializer Example - Worker (Server) Side
 *
 * The worker must use the same serializer as the host.
 */

import { startWorkerServer, Handlers } from 'isolated-workers';
import type { Messages } from './messages.js';
import { verboseSerializer } from './serializer.js';

const handlers: Handlers<Messages> = {
  echo: ({ data }) => {
    console.log(`Worker received: "${data}"`);
    return {
      echoed: data.toUpperCase(),
      serializer: verboseSerializer.constructor.name,
    };
  },
};

async function main() {
  console.log('Worker starting with custom serializer...');
  console.log('Using:', verboseSerializer.constructor.name);

  // #region start-worker-with-serializer
  const server = await startWorkerServer(handlers, {
    serializer: verboseSerializer,
  });
  // #endregion start-worker-with-serializer

  console.log('Worker ready');

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
