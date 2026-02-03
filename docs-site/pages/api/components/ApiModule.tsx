import { Link } from '../../../components/Link';
import type { ApiModule, ApiExportKind } from '../../../server/utils/typedoc';

interface ApiModulePageProps {
  module: ApiModule;
}

const KIND_ICONS: Record<ApiExportKind, string> = {
  function: 'f',
  type: 'T',
  interface: 'I',
  class: 'C',
  variable: 'V',
  enum: 'E',
};

const KIND_COLORS: Record<ApiExportKind, string> = {
  function: 'text-neon-cyan',
  type: 'text-neon-purple',
  interface: 'text-neon-green',
  class: 'text-neon-orange',
  variable: 'text-neon-yellow',
  enum: 'text-neon-pink',
};

export function ApiModulePage({ module }: ApiModulePageProps) {
  // Group exports by kind
  const grouped = module.exports.reduce(
    (acc, exp) => {
      if (!acc[exp.kind]) acc[exp.kind] = [];
      acc[exp.kind].push(exp);
      return acc;
    },
    {} as Record<ApiExportKind, typeof module.exports>
  );

  const kindOrder: ApiExportKind[] = [
    'function',
    'class',
    'interface',
    'type',
    'enum',
    'variable',
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/api" className="hover:text-neon-cyan">
          API Reference
        </Link>
        <span>/</span>
        <span className="text-gray-100">
          {module.name.charAt(0).toUpperCase() + module.name.slice(1)}
        </span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-100 mb-4">
          {module.name.charAt(0).toUpperCase() + module.name.slice(1)}
        </h1>
        {module.description && (
          <p className="text-gray-400 text-lg">{module.description}</p>
        )}
      </div>

      {/* Grouped Exports */}
      <div className="space-y-8">
        {kindOrder.map((kind) => {
          const exports = grouped[kind];
          if (!exports || exports.length === 0) return null;

          return (
            <div key={kind}>
              <h2 className="text-lg font-semibold text-gray-200 mb-4 capitalize">
                {kind === 'type'
                  ? 'Types'
                  : kind === 'class'
                    ? 'Classes'
                    : `${kind}s`}
              </h2>
              <div className="space-y-2">
                {exports.map((exp) => (
                  <Link
                    key={exp.name}
                    href={exp.path}
                    className="flex items-center gap-3 p-3 rounded-lg bg-tertiary/30 hover:bg-tertiary/50 border border-transparent hover:border-neon-cyan/30 transition-all group"
                  >
                    <span
                      className={`w-6 h-6 flex items-center justify-center rounded text-sm font-mono font-bold ${KIND_COLORS[exp.kind]}`}
                    >
                      {KIND_ICONS[exp.kind]}
                    </span>
                    <span className="font-mono text-gray-100 group-hover:text-neon-cyan transition-colors">
                      {exp.name}
                    </span>
                    {exp.description && (
                      <span className="text-gray-500 text-sm truncate">
                        - {exp.description}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
