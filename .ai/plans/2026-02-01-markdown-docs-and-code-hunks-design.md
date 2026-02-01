# Markdown Docs & Code Hunks System

**Date:** 2026-02-01
**Status:** Approved

## Overview

Enhance the docs-site to support markdown-based documentation in a root-level `docs/` folder, with the ability to reference specific code "hunks" from example files using `#region` annotations.

## Goals

1. Write documentation guides in markdown, separate from the rendering system
2. Reference specific code sections from examples without showing entire files
3. Maintain build-time validation - broken references fail the build
4. Clean output - region markers are stripped from rendered code

## File Structure

```
isolated-workers/
├── docs/                           # Markdown documentation
│   ├── guides/
│   │   ├── index.md               # → /docs/guides/
│   │   ├── error-handling.md      # → /docs/guides/error-handling
│   │   └── type-safety.md         # → /docs/guides/type-safety
│   ├── concepts/
│   │   └── workers.md             # → /docs/concepts/workers
│   └── index.md                   # → /docs/
│
├── examples/                       # Enhanced with region markers
│   └── basic-ping/
│       ├── host.ts                # Contains #region markers
│       └── content.md             # Uses {% file %} syntax
│
└── docs-site/
    └── pages/
        └── docs/
            ├── +route.ts          # Splat route: /docs/*
            ├── +data.ts           # Load & process markdown
            ├── +Page.tsx          # Render markdown content
            └── +onBeforePrerenderStart.ts
```

## Routing

- **Filesystem-based:** `docs/guides/error-handling.md` → `/docs/guides/error-handling`
- **Index files:** `docs/guides/index.md` → `/docs/guides/` (no `/index` suffix)
- **Frontmatter override:** Optional `path:` field in frontmatter

### Frontmatter Schema

```yaml
---
title: Error Handling Guide
description: Learn how to handle errors across process boundaries
nav:
  section: Guides
  order: 2
path: /docs/custom-path  # Optional override
---
```

## Region Annotation System

### Syntax

```typescript
// examples/basic-ping/host.ts

import { createWorker } from 'isolated-workers';
import { messages } from './messages';

// #region setup
const worker = createWorker({
  workerPath: './worker.ts',
  messages,
});
// #endregion setup

// #region usage
const result = await worker.send('ping', { message: 'hello' });
console.log(result.response);
// #endregion usage

// #region cleanup
await worker.shutdown();
// #endregion cleanup
```

### Behaviors

- Regions can be nested (outer region includes inner content)
- Region IDs must be unique within a file
- Empty lines at start/end of region are trimmed
- Indentation is preserved
- Markers are always stripped from output (full file or hunk)

### Validation

- Unmatched `#region`/`#endregion` pairs cause build errors
- Missing region IDs in references cause build errors

## Markdown Reference Syntax

Using Liquid-style tags:

| Syntax | Context | Result |
|--------|---------|--------|
| `{% file host.ts %}` | Examples only | Relative file from current example |
| `{% file host.ts#setup %}` | Examples only | Specific hunk from relative file |
| `{% example basic-ping %}` | Anywhere | Link to the example page |
| `{% example basic-ping:host.ts %}` | Anywhere | File from that example |
| `{% example basic-ping:host.ts#setup %}` | Anywhere | Hunk from example file |

### Resolution Rules

1. `{% file ... %}` - Path relative to current example directory
2. `{% example name:path %}` - Path relative to `examples/{name}/`
3. `{% example name %}` - Renders as link to `/examples/{name}`

### Error Messages

Build fails with clear messages:
- `File not found: examples/basic-ping/host.ts (referenced from docs/guides/error-handling.md:15)`
- `Region 'setup' not found in examples/basic-ping/host.ts (referenced from docs/guides/error-handling.md:15)`
- `Unclosed region 'setup' in examples/basic-ping/host.ts`

## Processing Pipeline

In `+data.ts`:

1. Read markdown file
2. Parse frontmatter (title, description, nav, path)
3. Parse markdown body with remark
4. Walk AST, find `{% ... %}` placeholders
5. For each placeholder:
   - Resolve file path
   - Read file content
   - Parse regions if `#hunk` specified
   - Extract hunk content (throw if not found)
   - Strip all region markers
   - Syntax highlight with Shiki
6. Return `{ frontmatter, segments[] }`
7. Throw on any missing file/hunk (fails build)

## Navigation Integration

### Global Context (`+onCreateGlobalContext.server.ts`)

```typescript
export async function onCreateGlobalContext() {
  const examples = await scanExamples();
  const docs = await scanDocs();  // NEW

  const navigation = [
    ...buildDocsNavigation(docs),  // From frontmatter nav fields
    {
      title: 'Examples',
      items: Object.values(examples).map(ex => ({
        title: ex.title,
        href: `/examples/${ex.id}`,
      })),
    },
  ];

  return { examples, docs, navigation };
}
```

### `scanDocs()` Utility

```typescript
interface DocMetadata {
  path: string;           // URL path
  filePath: string;       // Filesystem path
  title: string;
  description?: string;
  nav?: {
    section: string;
    order: number;
  };
}
```

- Recursively scan `docs/` folder for `.md` files
- Parse frontmatter from each file
- Return `Record<path, DocMetadata>`

### `buildDocsNavigation()`

- Group docs by `nav.section`
- Sort within each section by `nav.order`
- Return `NavigationItem[]` structure

## Implementation Scope

### New Files

```
docs/                                    # New folder
docs-site/server/utils/docs.ts           # scanDocs(), buildDocsNavigation()
docs-site/server/utils/regions.ts        # parseRegions(), extractHunk(), stripMarkers()
docs-site/pages/docs/+route.ts           # Splat route
docs-site/pages/docs/+data.ts            # Load & process markdown
docs-site/pages/docs/+Page.tsx           # Render doc page
docs-site/pages/docs/+onBeforePrerenderStart.ts
```

### Modified Files

```
docs-site/server/utils/examples.ts       # Add hunk support
docs-site/pages/examples/@id/+data.ts    # Use region utilities
docs-site/+onCreateGlobalContext.server.ts  # Add docs scanning
examples/basic-ping/content.md           # Migrate to {% file %}
examples/error-handling/content.md       # Migrate to {% file %}
```

### Out of Scope

- Nested docs folders beyond 2 levels
- Table of contents generation
- Prev/next navigation between docs
- Search integration (Pagefind handles automatically)
