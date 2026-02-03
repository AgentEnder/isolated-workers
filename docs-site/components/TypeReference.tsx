import { Link } from './Link';
import type { ApiExport } from '../server/utils/typedoc';

export interface TypeReferenceProps {
  export: ApiExport;
}

export function TypeReference({ export: apiExport }: TypeReferenceProps) {
  const { path, module, name } = apiExport;

  if (!path) {
    return <span className="text-gray-300">{name}</span>;
  }

  // Build path to type documentation
  const basePath = `/api/${module || 'core'}`;
  const exportPath = name ? `${basePath}/${name}` : basePath;

  return (
    <Link href={exportPath} className="hover:text-neon-cyan transition-colors">
      {name}
    </Link>
  );
}
