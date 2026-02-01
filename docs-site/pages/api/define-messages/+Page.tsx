import { CodeBlock } from '../../../components/CodeBlock';

export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">
        DefineMessages Type
      </h1>
      <p className="text-lg text-gray-400 mb-8">
        Define message contracts with full type safety between host and worker.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Definition
        </h2>
        <p className="text-gray-400 mb-4">
          DefineMessages is a type constructor that defines message contracts:
        </p>

        <CodeBlock
          code={`type DefineMessages<TDefs extends MessageDefs> = TDefs;

interface MessageDef {
  payload: unknown;
  result?: unknown;
}

type MessageDefs = Record<string, MessageDef>;`}
          filename="types.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Basic Usage
        </h2>
        <p className="text-gray-400 mb-4">
          Define your message contract at the type level:
        </p>

        <CodeBlock
          code={`import type { DefineMessages } from 'isolated-workers';

type WorkerMessages = DefineMessages<{
  // Message with both payload and result
  addUser: {
    payload: { name: string; email: string };
    result: { id: string; created: boolean };
  };

  // One-way message (fire and forget)
  log: {
    payload: { message: string; level: string };
  };

  // Message with void payload
  ping: {
    payload: void;
    result: { pong: boolean };
  };

  // Message with complex payload
  processBatch: {
    payload: {
      items: Array<{ id: string; data: any }>;
      options: { parallel: boolean; retries: number };
    };
    result: {
      successful: number;
      failed: number;
    };
  };
}>;`}
          filename="messages.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Type Safety Guarantees
        </h2>
        <p className="text-gray-400 mb-4">
          DefineMessages provides end-to-end type safety:
        </p>

        <CodeBlock
          code={`import { createWorker } from 'isolated-workers';
import type { WorkerMessages } from './messages';

// Host side
const worker = await createWorker<WorkerMessages>({
  script: './worker.js',
});

// Payload types are enforced
await worker.send('addUser', {
  name: 'John Doe',
  email: 'john@example.com',
  // age: 30,  // Error: excess property
});

// Result types are inferred
const result = await worker.send('addUser', {
  name: 'Jane Doe',
  email: 'jane@example.com',
});

console.log(result.id);      // string
console.log(result.created); // boolean
// result.timestamp          // Error: property doesn't exist

// Message types are checked
await worker.send('unknownMessage', {});
// Error: '"unknownMessage"' is not assignable to keyof WorkerMessages`}
          filename="host.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Helper Types
        </h2>
        <p className="text-gray-400 mb-4">
          Extract types from your message definitions:
        </p>

        <CodeBlock
          code={`import type {
  PayloadOf,
  ResultPayloadOf,
  WithResult,
  MessageOf,
  ResultOf
} from 'isolated-workers';

type MyMessages = DefineMessages<{
  compute: {
    payload: { x: number; y: number };
    result: { sum: number };
  };
  notify: { payload: { message: string } };
}>;

// Extract payload type
type ComputePayload = PayloadOf<MyMessages, 'compute'>;
// { x: number; y: number }

// Extract result type
type ComputeResult = ResultPayloadOf<MyMessages, 'compute'>;
// { sum: number }

// Get messages that have results
type MessagesWithResults = WithResult<MyMessages>;
// 'compute'

// Full message type (including tx field)
type ComputeMessage = MessageOf<MyMessages, 'compute'>;
// { tx: string; type: 'compute'; payload: { x: number; y: number } }

// Full result type
type ComputeResultMessage = ResultOf<MyMessages, 'compute'>;
// { tx: string; type: 'computeResult'; payload: { sum: number } }`}
          filename="helpers.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Generic Message Patterns
        </h2>
        <p className="text-gray-400 mb-4">
          Create reusable message patterns with generics:
        </p>

        <CodeBlock
          code={`// Generic CRUD pattern
type CrudMessages<T> = DefineMessages<{
  create: {
    payload: { data: T };
    result: { id: string };
  };
  read: {
    payload: { id: string };
    result: { data: T | null };
  };
  update: {
    payload: { id: string; data: Partial<T> };
    result: { success: boolean };
  };
  delete: {
    payload: { id: string };
    result: { success: boolean };
  };
}>;

// Use for specific entities
interface User {
  name: string;
  email: string;
}

type UserCrud = CrudMessages<User>;

// UserCrud.create.payload is { data: User }
// UserCrud.read.payload is { id: string }
// UserCrud.update.payload is { id: string; data: Partial<User> }`}
          filename="generics.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Message Naming Conventions
        </h2>
        <p className="text-gray-400 mb-4">
          Follow these conventions for clear message contracts:
        </p>

        <CodeBlock
          code={`// Good: Clear, descriptive names
type GoodMessages = DefineMessages<{
  fetchUserById: { payload: { userId: string }; result: User };
  updateUserProfile: { payload: { userId: string; updates: Partial<User> }; result: User };
  deleteUserAccount: { payload: { userId: string }; result: { success: boolean } };
}>;

// Avoid: Vague names
type BadMessages = DefineMessages<{
  get: { payload: any; result: any };
  set: { payload: any; result: any };
  do: { payload: any; result: any };
}>;`}
          filename="naming.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Sharing Message Types
        </h2>
        <p className="text-gray-400 mb-4">
          Define messages in a shared file for both host and worker:
        </p>

        <CodeBlock
          code={`// src/messages.ts - Shared file
import type { DefineMessages } from 'isolated-workers';

export type AppMessages = DefineMessages<{
  // ... message definitions
}>;

// src/worker.ts
import { startWorkerServer } from 'isolated-workers';
import type { AppMessages } from './messages';

export default await startWorkerServer<AppMessages>({
  // ... handlers
});

// src/host.ts
import { createWorker } from 'isolated-workers';
import type { AppMessages } from './messages';

const worker = await createWorker<AppMessages>({
  script: './worker.js',
});`}
          filename="sharing.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Advanced Patterns
        </h2>
        <p className="text-gray-400 mb-4">
          Use utility types for advanced message patterns:
        </p>

        <CodeBlock
          code={`// Messages that return void
type VoidResultMessages = DefineMessages<{
  notify: { payload: { message: string } };  // No result
  ping: { payload: void; result: { pong: boolean } };  // Has result
}>;

// Extract only one-way messages
type OneWayMessages = {
  [K in keyof VoidResultMessages as VoidResultMessages[K] extends { result: unknown }
    ? never
    : K]: VoidResultMessages[K];
};

// OneWayMessages = { notify: { payload: { message: string } } }`}
          filename="advanced.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">See Also</h2>
        <ul className="list-disc list-inside text-gray-400 space-y-2">
          <li>
            <a href="/api/handlers" className="text-neon-cyan hover:underline">
              Handlers
            </a>{' '}
            - Handler type definitions
          </li>
          <li>
            <a
              href="/api/create-worker"
              className="text-neon-cyan hover:underline"
            >
              createWorker()
            </a>{' '}
            - Host-side worker creation
          </li>
          <li>
            <a
              href="/guides/type-safety"
              className="text-neon-cyan hover:underline"
            >
              Type Safety Guide
            </a>{' '}
            - Deep dive on types
          </li>
        </ul>
      </section>
    </div>
  );
}
