import { useRef } from 'react';
import { useData } from 'vike-react/useData';
import { useCodeCopyHydration } from '../../../components/CodeCopyHydration';
import { Link } from '../../../components/Link';
import type { ExampleData } from './+data';

export default function Page() {
  const { example, renderedHtml } = useData<ExampleData>();
  const contentRef = useRef<HTMLDivElement>(null);
  useCodeCopyHydration(contentRef);

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
      {example.description && (
        <p className="text-lg text-gray-400 mb-8">{example.description}</p>
      )}

      {/* Rendered content */}
      <div
        ref={contentRef}
        className="docs-prose prose prose-invert text-sm max-w-none space-y-8"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

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
