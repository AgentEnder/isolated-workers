import { Link } from '../../../components/Link';
import { CodeBlock } from '../../../components/CodeBlock';
import type { ApiExport, ApiModule } from '../../../server/utils/typedoc';

interface ApiExportPageProps {
  export: ApiExport;
  module: ApiModule;
}

export function ApiExportPage({ export: exp, module }: ApiExportPageProps) {
  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/api" className="hover:text-neon-cyan">
          API Reference
        </Link>
        <span>/</span>
        <Link href={module.path} className="hover:text-neon-cyan">
          {module.name.charAt(0).toUpperCase() + module.name.slice(1)}
        </Link>
        <span>/</span>
        <span className="text-gray-100">{exp.name}</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs px-2 py-1 rounded bg-neon-cyan/20 text-neon-cyan uppercase font-semibold">
            {exp.kind}
          </span>
          {exp.comment?.deprecated && (
            <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 uppercase font-semibold">
              Deprecated
            </span>
          )}
        </div>
        <h1 className="text-4xl font-bold text-gray-100 font-mono">
          {exp.name}
        </h1>
      </div>

      {/* Signature */}
      {exp.signature && (
        <div className="mb-8">
          <CodeBlock code={exp.signature} language="typescript" />
        </div>
      )}

      {/* Description */}
      {exp.description && (
        <div className="mb-8">
          <p className="text-gray-300 text-lg">{exp.description}</p>
        </div>
      )}

      {/* Deprecation Warning */}
      {exp.comment?.deprecated && (
        <div className="mb-8 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-red-400">
            <strong>Deprecated:</strong> {exp.comment.deprecated}
          </p>
        </div>
      )}

      {/* Parameters */}
      {exp.parameters && exp.parameters.length > 0 && (
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
                {exp.parameters.map((param) => (
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
      {exp.returnType && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Returns</h2>
          <p className="font-mono text-gray-300">{exp.returnType}</p>
        </div>
      )}

      {/* Properties */}
      {exp.properties && exp.properties.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">
            Properties
          </h2>
          <div className="space-y-4">
            {exp.properties.map((prop) => (
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
      {exp.comment?.remarks && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Remarks</h2>
          <p className="text-gray-300">{exp.comment.remarks}</p>
        </div>
      )}

      {/* Examples */}
      {exp.comment?.examples && exp.comment.examples.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Examples</h2>
          <div className="space-y-4">
            {exp.comment.examples.map((example, i) => (
              <CodeBlock key={i} code={example} language="typescript" />
            ))}
          </div>
        </div>
      )}

      {/* See Also */}
      {exp.comment?.see && exp.comment.see.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">See Also</h2>
          <ul className="list-disc list-inside text-gray-300">
            {exp.comment.see.map((ref, i) => (
              <li key={i}>{ref}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-12 pt-8 border-t border-tertiary/50">
        <Link
          href={module.path}
          className="text-neon-cyan hover:text-neon-purple transition-colors"
        >
          &larr; Back to{' '}
          {module.name.charAt(0).toUpperCase() + module.name.slice(1)}
        </Link>
      </div>
    </div>
  );
}
