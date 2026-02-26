import { Link } from '../../../components/Link'

interface ApiLandingProps {
  packageSlugs: string[]
}

export function ApiLanding({ packageSlugs }: ApiLandingProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-100 mb-4">API Reference</h1>
        <p className="text-gray-400 text-lg">
          Type-safe worker process library for Node.js. Define your message
          contracts with TypeScript and get full type inference for payloads and
          responses.
        </p>
      </div>

      {/* Package list */}
      <div className="space-y-2">
        {packageSlugs.map((slug) => (
          <Link
            key={slug}
            href={`/api/${slug}`}
            className="flex items-center gap-3 p-3 rounded-lg bg-tertiary/30 hover:bg-tertiary/50 border border-transparent hover:border-neon-cyan/30 transition-all group"
          >
            <span className="font-mono text-gray-100 group-hover:text-neon-cyan transition-colors">
              {slug}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
