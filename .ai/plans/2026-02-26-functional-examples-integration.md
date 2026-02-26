# functional-examples Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all custom example scanning, liquid tag parsing, TypeDoc integration, and test assertion handling in the isolated-workers docs site with published packages from the functional-examples monorepo.

**Architecture:** Complete cutover — delete the 7 custom server utility files and replace them with `functional-examples` core, `@functional-examples/{yaml-manifest,javascript,documentation,test}`, `rehype-typedoc`, and `vike-plugin-typedoc`. Guides pre-render to HTML at build time via `createGuideRenderer()` + `renderMarkdown()` so data loaders become simple lookups. The example and docs pages drop the `ContentSegment` union and just render an HTML string.

**Tech Stack:** functional-examples ^0.1.0, @functional-examples/{yaml-manifest,javascript,documentation,test} ^0.1.0, rehype-typedoc ^0.0.1, vike-plugin-typedoc ^0.0.1, Eta (bundled in @functional-examples/documentation), unified/remark/rehype (already installed), Vike 0.4.252, React 19

---

## Task 1: Install dependencies

**Files:**
- Modify: `docs-site/package.json`

**Step 1: Add new dependencies, remove old ones**

Edit `docs-site/package.json` `dependencies` section:

```json
{
  "dependencies": {
    "functional-examples": "^0.1.0",
    "@functional-examples/yaml-manifest": "^0.1.0",
    "@functional-examples/javascript": "^0.1.0",
    "@functional-examples/test": "^0.1.0",
    "@functional-examples/documentation": "^0.1.0",
    "rehype-typedoc": "^0.0.1",
    "vike-plugin-typedoc": "^0.0.1",
    "gray-matter": "^4.0.3",
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "rehype-raw": "^7.0.0",
    "rehype-stringify": "^10.0.1",
    "remark-directive": "^3.0.0",
    "remark-gfm": "^4.0.1",
    "remark-parse": "^11.0.0",
    "remark-rehype": "^11.1.2",
    "shiki": "^3.21.0",
    "unified": "^11.0.5",
    "unist-util-visit": "^5.0.0",
    "vike": "^0.4.252",
    "vike-react": "^0.6.19",
    "yaml": "^2.8.2"
  }
}
```

> Note: `rehype-highlight` is removed (replaced by shiki via rehype-typedoc pipeline).
> Note: `remark-directive` is added (required by rehype-typedoc peer deps).

**Step 2: Run install**

```bash
cd /path/to/isolated-workers && pnpm install
```

Expected: dependencies install without errors.

**Step 3: Verify functional-examples CLI is available**

```bash
cd /path/to/isolated-workers && npx functional-examples --help
```

Expected: help text printed without errors.

**Step 4: Commit**

```bash
git add docs-site/package.json pnpm-workspace.yaml
git commit -m "deps: add functional-examples packages to docs-site"
```

---

## Task 2: Create functional-examples.config.ts

**Files:**
- Create: `functional-examples.config.ts` (at repo root)

**Step 1: Create the config file**

```typescript
// functional-examples.config.ts
import { createDocumentationPlugin } from '@functional-examples/documentation'
import { createJavaScriptPlugin } from '@functional-examples/javascript'
import { createTestPlugin } from '@functional-examples/test'
import { createYamlManifestPlugin } from '@functional-examples/yaml-manifest'

export default {
  scan: { root: 'examples' },
  metadata: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['title'],
  },
  plugins: [
    createYamlManifestPlugin(),
    createJavaScriptPlugin(),
    createTestPlugin(),
    createDocumentationPlugin(),
  ],
}
```

**Step 2: Verify the scanner can find examples (before migrating meta.yml)**

```bash
cd /path/to/isolated-workers && npx functional-examples scan 2>&1 | head -20
```

Expected: Either lists examples (if format compatible) or shows an error about unrecognized fields — that's OK, meta.yml migration is next.

**Step 3: Commit**

```bash
git add functional-examples.config.ts
git commit -m "feat: add functional-examples config"
```

---

## Task 3: Migrate all meta.yml files

**Files:**
- Modify: `examples/*/meta.yml` (all 15 examples)

Each `meta.yml` needs:
- **Remove**: `id` (derived from directory name by yaml-manifest)
- **Remove**: `entryPoint` (not used by functional-examples)
- **Remove**: `fileMap` (replaced by `include`)
- **Add**: `include` list of file globs/names
- **Keep unchanged**: `title`, `description`, `commands` (test plugin handles these)

