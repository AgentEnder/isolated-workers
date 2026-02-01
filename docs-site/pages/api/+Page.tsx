export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">API Reference</h1>
      <p className="text-lg text-gray-400 mb-8">
        Complete API documentation for isolated-workers.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <a
          href="/api/create-worker"
          className="p-6 rounded-xl bg-secondary/50 border border-tertiary/50 hover:border-neon-cyan/50 transition-all hover:shadow-neon-sm"
        >
          <code className="text-neon-mint text-sm">createWorker()</code>
          <h3 className="text-xl font-semibold text-gray-100 mt-2 mb-2">
            Worker Client
          </h3>
          <p className="text-gray-400">
            Spawn a worker process with type-safe messaging.
          </p>
        </a>
        <a
          href="/api/start-worker-server"
          className="p-6 rounded-xl bg-secondary/50 border border-tertiary/50 hover:border-neon-cyan/50 transition-all hover:shadow-neon-sm"
        >
          <code className="text-neon-mint text-sm">startWorkerServer()</code>
          <h3 className="text-xl font-semibold text-gray-100 mt-2 mb-2">
            Worker Server
          </h3>
          <p className="text-gray-400">
            Start a server to handle incoming messages in a worker.
          </p>
        </a>
        <a
          href="/api/handlers"
          className="p-6 rounded-xl bg-secondary/50 border border-tertiary/50 hover:border-neon-cyan/50 transition-all hover:shadow-neon-sm"
        >
          <code className="text-neon-mint text-sm">Handlers</code>
          <h3 className="text-xl font-semibold text-gray-100 mt-2 mb-2">
            Handler Type
          </h3>
          <p className="text-gray-400">
            Type-safe message handler definitions.
          </p>
        </a>
        <a
          href="/api/define-messages"
          className="p-6 rounded-xl bg-secondary/50 border border-tertiary/50 hover:border-neon-cyan/50 transition-all hover:shadow-neon-sm"
        >
          <code className="text-neon-mint text-sm">DefineMessages</code>
          <h3 className="text-xl font-semibold text-gray-100 mt-2 mb-2">
            Message Types
          </h3>
          <p className="text-gray-400">
            Define message contracts with full type safety.
          </p>
        </a>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Utility Types
        </h2>
        <p className="text-gray-400 mb-4">
          Additional type utilities for working with messages:
        </p>
        <ul className="list-disc list-inside text-gray-400 space-y-2">
          <li>
            <code className="text-neon-mint text-sm">PayloadOf</code> - Extract
            payload type from a message
          </li>
          <li>
            <code className="text-neon-mint text-sm">ResultPayloadOf</code> -
            Extract result type from a message
          </li>
          <li>
            <code className="text-neon-mint text-sm">WithResult</code> - Get
            messages that have results
          </li>
          <li>
            <code className="text-neon-mint text-sm">AnyMessage</code> - Union
            of all message types
          </li>
          <li>
            <code className="text-neon-mint text-sm">Middleware</code> -
            Middleware function type
          </li>
        </ul>
      </section>
    </div>
  );
}
