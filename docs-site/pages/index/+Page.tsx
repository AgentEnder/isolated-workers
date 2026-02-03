import { CodePreview } from '../../components/CodePreview';
import { FeatureCard } from '../../components/FeatureCard';
import { Link } from '../../components/Link';

export default function Page() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-5 xl:py-15 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img
              src="/assets/logo.svg"
              alt="Isolated Workers Logo"
              className="w-24 h-24 md:w-32 md:h-32"
            />
          </div>

          {/* Hero heading - Package name */}
          <h1 className="text-6xl md:text-7xl font-bold mb-4 tracking-tight text-gray-100 heading-glow">
            Isolated Workers
          </h1>

          {/* Subtitle - Type safety emphasis */}
          <p className="text-2xl md:text-3xl font-semibold mb-6">
            <span className="bg-linear-to-r from-neon-cyan via-neon-purple to-neon-mint bg-clip-text text-transparent animate-gradient-x bg-size-[200%_auto] neon-flicker-slow">
              Type-Safe Worker Processes
            </span>
          </p>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-gray-400 mb-8 max-w-3xl mx-auto leading-relaxed">
            Build isolated worker processes with end-to-end type safety.
            <br />
            <span className="text-neon-cyan/80 neon-flicker-alt neon-flicker-delay-2">
              Message contracts, not callbacks.
            </span>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link
              href="/docs/getting-started"
              className="
                px-8 py-3 rounded-lg font-semibold
                bg-linear-to-r from-neon-cyan to-neon-purple
                text-primary hover:shadow-neon-lg transition-all duration-300
                transform hover:scale-105 btn-shine
              "
            >
              Get Started
            </Link>
            <Link
              href="/examples"
              className="
                px-8 py-3 rounded-lg font-semibold
                border border-neon-cyan/50 text-neon-cyan
                hover:bg-neon-cyan/10 hover:shadow-neon-sm transition-all duration-300
                hover:border-neon-cyan
              "
            >
              View Examples
            </Link>
          </div>

          {/* Quick code preview */}
          <div className="text-left max-w-2xl mx-auto">
            <CodePreview />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-100 heading-glow">
            Why isolated-workers?
          </h2>
          <p className="text-center text-gray-500 mb-16 max-w-2xl mx-auto">
            A modern approach to worker processes with the developer experience
            you deserve.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              title="End-to-End Type Safety"
              description="Define message contracts once and get full type inference on both host and worker sides."
            />
            <FeatureCard
              icon={
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              }
              title="True Process Isolation"
              description="Each worker runs in its own process with proper isolation and crash recovery."
            />
            <FeatureCard
              icon={
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              title="Request/Response Pattern"
              description="Simple async/await interface with automatic message correlation and timeout handling."
            />
            <FeatureCard
              icon={
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                  />
                </svg>
              }
              title="Custom Serialization"
              description="Bring your own serializer. Built-in support for JSON, msgpack, and more."
            />
            <FeatureCard
              icon={
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              }
              title="TypeScript First"
              description="Built from the ground up with TypeScript. No runtime type checking required."
            />
            <FeatureCard
              icon={
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
              }
              title="Zero Dependencies"
              description="Lightweight core with no external dependencies. Just pure TypeScript."
            />
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="relative py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-8 rounded-2xl bg-linear-to-br from-tertiary/50 to-secondary/50 border border-neon-cyan/20 shadow-neon card-brackets">
            <h2 className="text-2xl font-bold mb-4 text-gray-100 heading-glow">
              Ready to dive in?
            </h2>
            <p className="text-gray-400 mb-6">
              Explore our examples to see isolated-workers in action, or jump
              straight into the documentation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/examples/basic-ping"
                className="
                  px-6 py-2 rounded-lg font-medium
                  bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50
                  hover:bg-neon-cyan/30 hover:shadow-neon-sm transition-all
                  btn-shine
                "
              >
                See Example
              </Link>
              <Link
                href="/api"
                className="
                  px-6 py-2 rounded-lg font-medium
                  bg-neon-purple/20 text-neon-purple border border-neon-purple/50
                  hover:bg-neon-purple/30 hover:shadow-neon-sm transition-all
                  btn-shine
                "
              >
                API Reference
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
