# Markdown Docs & Code Hunks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable markdown-based documentation in `docs/` folder with code hunk extraction from examples using `#region` annotations.

**Architecture:** Filesystem-based routing with Vike splat routes. Region parsing extracts annotated code sections. Liquid-style `{% %}` tags reference files and hunks. Build-time validation ensures no broken references.

**Tech Stack:** Vike (SSG), remark/rehype (markdown), Shiki (highlighting), TypeScript

---

## Task 1: Create Region Parser Utility

**Files:**
- Create: `docs-site/server/utils/regions.ts`
- Test: `docs-site/server/utils/regions.test.ts`

**Step 1: Write the test file**

```typescript
// docs-site/server/utils/regions.test.ts
import { describe, expect, it } from 'vitest';
import { parseRegions, extractHunk, stripMarkers } from './regions';

describe('parseRegions', () => {
  it('parses a single region', () => {
    const code = `const a = 1;
// #region setup
const worker = createWorker();
// #endregion setup
const b = 2;`;

    const regions = parseRegions(code);
    expect(regions).toEqual({
      setup: {
        startLine: 2,
        endLine: 4,
        content: 'const worker = createWorker();',
      },
    });
  });

  it('parses nested regions', () => {
    const code = `// #region outer
const a = 1;
// #region inner
const b = 2;
// #endregion inner
const c = 3;
// #endregion outer`;

    const regions = parseRegions(code);
    expect(regions.outer.content).toContain('const a = 1;');
    expect(regions.outer.content).toContain('const b = 2;');
    expect(regions.outer.content).toContain('const c = 3;');
    expect(regions.inner.content).toBe('const b = 2;');
  });

  it('throws on unclosed region', () => {
    const code = `// #region unclosed
const a = 1;`;
    expect(() => parseRegions(code)).toThrow(/Unclosed region 'unclosed'/);
  });

  it('throws on mismatched endregion', () => {
    const code = `// #region one
// #endregion two`;
    expect(() => parseRegions(code)).toThrow(/Mismatched/);
  });
});

describe('extractHunk', () => {
  it('extracts a region by id', () => {
    const code = `const a = 1;
// #region setup
const worker = createWorker();
// #endregion setup`;

    const hunk = extractHunk(code, 'setup');
    expect(hunk).toBe('const worker = createWorker();');
  });

  it('throws on missing region', () => {
    const code = `const a = 1;`;
    expect(() => extractHunk(code, 'missing')).toThrow(
      /Region 'missing' not found/
    );
  });
});