**Step 1: Migrate each meta.yml**

For `examples/basic-ping/meta.yml` (example template — repeat for all):

```yaml
# BEFORE
id: basic-ping
title: Basic Ping-Pong Worker
description: |
  A simple example demonstrating the basics of isolated-workers...
entryPoint: host.ts
fileMap:
  './messages.ts': 'messages.ts'
  './host.ts': 'host.ts'
  './worker.ts': 'worker.ts'
commands:
  - command: 'pnpm run:basic-ping'
    title: 'Run the example'
    assertions:
      - contains: 'Worker spawned with PID'

# AFTER
title: Basic Ping-Pong Worker
description: |
  A simple example demonstrating the basics of isolated-workers...
include:
  - messages.ts
  - host.ts
  - worker.ts
commands:
  - command: 'pnpm run:basic-ping'
    title: 'Run the example'
    assertions:
      - contains: 'Worker spawned with PID'
```

Do this for every example under `examples/`. The `include` list should contain all the `.ts` files that were in the old `fileMap`.

**Step 2: Verify scan works after migration**

```bash
cd /path/to/isolated-workers && npx functional-examples scan --format table
```

Expected: All 15 examples listed with titles and descriptions.

**Step 3: Commit**

```bash
git add examples/*/meta.yml
git commit -m "feat: migrate meta.yml to functional-examples format"
```

---

## Task 4: Wire vike-plugin-typedoc in +config.ts

**Files:**
- Modify: `docs-site/pages/+config.ts`

**Step 1: Check the exact LoadTypedocContextOptions shape**

Read the vike-plugin-typedoc server.ts source to find the exact option name for the TypeDoc JSON path:

```bash
node -e "import('vike-plugin-typedoc/server').then(m => console.log(Object.keys(m)))" 2>/dev/null || cat node_modules/vike-plugin-typedoc/dist/server.js | head -50
```

You're looking for the `LoadTypedocContextOptions` interface — specifically whether the JSON path field is named `jsonPath`, `apiJsonPath`, `packages`, or similar.

**Step 2: Update +config.ts**

```typescript
// docs-site/pages/+config.ts
import vikeReact from 'vike-react/config'
import vikeTypedoc from 'vike-plugin-typedoc/config'
import type { Config } from 'vike/types'

export default {
  title: 'isolated-workers',
  description: 'Type-safe worker processes with end-to-end message contracts',
  prerender: true,
  passToClient: ['navigation'],
  extends: [vikeReact, vikeTypedoc],
  // Adjust option name based on Step 1 finding:
  typedoc: {
    packages: [{ slug: 'isolated-workers', jsonPath: '../.typedoc/api.json' }],
  },
} satisfies Config
```

> Note: `passToClient` no longer includes `examples` (pages render server-side HTML now). The `api` key is gone — TypeDoc context is accessed via `$$VIKE_PLUGIN_TYPEDOC$$`.

**Step 3: Commit**

```bash
git add docs-site/pages/+config.ts
git commit -m "feat: wire vike-plugin-typedoc in Vike config"
```

---

## Task 5: Create new markdown rendering utility

**Files:**
- Modify: `docs-site/server/utils/markdown.ts` (complete rewrite)

This replaces the existing `markdown.ts` with the pattern from functional-examples: module-level configurable rehype-typedoc, and a single `renderMarkdown(md)` function.

**Step 1: Rewrite markdown.ts**

```typescript
// docs-site/server/utils/markdown.ts
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import type { RehypeTypedocOptions, RemarkCodePropsOptions } from 'rehype-typedoc'
import { rehypeTypedoc, rehypeTypedocCodeBlocks, remarkCodeProps } from 'rehype-typedoc'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { getHighlighter } from './highlighter.js'

// Module-level options — configured once in onCreateGlobalContext, used everywhere
let _rehypeOptions: RehypeTypedocOptions | undefined
let _remarkCodePropsOptions: RemarkCodePropsOptions | undefined

export function configureRehypeTypedoc(options: RehypeTypedocOptions): void {
  _rehypeOptions = options
}

export function configureRemarkCodeProps(options: RemarkCodePropsOptions): void {
  _remarkCodePropsOptions = options
}

/**
 * Render a Markdown string to syntax-highlighted HTML.
 *
 * Pipeline:
 *   remarkParse → remarkGfm → remarkDirective → remarkCodeProps
 *   → remarkRehype → rehypeRaw → rehypeTypedoc (if configured)
 *   → rehypeShiki → rehypeTypedocCodeBlocks (if configured)
 *   → rehypeStringify
 */
export async function renderMarkdown(md: string): Promise<string> {
  const highlighter = await getHighlighter()

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkCodeProps, _remarkCodePropsOptions ?? {})
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)

  if (_rehypeOptions) {
    processor.use(rehypeTypedoc, _rehypeOptions)
  }

  // Use @shikijs/rehype for syntax highlighting
  const { default: rehypeShiki } = await import('@shikijs/rehype')
  processor.use(rehypeShiki, {
    theme: 'github-dark',
    addLanguageClass: true,
  })

  if (_rehypeOptions) {
    processor.use(rehypeTypedocCodeBlocks, _rehypeOptions)
  }

  processor.use(rehypeStringify)

  const file = await processor.process(md)
  return String(file)
}
```

