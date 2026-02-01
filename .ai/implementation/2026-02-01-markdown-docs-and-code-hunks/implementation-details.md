# Implementation Details

## Region Parser (`docs-site/server/utils/regions.ts`)

### Data Structures

```typescript
interface RegionMap {
  [regionId: string]: {
    startLine: number;  // 0-indexed line where content starts
    endLine: number;    // 0-indexed line where content ends (exclusive)
    content: string;    // Extracted content without markers
  };
}
```

### Key Functions

#### `parseRegions(code: string): RegionMap`
- Scans code line-by-line for `#region` and `#endregion` markers
- Supports nested regions (each tracked independently)
- Throws on orphan `#endregion` (no matching start)
- Returns map of region ID → content

#### `extractHunk(code: string, regionId: string): string`
- Convenience wrapper: parses regions and returns specific one
- Throws if region not found

#### `stripMarkers(code: string): string`
- Removes all `#region` and `#endregion` lines
- Used when displaying full file without markers

### Marker Pattern

```typescript
const REGION_START = /^\s*(?:\/\/|\/\*|#|<!--)\s*#region\s+(\S+)/;
const REGION_END = /^\s*(?:\/\/|\/\*|#|<!--)\s*#endregion(?:\s+(\S+))?/;
```

Supports: `//`, `/* */`, `#`, `<!-- -->` comment styles.

---

## Liquid Tag Parser (`docs-site/server/utils/liquid-tags.ts`)

### Tag Types

```typescript
type LiquidTag =
  | { type: 'file'; path: string; hunk: string | undefined }
  | { type: 'example-link'; example: string }
  | { type: 'example-file'; example: string; path: string; hunk: string | undefined };
```

### Parsing Logic

```typescript
const LIQUID_TAG_REGEX = /^\{%\s*(file|example|example-link)\s+(.+?)\s*%\}$/;
```

1. **`{% file path.ts %}`** → `{ type: 'file', path: 'path.ts', hunk: undefined }`
2. **`{% file path.ts#setup %}`** → `{ type: 'file', path: 'path.ts', hunk: 'setup' }`
3. **`{% example basic-ping:host.ts %}`** → `{ type: 'example-file', example: 'basic-ping', path: 'host.ts', hunk: undefined }`
4. **`{% example-link basic-ping %}`** → `{ type: 'example-link', example: 'basic-ping' }`

---

## Docs Scanner (`docs-site/server/utils/docs.ts`)

### Scanning Process

1. **`getDocsDir()`** - Resolves absolute path to `docs/` from repo root
2. **`scanDocs(docsRoot)`** - Recursively walks directory, parses each `.md` file
3. **`buildDocsNavigation(docs)`** - Groups by `nav.section`, sorts by `nav.order`

### Frontmatter Schema

```yaml
---
title: Error Handling          # Required
description: How errors work   # Optional
nav:                           # Optional
  section: Guides              # Groups in sidebar
  order: 2                     # Sort within section
---
```

### Path Resolution

| File Path | URL Path |
|-----------|----------|
| `docs/index.md` | `/docs` |
| `docs/guides/index.md` | `/docs/guides` |
| `docs/guides/error-handling.md` | `/docs/guides/error-handling` |

---

## Vike Integration

### Route (`+route.ts`)

```typescript
export default '/docs/*';
```

### Data Loading (`+data.ts`)

1. Extract path from route params
2. Look up doc in `globalContext.docs`
3. Read markdown file
4. Parse with remark, process Liquid tags
5. Return segments array for rendering

### Segment Types

```typescript
type ContentSegment =
  | { type: 'html'; html: string }
  | { type: 'file'; filename: string; language: string; content: string; highlightedHtml: string }
  | { type: 'example-link'; example: string; title: string; path: string };
```

### Prerendering (`+onBeforePrerenderStart.ts`)

```typescript
export async function onBeforePrerenderStart(globalContext) {
  return Object.keys(globalContext.docs).map(path => `/docs/${path}`);
}
```

---

## Global Context Updates

### Type Declaration (`vike-types.d.ts`)

```typescript
declare global {
  namespace Vike {
    interface GlobalContext {
      examples: Record<string, ExampleMetadata>;
      docs: Record<string, DocMetadata>;      // Added
      navigation: NavigationItem[];
    }
  }
}
```

### Context Creation (`+onCreateGlobalContext.server.ts`)

```typescript
const docsDir = await getDocsDir();
const docs = await scanDocs(docsDir);
const docsNavigation = buildDocsNavigation(docs);

context.docs = docs;
context.navigation = [...docsNavigation, ...staticNavigation];
```

---

## Error Handling

All errors are build-time (thrown during prerender):

| Error | Message |
|-------|---------|
| Missing file | `Referenced file "X" not found in example "Y"` |
| Missing region | `Region 'X' not found in file "Y" in example "Z"` |
| Missing doc | Returns `{ doc: null }`, Page shows 404 |

---

## Backwards Compatibility

The example pages (`pages/examples/@id/+data.ts`) support both syntaxes:

- Legacy: `{{file:messages.ts}}`
- New: `{% file messages.ts %}`

The `extractFilePlaceholder` function checks for Liquid syntax first, then falls back to legacy regex.
