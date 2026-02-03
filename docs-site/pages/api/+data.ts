import type { PageContextServer } from 'vike/types';
import type { ApiDocs, ApiExport } from '../../server/utils/typedoc';

export interface ApiDataLanding {
  type: 'landing';
  api: ApiDocs;
}

export interface ApiDataExport {
  type: 'export';
  export: ApiExport;
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

  return {
    type: 'export',
    export: exp,
  };
}
