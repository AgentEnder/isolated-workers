import { CodeBlock } from '../../../components/CodeBlock';
import { Link } from '../../../components/Link';
import { TypeReference } from '../../../components/TypeReference';
import type { ApiExport } from '../../../server/utils/typedoc';

interface ApiExportPageProps {
  mod: ApiExport;
}

function slugifyCategory(category: string): string {
  return category.toLowerCase().replace(/\s+/g, '-');
}

export function ApiExportPage({ mod: mod }: ApiExportPageProps) {
  const categorySlug = mod.category ? slugifyCategory(mod.category) : null;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/api" className="hover:text-neon-cyan">
          API Reference
        </Link>
        {mod.category && (
          <>
            <span>/</span>
            <Link
              href={`/api#${categorySlug}`}
              className="hover:text-neon-cyan"
            >
              {mod.category}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-gray-100">{mod.name}</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs px-2 py-1 rounded bg-neon-cyan/20 text-neon-cyan uppercase font-semibold">
            {mod.kind}
          </span>
          {mod.comment?.deprecated && (
            <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 uppercase font-semibold">
              Deprecated
            </span>
          )}
        </div>
        <h1 className="text-4xl font-bold text-gray-100 font-mono">
          {mod.name}
        </h1>
        {/* Add type reference link if typedoc data available */}
        {mod.path && (
          <div className="ml-2">
            <TypeReference export={mod} />
          </div>
        )}
      </div>

      {/* Signature */}
      {mod.signature && (
        <div className="mb-8">
          <CodeBlock code={mod.signature} language="typescript" />
        </div>
      )}

      {/* Description */}
      {mod.description && (
        <div className="mb-8">
          <p className="text-gray-300 text-lg">{mod.description}</p>
        </div>
      )}

      {/* Deprecation Warning */}
      {mod.comment?.deprecated && (
        <div className="mb-8 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-red-400">
            <strong>Deprecated:</strong> {mod.comment.deprecated}
          </p>
        </div>
      )}

      {/* Parameters */}
      {mod.parameters && mod.parameters.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">
            Parameters
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-tertiary">
                  <th className="py-2 pr-4 text-gray-400 font-medium">Name</th>
                  <th className="py-2 pr-4 text-gray-400 font-medium">Type</th>
                  <th className="py-2 text-gray-400 font-medium">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {mod.parameters.map((param) => (
                  <tr key={param.name} className="border-b border-tertiary/50">
                    <td className="py-3 pr-4 font-mono text-neon-cyan">
                      {param.name}
                      {param.optional && (
                        <span className="text-gray-500">?</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-gray-300">
                      {param.type}
                    </td>
                    <td className="py-3 text-gray-400">
                      {param.description || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Return Type */}
      {mod.returnType && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Returns</h2>
          <p className="font-mono text-gray-300">{mod.returnType}</p>
        </div>
      )}

      {/* Properties */}
      {mod.properties && mod.properties.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">
            Properties
          </h2>
          <div className="space-y-4">
            {mod.properties.map((prop) => (
              <div
                key={prop.name}
                className="p-4 rounded-lg bg-tertiary/30 border border-tertiary/50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-neon-cyan">{prop.name}</span>
                  {prop.optional && (
                    <span className="text-xs text-gray-500">(optional)</span>
                  )}
                  {prop.readonly && (
                    <span className="text-xs text-gray-500">(readonly)</span>
                  )}
                </div>
                <p className="font-mono text-sm text-gray-400 mb-2">
                  {prop.type}
                </p>
                {prop.description && (
                  <p className="text-gray-300 text-sm">{prop.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remarks */}
      {mod.comment?.remarks && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Remarks</h2>
          <p className="text-gray-300">{mod.comment.remarks}</p>
        </div>
      )}

      {/* Examples */}
      {mod.comment?.examples && mod.comment.examples.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Examples</h2>
          <div className="space-y-4">
            {mod.comment.examples.map((example, i) => (
              <CodeBlock key={i} code={example} language="typescript" />
            ))}
          </div>
        </div>
      )}

      {/* See Also */}
      {mod.comment?.see && mod.comment.see.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">See Also</h2>
          <ul className="list-disc list-inside text-gray-300">
            {mod.comment.see.map((ref, i) => (
              <li key={i}>{ref}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-12 pt-8 border-t border-tertiary/50">
        <Link
          href={mod.path}
          className="text-neon-cyan hover:text-neon-purple transition-colors"
        >
          &larr; Back to {mod.name.charAt(0).toUpperCase() + mod.name.slice(1)}
        </Link>
      </div>
    </div>
  );
}
