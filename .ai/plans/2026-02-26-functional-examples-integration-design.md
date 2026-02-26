# Design: Integrate functional-examples into isolated-workers docs site

**Date:** 2026-02-26
**Approach:** Complete cutover — no legacy code left in place

## Overview

Replace all custom docs-site code for example scanning, markdown segment parsing, liquid tag handling, and TypeDoc integration with published packages from the `functional-examples` monorepo.

## Architecture

Four custom systems are replaced:

| Removed | Replaced by |
|---|---|
| Custom `examples.ts` scanner | `functional-examples` core + `@functional-examples/yaml-manifest` |
| Liquid tag remark plugin + `segments.ts` | `@functional-examples/documentation` `createGuideRenderer()` + Eta |
| `typedoc.ts` + custom global context hook | `vike-plugin-typedoc` |
| `code-links.ts` symbol linking | `rehype-typedoc` |
| Manual `meta.yml` test assertions | `@functional-examples/test` plugin |

### File Map

```
isolated-workers/
├── functional-examples.config.ts       ← NEW
├── examples/*/meta.yml                 ← UPDATED (format migration)
├── docs/guides/*.md                    ← UPDATED (liquid tags → Eta)
└── docs-site/
    ├── pages/
    │   ├── +config.ts                  ← ADD vike-plugin-typedoc
    │   └── +onCreateGlobalContext.server.ts  ← REPLACE
    └── server/utils/
        ├── docs.ts                     ← KEEP (frontmatter scan unchanged)
        ├── examples.ts                 ← DELETE
        ├── segments.ts                 ← DELETE
        ├── remark-liquid-tags.ts       ← DELETE
        ├── code-links.ts               ← DELETE
        ├── typedoc.ts                  ← DELETE
        └── highlight-code.ts           ← KEEP (shiki unchanged)
```

## Section 1: Configuration

**`functional-examples.config.ts`** at repo root:

```ts
import { createYamlManifestPlugin } from '@functional-examples/yaml-manifest'
import { createJavaScriptPlugin } from '@functional-examples/javascript'
import { createTestPlugin } from '@functional-examples/test'
import { createDocumentationPlugin } from '@functional-examples/documentation'

export default {
  scan: { root: 'examples' },
  plugins: [
    createYamlManifestPlugin(),
    createJavaScriptPlugin(),
    createTestPlugin(),
    createDocumentationPlugin(),
  ],
}
```

## Section 2: Example Format Migration

`meta.yml` files lose `id` (derived from directory name), `entryPoint`, and `fileMap`. They gain `include` for file bundling. `commands`/`assertions` are compatible with `@functional-examples/test` schema unchanged.

```yaml
# BEFORE
id: basic-ping
title: Basic Ping-Pong Worker
description: A simple example demonstrating...
entryPoint: host.ts
fileMap:
  './messages.ts': 'messages.ts'
  './host.ts': 'host.ts'
  './worker.ts': 'worker.ts'
commands:
  - command: 'pnpm run:basic-ping'
    assertions:
      - contains: 'Worker spawned with PID'
```

```yaml
# AFTER
title: Basic Ping-Pong Worker
description: A simple example demonstrating...
include:
  - messages.ts
  - host.ts
  - worker.ts
commands:
  - command: 'pnpm run:basic-ping'
    assertions:
      - contains: 'Worker spawned with PID'
```

## Section 3: Docs Pipeline & Guide Markdown

**`+onCreateGlobalContext.server.ts`:**

```ts
import { scan } from 'functional-examples'
import { createGuideRenderer } from '@functional-examples/documentation'

export async function onCreateGlobalContext() {
  const { examples } = await scan()
  const renderer = createGuideRenderer(examples)

  const guides = await loadAndHydrateGuides(renderer)
  const docs = await loadDocs()

  return { examples, guides, docs }
  // TypeDoc context injected by vike-plugin-typedoc
}
```

**Guide markdown — liquid tags become Eta:**

```markdown
<!-- BEFORE -->
{% file examples/basic-ping/host.ts %}
{% example basic-ping:host.ts#setup %}
{% example basic-ping %}

<!-- AFTER -->
<%= example('basic-ping').file('host.ts') %>
<%= example('basic-ping').region('setup') %>
[Basic Ping](/examples/basic-ping)
```

**Unified remark/rehype pipeline:**

```ts
unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkCodeProps)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeTypedoc, { symbols, buildLink })
  .use(rehypeShiki)
  .use(rehypeStringify)
```

`SegmentRenderer.tsx` becomes a simple HTML renderer — Eta pre-expands all code blocks into standard fenced markdown so no segment dispatch is needed.

## Section 4: Vike Config & Test Plugin

**`pages/+config.ts`:**

```ts
import vikeReact from 'vike-react/config'
import vikeTypedoc from 'vike-plugin-typedoc/config'

export default {
  extends: [vikeReact, vikeTypedoc],
  typedoc: {
    apiJsonPath: '.typedoc/api.json',
  },
}
```

**Nx test-examples target** (root or docs-site `project.json`):

```json
{
  "targets": {
    "test-examples": {
      "command": "functional-examples test",
      "cwd": "{projectRoot}"
    }
  }
}
```

**Dependencies to add** (`docs-site/package.json`):

```json
{
  "functional-examples": "^0.1.0",
  "@functional-examples/yaml-manifest": "^0.1.0",
  "@functional-examples/javascript": "^0.1.0",
  "@functional-examples/test": "^0.1.0",
  "@functional-examples/documentation": "^0.1.0",
  "rehype-typedoc": "^0.0.1",
  "vike-plugin-typedoc": "^0.0.1"
}
```

**Dependencies to remove:**
- `rehype-highlight` (replaced by shiki + rehype-typedoc)
