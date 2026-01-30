# Phase 5: Documentation Strategy

## Overview

Set up comprehensive documentation system using Vike + Pagefind, with automatic example generation and search capabilities.

## Documentation Technology Stack

### Vike (Framework)

**Why Vike over Docusaurus?**

- Simpler setup and configuration
- Pure React components (more familiar DX)
- Better TypeScript integration
- Faster builds with Vite
- Easier customization

**Key Features:**

- File-based routing for simple page structure
- SSR/SSG support for static generation
- Markdown support out of the box
- Custom components for interactive examples

### Pagefind (Search)

**Why Pagefind?**

- Fast, pure JS search index
- No backend required
- Excellent for documentation sites
- Easy integration with Vike

**Key Features:**

- Instant search results
- Fuzzy matching
- Search result highlighting
- Mobile-friendly

## Documentation Site Structure

```
docs-site/
├── src/
│   ├── pages/
│   │   ├── +Page.tsx           # Layout wrapper
│   │   ├── index/
│   │   │   └── +Page.tsx      # Home page
│   │   ├── api/
│   │   │   └── +Page.tsx      # API reference
│   │   ├── guides/
│   │   │   └── *.md            # Guide pages
│   │   └── examples/
│   │       ├── +Page.tsx      # Examples index
│   │       └── [id]/
│   │           └── +Page.tsx   # Individual example
│   ├── components/                # Reusable React components
│   └── plugins/
│       └── examples-plugin.ts    # Generate example docs
├── package.json
├── vike.config.ts
├── pagefind.config.json
└── tsconfig.json
```

## Vike Configuration

### `docs-site/vike.config.ts`

```typescript
import { defineConfig } from "vike/config";

export default defineConfig({
  prerender: true,
  pagefind: true, // Enable Pagefind integration
  root: __dirname,
});
```

### Key Configuration Options

- `prerender: true` - Pre-render all pages for SEO and performance
- `pagefind: true` - Enable Pagefind for search functionality
- `root: __dirname` - Set root directory for file resolution

## Pagefind Configuration

### `docs-site/pagefind.config.json`

```json
{
  "indexing": {
    "exclude": ["node_modules", "dist"]
  },
  "styling": {
    "variables": {
      "heading": {
        "weight": "bold",
        "size": "1.5em"
      },
      "meta": {
        "color": "#666"
      }
    }
  },
  "ranking": {
    "pageRank": {
      "boost": {
        "heading": 0.2,
        "title": 0.2,
        "pathDepth": 0.05
      }
    }
  }
}
```

## Documentation Content Strategy

### 1. Getting Started Guide (`src/pages/guides/getting-started.md`)

**Content:**

- Installation instructions
- Basic usage example
- Creating a custom worker
- Common patterns

````markdown
# Getting Started

## Installation

```bash
npm install isolated-workers
# or
pnpm add isolated-workers
# or
yarn add isolated-workers
```
````

## Basic Usage

Create a simple worker and send messages to it.

### 1. Create Worker Script

```typescript
// worker.ts
import { setupWorker } from "isolated-workers/worker";

setupWorker({
  handlers: {
    compute: async (payload: { n: number }) => {
      return { result: payload.n * 2 };
    },
  },
});
```

### 2. Spawn Worker

```typescript
// main.ts
import { createWorker } from "isolated-workers";

const worker = await createWorker({
  workerScript: "./worker.ts",
});

// Send message
const result = await worker.request("compute", { n: 5 });
console.log(result); // { result: 10 }

// Cleanup
await worker.shutdown();
```

## Advanced Topics

Link to: [Worker Creation](./worker-creation.md), [Message Patterns](./message-patterns.md)

````

### 2. API Reference (`src/pages/api/+Page.tsx`)

**Content:**
- Full API documentation
- Type signatures with explanations
- Examples for each API
- Options and parameters

**Structure:**
```typescript
// src/pages/api/+Page.tsx
import { createPage } from 'vike/page';

export default createPage({
  title: 'API Reference',

  // Generate from TypeScript types
  // Use typedoc or manual documentation
});
````

### 3. Examples System

**Collection Utility** (`tools/scripts/collect-examples.ts`):

```typescript
// Parse YAML front-matter from example files
// Generate markdown pages for each example
// Create index page
```

**Example Front-Matter Format:**

```typescript
// ---
// id: basic-worker
// title: Basic Worker Example
// description: |
//   Demonstrates creating a simple worker and sending messages.
//   Shows → full lifecycle from creation to shutdown.
// commands:
//   - '{filename}'  # Run example
// assertions:
//   - contains: 'Computation complete: 10'
// ---

import { createWorker } from "isolated-workers/worker";

const worker = await createWorker({
  workerScript: __filename,
});

// ... worker code
```

**Generated Example Page Structure:**

````markdown
---
title: Basic Worker Example
description: Demonstrates creating a simple worker
---

# Basic Worker Example

This example shows how to create a worker, send messages, and handle responses.

## Running the Example

```bash
# Clone → repository
git clone https://github.com/yourorg/isolated-workers.git
cd isolated-workers