> Note: If `@shikijs/rehype` is not yet in the workspace catalog, add it to `docs-site/package.json` devDependencies and run `pnpm install`.

**Step 2: Commit**

```bash
git add docs-site/server/utils/markdown.ts
git commit -m "refactor: rewrite markdown.ts to use rehype-typedoc pipeline"
```

---

## Task 6: Add hydrateGuides to docs.ts

**Files:**
- Modify: `docs-site/server/utils/docs.ts`

Add two things to the existing `docs.ts`:
1. A `renderedHtml` field to `DocMetadata`
2. A `hydrateGuides()` function that uses `createGuideRenderer` + `renderMarkdown`

**Step 1: Add `renderedHtml` to the `DocMetadata` interface**

Find the `DocMetadata` interface in `docs.ts` and add:

```typescript
export interface DocMetadata {
  // ...existing fields...
  filePath: string
  content: string          // raw markdown (after frontmatter strip)
  renderedHtml: string     // pre-rendered HTML (populated by hydrateGuides)
}
```

Also update `scanDocs()` to populate `content` (the raw markdown without frontmatter) and `renderedHtml: ''` initially.

**Step 2: Add hydrateGuides() to docs.ts**

Add these imports at the top of `docs.ts`:

```typescript
import type { ScannedExample } from '@functional-examples/devkit'
import { createGuideRenderer } from '@functional-examples/documentation'
import { renderMarkdown } from './markdown.js'
```

Add this function:

```typescript
/**
 * Hydrate all guide docs: expand Eta example references in markdown,
 * then render the expanded markdown to HTML.
 *
 * @param docs - from scanDocs()
 * @param examples - from functional-examples scan()
 */
export async function hydrateGuides(
  docs: Record<string, DocMetadata>,
  examples: ScannedExample[]
): Promise<Record<string, DocMetadata>> {
  const renderer = createGuideRenderer(examples)
  const hydrated: Record<string, DocMetadata> = {}

  for (const [urlPath, doc] of Object.entries(docs)) {
    let expandedContent = doc.content
    try {
      expandedContent = renderer.render(doc.content)
    } catch (err) {
      console.warn(
        `[docs] Guide hydration failed for "${urlPath}":`,
        (err as Error).message
      )
    }

    let renderedHtml = ''
    try {
      renderedHtml = await renderMarkdown(expandedContent)
    } catch (err) {
      console.warn(
        `[docs] Markdown render failed for "${urlPath}":`,
        (err as Error).message
      )
    }

    hydrated[urlPath] = { ...doc, content: expandedContent, renderedHtml }
  }

  return hydrated
}
```

Also update `scanDocs()` to read raw content and set `renderedHtml: ''`:

```typescript
// In scanDocs(), when building the DocMetadata object:
const { data, content } = matter(rawContent)
// ...
return {
  // ...existing fields...
  filePath: doc.filePath,
  content,         // raw markdown (no frontmatter)
  renderedHtml: '', // populated by hydrateGuides()
}
```

**Step 3: Commit**

```bash
git add docs-site/server/utils/docs.ts
git commit -m "feat: add hydrateGuides() to docs.ts using createGuideRenderer"
```

---

## Task 7: Rewrite +onCreateGlobalContext.server.ts

**Files:**
- Modify: `docs-site/pages/+onCreateGlobalContext.server.ts`

Replace the entire file. The new version uses:
- `scan()` from `functional-examples` instead of `scanExamples()`
- `hydrateGuides()` from `docs.ts` instead of custom pipeline
- `loadTypedocContext` from `vike-plugin-typedoc/server` instead of custom `loadApiDocs()`
- `configureRehypeTypedoc` + `configureRemarkCodeProps` from new `markdown.ts`

