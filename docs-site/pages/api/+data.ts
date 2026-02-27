/// <reference types="vike-plugin-typedoc/config" />
import type { LinkedApiExport } from 'vike-plugin-typedoc';
import type { PageContextServer } from 'vike/types';

export interface ApiDataLanding {
  type: 'landing';
  packageSlugs: string[];
}

export interface ApiDataExport {
  type: 'export';
  export: LinkedApiExport;
}

export type ApiData = ApiDataLanding | ApiDataExport | { type: 'not-found' };

export async function data(pageContext: PageContextServer): Promise<ApiData> {
  const typedoc = pageContext.globalContext.$$VIKE_PLUGIN_TYPEDOC$$;
  if (!typedoc) return { type: 'not-found' };

  const parts = pageContext.urlPathname.split('/').filter(Boolean);
  // parts[0] = 'api', parts[1] = packageSlug?, parts[2] = symbolSlug?
  // We only have one package right now.
  // const packageSlug = parts[1]
  const symbolSlug = parts[1];

  if (!symbolSlug) {
    const pkg = typedoc.getPackage('api');
    if (!pkg) return { type: 'not-found' };
    return {
      type: 'landing',
      packageSlugs: pkg.exports.map((e) => e.slug),
    };
  }

  const linked = typedoc.getLinkedExport('api', symbolSlug);
  if (!linked) return { type: 'not-found' };

  return { type: 'export', export: linked };
}
