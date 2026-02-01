import { CodeBlock } from '../../../components/CodeBlock';

export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">Installation</h1>
      <p className="text-lg text-gray-400 mb-8">
        Install isolated-workers using your favorite package manager.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Package Managers
        </h2>
        <p className="text-gray-400 mb-4">
          isolated-workers is available on npm and can be installed with any
          popular package manager.
        </p>

        <CodeBlock
          code={`# npm
npm install isolated-workers

# yarn
yarn add isolated-workers

# pnpm
pnpm add isolated-workers

# bun
bun add isolated-workers`}
          language="bash"
          filename="Terminal"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          TypeScript Requirements
        </h2>
        <p className="text-gray-400 mb-4">
          isolated-workers is built with TypeScript and requires TypeScript 5.0
          or later for full type safety. Ensure your tsconfig.json has the
          following settings:
        </p>

        <CodeBlock
          code={`{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}`}
          filename="tsconfig.json"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Requirements
        </h2>
        <ul className="list-disc list-inside text-gray-400 space-y-2">
          <li>Node.js 18.0 or later</li>
          <li>TypeScript 5.0 or later (recommended but not required)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Next Steps
        </h2>
        <p className="text-gray-400 mb-4">
          Once installed, continue to the{' '}
          <a
            href="/getting-started/quick-start"
            className="text-neon-cyan hover:underline"
          >
            Quick Start
          </a>{' '}
          guide to create your first worker.
        </p>
      </section>
    </div>
  );
}
