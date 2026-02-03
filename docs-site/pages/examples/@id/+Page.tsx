import { useData } from 'vike-react/useData';
import { CodeBlock } from '../../../components/CodeBlock';
import { Link } from '../../../components/Link';
import { SegmentList } from '../../../components/SegmentRenderer';
import type { ExampleData } from './+data';

export default function Page() {
  const { example, segments, files, renderedFiles } = useData<ExampleData>();

  // Files that weren't rendered inline can be shown in "All Files"
  const unrenderedFiles = files.filter(
    (f) => !renderedFiles.includes(f.filename)
  );

  if (!example) {
    return (
      <div className="text-center py-20">
        <h1 className="text-4xl font-bold text-gray-100 mb-4">
          Example Not Found
        </h1>
        <p className="text-gray-400 mb-8">
          The example you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/examples"
          className="px-6 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30"
        >
          Back to Examples
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/examples" className="hover:text-neon-cyan">
          Examples
        </Link>
        <span>/</span>
        <span className="text-gray-100">{example.title}</span>
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold mb-4 text-gray-100">{example.title}</h1>

      {/* Description */}
      <p className="text-lg text-gray-400 mb-8">{example.description}</p>

      {/* Content segments */}
      <div className="prose prose-invert max-w-none space-y-8">
        <SegmentList segments={segments} />
      </div>

      {/* Additional Files Section - files not rendered inline */}
      {unrenderedFiles.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-100 mb-6">
            Additional Files
          </h2>
          <div className="space-y-6">
            {unrenderedFiles.map((file) => (
              <CodeBlock
                key={file.filename}
                code={file.content}
                language={file.language}
                filename={file.filename}
                preHighlightedHtml={file.highlightedHtml}
              />
            ))}
          </div>
        </section>
      )}

      {/* Running Section */}
      {example.commands && example.commands.length > 0 && (
        <section className="mt-12 p-6 rounded-xl bg-tertiary/50 border border-tertiary/50">
          <h2 className="text-xl font-bold text-gray-100 mb-4">
            Running the Example
          </h2>
          {example.commands.map((cmd, index) => (
            <div key={index} className="mb-4 last:mb-0">
              <p className="text-sm text-gray-400 mb-2">{cmd.title}</p>
              <CodeBlock code={cmd.command} language="bash" />
            </div>
          ))}
        </section>
      )}

      {/* Navigation */}
      <div className="mt-12 pt-8 border-t border-tertiary/50">
        <Link
          href="/examples"
          className="text-neon-cyan hover:text-neon-purple transition-colors"
        >
          &larr; Back to Examples
        </Link>
      </div>
    </div>
  );
}
