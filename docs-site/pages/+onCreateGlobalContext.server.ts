import type { ScannedExample } from '@functional-examples/devkit'
import { scan } from 'functional-examples'
import { loadTypedocContext } from 'vike-plugin-typedoc/server'
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
  // Configure rehype-typedoc so renderMarkdown auto-links API symbols.
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
  const navigation: NavigationItem[] = sortNavigationItems([
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
      children: scannedExamples.map((ex) => ({
        title: ex.title,
        path: `/examples/${ex.id}`,
      })),
      order: 100,
    },
    {
      title: 'API',
      path: '/api',
      order: 200,
      children: typedoc.navigation.flatMap((item) => item.children ?? [item]),
    },
  ])

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
