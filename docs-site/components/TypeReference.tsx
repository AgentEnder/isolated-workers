import { Link } from './Link'
import type { ApiExport } from 'vike-plugin-typedoc'

export interface TypeReferenceProps {
  export: ApiExport
}

export function TypeReference({ export: apiExport }: TypeReferenceProps) {
  const { path, name } = apiExport

  if (!path) {
    return <span className="text-gray-300">{name}</span>
  }

  return (
    <Link href={path} className="hover:text-neon-cyan transition-colors">
      {name}
    </Link>
  )
}
