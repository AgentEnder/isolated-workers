export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">Guides</h1>
      <p className="text-lg text-gray-400 mb-8">
        Deep dives into specific topics and advanced patterns.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <a
          href="/guides/type-safety"
          className="p-6 rounded-xl bg-secondary/50 border border-tertiary/50 hover:border-neon-cyan/50 transition-all hover:shadow-neon-sm"
        >
          <h3 className="text-xl font-semibold text-neon-cyan mb-2">
            Type Safety
          </h3>
          <p className="text-gray-400">
            Understanding the DefineMessages type system and how it provides
            end-to-end type safety.
          </p>
        </a>
        <a
          href="/guides/error-handling"
          className="p-6 rounded-xl bg-secondary/50 border border-tertiary/50 hover:border-neon-cyan/50 transition-all hover:shadow-neon-sm"
        >
          <h3 className="text-xl font-semibold text-neon-cyan mb-2">
            Error Handling
          </h3>
          <p className="text-gray-400">
            Best practices for handling errors across process boundaries and
            timeouts.
          </p>
        </a>
        <a
          href="/guides/best-practices"
          className="p-6 rounded-xl bg-secondary/50 border border-tertiary/50 hover:border-neon-cyan/50 transition-all hover:shadow-neon-sm"
        >
          <h3 className="text-xl font-semibold text-neon-cyan mb-2">
            Best Practices
          </h3>
          <p className="text-gray-400">
            Production-ready patterns for worker lifecycle, serialization, and
            monitoring.
          </p>
        </a>
      </div>
    </div>
  );
}
