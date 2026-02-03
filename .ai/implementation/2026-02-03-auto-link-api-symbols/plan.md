# Auto-link API Symbols in Code Blocks

## Overview

Replace liquid tags inside code blocks with automatic symbol linking based on import statements. This allows TypeScript/JavaScript code in documentation to have clickable references to API documentation.

## Why This Enhancement?

The current approach of using liquid tags `{% typedoc export:module:symbol %}` inside code blocks doesn't work because code blocks are treated as literal text. Auto-linking based on import statements provides:

- **Seamless UX**: Write normal code, symbols become links automatically
- **Always accurate**: Links reflect actual imports in the code
- **Type-safe validation**: Only link symbols that are actually imported
- **Maintainable**: No manual tag maintenance needed

## Implementation Approach

### Phase 1: Code Block Analysis

Create utility to parse code blocks and extract imports:

```typescript
interface ImportInfo {
  source: string;        // 'isolated-workers' or './types'
  symbols: string[];     // ['createWorker', 'DefineMessages']
  isTypeImport: boolean; // true for `import type { ... }`
}

function extractImports(code: string, lang: string): ImportInfo[] {
  // Only process TypeScript/JavaScript
  if (!['ts', 'typescript', 'js', 'javascript'].includes(lang)) {
    return [];
  }

  // Parse import statements using regex or TypeScript compiler API
  // Returns array of imported symbols with their source
}
```

### Phase 2: Symbol Lookup in API Docs

Create function to find API exports for imported symbols:

```typescript
function findApiExport(
  apiDocs: ApiDocs,
  symbolName: string,
  importSource?: string
): ApiExport | null {
  // If importSource is 'isolated-workers', search all exports
  // If importSource is a relative path, infer module from context
  // Return matching ApiExport or null
}
```

### Phase 3: Code Block Transformation Plugin

Create remark plugin to transform code blocks:

```typescript
export const remarkCodeLinks: Plugin<
  [{ apiDocs: ApiDocs }],
  Root
> = ({ apiDocs }) => {
  return (tree) => {
    visit(tree, 'code', (node: Code) => {
      if (node.lang && ['ts', 'typescript'].includes(node.lang)) {
        const imports = extractImports(node.value, node.lang);

        // Build mapping of symbol -> link
        const symbolLinks = new Map<string, string>();
        for (const imp of imports) {
          for (const symbol of imp.symbols) {
            const export = findApiExport(apiDocs, symbol, imp.source);
            if (export) {
              symbolLinks.set(symbol, export.path);
            }
          }
        }

        // Replace symbols with links in code
        if (symbolLinks.size > 0) {
          node.value = linkSymbols(node.value, symbolLinks);
        }
      }
    });
  };
};
```

### Phase 4: Symbol Linking Logic

Replace symbol occurrences with HTML links:

```typescript
function linkSymbols(code: string, symbolLinks: Map<string, string>): string {
  // Find all symbol references in code
  // Avoid replacing:
  //   - Inside string literals
  //   - Inside comments
  //   - In import/export statements themselves
  //   - As property access (e.g., `worker.send` - only link 'worker')
  //
  // Replace with: <a href="/api/core/createWorker" class="code-link">createWorker</a>
}
```

## Technical Considerations

### Complexity Analysis

**Simple approach (regex-based)**:
- Pros: Easy to implement, fast
- Cons: May have false positives/negatives

**Robust approach (TypeScript compiler API)**:
- Pros: Accurate symbol identification
- Cons: Complex, requires TypeScript as runtime dependency

**Recommended**: Start with regex approach, upgrade if needed

### Edge Cases

1. **Duplicate symbol names**: If multiple imports have same name, prefer the one from 'isolated-workers'
2. **Local symbols**: Don't link locally defined variables/functions
3. **Property access**: Link only the identifier, not the full path (e.g., link `worker` in `worker.send`)
4. **String literals/comments**: Skip replacements inside these
5. **Import/export statements**: Skip replacements in import/export lines

### Performance

- Cache API docs (already implemented in `loadApiDocs()`)
- Process code blocks once per page render
- Use efficient regex patterns

## Success Criteria

- [ ] Imported symbols from 'isolated-workers' become clickable links
- [ ] Links point to correct API documentation pages
- [ ] Code blocks render with highlighted syntax AND links
- [ ] No false positives (local symbols not linked)
- [ ] No false negatives (imported symbols are linked)
- [ ] Works in all markdown files
- [ ] Existing liquid tags still work for non-code content

## Files to Modify

1. `docs-site/server/utils/code-links.ts` (new) - Import extraction and symbol linking
2. `docs-site/server/utils/remark-code-links.ts` (new) - Remark plugin
3. `docs-site/server/utils/markdown.ts` - Add plugin to processor chain
4. `docs-site/renderer/+onBeforeRender.ts` - Pass API docs to markdown processing

## Example Transformations

### Before
```typescript
import { createWorker } from 'isolated-workers';

const worker = await createWorker();
```

### After
```html
<pre><code class="language-typescript">
import { <a href="/api/core/createWorker" class="code-link">createWorker</a> } from 'isolated-workers';

const <a href="/api/core/createWorker" class="code-link">worker</a> = await <a href="/api/core/createWorker" class="code-link">createWorker</a>();
</code></pre>
```

### Rendering
Code blocks would show syntax highlighting with clickable links:
- `createWorker` (blue/underlined, links to `/api/core/createWorker`)
- `worker` variable would NOT be linked (local symbol)

## Implementation Order

1. **Import extraction**: Regex-based parser for import statements
2. **Symbol lookup**: Match imported symbols to API exports
3. **Code transformation**: Replace symbols with HTML links (respecting edge cases)
4. **Remark plugin**: Integrate into markdown processing pipeline
5. **Testing**: Manual testing with real documentation files
6. **Cleanup**: Remove liquid tags from code blocks (now redundant)

## Notes

- This approach works for TypeScript and JavaScript code blocks only
- Other languages (Python, Go, etc.) are not affected
- The system gracefully falls back to plain text if API docs unavailable
- Links use existing CSS classes for styling consistency
