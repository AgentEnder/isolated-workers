/// <reference types="vike-plugin-typedoc/config" />
import type { LinkedApiExport } from 'vike-plugin-typedoc'
import type { PageContextServer } from 'vike/types'

export interface ApiDataLanding {
  type: 'landing'
  packageSlugs: string[]
}

export interface ApiDataExport {
  type: 'export'
  export: LinkedApiExport
}

export type ApiData = ApiDataLanding | ApiDataExport | { type: 'not-found' }

export async function data(pageContext: PageContextServer): Promise<ApiData> {
  const typedoc = pageContext.globalContext.$$VIKE_PLUGIN_TYPEDOC$$
  if (!typedoc) return { type: 'not-found' }

  const parts = pageContext.urlPathname.split('/').filter(Boolean)
  // parts[0] = 'api', parts[1] = packageSlug?, parts[2] = symbolSlug?
  const packageSlug = parts[1]
  const symbolSlug = parts[2]

  if (!packageSlug) {
    return {
      type: 'landing',
      packageSlugs: Object.keys(typedoc.apiDocs.packages),
    }
  }

  if (!symbolSlug) {
    const pkg = typedoc.getPackage(packageSlug)
    if (!pkg) return { type: 'not-found' }
    return {
      type: 'landing',
      packageSlugs: pkg.exports.map((e) => e.slug),
    }
  }

  const linked = typedoc.getLinkedExport(packageSlug, symbolSlug)
  if (!linked) return { type: 'not-found' }

  return { type: 'export', export: linked }
}
