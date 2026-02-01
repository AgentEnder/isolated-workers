import { CodeBlock } from '../../../components/CodeBlock';

export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">Handlers Type</h1>
      <p className="text-lg text-gray-400 mb-8">
        Type-safe message handler definitions for worker servers.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Definition
        </h2>
        <p className="text-gray-400 mb-4">
          The Handlers type ensures that your handlers match the message
          contract:
        </p>

        <CodeBlock
          code={`type Handlers<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: (
    payload: TDefs[K]['payload']
  ) => TDefs[K] extends { result: unknown }
    ? MaybePromise<TDefs[K]['result'] | void>
    : MaybePromise<void>;
};`}
          filename="types.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">Usage</h2>
        <p className="text-gray-400 mb-4">
          Use the Handlers type when defining your worker server:
        </p>

        <CodeBlock
          code={`import { startWorkerServer } from 'isolated-workers';
import type { MyMessages, Handlers } from './types';

// The Handlers type ensures type safety
const handlers: Handlers<MyMessages> = {
  // Message with result
  fetchUser: async ({ userId }) => {
    // Payload type: { userId: string }
    // Return type must match: { name: string; email: string }
    return {
      name: 'John Doe',
      email: 'john@example.com',
    };
  },

  // One-way message (no result)
  logEvent: async ({ event, timestamp }) => {
    // Payload type: { event: string; timestamp: number }
    console.log(event, timestamp);
    // No return needed
  },

  // Void payload
  ping: async () => {
    return { pong: true };
  },
};

const server = await startWorkerServer(handlers);`}
          filename="handlers.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Type Inference
        </h2>
        <p className="text-gray-400 mb-4">
          When passed to startWorkerServer, handlers are automatically
          type-checked:
        </p>

        <CodeBlock
          code={`import { startWorkerServer } from 'isolated-workers';
import type { MyMessages } from './types';

// Handlers are inferred from the message type
const server = await startWorkerServer<MyMessages>({
  // Type errors are caught at compile time
  fetchUser: async ({ userId }) => {
    // Returning wrong type causes error
    return {
      name: 'John',
      // extraField: 'oops',  // Error: excess property check
    };
  },

  // Missing required field causes error
  fetchUser: async ({ userId }) => {
    return {
      // Error: missing 'email' property
      name: 'John',
    };
  },

  // Unknown message type causes error
  unknownMessage: async ({ data }) => {
    return {};
    // Error: 'unknownMessage' is not a valid message type
  },
});`}
          filename="type-inference.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Async and Sync Handlers
        </h2>
        <p className="text-gray-400 mb-4">
          Handlers can be synchronous or asynchronous:
        </p>

        <CodeBlock
          code={`const handlers = {
  // Synchronous handler
  add: async ({ a, b }) => {
    return { sum: a + b };  // Sync computation
  },

  // Asynchronous handler
  fetchFromAPI: async ({ url }) => {
    const response = await fetch(url);
    const data = await response.json();
    return { data };  // Async operation
  },

  // Mix of both
  validate: ({ input }) => {
    if (!input) {
      throw new Error('Invalid input');
    }
    // Can also return Promise explicitly
    return Promise.resolve({ valid: true });
  },
};`}
          filename="async-sync.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Error Handling
        </h2>
        <p className="text-gray-400 mb-4">
          Errors thrown in handlers are automatically propagated to the host:
        </p>

        <CodeBlock
          code={`const handlers = {
  riskyOperation: async ({ input }) => {
    if (input === null) {
      // This error is serialized and thrown on the host
      throw new Error('Input cannot be null');
    }

    try {
      const result = await doWork(input);
      return { result };
    } catch (error) {
      // Wrap and rethrow
      throw new Error(\`Operation failed: \${error.message}\`);
    }
  },
};

// Host side
try {
  await worker.send('riskyOperation', { input: null });
} catch (error) {
  console.error(error.message); // "Input cannot be null"
}`}
          filename="error-handling.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Handler Utilities
        </h2>
        <p className="text-gray-400 mb-4">
          Helper types for working with handlers:
        </p>

        <CodeBlock
          code={`import type {
  Handlers,
  PayloadOf,
  ResultPayloadOf
} from 'isolated-workers';

type MyMessages = DefineMessages<{
  process: { payload: { input: string }; result: { output: string } };
}>;

// Extract handler signature for a specific message
type ProcessHandler = Handlers<MyMessages>['process'];
// (payload: { input: string }) => MaybePromise<{ output: string }>

// Extract payload type
type ProcessPayload = PayloadOf<MyMessages, 'process'>;
// { input: string }

// Extract result type
type ProcessResult = ResultPayloadOf<MyMessages, 'process'>;
// { output: string }`}
          filename="utilities.ts"
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
            - Create a server with handlers
          </li>
          <li>
            <a
              href="/api/define-messages"
              className="text-neon-cyan hover:underline"
            >
              DefineMessages
            </a>{' '}
            - Define message contracts
          </li>
          <li>
            <a
              href="/guides/type-safety"
              className="text-neon-cyan hover:underline"
            >
              Type Safety Guide
            </a>{' '}
            - More on type system
          </li>
        </ul>
      </section>
    </div>
  );
}
