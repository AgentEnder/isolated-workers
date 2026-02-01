# Markdown Docs and Code Hunks System

## Decision: Root-Level `docs/` Folder for Markdown Documentation

**Status**: ✅ Accepted
**Context**: Need a system for writing documentation guides in markdown
**Alternatives Considered**: Docs in docs-site folder, docs in .ai folder
**Rationale**:

- Root-level `docs/` is conventional and discoverable
- Separates content from presentation (docs-site handles rendering)
- Allows documentation to be read directly on GitHub
- Consistent with common open source patterns

## Decision: Use gray-matter for Frontmatter Parsing

**Status**: ✅ Accepted
**Context**: Need to parse YAML frontmatter from markdown files
**Alternatives Considered**: Custom regex parsing, remark-frontmatter, front-matter package
**Rationale**:

- gray-matter is the de facto standard for frontmatter parsing
- Well-maintained with 10M+ weekly downloads
- Handles edge cases (multi-document YAML, custom delimiters)
- Simple API: `matter(content)` returns `{ data, content }`
- Already familiar pattern from other static site generators

## Decision: Liquid Tag Syntax (`{% %}`) Over Handlebars (`{{ }}`)

**Status**: ✅ Accepted
**Context**: Need syntax for referencing code files and examples in markdown
**Alternatives Considered**: Handlebars `{{file:...}}`, custom HTML elements, MDX components
**Rationale**:

- Liquid tags are visually distinct from JavaScript template literals
- Less likely to conflict with code examples showing template strings
- Familiar from Jekyll, Shopify, and other systems
- Clear difference between tags (`{% %}`) and variables (`{{ }}`)
- Easier to parse unambiguously

Supported tags:
- `{% file path.ts %}` - Reference file in current example context
- `{% file path.ts#region %}` - Reference specific region/hunk
- `{% example example-id:path.ts %}` - Cross-example file reference
- `{% example-link example-id %}` - Link to example page

## Decision: Region Markers Using `#region`/`#endregion` Syntax

**Status**: ✅ Accepted
**Context**: Need to mark extractable code sections in example files
**Alternatives Considered**: Custom `// begin-hunk-{id}`, HTML comments, JSDoc-style tags
**Rationale**:

- IDE-friendly: VS Code, JetBrains, and others recognize `#region` for code folding
- Language-agnostic: Works in JS/TS (`// #region`), CSS (`/* #region */`), etc.
- Developer experience: Regions are collapsible in editors
- Familiar pattern from C# and other languages
- Markers are stripped from rendered output

Format:
```typescript
// #region setup
const worker = createWorker<Messages>('./worker.ts');
// #endregion setup
```

## Decision: Build-Time Validation Over Runtime

**Status**: ✅ Accepted
**Context**: How to handle missing file/region references
**Alternatives Considered**: Runtime fallback with warning, silent skip, placeholder text
**Rationale**:

- Docs site uses SSG (Static Site Generation)
- Build-time errors prevent broken docs from being deployed
- Throws in `+data.ts` hook during prerender
- Clear error messages identify the problem file and missing reference
- Matches "fail fast" philosophy

## Decision: Frontmatter-Driven Navigation

**Status**: ✅ Accepted
**Context**: How to organize docs in the navigation sidebar
**Alternatives Considered**: Filesystem-only, separate config file, hardcoded in code
**Rationale**:

- Each doc controls its own placement via `nav.section` and `nav.order`
- No separate config file to keep in sync
- Docs can be reorganized by changing frontmatter
- Sections are auto-generated from unique `nav.section` values
- Fallback to filesystem structure if no frontmatter

Example frontmatter:
```yaml
---
title: Error Handling
description: How errors propagate from workers
nav:
  section: Guides
  order: 2
---
```

## Decision: Vike Splat Route for Docs

**Status**: ✅ Accepted
**Context**: How to route arbitrary doc paths
**Alternatives Considered**: Individual routes per doc, filesystem routing
**Rationale**:

- Single `/docs/*` splat route handles all doc paths
- Path structure mirrors filesystem (`docs/guides/error-handling.md` → `/docs/guides/error-handling`)
- `index.md` files don't append to path (`docs/guides/index.md` → `/docs/guides`)
- Prerender discovers all paths via `onBeforePrerenderStart`
- Flexible: docs can be nested arbitrarily deep

## Decision: Always Strip Region Markers from Output

**Status**: ✅ Accepted
**Context**: Whether to show or hide region markers in rendered code
**Alternatives Considered**: Option to show markers, show as comments
**Rationale**:

- Markers are for documentation tooling, not for readers
- Cleaner code display without comment noise
- `stripMarkers()` utility removes all `#region`/`#endregion` lines
- When extracting a hunk, only that region's code is shown
- Consistent behavior regardless of context
