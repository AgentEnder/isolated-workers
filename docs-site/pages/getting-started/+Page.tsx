export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">Getting Started</h1>
      <p className="text-lg text-gray-400 mb-8">
        Get up and running with isolated-workers in minutes.
      </p>

      <div className="grid gap-6 md:grid-cols-3">
        <a
          href="/getting-started/installation"
          className="p-6 rounded-xl bg-secondary/50 border border-tertiary/50 hover:border-neon-cyan/50 transition-all hover:shadow-neon-sm"
        >
          <h3 className="text-xl font-semibold text-neon-cyan mb-2">
            1. Installation
          </h3>
          <p className="text-gray-400">
            Install isolated-workers via npm, yarn, or pnpm.
          </p>
        </a>
        <a
          href="/getting-started/quick-start"
          className="p-6 rounded-xl bg-secondary/50 border border-tertiary/50 hover:border-neon-cyan/50 transition-all hover:shadow-neon-sm"
        >
          <h3 className="text-xl font-semibold text-neon-cyan mb-2">
            2. Quick Start
          </h3>
          <p className="text-gray-400">
            Create your first worker in under 5 minutes.
          </p>
        </a>
        <a
          href="/getting-started/first-worker"
          className="p-6 rounded-xl bg-secondary/50 border border-tertiary/50 hover:border-neon-cyan/50 transition-all hover:shadow-neon-sm"
        >
          <h3 className="text-xl font-semibold text-neon-cyan mb-2">
            3. First Worker
          </h3>
          <p className="text-gray-400">
            Build a complete worker with type-safe messaging.
          </p>
        </a>
      </div>
    </div>
  );
}