**Step 1: Rewrite the file**

```typescript
// docs-site/pages/+onCreateGlobalContext.server.ts
import { scan } from 'functional-examples'
import type { ScannedExample } from '@functional-examples/devkit'
import { loadTypedocContext } from 'vike-plugin-typedoc/server'
import type { GlobalContextServer } from 'vike/types'
import {
  buildDocsNavigation,
  getDocsDir,
  hydrateGuides,
  scanDocs,
  type DocMetadata,
} from '../server/utils/docs.js'
import { configureRehypeTypedoc, configureRemarkCodeProps } from '../server/utils/markdown.js'
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
  // Phase 1: Load TypeDoc context (injected by vike-plugin-typedoc extension)
  // and configure rehype-typedoc so inline code auto-linking works in renderMarkdown().
  const typedoc = await loadTypedocContext(context)
  configureRehypeTypedoc(typedoc.rehypeOptions)
  configureRemarkCodeProps({
    resolveSignature: (symbolName, pkg) => {
      const exports = typedoc.apiDocs.allExports
      const matches = exports.filter((exp) => exp.name === symbolName)
      if (pkg) return matches.find((exp) => exp.package === pkg)?.signature
      if (matches.length === 1) return matches[0].signature
      return undefined
    },
  })

  // Phase 2: Scan examples using functional-examples scanner
  const { examples: scannedExamples } = await scan()

  // Phase 3: Scan and hydrate docs (expand Eta tags, render to HTML)
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
```

**Step 2: Commit**

```bash
git add docs-site/pages/+onCreateGlobalContext.server.ts
git commit -m "refactor: rewrite onCreateGlobalContext to use functional-examples scanner"
```

---

## Task 8: Update vike-types.d.ts

**Files:**
- Modify: `docs-site/vike-types.d.ts`

Replace the old type declarations to match the new global context shape.

```typescript
// docs-site/vike-types.d.ts
import type { DocMetadata } from './server/utils/docs.js'
import type { ScannedExample } from '@functional-examples/devkit'

export interface NavigationItem {
  title: string
  path?: string
  children?: NavigationItem[]
  order?: number
}

declare global {
  namespace Vike {
    interface GlobalContext {
      scannedExamples: ScannedExample[]
      docs: Record<string, DocMetadata>
      navigation: NavigationItem[]
    }
  }
}

export { NavigationItem }
```

**Step 2: Commit**

```bash
git add docs-site/vike-types.d.ts
git commit -m "refactor: update vike-types.d.ts to match new global context shape"
```

---

## Task 9: Simplify docs/+data.ts

**Files:**
- Modify: `docs-site/pages/docs/+data.ts`

The new version is dramatically simpler: guides are pre-rendered in the global context, so just look up and return.

**Step 1: Replace docs/+data.ts**

```typescript
// docs-site/pages/docs/+data.ts
import type { PageContextServer } from 'vike/types'
import type { DocMetadata } from '../../server/utils/docs.js'

export interface DocsData {
  doc: DocMetadata | null
}

export async function data(pageContext: PageContextServer): Promise<DocsData> {
  const urlPath = pageContext.urlPathname
  const doc = pageContext.globalContext.docs[urlPath] ?? null
  return { doc }
}
```

**Step 2: Update docs/+Page.tsx if it references ContentSegment**

Open `docs/+Page.tsx` and replace any `<SegmentList segments={segments} />` usage with:

```tsx
<div
  className="docs-prose"
  dangerouslySetInnerHTML={{ __html: doc.renderedHtml }}
/>
```

**Step 3: Commit**

```bash
git add docs-site/pages/docs/+data.ts docs-site/pages/docs/+Page.tsx
git commit -m "refactor: simplify docs data loader — use pre-rendered HTML"
```

---

## Task 10: Rewrite examples/@id/+data.ts

**Files:**
- Modify: `docs-site/pages/examples/@id/+data.ts`

The new version looks up the `ScannedExample`, loads `content.md`, renders it with the guide renderer + `renderMarkdown`, and returns HTML.

**Step 1: Replace the file**

