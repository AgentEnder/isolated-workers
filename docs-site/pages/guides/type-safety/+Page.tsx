import { CodeBlock } from '../../../components/CodeBlock';

export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">Type Safety</h1>
      <p className="text-lg text-gray-400 mb-8">
        Understanding how isolated-workers provides end-to-end type safety for
        your worker communications.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          The DefineMessages Type
        </h2>
        <p className="text-gray-400 mb-4">
          At the heart of isolated-workers is the DefineMessages type, which
          defines the contract between your host and worker processes:
        </p>

        <CodeBlock
          code={`import type { DefineMessages } from 'isolated-workers';

// Define your message contract
type MyMessages = DefineMessages<{
  // Message with request and response
  fetchData: {
    payload: { userId: string };
    result: { name: string; email: string };
  };

  // One-way message (fire and forget)
  logEvent: {
    payload: { event: string; timestamp: number };
  };

  // Message with void payload
  ping: {
    payload: void;
    result: { pong: boolean };
  };
}>;`}
          filename="types.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Type Inference on the Host
        </h2>
        <p className="text-gray-400 mb-4">
          When you create a worker with createWorker, TypeScript infers all
          message types:
        </p>

        <CodeBlock
          code={`import { createWorker } from 'isolated-workers';
import type { MyMessages } from './types';

const worker = await createWorker<MyMessages>({
  script: './worker.js',
});

// Full type inference for payloads
const result = await worker.send('fetchData', {
  userId: 'user-123',  // Type: string
});

// Result type is automatically inferred
console.log(result.name);    // string
console.log(result.email);   // string

// Type errors are caught at compile time
await worker.send('fetchData', {
  userId: 123,  // Error: Type 'number' is not assignable to type 'string'
});

// Unknown message types are errors
await worker.send('unknownMessage', {});  // Error: Unknown message type`}
          filename="host.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Type Safety on the Worker
        </h2>
        <p className="text-gray-400 mb-4">
          The worker side also has full type safety through the Handlers type:
        </p>

        <CodeBlock
          code={`import { startWorkerServer } from 'isolated-workers';
import type { MyMessages } from './types';

const server = await startWorkerServer<MyMessages>({
  fetchData: async (payload) => {
    // Payload type is inferred: { userId: string }
    const { userId } = payload;

    // Return type is checked
    return {
      name: 'John Doe',
      email: 'john@example.com',
      // extraField: 'oops',  // Error: Object literal may only specify known properties
    };
  },

  logEvent: async (payload) => {
    // Payload type is inferred: { event: string; timestamp: number }
    console.log(payload.event, payload.timestamp);
    // No return needed for one-way messages
  },

  ping: async () => {
    // Void payload means no parameters
    return { pong: true };
  },
});`}
          filename="worker.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Shared Types Pattern
        </h2>
        <p className="text-gray-400 mb-4">
          For maximum type safety, share your message definitions between host
          and worker:
        </p>

        <CodeBlock
          code={`// messages.ts - Shared between host and worker
export type AppMessages = DefineMessages<{
  process: {
    payload: { input: string; options: Options };
    result: { output: string; metrics: Metrics };
  };
}>;

// Import in both files
import type { AppMessages } from './messages';

// Host
const worker = await createWorker<AppMessages>({ ... });

// Worker
await startWorkerServer<AppMessages>({ ... });`}
          filename="messages.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Type Helper Utilities
        </h2>
        <p className="text-gray-400 mb-4">
          isolated-workers exports type helpers for extracting payload and
          result types:
        </p>

        <CodeBlock
          code={`import type {
  PayloadOf,
  ResultPayloadOf,
  WithResult
} from 'isolated-workers';

type MyMessages = DefineMessages<{
  compute: { payload: { x: number }; result: { y: number } };
  notify: { payload: { msg: string } };
}>;

// Extract payload type
type ComputePayload = PayloadOf<MyMessages, 'compute'>;
// { x: number }

// Extract result type
type ComputeResult = ResultPayloadOf<MyMessages, 'compute'>;
// { y: number }

// Get messages that have results
type MessagesWithResults = WithResult<MyMessages>;
// 'compute'`}
          filename="types.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Generic Message Patterns
        </h2>
        <p className="text-gray-400 mb-4">
          You can create generic message patterns for reusable abstractions:
        </p>

        <CodeBlock
          code={`// Generic CRUD message pattern
type CrudMessages<TEntity> = DefineMessages<{
  create: {
    payload: { data: TEntity };
    result: { id: string };
  };
  read: {
    payload: { id: string };
    result: { data: TEntity | null };
  };
  update: {
    payload: { id: string; data: Partial<TEntity> };
    result: { success: boolean };
  };
  delete: {
    payload: { id: string };
    result: { success: boolean };
  };
}>;

// Use for specific entities
type UserCrud = CrudMessages<{
  name: string;
  email: string;
}>;

// UserCrud.create has typed payload: { data: { name: string; email: string } }`}
          filename="types.ts"
        />
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">Summary</h2>
        <p className="text-gray-400 mb-4">The type system ensures:</p>
        <ul className="list-disc list-inside text-gray-400 space-y-2">
          <li>Compile-time checking of all message contracts</li>
          <li>Autocomplete for payloads and results in both host and worker</li>
          <li>Impossible to send messages with wrong payload types</li>
          <li>Refactoring safety across process boundaries</li>
        </ul>
      </section>
    </div>
  );
}