describe('stripMarkers', () => {
  it('removes all region markers from code', () => {
    const code = `const a = 1;
// #region setup
const worker = createWorker();
// #endregion setup
const b = 2;`;

    const stripped = stripMarkers(code);
    expect(stripped).toBe(`const a = 1;
const worker = createWorker();
const b = 2;`);
  });

  it('handles multiple regions', () => {
    const code = `// #region a
one
// #endregion a
// #region b
two
// #endregion b`;

    const stripped = stripMarkers(code);
    expect(stripped).toBe(`one
two`);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm nx test docs-site -- --run regions.test.ts`
Expected: FAIL - module not found

**Step 3: Write the implementation**

```typescript
// docs-site/server/utils/regions.ts

export interface RegionInfo {
  startLine: number;
  endLine: number;
  content: string;
}

export type RegionMap = Record<string, RegionInfo>;

const REGION_START = /^\s*\/\/\s*#region\s+(\S+)\s*$/;
const REGION_END = /^\s*\/\/\s*#endregion\s+(\S+)\s*$/;

/**
 * Parse all #region/#endregion pairs from code.
 * Supports nested regions.
 * Throws on unclosed or mismatched regions.
 */
export function parseRegions(code: string): RegionMap {
  const lines = code.split('\n');
  const regions: RegionMap = {};
  const stack: Array<{ id: string; startLine: number; startIndex: number }> =
    [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const startMatch = line.match(REGION_START);
    if (startMatch) {
      stack.push({ id: startMatch[1], startLine: i + 1, startIndex: i });
      continue;
    }

    const endMatch = line.match(REGION_END);
    if (endMatch) {
      const endId = endMatch[1];
      const openRegion = stack.pop();

      if (!openRegion) {
        throw new Error(`Unexpected #endregion '${endId}' at line ${i + 1}`);
      }

      if (openRegion.id !== endId) {
        throw new Error(
          `Mismatched region: opened '${openRegion.id}' at line ${openRegion.startLine}, closed '${endId}' at line ${i + 1}`
        );
      }

      // Extract content between markers (exclusive)
      const contentLines = lines.slice(openRegion.startIndex + 1, i);
      // Strip nested region markers from content
      const content = stripMarkers(contentLines.join('\n'));

      regions[openRegion.id] = {
        startLine: openRegion.startLine,
        endLine: i + 1,
        content: content.trim(),
      };
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    throw new Error(
      `Unclosed region '${unclosed.id}' starting at line ${unclosed.startLine}`
    );
  }

  return regions;
}

/**
 * Extract a specific region's content by ID.
 * Throws if region not found.
 */
export function extractHunk(code: string, regionId: string): string {
  const regions = parseRegions(code);

  if (!(regionId in regions)) {
    throw new Error(`Region '${regionId}' not found in code`);
  }

  return regions[regionId].content;
}

/**
 * Remove all #region and #endregion marker lines from code.
 */
export function stripMarkers(code: string): string {
  const lines = code.split('\n');
  const filtered = lines.filter(
    (line) => !REGION_START.test(line) && !REGION_END.test(line)
  );
  return filtered.join('\n');
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm nx test docs-site -- --run regions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add docs-site/server/utils/regions.ts docs-site/server/utils/regions.test.ts
git commit -m "feat(docs-site): add region parser for code hunk extraction"
```

---

## Task 2: Create Liquid Tag Parser

**Files:**
- Create: `docs-site/server/utils/liquid-tags.ts`
- Test: `docs-site/server/utils/liquid-tags.test.ts`

**Step 1: Write the test file**

```typescript
// docs-site/server/utils/liquid-tags.test.ts
import { describe, expect, it } from 'vitest';
import { parseLiquidTag, LiquidTag } from './liquid-tags';

describe('parseLiquidTag', () => {
  it('parses {% file path %}', () => {
    const result = parseLiquidTag('{% file host.ts %}');
    expect(result).toEqual({
      type: 'file',
      path: 'host.ts',
      hunk: undefined,
    });
  });

  it('parses {% file path#hunk %}', () => {
    const result = parseLiquidTag('{% file host.ts#setup %}');
    expect(result).toEqual({
      type: 'file',
      path: 'host.ts',
      hunk: 'setup',
    });
  });

  it('parses {% example name %}', () => {
    const result = parseLiquidTag('{% example basic-ping %}');
    expect(result).toEqual({
      type: 'example-link',
      example: 'basic-ping',
    });
  });

  it('parses {% example name:path %}', () => {
    const result = parseLiquidTag('{% example basic-ping:host.ts %}');
    expect(result).toEqual({
      type: 'example-file',
      example: 'basic-ping',
      path: 'host.ts',
      hunk: undefined,
    });
  });

  it('parses {% example name:path#hunk %}', () => {
    const result = parseLiquidTag('{% example basic-ping:host.ts#setup %}');
    expect(result).toEqual({
      type: 'example-file',
      example: 'basic-ping',
      path: 'host.ts',
      hunk: 'setup',
    });
  });

  it('returns null for invalid tags', () => {
    expect(parseLiquidTag('{{ handlebars }}')).toBeNull();
    expect(parseLiquidTag('not a tag')).toBeNull();
    expect(parseLiquidTag('{% unknown foo %}')).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm nx test docs-site -- --run liquid-tags.test.ts`
Expected: FAIL - module not found

**Step 3: Write the implementation**

```typescript
// docs-site/server/utils/liquid-tags.ts

export type LiquidTag =
  | { type: 'file'; path: string; hunk: string | undefined }
  | { type: 'example-link'; example: string }
  | {
      type: 'example-file';
      example: string;
      path: string;
      hunk: string | undefined;
    };

const LIQUID_TAG = /^\{%\s+(\w+)\s+(.+?)\s*%\}$/;

/**
 * Parse a Liquid-style tag string.
 * Returns null if not a valid tag.
 *
 * Supported formats:
 * - {% file path %} or {% file path#hunk %}
 * - {% example name %} (link only)
 * - {% example name:path %} or {% example name:path#hunk %}
 */
export function parseLiquidTag(tag: string): LiquidTag | null {
  const match = tag.trim().match(LIQUID_TAG);
  if (!match) return null;

  const [, command, args] = match;

  if (command === 'file') {
    const [path, hunk] = args.split('#');
    return { type: 'file', path: path.trim(), hunk: hunk?.trim() };
  }

  if (command === 'example') {
    // Check if it's just a link or has a file reference
    if (args.includes(':')) {
      const colonIndex = args.indexOf(':');
      const example = args.slice(0, colonIndex).trim();
      const rest = args.slice(colonIndex + 1).trim();
      const [path, hunk] = rest.split('#');
      return {
        type: 'example-file',
        example,
        path: path.trim(),
        hunk: hunk?.trim(),
      };
    } else {
      // Just an example link, might have a hunk but that's invalid for links
      // For now, treat anything without : as a link
      return { type: 'example-link', example: args.trim() };
    }
  }

  return null;
}

/**
 * Check if a string contains a Liquid tag placeholder.
 */
export function isLiquidTag(text: string): boolean {
  return /^\{%\s+\w+\s+.+?\s*%\}$/.test(text.trim());
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm nx test docs-site -- --run liquid-tags.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add docs-site/server/utils/liquid-tags.ts docs-site/server/utils/liquid-tags.test.ts
git commit -m "feat(docs-site): add Liquid tag parser for file/example references"
```

---

## Task 3: Create Docs Scanner Utility

**Files:**
- Create: `docs-site/server/utils/docs.ts`
- Test: `docs-site/server/utils/docs.test.ts`

**Step 1: Write the test file**

```typescript
// docs-site/server/utils/docs.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';
import { vi } from 'vitest';

// Mock fs module
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

import { scanDocs, buildDocsNavigation, type DocMetadata } from './docs';

describe('scanDocs', () => {
  beforeEach(() => {
    vol.reset();
  });

  afterEach(() => {
    vol.reset();
  });

  it('scans docs folder and parses frontmatter', async () => {
    vol.fromJSON({
      '/docs/guides/error-handling.md': `---
title: Error Handling Guide
description: Learn error handling
nav:
  section: Guides
  order: 2
---

# Error Handling

Content here...`,
      '/docs/index.md': `---
title: Documentation
description: Main docs page
nav:
  section: Home
  order: 1
---

Welcome!`,
    });

    const docs = await scanDocs('/docs');

    expect(docs['/docs/']).toBeDefined();
    expect(docs['/docs/'].title).toBe('Documentation');

    expect(docs['/docs/guides/error-handling']).toBeDefined();
    expect(docs['/docs/guides/error-handling'].title).toBe(
      'Error Handling Guide'
    );
    expect(docs['/docs/guides/error-handling'].nav?.section).toBe('Guides');
  });

  it('supports path override in frontmatter', async () => {
    vol.fromJSON({
      '/docs/legacy/old-page.md': `---
title: New Page
path: /docs/new-location
---
Content`,
    });

    const docs = await scanDocs('/docs');
    expect(docs['/docs/new-location']).toBeDefined();
    expect(docs['/docs/legacy/old-page']).toBeUndefined();
  });

  it('handles index.md files correctly', async () => {
    vol.fromJSON({
      '/docs/guides/index.md': `---
title: Guides Overview
---
Content`,
    });

    const docs = await scanDocs('/docs');
    expect(docs['/docs/guides/']).toBeDefined();
    expect(docs['/docs/guides/index']).toBeUndefined();
  });
});

describe('buildDocsNavigation', () => {
  it('groups docs by nav.section and sorts by order', () => {
    const docs: Record<string, DocMetadata> = {
      '/docs/a': {
        path: '/docs/a',
        filePath: '/docs/a.md',
        title: 'A',
        nav: { section: 'Guides', order: 2 },
      },
      '/docs/b': {
        path: '/docs/b',
        filePath: '/docs/b.md',
        title: 'B',
        nav: { section: 'Guides', order: 1 },
      },
      '/docs/c': {
        path: '/docs/c',
        filePath: '/docs/c.md',
        title: 'C',
        nav: { section: 'API', order: 1 },
      },
    };

    const nav = buildDocsNavigation(docs);

    expect(nav).toHaveLength(2);
    expect(nav[0].title).toBe('API');
    expect(nav[1].title).toBe('Guides');
    expect(nav[1].children?.[0].title).toBe('B'); // order: 1
    expect(nav[1].children?.[1].title).toBe('A'); // order: 2
  });

  it('excludes docs without nav section', () => {
    const docs: Record<string, DocMetadata> = {
      '/docs/hidden': {
        path: '/docs/hidden',
        filePath: '/docs/hidden.md',
        title: 'Hidden',
        // no nav
      },
    };

    const nav = buildDocsNavigation(docs);
    expect(nav).toHaveLength(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm nx test docs-site -- --run docs.test.ts`
Expected: FAIL - module not found

**Step 3: Write the implementation**

```typescript
// docs-site/server/utils/docs.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type { NavigationItem } from '../../vike-types';

export interface DocMetadata {
  path: string; // URL path
  filePath: string; // Filesystem path
  title: string;
  description?: string;
  nav?: {
    section: string;
    order: number;
  };
}

/**
 * Recursively scan a directory for markdown files.
 */
async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(fullPath)));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Convert a filesystem path to a URL path.
 * - docs/guides/error-handling.md -> /docs/guides/error-handling
 * - docs/guides/index.md -> /docs/guides/
 */
function filePathToUrlPath(filePath: string, docsRoot: string): string {
  // Get relative path from docs root
  const relative = path.relative(docsRoot, filePath);

  // Remove .md extension
  let urlPath = relative.replace(/\.md$/, '');

  // Handle index files
  if (urlPath.endsWith('/index') || urlPath === 'index') {
    urlPath = urlPath.replace(/\/?index$/, '/');
  }

  // Ensure leading slash and /docs prefix
  return '/docs/' + urlPath.replace(/^\/+/, '');
}

/**
 * Scan the docs directory and return metadata for all markdown files.
 */
export async function scanDocs(
  docsRoot: string
): Promise<Record<string, DocMetadata>> {
  const docs: Record<string, DocMetadata> = {};

  try {
    const files = await walkDir(docsRoot);

    for (const filePath of files) {
      const content = await fs.readFile(filePath, 'utf-8');
      const { data: frontmatter } = matter(content);

      // Determine URL path (frontmatter override or derived)
      const derivedPath = filePathToUrlPath(filePath, docsRoot);
      const urlPath = frontmatter.path || derivedPath;

      docs[urlPath] = {
        path: urlPath,
        filePath,
        title: frontmatter.title || path.basename(filePath, '.md'),
        description: frontmatter.description,
        nav: frontmatter.nav,
      };
    }
  } catch {
    // Docs folder doesn't exist yet, return empty
  }

  return docs;
}

/**
 * Build navigation structure from docs metadata.
 * Groups by nav.section, sorts by nav.order.
 */
export function buildDocsNavigation(
  docs: Record<string, DocMetadata>
): NavigationItem[] {
  // Group by section
  const sections: Record<string, Array<{ title: string; path: string; order: number }>> = {};

  for (const doc of Object.values(docs)) {
    if (!doc.nav?.section) continue;

    const { section, order } = doc.nav;
    if (!sections[section]) {
      sections[section] = [];
    }
    sections[section].push({
      title: doc.title,
      path: doc.path,
      order: order ?? 999,
    });
  }

  // Sort items within each section, then build navigation
  const navigation: NavigationItem[] = [];

  for (const [sectionName, items] of Object.entries(sections).sort()) {
    items.sort((a, b) => a.order - b.order);

    navigation.push({
      title: sectionName,
      path: items[0]?.path || '#',
      children: items.map((item) => ({
        title: item.title,
        path: item.path,
      })),
    });
  }

  return navigation;
}

/**
 * Resolve docs directory from workspace root.
 */
export async function getDocsDir(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), '../docs'),
    path.resolve(process.cwd(), 'docs'),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue
    }
  }

  return candidates[0];
}
```

**Step 4: Install gray-matter dependency**

Run: `pnpm add gray-matter --filter docs-site`

**Step 5: Run tests to verify they pass**

Run: `pnpm nx test docs-site -- --run docs.test.ts`
Expected: PASS (or adjust mocking if needed)

**Step 6: Commit**

```bash
git add docs-site/server/utils/docs.ts docs-site/server/utils/docs.test.ts docs-site/package.json pnpm-lock.yaml
git commit -m "feat(docs-site): add docs scanner with frontmatter parsing"
```

---

## Task 4: Create Docs Vike Pages

**Files:**
- Create: `docs-site/pages/docs/+route.ts`
- Create: `docs-site/pages/docs/+data.ts`
- Create: `docs-site/pages/docs/+Page.tsx`
- Create: `docs-site/pages/docs/+onBeforePrerenderStart.ts`

**Step 1: Create the route file**

```typescript
// docs-site/pages/docs/+route.ts
export default '/docs/*';
```

**Step 2: Create the data loader**

```typescript
// docs-site/pages/docs/+data.ts
import type { Root as MdastRoot, RootContent } from 'mdast';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import type { BundledLanguage } from 'shiki';
import { createHighlighter } from 'shiki';
import { unified } from 'unified';
import type { PageContextServer } from 'vike/types';
import { parseLiquidTag } from '../../server/utils/liquid-tags';
import { extractHunk, stripMarkers } from '../../server/utils/regions';
import { getDocsDir, type DocMetadata } from '../../server/utils/docs';

export type ContentSegment =
  | { type: 'html'; html: string }
  | {
      type: 'file';
      filename: string;
      language: string;
      content: string;
      highlightedHtml: string;
    }
  | { type: 'example-link'; example: string; title: string };

export interface DocsData {
  doc: DocMetadata | null;
  segments: ContentSegment[];
}

// Reuse highlighter singleton
let highlighterInit: Promise<Awaited<ReturnType<typeof createHighlighter>>> | null = null;

async function getHighlighter() {
  if (!highlighterInit) {
    highlighterInit = createHighlighter({
      themes: ['github-dark'],
      langs: ['javascript', 'jsx', 'typescript', 'tsx', 'json', 'yaml', 'bash', 'html', 'css', 'plaintext'],
    });
  }
  return highlighterInit;
}

function getLanguage(filename: string): string {
  const ext = path.extname(filename);
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript',
    '.js': 'javascript', '.jsx': 'javascript',
    '.json': 'json', '.yml': 'yaml', '.yaml': 'yaml',
    '.sh': 'bash', '.bash': 'bash',
    '.html': 'html', '.css': 'css',
  };
  return map[ext] || 'plaintext';
}

async function highlightCode(code: string, language: string): Promise<string> {
  try {
    const h = await getHighlighter();
    return h.codeToHtml(code, {
      lang: language as BundledLanguage,
      theme: 'github-dark',
      colorReplacements: { '#24292e': '#00000000' },
    });
  } catch {
    return `<pre class="shiki"><code>${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
  }
}

/**
 * Check if a paragraph contains only a Liquid tag.
 */
function extractLiquidTag(node: RootContent): string | null {
  if (node.type !== 'paragraph' || node.children.length !== 1) return null;
  const child = node.children[0];
  if (child.type !== 'text') return null;
  if (/^\{%\s+\w+\s+.+?\s*%\}$/.test(child.value.trim())) {
    return child.value.trim();
  }
  return null;
}

async function processMarkdownChunk(nodes: RootContent[]): Promise<string> {
  if (nodes.length === 0) return '';
  const root: MdastRoot = { type: 'root', children: nodes };
  const processor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify, { allowDangerousHtml: true });
  const result = await processor.run(root);
  return processor.stringify(result);
}

async function resolveFileContent(
  exampleId: string,
  filePath: string,
  hunk: string | undefined,
  sourceFile: string,
  sourceLine: number
): Promise<{ content: string; language: string }> {
  const examplesDir = path.resolve(process.cwd(), '../examples');
  const fullPath = path.join(examplesDir, exampleId, filePath);

  let fileContent: string;
  try {
    fileContent = await fs.readFile(fullPath, 'utf-8');
  } catch {
    throw new Error(
      `File not found: examples/${exampleId}/${filePath} (referenced from ${sourceFile}:${sourceLine})`
    );
  }

  let content: string;
  if (hunk) {
    try {
      content = extractHunk(fileContent, hunk);
    } catch {
      throw new Error(
        `Region '${hunk}' not found in examples/${exampleId}/${filePath} (referenced from ${sourceFile}:${sourceLine})`
      );
    }
  } else {
    content = stripMarkers(fileContent);
  }

  return { content, language: getLanguage(filePath) };
}

export async function data(pageContext: PageContextServer): Promise<DocsData> {
  // Extract path from wildcard route
  const wildcardPath = pageContext.routeParams['*'] || '';
  let urlPath = '/docs/' + wildcardPath;

  // Normalize: ensure trailing slash for index routes
  if (!urlPath.endsWith('/') && !path.extname(urlPath)) {
    // Check if this is an index route
    const doc = pageContext.globalContext.docs?.[urlPath + '/'];
    if (doc) {
      urlPath = urlPath + '/';
    }
  }

  const doc = pageContext.globalContext.docs?.[urlPath];
  if (!doc) {
    return { doc: null, segments: [] };
  }

  // Read and parse markdown
  const rawContent = await fs.readFile(doc.filePath, 'utf-8');
  const { content: markdown } = matter(rawContent);

  // Parse markdown to AST
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);

  const segments: ContentSegment[] = [];
  let currentChunk: RootContent[] = [];
  let lineNumber = 0; // Approximate line tracking

  for (const node of tree.children) {
    lineNumber++;
    const tagText = extractLiquidTag(node);

    if (tagText) {
      // Flush HTML chunk
      if (currentChunk.length > 0) {
        const html = await processMarkdownChunk(currentChunk);
        if (html.trim()) segments.push({ type: 'html', html });
        currentChunk = [];
      }

      const tag = parseLiquidTag(tagText);
      if (!tag) {
        throw new Error(`Invalid tag: ${tagText} in ${doc.filePath}`);
      }

      if (tag.type === 'example-link') {
        const exampleMeta = pageContext.globalContext.examples?.[tag.example];
        segments.push({
          type: 'example-link',
          example: tag.example,
          title: exampleMeta?.title || tag.example,
        });
      } else if (tag.type === 'example-file') {
        const { content, language } = await resolveFileContent(
          tag.example, tag.path, tag.hunk, doc.filePath, lineNumber
        );
        const highlightedHtml = await highlightCode(content, language);
        segments.push({
          type: 'file',
          filename: `${tag.example}/${tag.path}${tag.hunk ? '#' + tag.hunk : ''}`,
          language,
          content,
          highlightedHtml,
        });
      } else if (tag.type === 'file') {
        throw new Error(
          `{% file %} is only valid in example content.md files. Use {% example name:path %} instead. (${doc.filePath}:${lineNumber})`
        );
      }
    } else {
      currentChunk.push(node);
    }
  }

  // Flush remaining chunk
  if (currentChunk.length > 0) {
    const html = await processMarkdownChunk(currentChunk);
    if (html.trim()) segments.push({ type: 'html', html });
  }

  return { doc, segments };
}
```

**Step 3: Create the page component**

```tsx
// docs-site/pages/docs/+Page.tsx
import { useData } from 'vike-react/useData';
import { Link } from '../../components/Link';
import { CodeBlock } from '../../components/CodeBlock';
import type { DocsData, ContentSegment } from './+data';

export default function Page() {
  const { doc, segments } = useData<DocsData>();

  if (!doc) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-red-500">Page Not Found</h1>
        <p className="mt-4 text-zinc-400">
          The documentation page you're looking for doesn't exist.
        </p>
        <Link href="/docs/" className="text-cyan-400 hover:text-cyan-300 mt-4 inline-block">
          ← Back to Documentation
        </Link>
      </div>
    );
  }

  return (
    <article className="max-w-4xl mx-auto px-4 py-8">
      <div className="prose prose-invert prose-cyan max-w-none">
        {segments.map((segment, i) => (
          <SegmentRenderer key={i} segment={segment} />
        ))}
      </div>
    </article>
  );
}

function SegmentRenderer({ segment }: { segment: ContentSegment }) {
  if (segment.type === 'html') {
    return <div dangerouslySetInnerHTML={{ __html: segment.html }} />;
  }

  if (segment.type === 'file') {
    return (
      <CodeBlock
        code={segment.content}
        language={segment.language}
        filename={segment.filename}
        highlightedHtml={segment.highlightedHtml}
      />
    );
  }

  if (segment.type === 'example-link') {
    return (
      <div className="not-prose my-4">
        <Link
          href={`/examples/${segment.example}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/20 transition-colors"
        >
          <span>📦</span>
          <span>View Example: {segment.title}</span>
          <span>→</span>
        </Link>
      </div>
    );
  }

  return null;
}
```

**Step 4: Create the pre-render start hook**

```typescript
// docs-site/pages/docs/+onBeforePrerenderStart.ts
import type { OnBeforePrerenderStartSync } from 'vike/types';
import { getDocsDir, scanDocs } from '../../server/utils/docs';

export const onBeforePrerenderStart: OnBeforePrerenderStartSync = async () => {
  const docsDir = await getDocsDir();
  const docs = await scanDocs(docsDir);

  return Object.keys(docs).map((urlPath) => urlPath);
};
```

**Step 5: Commit**

```bash
git add docs-site/pages/docs/
git commit -m "feat(docs-site): add Vike pages for markdown docs"
```

---

## Task 5: Update Global Context for Docs

**Files:**
- Modify: `docs-site/pages/+onCreateGlobalContext.server.ts`
- Modify: `docs-site/vike-types.d.ts`

**Step 1: Update vike-types.d.ts**

```typescript
// docs-site/vike-types.d.ts
import { type ExampleMetadata } from './server/utils/examples';
import { type DocMetadata } from './server/utils/docs';

export interface NavigationItem {
  title: string;
  path: string;
  children?: NavigationItem[];
}

declare global {
  namespace Vike {
    interface GlobalContext {
      examples: Record<string, ExampleMetadata>;
      docs: Record<string, DocMetadata>;
      navigation: NavigationItem[];
    }
  }
}

export { NavigationItem };
```

**Step 2: Update onCreateGlobalContext.server.ts**

```typescript
// docs-site/pages/+onCreateGlobalContext.server.ts
import { GlobalContextServer } from 'vike/types';
import { scanExamples } from '../server/utils/examples';
import { scanDocs, buildDocsNavigation, getDocsDir } from '../server/utils/docs';
import { NavigationItem } from '../vike-types';

export async function onCreateGlobalContext(
  context: Partial<GlobalContextServer>
): Promise<void> {
  const examples = await scanExamples();
  const docsDir = await getDocsDir();
  const docs = await scanDocs(docsDir);
  const docsNavigation = buildDocsNavigation(docs);

  const navigation: NavigationItem[] = [
    // Dynamic docs navigation (from frontmatter)
    ...docsNavigation,
    // Static sections
    {
      title: 'Getting Started',
      path: '/getting-started',
      children: [
        { title: 'Installation', path: '/getting-started/installation' },
        { title: 'Quick Start', path: '/getting-started/quick-start' },
        { title: 'First Worker', path: '/getting-started/first-worker' },
      ],
    },
    {
      title: 'Examples',
      path: '/examples',
      children: examples.map((ex) => ({
        title: ex.title,
        path: `/examples/${ex.id}`,
      })),
    },
    {
      title: 'API Reference',
      path: '/api',
      children: [
        { title: 'createWorker', path: '/api/create-worker' },
        { title: 'startWorkerServer', path: '/api/start-worker-server' },
        { title: 'Handlers Type', path: '/api/handlers' },
        { title: 'DefineMessages', path: '/api/define-messages' },
      ],
    },
  ];

  context.examples = Object.fromEntries(examples.map((ex) => [ex.id, ex]));
  context.docs = docs;
  context.navigation = navigation;
}
```

**Step 3: Commit**

```bash
git add docs-site/pages/+onCreateGlobalContext.server.ts docs-site/vike-types.d.ts
git commit -m "feat(docs-site): integrate docs into global context and navigation"
```

---

## Task 6: Update Example Data Loader for Liquid Tags

**Files:**
- Modify: `docs-site/pages/examples/@id/+data.ts`

**Step 1: Update the placeholder detection to use Liquid syntax**

Replace the `isFilePlaceholder` function and related code to support both legacy `{{file:}}` and new `{% file %}` syntax, plus `{% example %}` tags.

```typescript
// In docs-site/pages/examples/@id/+data.ts
// Update imports
import { parseLiquidTag, isLiquidTag } from '../../../server/utils/liquid-tags';
import { extractHunk, stripMarkers } from '../../../server/utils/regions';

// Replace isFilePlaceholder with:
function extractPlaceholder(
  node: RootContent
): { type: 'file' | 'legacy'; filename: string; hunk?: string } | null {
  if (node.type !== 'paragraph' || node.children.length !== 1) return null;
  const child = node.children[0];
  if (child.type !== 'text') return null;

  const text = child.value.trim();

  // Try new Liquid syntax first
  const tag = parseLiquidTag(text);
  if (tag && tag.type === 'file') {
    return { type: 'file', filename: tag.path, hunk: tag.hunk };
  }

  // Fall back to legacy {{file:...}} for backwards compatibility
  const legacyMatch = text.match(/^\{\{file:([^}]+)\}\}$/);
  if (legacyMatch) {
    const [filename, hunk] = legacyMatch[1].trim().split('#');
    return { type: 'legacy', filename, hunk };
  }

  return null;
}
```

Then update `parseMarkdownToSegments` to use `extractHunk` and `stripMarkers` when processing files.

**Step 2: Commit**

```bash
git add docs-site/pages/examples/@id/+data.ts
git commit -m "feat(docs-site): add Liquid tag and hunk support to example pages"
```

---

## Task 7: Migrate Existing Content Files

**Files:**
- Modify: `examples/basic-ping/content.md`
- Modify: `examples/error-handling/content.md`

**Step 1: Update basic-ping/content.md**

```markdown
# Basic Ping-Pong Worker

This example demonstrates the fundamental request/response pattern with isolated-workers.

## Overview

The ping-pong example shows:

- How to define message types using `DefineMessages`
- How to spawn a worker process
- How to send messages and receive responses
- Proper cleanup and shutdown

## Files

### Shared Message Definitions

First, define the message types in a shared file that both host and worker import:

{% file messages.ts %}

### Host (Client)

The host imports the message types and uses them with `createWorker<Messages>()`:

{% file host.ts %}

### Worker

The worker imports the same message types and uses `Handlers<Messages>` for type-safe handlers:

{% file worker.ts %}

## Running the Example

```bash
pnpm nx run examples:run-example --example=basic-ping
```

## Key Concepts

1. **Message Definitions**: Type-safe messages using `DefineMessages<T>`
2. **Worker Spawning**: Creating a worker with `createWorker()`
3. **Message Exchange**: Sending and receiving with automatic correlation
4. **Cleanup**: Graceful shutdown with `worker.close()`
```

**Step 2: Update error-handling/content.md similarly**

**Step 3: Commit**

```bash
git add examples/basic-ping/content.md examples/error-handling/content.md
git commit -m "chore(examples): migrate content.md to Liquid tag syntax"
```

---

## Task 8: Create Sample Docs Folder

**Files:**
- Create: `docs/index.md`
- Create: `docs/guides/index.md`
- Create: `docs/guides/error-handling.md`

**Step 1: Create docs/index.md**

```markdown
---
title: Documentation
description: isolated-workers documentation
nav:
  section: Docs
  order: 1
---

# isolated-workers Documentation

Welcome to the isolated-workers documentation. This library provides type-safe worker process management for Node.js.

## Quick Links

- [Getting Started](/getting-started/installation)
- [Guides](/docs/guides/)
- [API Reference](/api)
- [Examples](/examples)
```

**Step 2: Create docs/guides/index.md**

```markdown
---
title: Guides
description: In-depth guides for isolated-workers
nav:
  section: Guides
  order: 1
---

# Guides

Learn how to use isolated-workers effectively with these guides.
```

**Step 3: Create docs/guides/error-handling.md with example reference**

```markdown
---
title: Error Handling
description: How to handle errors across process boundaries
nav:
  section: Guides
  order: 2
---

# Error Handling Guide

Learn how to handle errors when working with isolated workers.

## Basic Error Handling

When a worker throws an error, it gets serialized and re-thrown on the host side.

Here's how to set up error handling:

{% example error-handling:host.ts %}

## See Also

{% example error-handling %}
```

**Step 4: Commit**

```bash
git add docs/
git commit -m "docs: add initial docs folder with sample guides"
```

---

## Task 9: Build and Verify

**Step 1: Run type check**

Run: `pnpm nx run docs-site:build`
Expected: Build succeeds without errors

**Step 2: Verify pre-rendered pages**

Run: `ls docs-site/dist/client/docs/`
Expected: See generated HTML files for docs pages

**Step 3: Run all tests**

Run: `pnpm nx run-many -t test,lint,build`
Expected: All pass

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(docs-site): address build issues"
```

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Region parser utility | +2 new files |
| 2 | Liquid tag parser | +2 new files |
| 3 | Docs scanner utility | +2 new files, +1 dependency |
| 4 | Docs Vike pages | +4 new files |
| 5 | Global context integration | 2 modified |
| 6 | Example page updates | 1 modified |
| 7 | Content migration | 2 modified |
| 8 | Sample docs folder | +3 new files |
| 9 | Build verification | 0 files |

Total: ~15 files changed, 9 commits
