# Writing Documentation

This guide covers how to write documentation for isolated-workers, including referencing code from examples.

## Overview

The documentation system has two main components:

1. **Docs** (`docs/`) - Markdown guides rendered at `/docs/*`
2. **Examples** (`examples/`) - Runnable code examples with their own pages at `/examples/*`

Docs can embed code from examples using Liquid tags, and examples can have content files that reference their own files.

---

## Writing Docs (Markdown Guides)

### File Structure

```
docs/
├── index.md                    # /docs
├── guides/
│   ├── index.md               # /docs/guides
│   └── error-handling.md      # /docs/guides/error-handling
└── advanced/
    └── custom-serializers.md  # /docs/advanced/custom-serializers
```

### Frontmatter

Every doc file should have YAML frontmatter:

```yaml
---
title: Error Handling
description: How errors propagate from workers to hosts
nav:
  section: Guides    # Groups this doc in navigation
  order: 2           # Sort order within section (lower = earlier)
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Page title, shown in navigation |
| `description` | No | Short description for SEO/previews |
| `nav.section` | No | Navigation section name (defaults to "Docs") |
| `nav.order` | No | Sort order within section (defaults to 999) |
| `path` | No | Override the URL path (rarely needed) |

### Referencing Example Code

Use Liquid tags to embed code from examples:

#### Embed an entire file

```markdown
{% example error-handling:worker.ts %}
```

This embeds the full `worker.ts` file from the `error-handling` example, with region markers stripped.

#### Embed a specific region (hunk)

```markdown
{% example error-handling:host.ts#error-catch %}
```

This embeds only the `error-catch` region from `host.ts`. The example file must have matching region markers:

```typescript
// In examples/error-handling/host.ts
// #region error-catch
try {
  const result = await worker.sendRequest({ type: 'divide', a: 10, b: 0 });
} catch (error) {
  console.error('Caught error:', error.message);
}
// #endregion error-catch
```

#### Link to an example

```markdown
{% example-link error-handling %}
```

This renders a styled link card to the example page.

### Tag Syntax Reference

| Tag | Description |
|-----|-------------|
| `{% example name:file.ts %}` | Embed file from example |
| `{% example name:file.ts#region %}` | Embed specific region |
| `{% example-link name %}` | Link card to example |

**Note:** The `{% file %}` tag is NOT valid in docs - it only works in example content files.

---

## Adding New Examples

### Directory Structure

Each example lives in its own folder under `examples/`:

```
examples/
└── my-example/
    ├── meta.yml        # Required: metadata
    ├── content.md      # Optional: rich documentation
    ├── messages.ts     # Example source files
    ├── host.ts
    └── worker.ts
```

### meta.yml (Required)

```yaml
title: My Example
description: |
  A short description of what this example demonstrates.
  Can be multi-line.
entryPoint: host.ts
fileMap:
  './messages.ts': 'messages.ts'
  './host.ts': 'host.ts'
  './worker.ts': 'worker.ts'
commands:
  - command: 'pnpm run:my-example'
    title: 'Run the example'
    assertions:
      - contains: 'Expected output'
```

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Display title |
| `description` | Yes | Description shown on examples page |
| `entryPoint` | No | Main file to highlight |
| `fileMap` | No | Map of import paths to filenames |
| `commands` | No | Runnable commands with assertions |
| `hidden` | No | If `true`, hide from navigation (embed-only) |

### Hidden Examples

Set `hidden: true` in meta.yml for examples that should only be embedded in docs:

```yaml
title: Error Handling Snippets
description: Code snippets for the error handling guide
hidden: true
```

Hidden examples:
- Don't appear in `/examples` listing
- Don't appear in navigation sidebar
- Can still be referenced via `{% example name:file %}` in docs
- Have their own page at `/examples/name` (accessible via direct URL)

This is useful for:
- Code snippets that only make sense within a guide
- Partial examples that demonstrate one concept
- Supporting code for documentation

---

## Writing Example Content Files

### content.md

The optional `content.md` file provides rich documentation for an example:

```markdown
# My Example

This example demonstrates...

## Overview

Explanation of what we're building.

## Files

### Message Definitions

{% file messages.ts %}

### Host

{% file host.ts %}

### Worker

{% file worker.ts %}

## Running

\`\`\`bash
pnpm run:my-example
\`\`\`
```

### Referencing Files Within an Example

In `content.md`, use `{% file %}` to reference files in the same example:

| Tag | Description |
|-----|-------------|
| `{% file messages.ts %}` | Embed entire file |
| `{% file host.ts#setup %}` | Embed specific region |

### Using Regions in Example Files

Mark extractable sections with `#region` and `#endregion`:

```typescript
// examples/my-example/host.ts

import { createWorker } from 'isolated-workers';
import type { Messages } from './messages';

// #region setup
const worker = createWorker<Messages>('./worker.ts');
// #endregion setup

// #region main
async function main() {
  const response = await worker.sendRequest({ type: 'ping' });
  console.log('Response:', response);
}
// #endregion main

main().finally(() => worker.close());
```

Then reference in content.md:

```markdown
First, create the worker:

{% file host.ts#setup %}

Then use it:

{% file host.ts#main %}
```

### Region Marker Syntax

Markers work with different comment styles:

```typescript
// #region name
// #endregion name
```

```css
/* #region name */
/* #endregion name */
```

```python
# #region name
# #endregion name
```

```html
<!-- #region name -->
<!-- #endregion name -->
```

**Rules:**
- Region IDs must match between start and end markers
- Regions can be nested (each tracked independently)
- All markers are stripped from rendered output
- Orphan `#endregion` (no matching start) throws an error

---

## Build-Time Validation

The docs system validates references at build time:

| Error | Cause |
|-------|-------|
| `Example "X" not found` | Referenced example doesn't exist |
| `File "X" not found in example "Y"` | File doesn't exist in example |
| `Region 'X' not found in file "Y"` | Region markers missing or misnamed |

These errors appear during `pnpm nx run docs-site:build` and prevent broken docs from being deployed.

---

## Quick Reference

### In Docs (`docs/*.md`)

```markdown
{% example basic-ping:host.ts %}        # Embed file from example
{% example basic-ping:host.ts#setup %}  # Embed region from example
{% example-link basic-ping %}           # Link card to example
```

### In Example Content (`examples/*/content.md`)

```markdown
{% file host.ts %}        # Embed file from this example
{% file host.ts#setup %}  # Embed region from this example
```

### In Example Source Files

```typescript
// #region setup
const worker = createWorker('./worker.ts');
// #endregion setup
```

### In Example meta.yml

```yaml
title: My Example
description: What this demonstrates
hidden: true  # Optional: hide from navigation
```
