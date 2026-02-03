import { useData } from 'vike-react/useData';
import { Link } from '../../components/Link';
import type { ApiData } from './+data';
import { ApiExportPage } from './components/ApiExport';
import { ApiLanding } from './components/ApiLanding';

export default function Page() {
  const data = useData<ApiData>();

  if (data.type === 'not-found') {
    return (
      <div className="text-center py-20">
        <h1 className="text-4xl font-bold text-gray-100 mb-4">
          API Reference Not Found
        </h1>
        <p className="text-gray-400 mb-8">
          The API documentation page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/api"
          className="px-6 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30"
        >
          Back to API Reference
        </Link>
      </div>
    );
  }

  switch (data.type) {
    case 'landing':
      return <ApiLanding api={data.api} />;
    case 'export':
      return (
        <ApiExportPage mod={data.export} knownExports={data.knownExports} />
      );
  }
}
