import type { ContentSegment } from '../server/utils/segments';
import { CodeBlock } from './CodeBlock';
import { Link } from './Link';

interface SegmentRendererProps {
  segment: ContentSegment;
}

/**
 * Render a single content segment.
 * Handles HTML text, code files, inline code blocks, and example links.
 * Used by both docs and examples pages.
 */
export function SegmentRenderer({ segment }: SegmentRendererProps) {
  switch (segment.type) {
    case 'html':
      return (
        <div
          className="docs-prose"
          dangerouslySetInnerHTML={{ __html: segment.html }}
        />
      );

    case 'file':
      return (
        <CodeBlock
          code={segment.content}
          language={segment.language}
          filename={segment.filename}
          preHighlightedHtml={segment.highlightedHtml}
        />
      );

    case 'code-block':
      return (
        <CodeBlock
          code={segment.content}
          language={segment.language}
          preHighlightedHtml={segment.highlightedHtml}
        />
      );

    case 'example-link':
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
}

interface SegmentListProps {
  segments: ContentSegment[];
}

/**
 * Render a list of content segments.
 * Convenience wrapper around SegmentRenderer.
 */
export function SegmentList({ segments }: SegmentListProps) {
  return (
    <>
      {segments.map((segment, index) => (
        <SegmentRenderer key={index} segment={segment} />
      ))}
    </>
  );
}
