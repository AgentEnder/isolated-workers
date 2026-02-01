import { useData } from 'vike-react/useData';
import { CodeBlock } from '../../components/CodeBlock';
import { Link } from '../../components/Link';
import type { DocsData, ContentSegment } from './+data';

export default function Page() {
  const { doc, segments } = useData<DocsData>();

  if (!doc) {
    return (
      <div className="text-center py-20">
        <h1 className="text-4xl font-bold text-gray-100 mb-4">
          Page Not Found
        </h1>
        <p className="text-gray-400 mb-8">
          The documentation page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="px-6 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-neon-cyan">
          Home
        </Link>
        <span>/</span>
        <span className="text-gray-100">{doc.title}</span>
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold mb-4 text-gray-100">{doc.title}</h1>

      {/* Description */}
      {doc.description && (
        <p className="text-lg text-gray-400 mb-8">{doc.description}</p>
      )}

      {/* Content segments */}
      <div className="prose prose-invert max-w-none space-y-8">
        {segments.map((segment, index) => (
          <SegmentRenderer key={index} segment={segment} />
        ))}
      </div>

      {/* Navigation */}
      <div className="mt-12 pt-8 border-t border-tertiary/50">
        <Link
          href="/"
          className="text-neon-cyan hover:text-neon-purple transition-colors"
        >
          &larr; Back to Home
        </Link>
      </div>
    </div>
  );
}

/**
 * Render a single content segment - HTML text, code file, or example link
 */
function SegmentRenderer({ segment }: { segment: ContentSegment }) {
  if (segment.type === 'html') {
    return (
      <div
        className="docs-prose"
        dangerouslySetInnerHTML={{ __html: segment.html }}
      />
    );
  }

  if (segment.type === 'file') {
    // File segment - render CodeBlock with pre-highlighted HTML
    return (
      <CodeBlock
        code={segment.content}
        language={segment.language}
        filename={segment.filename}
        preHighlightedHtml={segment.highlightedHtml}
      />
    );
  }

  // Example link segment - styled card linking to the example
  return (
    <Link
      href={`/examples/${segment.exampleId}`}
      className="block p-6 rounded-xl bg-tertiary/50 border border-tertiary/50 hover:border-neon-cyan/50 transition-all group"
    >
      <div className="flex items-center gap-3 mb-2">
        <svg
          className="w-5 h-5 text-neon-cyan"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
        <span className="text-lg font-semibold text-gray-100 group-hover:text-neon-cyan transition-colors">
          {segment.title}
        </span>
      </div>
      <p className="text-gray-400 text-sm">{segment.description}</p>
      <div className="mt-3 text-neon-cyan text-sm flex items-center gap-1">
        View example
        <svg
          className="w-4 h-4 group-hover:translate-x-1 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </Link>
  );
}
