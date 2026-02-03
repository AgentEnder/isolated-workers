import { useData } from 'vike-react/useData';
import { Link } from '../../components/Link';
import { SegmentList } from '../../components/SegmentRenderer';
import type { DocsData } from './+data';

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

      {/* Content segments */}
      <div className="prose prose-invert max-w-none space-y-8">
        <SegmentList segments={segments} />
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