```typescript
// docs-site/pages/examples/@id/+data.ts
import { createGuideRenderer } from '@functional-examples/documentation'
import type { ScannedExample } from '@functional-examples/devkit'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { PageContextServer } from 'vike/types'
import { renderMarkdown } from '../../../server/utils/markdown.js'

export interface ExampleData {
  example: ScannedExample | null
  renderedHtml: string
}

export async function data(pageContext: PageContextServer): Promise<ExampleData> {
  const { id } = pageContext.routeParams
  const scannedExamples = pageContext.globalContext.scannedExamples
  const example = scannedExamples.find((ex) => ex.id === id) ?? null

  if (!example) {
    return { example: null, renderedHtml: '' }
  }

  // Try to load content.md from the example directory.
  // Fall back to a generated heading if absent.
  let rawContent: string
  const exampleDir = example.files[0]
    ? path.dirname(path.resolve(process.cwd(), 'examples', id, example.files[0].relativePath))
    : path.join(process.cwd(), 'examples', id)

  try {
    rawContent = await fs.readFile(path.join(process.cwd(), 'examples', id, 'content.md'), 'utf-8')
  } catch {
    rawContent = `# ${example.title}\n\n${example.description ?? ''}`
  }

  // Expand Eta example references using ALL scanned examples (cross-reference support)
  const renderer = createGuideRenderer(scannedExamples)
  let expandedContent = rawContent
  try {
    expandedContent = renderer.render(rawContent)
  } catch (err) {
    console.warn(`[examples] Guide hydration failed for "${id}":`, (err as Error).message)
  }

  const renderedHtml = await renderMarkdown(expandedContent)
  return { example, renderedHtml }
}
```

**Step 2: Update examples/@id/+Page.tsx**

Replace `<SegmentList segments={segments} />` with:

```tsx
<div
  className="docs-prose"
  dangerouslySetInnerHTML={{ __html: renderedHtml }}