# Run example
node examples/basic-worker.ts
```
````

## Code

```typescript
// ... full example code
```

## Expected Output

```
Worker started on /tmp/worker-1234
Computation complete: 10
Shutting down...
```

## Customization

Try modifying → example to:

- Add custom message types
- Handle errors
- Implement timeout handling

````

### 4. Guides

**Guides to create:**

1. **Worker Creation** (`src/pages/guides/worker-creation.md`)
   - Custom worker entry points
   - Worker configuration options
   - Lifecycle management

2. **Message Patterns** (`src/pages/guides/message-patterns.md`)
   - Request/response pattern
   - Fire-and-forget messages
   - Streaming data
   - Error handling strategies

3. **Advanced Options** (`src/pages/guides/advanced-options.md`)
   - Custom timeouts
   - Environment variable injection
   - Socket path configuration
   - TypeScript transpilation

4. **Troubleshooting** (`src/pages/guides/troubleshooting.md`)
   - Common issues and solutions
   - Debug logging
   - Performance optimization
   - Platform-specific issues

### 5. Layout and Components

**Layout** (`src/pages/+Page.tsx`):

```typescript
import { Head } from 'vike/page';

export default function Page() {
  return (
    <html lang="en">
      <Head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>isolated-workers Documentation</title>
        <link rel="stylesheet" href="/main.css" />
      </Head>
      <body>
        <slot />
      </body>
    </html>
  );
}
````

**Components** (`src/components/`):

- `CodeBlock.tsx` - Syntax highlighted code blocks
- `ExampleRunner.tsx` - Interactive example execution
- `TypeSignature.tsx` - Display TypeScript types
- `StatusBadge.tsx` - Status indicators

## Documentation Build Commands

```bash
# Build docs
nx build docs-site

# Dev server
nx serve docs-site

# Preview production build
nx run docs-site:preview
```

## Documentation Site Configuration

### `docs-site/package.json`

```json
{
  "name": "isolated-workers-docs",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "vike build",
    "dev": "vike dev",
    "preview": "vike build && vike preview"
  },
  "devDependencies": {
    "@nx/vite": "catalog:",
    "vike": "catalog:",
    "pagefind": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "typescript": "catalog:"
  },
  "nx": {
    "includedScripts": []
  }
}
```

### `docs-site/project.json`

```json
{
  "name": "docs-site",
  "sourceRoot": "src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@nx/vite:vite",
      "options": {
        buildLib: false,
        configPath: "vike.config.ts"
      },
      "outputs": ["{projectRoot}/dist"]
    },
    "dev": {
      "executor": "@nx/vite:dev-server",
      "options": {
        buildLib": false,
        configPath: "vike.config.ts"
      }
    }
  }
}
```

## Custom Vike Plugin for Examples

### `docs-site/src/plugins/examples-plugin.ts`

```typescript
import { defineVikePlugin } from "vike/plugin";
import { collectExamples } from "isolated-workers-scripts/collect-examples";

export default defineVikePlugin({
  name: "examples-plugin",

  async build(config) {
    const examples = collectExamples(join(config.root, "../examples"));

    // Generate page files for each example
    for (const example of examples) {
      const { id, title, description, entryPoint } = example.data;

      // Create markdown content with front-matter
      // Write to docs-site/src/examples/[id]/+Page.mdx
    }

    // Generate index page
    // Write to docs-site/src/examples/+Page.mdx
  },
});
```

## Pagefind Integration

### Search Index Generation

Pagefind automatically generates search index during build:

```bash
# Run Pagefind indexing
npx pagefind --site docs-site/dist --output-subdir pagefind
```

### Search Component

```typescript
// docs-site/src/components/Search.tsx
'use client';

import { usePageContext } from 'vike/page';
import Pagefind from 'pagefind';

let pagefindInstance: Pagefind.UI | null = null;

export default function Search() {
  const { pageProps } = usePageContext();

  useEffect(() => {
    // Initialize Pagefind
    if (!pagefindInstance) {
      pagefindInstance = new Pagefind.UI({
        ranking: {
          pageRank: {
            boost: {
              heading: 0.2,
              title: 0.2,
              pathDepth: 0.05
            }
          }
        }
      });
    }
  }, []);

  return (
    <div className="search-container">
      <input
        type="text"
        placeholder="Search documentation..."
        onChange={(e) => pagefindInstance?.search(e.target.value)}
      />
      <div id="pagefind-results" />
    </div>
  );
}
```

## Documentation Principles

### 1. Example-Driven

Every feature should have a corresponding example that can be run.

### 2. Type-First

All code examples should be fully typed with no implicit `any`.

### 3. Progressive

Start with basics, progressively add advanced topics.

### 4. Real-World

Examples should resemble actual use cases, not toy examples.

### 5. Self-Documenting

Code should be self-documenting with clear variable names and comments.

## Success Criteria

- [ ] Vike site building locally
- [ ] Examples generated from source files
- [ ] Search working with Pagefind
- [ ] Getting started guide complete
- [ ] API reference documented
- [ ] Guides for common use cases
- [ ] Custom components for code display
- [ ] Responsive design working

## Next Steps

After documentation is functional:

1. Write comprehensive examples
2. Generate API documentation (manual or automated)
3. Add interactive code previews
4. Optimize for SEO (meta tags, sitemap)
5. Set up automated deployment
