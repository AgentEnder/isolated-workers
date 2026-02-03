import { Link } from '../../../components/Link';
import type {
  ApiDocs,
  ApiExport,
  ApiExportKind,
} from '../../../server/utils/typedoc';

interface ApiLandingProps {
  api: ApiDocs;
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

const KIND_ORDER: ApiExportKind[] = [
  'function',
  'class',
  'interface',
  'type',
  'enum',
  'variable',
];

// Category display order (lower = first)
const CATEGORY_ORDER: Record<string, number> = {
  Core: 0,
  Types: 10,
  Configuration: 20,
  Serialization: 30,
  Drivers: 40,
  Advanced: 50,
};

function slugifyCategory(category: string): string {
  return category.toLowerCase().replace(/\s+/g, '-');
}

function pluralizeKind(kind: ApiExportKind): string {
  if (kind === 'type') return 'Types';
  if (kind === 'class') return 'Classes';
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}s`;
}

interface GroupedByKind {
  kind: ApiExportKind;
  exports: ApiExport[];
}

interface CategoryGroup {
  category: string;
  slug: string;
  byKind: GroupedByKind[];
  totalExports: number;
}

function groupExports(exports: ApiExport[]): CategoryGroup[] {
  // First, group by category
  const byCategory = new Map<string, ApiExport[]>();

  for (const exp of exports) {
    const cat = exp.category || 'Other';
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
    }
    byCategory.get(cat)!.push(exp);
  }

  // Sort categories by defined order (unknowns go last)
  const sortedCategories = Array.from(byCategory.keys()).sort((a, b) => {
    const orderA = CATEGORY_ORDER[a] ?? 999;
    const orderB = CATEGORY_ORDER[b] ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  // For each category, group by kind
  const result: CategoryGroup[] = [];

  for (const category of sortedCategories) {
    const categoryExports = byCategory.get(category)!;

    // Group by kind
    const byKind = new Map<ApiExportKind, ApiExport[]>();
    for (const exp of categoryExports) {
      if (!byKind.has(exp.kind)) {
        byKind.set(exp.kind, []);
      }
      byKind.get(exp.kind)!.push(exp);
    }

    // Sort kinds by defined order
    const sortedKinds: GroupedByKind[] = KIND_ORDER.filter((kind) =>
      byKind.has(kind)
    ).map((kind) => ({
      kind,
      exports: byKind.get(kind)!.sort((a, b) => a.name.localeCompare(b.name)),
    }));

    result.push({
      category,
      slug: slugifyCategory(category),
      byKind: sortedKinds,
      totalExports: categoryExports.length,
    });
  }

  return result;
}

function ExportLink({ exp }: { exp: ApiExport }) {
  return (
    <Link
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
        <span className="text-gray-500 text-sm truncate flex-1">
          - {exp.description}
        </span>
      )}
    </Link>
  );
}

export function ApiLanding({ api }: ApiLandingProps) {
  const grouped = groupExports(api.allExports);

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

      {/* Table of Contents */}
      <div className="mb-10 p-6 rounded-xl bg-tertiary/30 border border-tertiary/50">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Categories</h2>
        <div className="flex flex-wrap gap-3">
          {grouped.map(({ category, slug, totalExports }) => (
            <a
              key={slug}
              href={`#${slug}`}
              className="px-4 py-2 rounded-lg bg-secondary/50 hover:bg-secondary/70 border border-tertiary/50 hover:border-neon-cyan/30 transition-all group"
            >
              <span className="text-gray-100 group-hover:text-neon-cyan transition-colors font-medium">
                {category}
              </span>
              <span className="ml-2 text-gray-500 text-sm">
                ({totalExports})
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* Grouped Exports */}
      <div className="space-y-12">
        {grouped.map(({ category, slug, byKind }) => (
          <section key={slug} id={slug} className="scroll-mt-24">
            {/* Category Header */}
            <h2 className="text-2xl font-bold text-gray-100 mb-6 pb-2 border-b border-tertiary/50">
              {category}
            </h2>

            {/* Kind Groups within Category */}
            <div className="space-y-6">
              {byKind.map(({ kind, exports }) => (
                <div key={kind}>
                  <h3 className="text-lg font-semibold text-gray-300 mb-4">
                    {pluralizeKind(kind)}
                  </h3>
                  <div className="space-y-2">
                    {exports.map((exp) => (
                      <ExportLink key={exp.name} exp={exp} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
