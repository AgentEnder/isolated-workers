import { CodeBlock } from '../../../components/CodeBlock';

export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">createWorker()</h1>
      <p className="text-lg text-gray-400 mb-8">
        Spawn a worker process with type-safe messaging capabilities.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">Signature</h2>
        <CodeBlock
          code={`function createWorker<TMessages extends MessageDefs>(
  options: WorkerOptions<TMessages>
): Promise<WorkerClient<TMessages>>`}
          filename="signature"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Parameters
        </h2>

        <h3 className="text-xl font-semibold text-gray-200 mt-6 mb-3">
          WorkerOptions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-tertiary/50">
                <th className="py-3 px-4 text-gray-100 font-semibold">
                  Property
                </th>
                <th className="py-3 px-4 text-gray-100 font-semibold">Type</th>
                <th className="py-3 px-4 text-gray-100 font-semibold">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">script</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">string</code>
                </td>
                <td className="py-3 px-4">
                  Path to the worker script (required)
                </td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">env</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">
                    Record&lt;string, string&gt;
                  </code>
                </td>
                <td className="py-3 px-4">
                  Environment variables to pass to worker
                </td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">timeout</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">number | TimeoutConfig</code>
                </td>
                <td className="py-3 px-4">
                  Timeout configuration for operations
                </td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">middleware</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">Middleware[]</code>
                </td>
                <td className="py-3 px-4">Message middleware pipeline</td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">serializer</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">Serializer</code>
                </td>
                <td className="py-3 px-4">Custom serializer (default: JSON)</td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">connection</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">object</code>
                </td>
                <td className="py-3 px-4">Connection retry options</td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">logLevel</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">
                    &apos;error&apos; | &apos;warn&apos; | &apos;info&apos; |
                    &apos;debug&apos;
                  </code>
                </td>
                <td className="py-3 px-4">
                  Logging level (default: &apos;error&apos;)
                </td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">logger</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">Logger</code>
                </td>
                <td className="py-3 px-4">Custom logger instance</td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">detached</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">boolean</code>
                </td>
                <td className="py-3 px-4">Run worker as detached process</td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">spawnOptions</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">SpawnOptions</code>
                </td>
                <td className="py-3 px-4">Additional child_process options</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Timeout Configuration
        </h2>
        <p className="text-gray-400 mb-4">
          The timeout option can be a number (applies to all operations) or an
          object with per-operation timeouts:
        </p>

        <CodeBlock
          code={`// Simple: 30s for all operations
const worker = await createWorker<MyMessages>({
  script: './worker.js',
  timeout: 30000,
});

// Advanced: per-operation timeouts
const worker = await createWorker<MyMessages>({
  script: './worker.js',
  timeout: {
    WORKER_STARTUP: 5000,     // 5s for worker to start
    WORKER_MESSAGE: 60000,    // 1min default for messages
    'heavyTask': 300000,      // 5min for specific message type
  },
});`}
          filename="timeouts.ts"
        />

        <h4 className="text-lg font-semibold text-gray-200 mt-6 mb-3">
          Built-in Timeout Keys
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-tertiary/50">
                <th className="py-3 px-4 text-gray-100 font-semibold">Key</th>
                <th className="py-3 px-4 text-gray-100 font-semibold">
                  Default
                </th>
                <th className="py-3 px-4 text-gray-100 font-semibold">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">WORKER_STARTUP</code>
                </td>
                <td className="py-3 px-4">10,000ms (10s)</td>
                <td className="py-3 px-4">Time to wait for worker to start</td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">SERVER_CONNECT</code>
                </td>
                <td className="py-3 px-4">30,000ms (30s)</td>
                <td className="py-3 px-4">
                  Time for server to wait for host connection
                </td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">WORKER_MESSAGE</code>
                </td>
                <td className="py-3 px-4">300,000ms (5min)</td>
                <td className="py-3 px-4">Default timeout for all messages</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          WorkerClient Interface
        </h2>
        <p className="text-gray-400 mb-4">
          The returned WorkerClient provides methods for communicating with the
          worker:
        </p>

        <CodeBlock
          code={`interface WorkerClient<TMessages> {
  // Send a message and await response
  send<K extends keyof TMessages>(
    type: K,
    payload: TMessages[K]['payload']
  ): Promise<TMessages[K]['result']>;

  // Close the worker gracefully
  close(): Promise<void>;

  // Disconnect but keep process alive (detached mode)
  disconnect(): Promise<void>;

  // Reconnect to existing worker (detached mode)
  reconnect(): Promise<void>;

  // Process ID of the worker
  pid: number;

  // Whether the worker process is active
  isActive: boolean;

  // Whether connection to worker is active
  isConnected: boolean;
}`}
          filename="types.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">Example</h2>
        <CodeBlock
          code={`import { createWorker } from 'isolated-workers';
import type { MyMessages } from './types';

const worker = await createWorker<MyMessages>({
  script: './worker.js',
  env: {
    NODE_ENV: 'production',
    API_KEY: process.env.API_KEY,
  },
  timeout: {
    WORKER_STARTUP: 5000,
    WORKER_MESSAGE: 30000,
  },
  logLevel: 'info',
});

// Send a message
const result = await worker.send('process', { data: 'input' });
console.log(result);

// Check status
console.log('Worker PID:', worker.pid);
console.log('Is active:', worker.isActive);
console.log('Is connected:', worker.isConnected);

// Clean up
await worker.close();`}
          filename="example.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">See Also</h2>
        <ul className="list-disc list-inside text-gray-400 space-y-2">
          <li>
            <a
              href="/api/start-worker-server"
              className="text-neon-cyan hover:underline"
            >
              startWorkerServer()
            </a>{' '}
            - Worker-side server implementation
          </li>
          <li>
            <a href="/api/handlers" className="text-neon-cyan hover:underline">
              Handlers
            </a>{' '}
            - Type-safe handler definitions
          </li>
          <li>
            <a
              href="/guides/error-handling"
              className="text-neon-cyan hover:underline"
            >
              Error Handling Guide
            </a>{' '}
            - Error handling patterns
          </li>
        </ul>
      </section>
    </div>
  );
}
