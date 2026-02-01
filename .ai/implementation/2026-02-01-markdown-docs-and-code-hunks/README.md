# Markdown Docs and Code Hunks Implementation

**Plan**: [2026-02-01-markdown-docs-and-code-hunks-design.md](../../plans/2026-02-01-markdown-docs-and-code-hunks-design.md)
**ADR**: [008-markdown-docs-and-code-hunks.md](../../design-decisions/008-markdown-docs-and-code-hunks.md)
**Status**: ✅ Completed
**Date**: 2026-02-01

## Overview

This implementation adds two major features to the docs-site:

1. **Markdown Documentation System** - Write guides in `docs/` folder, rendered by Vike
2. **Code Hunk Extraction** - Mark regions in example code, reference them in docs

## Files Created/Modified

### New Server Utilities

| File | Purpose |
|------|---------|
| `docs-site/server/utils/regions.ts` | Parse `#region`/`#endregion` markers, extract hunks |
| `docs-site/server/utils/regions.test.ts` | 10 tests for region parsing |
| `docs-site/server/utils/liquid-tags.ts` | Parse Liquid-style `{% %}` tags |
| `docs-site/server/utils/liquid-tags.test.ts` | 8 tests for tag parsing |
| `docs-site/server/utils/docs.ts` | Scan docs folder, parse frontmatter, build navigation |
| `docs-site/server/utils/docs.test.ts` | 5 tests for docs scanning |

### New Vike Pages

| File | Purpose |
|------|---------|
| `docs-site/pages/docs/+route.ts` | Splat route `/docs/*` |
| `docs-site/pages/docs/+data.ts` | Load markdown, process tags, return segments |
| `docs-site/pages/docs/+Page.tsx` | Render doc with HTML and code blocks |
| `docs-site/pages/docs/+onBeforePrerenderStart.ts` | Discover all doc paths for SSG |

### Modified Files

| File | Change |
|------|--------|
| `docs-site/vike-types.d.ts` | Added `docs` to GlobalContext |
| `docs-site/pages/+onCreateGlobalContext.server.ts` | Added docs scanning and navigation |
| `docs-site/pages/examples/@id/+data.ts` | Added Liquid tag and hunk support |
| `examples/basic-ping/content.md` | Migrated to Liquid syntax |
| `examples/error-handling/content.md` | Migrated to Liquid syntax |

### Sample Documentation

| File | Purpose |
|------|---------|
| `docs/index.md` | Documentation landing page |
| `docs/guides/index.md` | Guides section index |
| `docs/guides/error-handling.md` | Example guide with code references |

## Dependencies Added

- `gray-matter` - YAML frontmatter parsing (see ADR 008)

## Test Coverage

- **23 total tests** across 3 test files
- Region parser: nested regions, orphan markers, empty regions
- Liquid tags: file, example, example-link variations
- Docs scanner: filesystem structure, frontmatter parsing, navigation building

## Commits

1. `bf16221` - Region parser utility
2. `5fa6fff` - Liquid tag parser
3. `a37de84` - Docs scanner with frontmatter
4. `7323293` - Docs Vike pages
5. `fa9e2c8` - Global context integration
6. `c24467d` - Example pages Liquid tag support
7. `e0575ca` - Migrate example content files
8. `f616d68` - Sample docs folder
