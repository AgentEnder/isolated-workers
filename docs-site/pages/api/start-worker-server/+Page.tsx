import { CodeBlock } from '../../../components/CodeBlock';

export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">
        startWorkerServer()
      </h1>
      <p className="text-lg text-gray-400 mb-8">
        Start a server in your worker to handle incoming messages from the host.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">Signature</h2>
        <CodeBlock
          code={`function startWorkerServer<TDefs extends MessageDefs>(
  handlers: Handlers<TDefs>,
  options?: WorkerServerOptions<TDefs>
): Promise<WorkerServer>`}
          filename="signature"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Parameters
        </h2>

        <h3 className="text-xl font-semibold text-gray-200 mt-6 mb-3">
          Handlers
        </h3>
        <p className="text-gray-400 mb-4">
          A map of message type to handler function. The Handlers type ensures
          type safety:
        </p>

        <CodeBlock
          code={`type Handlers<TDefs> = {
  [K in keyof TDefs]: (
    payload: TDefs[K]['payload']
  ) => TDefs[K] extends { result: infer R }
    ? MaybePromise<R | void>
    : MaybePromise<void>;
};`}
          filename="types.ts"
        />

        <h3 className="text-xl font-semibold text-gray-200 mt-6 mb-3">
          WorkerServerOptions
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
                  <code className="text-neon-mint">socketPath</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">string</code>
                </td>
                <td className="py-3 px-4">
                  Socket path (from env if not provided)
                </td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">hostConnectTimeout</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">number</code>
                </td>
                <td className="py-3 px-4">
                  Time to wait for host connection (0 = forever)
                </td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">disconnectBehavior</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">
                    &apos;shutdown&apos; | &apos;keep-alive&apos;
                  </code>
                </td>
                <td className="py-3 px-4">
                  Behavior on disconnect (default: &apos;shutdown&apos;)
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
                <td className="py-3 px-4">
                  Custom serializer (must match host)
                </td>
              </tr>
              <tr className="border-b border-tertiary/30">
                <td className="py-3 px-4">
                  <code className="text-neon-mint">txIdGenerator</code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-neon-cyan">TransactionIdGenerator</code>
                </td>
                <td className="py-3 px-4">Custom transaction ID generator</td>
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
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          WorkerServer Interface
        </h2>
        <p className="text-gray-400 mb-4">
          The returned WorkerServer provides control over the server lifecycle:
        </p>

        <CodeBlock
          code={`interface WorkerServer {
  // Stop the server and cleanup
  stop(): Promise<void>;

  // Whether the server is running
  isRunning: boolean;
}`}
          filename="types.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Environment Variables
        </h2>
        <p className="text-gray-400 mb-4">
          When spawned via createWorker(), these environment variables are
          automatically set:
        </p>
        <ul className="list-disc list-inside text-gray-400 space-y-2">
          <li>
            <code className="text-neon-mint">ISOLATED_WORKERS_SOCKET_PATH</code>{' '}
            - The socket path to use
          </li>
          <li>
            <code className="text-neon-mint">
              ISOLATED_WORKERS_SERVER_CONNECT_TIMEOUT
            </code>{' '}
            - Connect timeout in ms
          </li>
          <li>
            <code className="text-neon-mint">ISOLATED_WORKERS_DEBUG</code> - Set
            to &apos;true&apos; for debug logging
          </li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">Examples</h2>

        <h4 className="text-lg font-semibold text-gray-200 mt-6 mb-3">
          Basic Worker
        </h4>
        <CodeBlock
          code={`import { startWorkerServer } from 'isolated-workers';
import type { MyMessages } from './types';

const server = await startWorkerServer<MyMessages>({
  greet: async ({ name }) => {
    return { message: \`Hello, \${name}!\` };
  },

  compute: async ({ value }) => {
    return { result: value * 2 };
  },

  notify: async ({ event }) => {
    console.log('Notification:', event);
    // No return needed for one-way messages
  },
});

console.log('Worker server started');`}
          filename="worker.ts"
        />

        <h4 className="text-lg font-semibold text-gray-200 mt-6 mb-3">
          With Custom Options
        </h4>
        <CodeBlock
          code={`import { startWorkerServer } from 'isolated-workers';

const server = await startWorkerServer<MyMessages>({
  processData: async ({ input }) => {
    return { output: input.toUpperCase() };
  },
}, {
  hostConnectTimeout: 60000,      // Wait up to 60s for host
  disconnectBehavior: 'keep-alive',  // Don't exit on disconnect
  logLevel: 'info',
});

console.log('Server is running:', server.isRunning);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await server.stop();
  console.log('Server stopped');
});`}
          filename="worker-options.ts"
        />

        <h4 className="text-lg font-semibold text-gray-200 mt-6 mb-3">
          With Middleware
        </h4>
        <CodeBlock
          code={`import type { Middleware } from 'isolated-workers';

const loggingMiddleware: Middleware<MyMessages> = (message, direction) => {
  console.log(\`[\${direction}] \${message.type}\`);
  return message;
};

const server = await startWorkerServer<MyMessages>({
  process: async ({ data }) => {
    return { result: data };
  },
}, {
  middleware: [loggingMiddleware],
});`}
          filename="middleware.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Disconnect Behavior
        </h2>
        <p className="text-gray-400 mb-4">
          The disconnectBehavior option controls what happens when the host
          disconnects:
        </p>

        <CodeBlock
          code={`// Default: shutdown on disconnect
const server = await startWorkerServer(handlers, {
  disconnectBehavior: &apos;shutdown&apos;,
});
// Worker exits when host disconnects

// Keep-alive: worker stays running
const server = await startWorkerServer(handlers, {
  disconnectBehavior: &apos;keep-alive&apos;,
});
// Worker continues running, can accept new connections`}
          filename="disconnect-behavior.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">See Also</h2>
        <ul className="list-disc list-inside text-gray-400 space-y-2">
          <li>
            <a
              href="/api/create-worker"
              className="text-neon-cyan hover:underline"
            >
              createWorker()
            </a>{' '}
            - Spawn worker from host
          </li>
          <li>
            <a href="/api/handlers" className="text-neon-cyan hover:underline">
              Handlers
            </a>{' '}
            - Handler type definitions
          </li>
          <li>
            <a
              href="/guides/best-practices"
              className="text-neon-cyan hover:underline"
            >
              Best Practices
            </a>{' '}
            - Production patterns
          </li>
        </ul>
      </section>
    </div>
  );
}
