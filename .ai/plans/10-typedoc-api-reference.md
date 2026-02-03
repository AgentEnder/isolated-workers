# Plan 10: TypeDoc API Reference Integration

## Overview

Integrate TypeDoc with Vike to generate fully dynamic API reference documentation from the `isolated-workers` package source code. The `/api/*` routes will be entirely driven by TypeDoc JSON output, with custom React components for rendering.

## Goals

- Generate API documentation from TypeScript source and JSDoc comments
- Serve at `/api/*` with nested routes: `/api/:module/:export`
- Fully dynamic navigation replacing static placeholder entries
- Custom React rendering matching site design
- Dev-time generation with caching (regenerate on server restart)

## URL Structure

```
/api                        → Landing page (list all modules)
/api/:module                → Module index (overview + export list)
/api/:module/:export        → Individual export (full documentation)
```

Examples:
- `/api/core/createWorker`
- `/api/types/DefineMessages`
- `/api/utils/JsonSerializer`

## Data Structures

```typescript
interface ApiModule {
  name: string;           // "core", "types", "utils"
  path: string;           // "/api/core"
  description?: string;   // from @packageDocumentation
  exports: ApiExport[];
}

interface ApiExport {
  name: string;           // "createWorker"
  kind: 'function' | 'type' | 'interface' | 'class' | 'variable';
  path: string;           // "/api/core/createWorker"
  signature?: string;     // Full TypeScript signature
  description?: string;   // JSDoc description
  params?: ApiParam[];    // Function parameters
  returns?: ApiReturn;    // Return type info
  examples?: string[];    // @example blocks
  see?: string[];         // @see references
  remarks?: string;       // @remarks content
}
```

## File Structure

```
docs-site/
├── pages/api/
│   ├── +route.ts                    # Match /api, /api/*, /api/*/*
│   ├── +data.ts                     # Fetch from globalContext.api
│   ├── +Page.tsx                    # Switch rendering by route depth
│   ├── +onBeforePrerenderStart.ts   # Generate routes for SSG
│   └── components/
│       ├── ApiLanding.tsx           # Grid/list of modules
│       ├── ApiModule.tsx            # Module overview + exports
│       ├── ApiExport.tsx            # Full export documentation
│       ├── TypeSignature.tsx        # Syntax-highlighted signatures
│       ├── ParamsTable.tsx          # Function parameters
│       ├── TypeLink.tsx             # Cross-reference links
│       └── JsDocBlock.tsx           # @remarks, @example rendering
└── server/utils/
    └── typedoc.ts                   # TypeDoc runner & JSON parser

typedoc.json                         # TypeDoc configuration (repo root)
```

## TypeDoc Configuration

- Entry point: `packages/isolated-workers/src/index.ts`
- Output: JSON format to `.typedoc/api.json` (gitignored)
- Follow exports to document full public API
- Include JSDoc comments, examples, and type information

## GlobalContext Integration

TypeDoc data loads alongside existing docs/examples:

```typescript
// +onCreateGlobalContext.server.ts
const api = await loadApiDocs();

context.api = api;
context.navigation = combineNavigationItems([
  ...docsNavigation,
  buildApiNavigation(api),  // Dynamic API navigation
  // ...
]);
```

## Key Features

1. **Syntax Highlighting** - TypeScript signatures rendered with existing highlighter
2. **Cross-Linking** - Type references link to their documentation pages
3. **JSDoc Support** - Full support for @example, @remarks, @see, @param, @returns
4. **Module Overviews** - @packageDocumentation provides module-level prose

## Non-Goals (for initial implementation)

- File watching for API docs (regenerate on server restart is sufficient)
- Search within API docs (can add later with Pagefind)
- Version switching (single version for now)

## Success Criteria

- [ ] TypeDoc generates JSON from isolated-workers source
- [ ] `/api` shows all modules with descriptions
- [ ] `/api/:module` shows module overview + hierarchical export list
- [ ] `/api/:module/:export` shows full export documentation
- [ ] Navigation sidebar dynamically populated from TypeDoc
- [ ] Type cross-references are clickable links
- [ ] JSDoc examples render as code blocks
