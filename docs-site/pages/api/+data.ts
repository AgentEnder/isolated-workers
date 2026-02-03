import type { PageContextServer } from 'vike/types';
import type { ApiDocs, ApiExport } from '../../server/utils/typedoc';

export interface ApiDataLanding {
  type: 'landing';
  api: ApiDocs;
}

export interface ApiDataExport {
  type: 'export';
  export: ApiExport;
  /** Map of export names to their paths for linking types */
  knownExports: Record<string, string>;
}

export type ApiData =
  | ApiDataLanding
  | ApiDataExport
  | { type: 'not-found' };

export async function data(pageContext: PageContextServer): Promise<ApiData> {
  const { api } = pageContext.globalContext;
  const { urlPathname } = pageContext;

  // Parse URL: /api or /api/:export
  const parts = urlPathname.split('/').filter(Boolean);
  // parts[0] = 'api', parts[1] = export?

  const exportSlug = parts[1];

  // Landing page: /api - show all exports grouped by category
  if (!exportSlug) {
    return {
      type: 'landing',
      api,
    };
  }

  // Export page: /api/:export
  const exp = api.exports[exportSlug];
  if (!exp) {
    return { type: 'not-found' };
  }

  // Build map of export names to paths for type linking
  const knownExports: Record<string, string> = {};
  for (const e of api.allExports) {
    knownExports[e.name] = e.path;
  }

  return {
    type: 'export',
    export: exp,
    knownExports,
  };
}
