import type { ScannedExample } from '@functional-examples/devkit'
import { scan } from 'functional-examples'
import { loadTypedocContext } from 'vike-plugin-typedoc/server'
import type { ApiExport } from 'vike-plugin-typedoc'
import type { GlobalContextServer } from 'vike/types'
import path from 'node:path'
import {
  buildDocsNavigation,
  getDocsDir,
  hydrateGuides,
  scanDocs,
  type DocMetadata,
} from '../server/utils/docs.js'
import {
  configureRehypeTypedoc,
  configureRemarkCodeProps,
} from '../server/utils/markdown.js'
import type { NavigationItem } from '../vike-types.js'

const CATEGORY_ORDER: Record<string, number> = {
  Core: 0,
  Types: 10,
  Configuration: 20,
  Serialization: 30,
  Drivers: 40,
  Advanced: 50,
}

/**
 * Build API sidebar navigation grouped by @category tag, matching production structure.
 */
function buildCategoryNavigation(allExports: ApiExport[]): NavigationItem[] {
  const byCategory = new Map<string, ApiExport[]>()
  for (const exp of allExports) {
    const cat = exp.category ?? 'Other'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(exp)
  }

  return Array.from(byCategory.keys())
    .sort((a, b) => {
      const orderA = CATEGORY_ORDER[a] ?? 999
      const orderB = CATEGORY_ORDER[b] ?? 999
      if (orderA !== orderB) return orderA - orderB
      return a.localeCompare(b)
    })
    .map((category) => ({
      title: category,
      path: `/api#${category.toLowerCase()}`,
      children: byCategory
        .get(category)!
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((exp) => ({ title: exp.name, path: exp.path })),
    }))
}

function combineNavigationItems(items: NavigationItem[]): NavigationItem[] {
  const combinedMap = new Map<string, NavigationItem>()

  for (const item of items) {
    if (!item.title) {
      throw new Error('Navigation item is missing a title')
    }
    if (combinedMap.has(item.title)) {
      const existingItem = combinedMap.get(item.title)!
      if (item.children) {
        existingItem.children = existingItem.children || []
        existingItem.children.push(...item.children)
        existingItem.children = combineNavigationItems(existingItem.children)
      }

      if (
        existingItem.order &&
        item.order &&
        existingItem.order !== item.order
      ) {
        throw new Error(
          `Conflicting order values for navigation item "${item.title}": ${existingItem.order} vs ${item.order}`
        )
      }

      if (existingItem.path && item.path && existingItem.path !== item.path) {
        throw new Error(
          `Conflicting path values for navigation item "${item.title}": ${existingItem.path} vs ${item.path}`
        )
      }

      existingItem.order ??= item.order
      existingItem.path ??= item.path
    } else {
      combinedMap.set(item.title, { ...item })
    }
  }

  return Array.from(combinedMap.values())
}

function sortNavigationItems(items: NavigationItem[]): NavigationItem[] {
  for (const item of items) {
    if (item.children) {
      item.children = sortNavigationItems(item.children)
    }
  }
  return items.sort((a, b) => {
    const orderA = a.order ?? 999
    const orderB = b.order ?? 999
    if (orderA !== orderB) return orderA - orderB
    return a.title.localeCompare(b.title)
  })
}

export async function onCreateGlobalContext(
  context: Partial<GlobalContextServer>
): Promise<void> {
  // Phase 1: Load TypeDoc context (injected by vike-plugin-typedoc)
  // The plugin's extension hook runs first and uses config from +typedoc.ts
  // (which includes buildUrl + rehypePlugins). This call returns the cached result.
  const typedoc = await loadTypedocContext(context)
  configureRehypeTypedoc(typedoc.rehypeOptions)
  configureRemarkCodeProps({
    resolveSignature: (symbolName: string, pkg?: string) => {
      const exports = typedoc.apiDocs.allExports
      const matches = exports.filter((exp) => exp.name === symbolName)
      if (pkg) return matches.find((exp) => exp.package === pkg)?.signature
      if (matches.length === 1) return matches[0].signature
      return undefined
    },
  })

  // Phase 2: Scan examples via functional-examples
  // Config is at the repo root (one level above docs-site)
  const repoRoot = path.resolve(import.meta.dirname, '..', '..')
  const { examples: scannedExamples } = await scan({ root: repoRoot })

  // Phase 3: Scan docs and hydrate guides (Eta → HTML)
  const docsDir = await getDocsDir()
  const rawDocs = await scanDocs(docsDir)
  const docs = await hydrateGuides(rawDocs, scannedExamples)

  // Phase 4: Build navigation
  const docsNavigation = buildDocsNavigation(docs)
  const navigation: NavigationItem[] = sortNavigationItems(
    combineNavigationItems([
      ...docsNavigation,
      {
        title: 'Getting Started',
        children: [],
        path: '/docs/getting-started',
        order: 0,
      },
      {
        title: 'Guides',
        children: [],
        path: '/docs/guides',
        order: 20,
      },
      {
        title: 'Examples',
        path: '/examples',
        children: scannedExamples
          .filter((ex) => !ex.metadata.hidden)
          .map((ex) => ({
            title: ex.title,
            path: `/examples/${ex.id}`,
          })),
        order: 100,
      },
      {
        title: 'API',
        path: '/api',
        order: 200,
        children: buildCategoryNavigation(typedoc.apiDocs.allExports),
      },
    ])
  )

  context.scannedExamples = scannedExamples
  context.docs = docs
  context.navigation = navigation
}

declare global {
  namespace Vike {
    interface GlobalContextServer {
      scannedExamples: ScannedExample[]
      docs: Record<string, DocMetadata>
      navigation: NavigationItem[]
    }
    interface GlobalContextClient {
      navigation: NavigationItem[]
    }
  }
}
