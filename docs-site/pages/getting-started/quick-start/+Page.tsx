import { CodeBlock } from '../../../components/CodeBlock';

export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">Quick Start</h1>
      <p className="text-lg text-gray-400 mb-8">
        Create your first type-safe worker in under 5 minutes.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Step 1: Define Your Messages
        </h2>
        <p className="text-gray-400 mb-4">
          First, define the message contract between your host and worker using
          the DefineMessages type:
        </p>

        <CodeBlock
          code={`import type { DefineMessages } from 'isolated-workers';

type WorkerMessages = DefineMessages<{
  // A message with a request and response
  add: {
    payload: { a: number; b: number };
    result: { sum: number };
  };
  // A one-way message (no result)
  log: {
    payload: { message: string };
  };
}>;`}
          filename="types.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Step 2: Create the Worker
        </h2>
        <p className="text-gray-400 mb-4">
          Create a worker file that handles the messages:
        </p>

        <CodeBlock
          code={`import { startWorkerServer } from 'isolated-workers';
import type { WorkerMessages } from './types';

const server = await startWorkerServer<WorkerMessages>({
  add: async ({ a, b }) => {
    // The result type is checked - returning invalid data will cause a type error
    return { sum: a + b };
  },
  log: async ({ message }) => {
    console.log('[Worker]', message);
    // No result needed for one-way messages
  },
});

console.log('Worker server started');`}
          filename="worker.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Step 3: Spawn the Worker
        </h2>
        <p className="text-gray-400 mb-4">
          In your main process, create and communicate with the worker:
        </p>

        <CodeBlock
          code={`import { createWorker } from 'isolated-workers';
import type { WorkerMessages } from './types';

// Spawn the worker process
const worker = await createWorker<WorkerMessages>({
  script: './worker.js',
});

// Send messages with full type safety
const result = await worker.send('add', { a: 5, b: 3 });
console.log(result.sum); // 8

// One-way message
await worker.send('log', { message: 'Hello from host!' });

// Clean up when done
await worker.close();`}
          filename="index.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          That&apos;s It!
        </h2>
        <p className="text-gray-400 mb-4">
          You now have a type-safe worker running in a separate process. The key
          benefits:
        </p>
        <ul className="list-disc list-inside text-gray-400 space-y-2">
          <li>Full type inference on both host and worker sides</li>
          <li>Autocomplete for payloads and results</li>
          <li>Compile-time type checking for all message contracts</li>
          <li>True process isolation</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Next Steps
        </h2>
        <p className="text-gray-400 mb-4">
          Continue to{' '}
          <a
            href="/getting-started/first-worker"
            className="text-neon-cyan hover:underline"
          >
            First Worker
          </a>{' '}
          for a more complete example, or explore the{' '}
          <a href="/guides" className="text-neon-cyan hover:underline">
            Guides
          </a>{' '}
          for advanced patterns.
        </p>
      </section>
    </div>
  );
}