/>
```

Also update the component to use `ScannedExample` fields (`example.title`, `example.description`, `example.metadata`) instead of the old `ExampleMetadata` fields. Remove the "Additional Files" section (files are now embedded via Eta in content.md) and update the "Running the Example" section to read from `example.metadata.commands`.

**Step 3: Commit**

```bash
git add "docs-site/pages/examples/@id/+data.ts" "docs-site/pages/examples/@id/+Page.tsx"
git commit -m "refactor: rewrite examples data loader to use functional-examples scanner"
```

---

## Task 11: Update api/+data.ts

**Files:**
- Modify: `docs-site/pages/api/+data.ts`
- Modify: `docs-site/pages/api/+Page.tsx`

Replace custom `ApiDocs` types with `vike-plugin-typedoc`'s `TypedocContext`. The context is stored on `GlobalContextServer` as `$$VIKE_PLUGIN_TYPEDOC$$`.

**Step 1: Read the current api/+Page.tsx**

Before modifying, understand what fields from `ApiExport` the page uses so you know what to map. Look for:
- `exp.name`, `exp.description`, `exp.signature`, `exp.path`
- `exp.comment.examples`
- `exp.parameters`, `exp.returns`
- `exp.kind`

**Step 2: Replace api/+data.ts**

```typescript
// docs-site/pages/api/+data.ts
import type { PageContextServer } from 'vike/types'
import type { LinkedApiExport } from 'vike-plugin-typedoc'

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
  // parts[0] = 'api', parts[1] = packageSlug, parts[2] = symbolSlug

  const packageSlug = parts[1]
  const symbolSlug = parts[2]

  if (!packageSlug) {
    return {
      type: 'landing',
      packageSlugs: Object.keys(typedoc.apiDocs.packages),
    }
  }

  if (!symbolSlug) {
    // Package-level landing — show all exports in package
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
```

**Step 3: Update api/+Page.tsx**

Update the component to use `LinkedApiExport` fields. `LinkedApiExport` has pre-rendered HTML fields:
- `linked.descriptionHtml` — rendered description
- `linked.signatureCodeHtml` — rendered signature
- `linked.examplesHtml` — rendered examples
- `linked.name`, `linked.kind`, `linked.path`

Render these using `dangerouslySetInnerHTML`.

**Step 4: Update api/+onBeforePrerenderStart.ts (if it exists)**

If there's a prerender hook for API pages, update it to use `typedoc.getAllPrerenderUrls()` from `vike-plugin-typedoc` (this is handled automatically by the vike-plugin-typedoc hooks, so you may be able to delete this file entirely).

**Step 5: Commit**

```bash
git add docs-site/pages/api/
git commit -m "refactor: update API pages to use vike-plugin-typedoc TypedocContext"
```

---

## Task 12: Migrate guide markdown — liquid tags to Eta

**Files:**
- Modify: `docs/guides/*.md` (all 11 guide files)

Convert liquid tag syntax to Eta template syntax. Do a global search-replace across all guide files.

**Step 1: Find all liquid tags**

```bash
grep -rn '{%' /path/to/isolated-workers/docs/
```

**Step 2: Apply conversions**

| Old liquid tag | New Eta syntax |
|---|---|
| `{% example name:file.ts#region %}` | `<%= example('name').region('region') %>` |
| `{% example name:file.ts %}` | `<%= example('name').file('file.ts') %>` |
| `{% file file.ts %}` | `<%= example('EXAMPLE_ID').file('file.ts') %>` |
| `{% file file.ts#region %}` | `<%= example('EXAMPLE_ID').region('region') %>` |
| `{% example-link name %}` | `[Title](/examples/name)` |

> Note: For `{% file ... %}` tags, you need to determine which example the file belongs to and use that example's ID. Look at the context (which example's directory the file is in).

**Step 3: Verify by checking for remaining liquid tags**

```bash
grep -rn '{%' /path/to/isolated-workers/docs/
```

Expected: No output (all liquid tags converted).

**Step 4: Commit**

```bash
git add docs/guides/
git commit -m "feat: migrate guide markdown from liquid tags to Eta templates"
```

---

## Task 13: Delete dead code

**Files to delete:**
- `docs-site/server/utils/examples.ts`
- `docs-site/server/utils/segments.ts`
- `docs-site/server/utils/liquid-tags.ts`
- `docs-site/server/utils/remark-liquid-tags.ts`
- `docs-site/server/utils/code-links.ts`
- `docs-site/server/utils/typedoc.ts`

**Step 1: Grep for any remaining imports of deleted files**

```bash
grep -rn "from.*examples\b\|from.*segments\|from.*liquid-tags\|from.*remark-liquid-tags\|from.*code-links\|from.*typedoc" docs-site/
```

Expected: No imports found (all consumers were updated in Tasks 7-11).

**Step 2: Delete the files**

```bash
rm docs-site/server/utils/examples.ts
rm docs-site/server/utils/segments.ts
rm docs-site/server/utils/liquid-tags.ts
rm docs-site/server/utils/remark-liquid-tags.ts
rm docs-site/server/utils/code-links.ts
rm docs-site/server/utils/typedoc.ts
```

**Step 3: Also simplify SegmentRenderer.tsx → rename to HtmlRenderer.tsx**

Replace `docs-site/components/SegmentRenderer.tsx` with a simple HTML renderer:

```tsx
// docs-site/components/HtmlRenderer.tsx
interface HtmlRendererProps {
  html: string
  className?: string
}

export function HtmlRenderer({ html, className = 'docs-prose' }: HtmlRendererProps) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
```

Update any pages that imported `SegmentRenderer` or `SegmentList` to use `HtmlRenderer` instead.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete custom server utilities replaced by functional-examples packages"
```

---

## Task 14: Add test-examples Nx target

**Files:**
- Modify: `docs-site/package.json` (add to the `nx.targets` section)

**Step 1: Add the target**

In `docs-site/package.json`, under `nx.targets`:

```json
{
  "nx": {
    "targets": {
      "test-examples": {
        "command": "functional-examples test",
        "cwd": "{workspaceRoot}"
      },
      "build": { ... },
      "preview": { ... }
    }
  }
}
```

**Step 2: Verify the test target runs**

```bash
npx nx run docs-site:test-examples
```

Expected: functional-examples test runner executes example commands and checks assertions.

**Step 3: Commit**

```bash
git add docs-site/package.json
git commit -m "feat: add test-examples Nx target for functional-examples test plugin"
```

---

## Task 15: Final verification

**Step 1: Type-check**

```bash
cd /path/to/isolated-workers/docs-site && npx tsc --noEmit
```

Expected: No TypeScript errors.

**Step 2: Extract TypeDoc (needed for build)**

```bash
npx nx run @isolated-workers/library:extract-docs
```

Expected: `.typedoc/api.json` is generated.

**Step 3: Run full build**

```bash
npx nx run docs-site:build
```

Expected: Build completes, dist/client contains the static site.

**Step 4: Start preview and manually verify**

Start preview:
```bash
npx nx run docs-site:preview
```

Check these pages manually:
- `/docs/guides/middleware` — should show Eta-expanded code blocks
- `/examples/basic-ping` — should show rendered content.md
- `/api` — should show API landing using vike-plugin-typedoc data

**Step 5: Run example tests**

```bash
npx nx run docs-site:test-examples
```

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: verify functional-examples integration complete"
```
