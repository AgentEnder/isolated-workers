import { Link } from '../../../components/Link';
import type { ApiModule } from '../../../server/utils/typedoc';

interface ApiLandingProps {
  modules: ApiModule[];
}

export function ApiLanding({ modules }: ApiLandingProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-100 mb-4">API Reference</h1>
        <p className="text-gray-400 text-lg">
          Complete API documentation for the isolated-workers library.
        </p>
      </div>

      {/* Module Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <Link
            key={mod.slug}
            href={mod.path}
            className="block p-6 rounded-xl bg-tertiary/50 border border-tertiary/50 hover:border-neon-cyan/50 transition-all group"
          >
            <h2 className="text-xl font-semibold text-gray-100 group-hover:text-neon-cyan transition-colors mb-2">
              {mod.name.charAt(0).toUpperCase() + mod.name.slice(1)}
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              {mod.description || `${mod.exports.length} exports`}
            </p>
            <div className="flex flex-wrap gap-2">
              {mod.exports.slice(0, 5).map((exp) => (
                <span
                  key={exp.name}
                  className="text-xs px-2 py-1 rounded bg-secondary/50 text-gray-300"
                >
                  {exp.name}
                </span>
              ))}
              {mod.exports.length > 5 && (
                <span className="text-xs px-2 py-1 rounded bg-secondary/50 text-gray-400">
                  +{mod.exports.length - 5} more
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
