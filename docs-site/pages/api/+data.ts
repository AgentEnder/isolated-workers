import type { PageContextServer } from 'vike/types';
import type { ApiExport, ApiModule } from '../../server/utils/typedoc';

export type ApiPageType = 'landing' | 'module' | 'export';

export interface ApiDataLanding {
  type: 'landing';
  modules: ApiModule[];
}

export interface ApiDataModule {
  type: 'module';
  module: ApiModule;
}

export interface ApiDataExport {
  type: 'export';
  export: ApiExport;
  module: ApiModule;
}

export type ApiData =
  | ApiDataLanding
  | ApiDataModule
  | ApiDataExport
  | { type: 'not-found' };

export async function data(pageContext: PageContextServer): Promise<ApiData> {
  const { api } = pageContext.globalContext;
  const { urlPathname } = pageContext;

  // Parse URL: /api, /api/:module, /api/:module/:export
  const parts = urlPathname.split('/').filter(Boolean);
  // parts[0] = 'api', parts[1] = module?, parts[2] = export?

  const moduleSlug = parts[1];
  const exportSlug = parts[2];

  // Landing page: /api
  if (!moduleSlug) {
    return {
      type: 'landing',
      modules: Object.values(api.modules).sort((a, b) => {
        if (a.slug === 'core') return -1;
        if (b.slug === 'core') return 1;
        return a.name.localeCompare(b.name);
      }),
    };
  }

  const module = api.modules[moduleSlug];
  if (!module) {
    return { type: 'not-found' };
  }

  // Module page: /api/:module
  if (!exportSlug) {
    return {
      type: 'module',
      module,
    };
  }

  // Export page: /api/:module/:export
  const exp = api.exports[`${moduleSlug}/${exportSlug}`];
  if (!exp) {
    return { type: 'not-found' };
  }

  return {
    type: 'export',
    export: exp,
    module,
  };
}
