# Implementation Plan: Documentation Site (Phase 6)

## Overview

Build a modern, distinctive documentation site using **Vike** + **Pagefind** with a dark neon/retro-future aesthetic. The site will auto-generate content from `examples/` directory and provide comprehensive documentation for isolated-workers library.

---

## Visual Design System

### Color Palette: Dark Neon / Retro-Future

\`\`\`css
/* Base Colors (Dark Mode) */
--bg-primary: #09090b;      /* Nearly black */
--bg-secondary: #131316;    /* Slightly lighter */
--bg-tertiary: #1c1c21;     /* Card backgrounds */

/* Neon Accents - vibrant but not oppressive */
--accent-primary: #00f0ff;    /* Cyan/electric blue */
--accent-secondary: #bf00ff;   /* Electric purple */
--accent-tertiary: #00ff9d;   /* Mint green */
--accent-warm: #ff6b35;        /* Warm orange for CTAs */

/* Text Colors */
--text-primary: #f0f0f0;     /* White */
--text-secondary: #a0a0b0;    /* Light gray */
--text-muted: #6b6b75;        /* Muted gray */

/* Semantic Colors */
--success: #00ff9d;
--warning: #ff9f43;
--error: #ff4757;
--info: #00f0ff;
\`\`\`

### Typography

- **Font**: Inter (Google Fonts) for body, JetBrains Mono for code
- **Scale**: Modular scale (1.125) - \`text-xs\` to \`text-3xl\`
- **Headings**: Bold weight with subtle neon glow effect on hover
- **Body**: Regular weight, high contrast for readability
- **Code**: Mono with syntax highlighting using neon accent colors

### Visual Effects

- **Glow effects**: Subtle box-shadow on interactive elements (\`box-shadow: 0 0 20px -5px var(--accent-primary)\`)
- **Gradients**: Diagonal gradients for buttons and cards (\`linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))\`)
- **Glass morphism**: Translucent backgrounds with backdrop blur (\`backdrop-filter: blur(12px)\`)
- **Borders**: Thin neon borders on hover (\`border:1px solid var(--accent-primary)\`)
- **Retro touches**: Slight noise texture or subtle grid patterns in backgrounds

---

## Phase 1: Project Setup & Infrastructure

### 1.1 Create Docs Project

**Files to create**:
\`\`\`
docs/
├── package.json
├── tsconfig.json
├── vite.config.ts          # Vite + Vike config
├── tailwind.config.js        # Tailwind configuration
├── postcss.config.js         # PostCSS for Tailwind
└── .gitignore
\`\`\`

**Dependencies**:
\`\`\`json
{
  "name": "docs-site",
  "dependencies": {
    "vike": "^1.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^6.0.0",
    "pagefind": "^1.0.0"
  }
}
\`\`\`

**Nx integration**:
- Add to \`nx.json\` as new project
- Configure \`build\`, \`dev\` and \`preview\` targets
- Set up proper project boundaries

### 1.2 Configure Tailwind CSS

**Tailwind config** (\`docs/tailwind.config.js\`):
\`\`\`javascript
export default {
  content: [
    './renderer/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx,md}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#09090b',
        secondary: '#131316',
        tertiary: '#1c1c21',
        neon: {
          cyan: '#00f0ff',
          purple: '#bf00ff',
          mint: '#00ff9d',
          orange: '#ff6b35',
        },
      },
      boxShadow: {
        'neon': '0 0 20px -5px var(--color-neon-cyan)',
        'neon-sm': '0 0 10px -3px var(--color-neon-cyan)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/vite'),
  ],
}
\`\`\`

### 1.3 Create Pagefind Vite Plugin

**File**: \`docs/plugins/pagefind-plugin.ts\`

This is **only** custom Vite plugin needed - it runs Pagefind after build:

\`\`\`typescript
import { Plugin } from 'vite';
import { execSync } from 'child_process';
import path from 'path';

export function pagefindPlugin(): Plugin {
  return {
    name: 'pagefind-plugin',
    apply: 'build',
    closeBundle() {
      // Run Pagefind CLI after build completes
      const outDir = this.meta?.config?.build?.outDir || 'dist';
      const pagefindPath = path.resolve(
        __dirname,
        '../node_modules/.bin/pagefind'
      );

      console.log('🔍 Running Pagefind indexing...');

      execSync(\`node \${pagefindPath} --site \${outDir}\`, {
        stdio: 'inherit',
      });

      console.log('✨ Pagefind indexing complete!');
    },
  };
}
\`\`\`

**Usage in \`vite.config.ts\`**:
\`\`\`typescript
import { defineConfig } from 'vite';
import vike from 'vike/vite';
import react from '@vitejs/plugin-react';
import { pagefindPlugin } from './plugins/pagefind-plugin';

export default defineConfig({
  plugins: [
    react(),
    vike(),
    pagefindPlugin(),  // Post-build Pagefind integration
  ],
});
\`\`\`

### 1.4 Vike Configuration

**File**: \`docs/vike.config.ts\`
\`\`\`typescript
import vike from 'vike/config';

export default vike({
  prerender: {
    crawl: true,
    // Disable for now, we'll generate pages dynamically
  },
  // Override default Layout with our custom one
  Layout: './renderer/Layout.tsx',
});
\`\`\`

---

## Phase 2: Navigation & Layout

### 2.1 Auto-Generated Navigation Structure

**Create data hook**: \`docs/+data.server.ts\`

This scans \`examples/\` and \`docs/pages/\` directories to build navigation:

\`\`\`typescript
import { PageContextServer } from 'vike/types';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

interface ExampleFrontmatter {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface NavigationItem {
  title: string;
  path: string;
  children?: NavigationItem[];
}

export async function data(pageContext: PageContextServer) {
  // Scan examples directory
  const examplesDir = path.resolve(process.cwd(), '../examples');
  const exampleDirs = await fs.readdir(examplesDir, { withFileTypes: true });

  const examples: Array<{
    id: string;
    title: string;
    description: string;
    difficulty: ExampleFrontmatter['difficulty'];
  }> = [];

  for (const dir of exampleDirs) {
    if (!dir.isDirectory()) continue;

    const contentPath = path.join(examplesDir, dir.name, 'content.md');
    try {
      const content = await fs.readFile(contentPath, 'utf-8');
      const frontmatter = extractFrontmatter(content);
      examples.push({
        id: dir.name,
        ...frontmatter,
      });
    } catch {
      // Skip if no content.md
    }
  }

  // Build navigation structure
  const navigation: NavigationItem[] = [
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
      title: 'Guides',
      path: '/guides',
      children: [
        { title: 'Type Safety', path: '/guides/type-safety' },
        { title: 'Error Handling', path: '/guides/error-handling' },
        { title: 'Best Practices', path: '/guides/best-practices' },
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

  return {
    navigation,
    examples,
  };
}

function extractFrontmatter(content: string): ExampleFrontmatter {
  const match = content.match(/^---\\n(.*?)\\n---/s);
  if (!match) throw new Error('No frontmatter found');

  const yamlContent = match[1];
  return yaml.load(yamlContent) as ExampleFrontmatter;
}
\`\`\`

### 2.2 Hybrid Floating Layout

**File**: \`docs/renderer/Layout.tsx\`

This implements hybrid floating navigation concept:

\`\`\`tsx
import { PageContext } from 'vike/types';
import { useState, useEffect } from 'react';
import Link from './Link';

export default function Layout({ pageContext, children }: {
  pageContext: PageContext;
  children: React.ReactNode;
}) {
  const { navigation } = pageContext.data;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  // Only show sidebar on docs pages, not landing
  const showSidebar = pageContext.urlPathname !== '/';

  return (
    <div className="min-h-screen bg-primary text-primary font-sans">
      {/* Floating Top Bar - Always visible, minimal */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-3">
            {/* Logo with subtle glow */}
            <div className="relative">
              <div className="absolute inset-0 blur-xl bg-neon-cyan opacity-20" />
              <span className="relative text-2xl font-bold tracking-tight">
                isolated-workers
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navigation.map((section) => (
              <Link
                key={section.path}
                href={section.path}
                className="text-sm font-medium text-secondary hover:text-neon-cyan transition-colors"
              >
                {section.title}
              </Link>
            ))}
          </nav>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Sidebar - Floating, glass morphism, only on docs pages */}
      {showSidebar && (
        <aside
          className={`fixed top-20 left-4 z-40 transition-all duration-300 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0`}
        >
          <div className="w-72 bg-secondary/90 backdrop-blur-xl rounded-2xl border border-white/5 shadow-neon overflow-hidden">
            <nav className="p-4 space-y-6">
              {navigation.map((section) => (
                <div key={section.title}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                    {section.title}
                  </h3>
                  {section.children?.map((item) => (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={`block py-2 px-3 rounded-lg text-sm transition-all ${
                        pageContext.urlPathname === item.path
                          ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20'
                          : 'text-secondary hover:text-primary hover:bg-white/5'
                      }`}
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main
        className={`pt-20 px-4 transition-all ${
          showSidebar ? 'md:pl-80' : ''
        }`}
      >
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>

      {/* Pagefind Search UI */}
      <div id="search" className="fixed top-20 right-6 z-50 w-80" />
    </div>
  );
}
\`\`\`

### 2.3 Link Component

**File**: \`docs/renderer/Link.tsx\`

Vike's \`<a>\` doesn't work in client components - we need a custom Link:

\`\`\`tsx
import { navigate } from 'vike/client/router';

export function Link({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        navigate(href);
      }}
      className={className}
    >
      {children}
    </a>
  );
}
\`\`\`

---

## Phase 3: Page Components

### 3.1 Landing Page

**File**: \`docs/pages/index/+Page.tsx\`

\`\`\`tsx
import { PageContextServer } from 'vike/types';

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-neon-purple/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        <h1 className="text-6xl md:text-8xl font-bold mb-6 tracking-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-mint">
            Type-Safe
          </span>
          <br />
          Worker Processes
        </h1>

        <p className="text-xl text-secondary mb-12 max-w-2xl mx-auto">
          Extract proven patterns from Nx's isolation architecture.
          Build production-ready worker processes with full TypeScript inference.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/getting-started"
            className="px-8 py-4 bg-gradient-to-r from-neon-cyan to-neon-purple rounded-xl font-semibold text-white shadow-neon hover:shadow-neon-sm transition-all transform hover:scale-105"
          >
            Get Started
          </Link>
          <Link
            href="/examples"
            className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl font-semibold text-neon-cyan hover:bg-white/10 transition-all"
          >
            View Examples
          </Link>
        </div>

        {/* Feature highlights */}
        <div className="grid md:grid-cols-3 gap-6 mt-20">
          {[
            { icon: '⚡', title: 'Fast', desc: 'Blazing-fast IPC with transaction IDs' },
            { icon: '🔒', title: 'Type-Safe', desc: 'Full TypeScript inference, no any' },
            { icon: '🛠️', title: 'Simple', desc: 'Minimal API, maximum DX' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-6 bg-tertiary rounded-2xl border border-white/5 hover:border-neon-cyan/30 transition-all group"
            >
              <span className="text-4xl mb-4 block">{feature.icon}</span>
              <h3 className="text-xl font-semibold mb-2 text-neon-cyan group-hover:text-neon-mint transition-colors">
                {feature.title}
              </h3>
              <p className="text-secondary">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
\`\`\`

### 3.2 Examples Index Page

**File**: \`docs/pages/examples/+Page.tsx\`

\`\`\`tsx
import { PageContext } from 'vike/types';

export default function Page({ pageContext }: { pageContext: PageContext }) {
  const { examples } = pageContext.data;

  return (
    <div className="py-12">
      <h1 className="text-4xl font-bold mb-8">
        Examples
      </h1>

      <div className="space-y-6">
        {examples.map((example) => (
          <Link
            key={example.id}
            href={`/examples/${example.id}`}
            className="block p-6 bg-tertiary rounded-2xl border border-white/5 hover:border-neon-cyan/50 transition-all group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-2xl font-semibold mb-2 text-neon-cyan group-hover:text-neon-mint transition-colors">
                  {example.title}
                </h2>
                <p className="text-secondary">{example.description}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  example.difficulty === 'beginner'
                    ? 'bg-neon-mint/20 text-neon-mint'
                    : example.difficulty === 'intermediate'
                    ? 'bg-neon-orange/20 text-neon-orange'
                    : 'bg-neon-purple/20 text-neon-purple'
                }`}
              >
                {example.difficulty}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
\`\`\`

### 3.3 Individual Example Page

**File**: \`docs/pages/examples/[id]/+Page.tsx\`

\`\`\`tsx
import { PageContextServer } from 'vike/types';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export async function onBeforeRender(pageContext: PageContextServer) {
  const { id } = pageContext.routeParams;

  // Read example files
  const exampleDir = path.resolve(process.cwd(), '../examples', id);
  const contentPath = path.join(exampleDir, 'content.md');
  const messagesPath = path.join(exampleDir, 'messages.ts');
  const hostPath = path.join(exampleDir, 'host.ts');
  const workerPath = path.join(exampleDir, 'worker.ts');

  const [content, messages, host, worker] = await Promise.all([
    fs.readFile(contentPath, 'utf-8'),
    fs.readFile(messagesPath, 'utf-8'),
    fs.readFile(hostPath, 'utf-8'),
    fs.readFile(workerPath, 'utf-8'),
  ]);

  return {
    pageContext: {
      title: id,
      data: {
        example: {
          id,
          content,
          messages,
          host,
          worker,
        },
      },
    },
  };
}

export default function Page({ pageContext }: { pageContext: PageContext }) {
  const { example } = pageContext.data;

  // Parse {{file:filename}} placeholders
  const content = example.content.replace(/\{\{file:(.*?)\}\}/g, (match, filename) => {
    if (filename === 'messages.ts') {
      return `<CodeBlock code={\`\${example.messages}\`} language="typescript" />`;
    }
    if (filename === 'host.ts') {
      return `<CodeBlock code={\`\${example.host}\`} language="typescript" />`;
    }
    if (filename === 'worker.ts') {
      return `<CodeBlock code={\`\${example.worker}\`} language="typescript" />`;
    }
    return match;
  });

  return (
    <article className="prose prose-invert prose-neon max-w-none">
      <div
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </article>
  );
}
\`\`\`

### 3.4 Documentation Pages

**File**: \`docs/pages/_default.page.tsx\`

\`\`\`tsx
import { PageContext } from 'vike/types';

export default function Page({ pageContext, children }: {
  pageContext: PageContext;
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}
\`\`\`

Markdown files in subdirectories will automatically become pages. Create:
- \`docs/pages/getting-started/installation.md\`
- \`docs/pages/getting-started/quick-start.md\`
- \`docs/pages/guides/type-safety.md\`
- etc.

---

## Phase 4: Components

### 4.1 Code Block Component

**File**: \`docs/renderer/CodeBlock.tsx\`

With syntax highlighting using Shiki (or Prism.js with neon theme):

\`\`\`tsx
export function CodeBlock({ code, language }: {
  code: string;
  language: string;
}) {
  // Use Shiki for server-side highlighting, or client-side Prism
  // For now, simple pre/code with styling
  return (
    <div className="my-6 rounded-xl overflow-hidden border border-white/10">
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/5">
        <span className="text-xs text-muted font-mono">{language}</span>
        <button
          className="text-xs text-neon-cyan hover:text-neon-mint transition-colors"
          onClick={() => navigator.clipboard.writeText(code)}
        >
          Copy
        </button>
      </div>
      <pre className="p-6 overflow-x-auto bg-black/60">
        <code className="text-sm font-mono" dangerouslySetInnerHTML={{ __html: code }} />
      </pre>
    </div>
  );
}
\`\`\`

### 4.2 Pagefind Search UI

**File**: \`docs/renderer/Pagefind.tsx\`

Custom Pagefind UI integration:

\`\`\`tsx
import { useEffect, useState } from 'react';

export function PagefindSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load Pagefind UI library
    const script = document.createElement('script');
    script.src = '/pagefind/pagefind-ui.js';
    document.body.appendChild(script);
  }, []);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder="Search docs..."
        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-primary placeholder:text-muted focus:border-neon-cyan focus:outline-none transition-colors"
      />

      {isOpen && query && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-secondary rounded-xl border border-white/10 shadow-neon overflow-hidden max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-4 text-secondary text-center">
              No results found
            </div>
          ) : (
            results.map((result) => (
              <a
                key={result.url}
                href={result.url}
                className="block px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
              >
                <div className="font-semibold text-neon-cyan">{result.title}</div>
                <div className="text-sm text-secondary">{result.excerpt}</div>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
\`\`\`

---

## Phase 5: Content & Examples

### 5.1 Example Front-Matter Enhancement

Update existing example \`content.md\` files to use consistent front-matter:

\`\`\`yaml
---
title: Basic Ping-Pong Worker
description: This example demonstrates the fundamental request/response pattern
difficulty: beginner
tags:
  - basics
  - request-response
---

## Overview

The ping-pong example shows:

- How to define message types using \`DefineMessages\`
- How to spawn a worker process
- How to send messages and receive responses
- Proper cleanup and shutdown

{{file:messages.ts}}

{{file:host.ts}}

{{file:worker.ts}}
\`\`\`

### 5.2 API Documentation Generation

Option A: Manual markdown with TSDoc comments in source
Option B: Auto-generate from TSDoc using \`typedoc\` or \`api-extractor\`

For MVP, manually create API pages with type definitions extracted from source:
- \`docs/pages/api/create-worker.md\`
- \`docs/pages/api/start-worker-server.md\`
- \`docs/pages/api/handlers.md\`
- etc.

---

## Phase 6: Build & Deployment

### 6.1 Nx Configuration

Update \`nx.json\`:

\`\`\`json
{
  "projects": {
    "docs-site": {
      "root": "docs",
      "sourceRoot": "docs",
      "projectType": "application",
      "targets": {
        "build": {
          "executor": "@nx/vite:build",
          "options": {
            "configFile": "docs/vite.config.ts"
          },
          "outputs": ["{projectRoot}/dist"]
        },
        "dev": {
          "executor": "@nx/vite:dev-server",
          "options": {
            "configFile": "docs/vite.config.ts"
          }
        },
        "preview": {
          "executor": "@nx/vite:preview-server",
          "options": {
            "configFile": "docs/vite.config.ts"
          }
        }
      }
    }
  }
}
\`\`\`

### 6.2 Pagefind Configuration

**File**: \`docs/pagefind.json\`

\`\`\`json
{
  "rootSelector": "main",
  "glob": "**/*.{html,md}",
  "excludeSelectors": [
    "[data-pagefind-ignore]",
    ".pagefind-ui"
  ]
}
\`\`\`

### 6.3 Build Process

1. Run \`pnpm nx run docs-site:build\`
2. Vike builds pages to \`docs/dist/\`
3. Pagefind plugin runs automatically, indexing \`docs/dist/\`
4. Search files generated in \`docs/dist/pagefind/\`
5. Deploy to static host (Vercel, Netlify, GitHub Pages)

---

## Phase 7: Success Criteria

### Phase Completion Checklist

- [ ] **Phase 1**: Project setup complete with Vike + Tailwind + Pagefind plugin
- [ ] **Phase 2**: Navigation auto-generating from examples, hybrid floating layout working
- [ ] **Phase 3**: Landing page, examples index, individual example pages rendering
- [ ] **Phase 4**: Code blocks with copy button, search UI functional
- [ ] **Phase 5**: Examples displaying correctly with file inclusion
- [ ] **Phase 6**: Build process working, Pagefind indexing functional

### Quality Gates

- [ ] Dark neon theme applied consistently across all pages
- [ ] Navigation automatically updates when new examples added
- [ ] Examples display with proper code highlighting
- [ ] Search returns relevant results
- [ ] Mobile responsive (sidebar toggle works)
- [ ] Performance: Lighthouse score > 90
- [ ] Accessibility: WCAG AA compliant

---

## Technical Decisions

### Why This Architecture?

1. **Minimal Vite Plugin**: Only Pagefind integration needed - everything else is Vike hooks
2. **Auto-Generated Navigation**: Examples directory scan eliminates manual nav maintenance
3. **Hybrid Layout**: Floating sidebar provides docs UX without cluttering landing page
4. **Vike over Docusaurus**: Better TypeScript integration, file-based routing, smaller bundle
5. **Pagefind over Algolia**: Static, no backend, free, perfect for docs

### Trade-offs Considered

| Decision | Alternative | Chosen Because |
|-----------|-------------|-----------------|
| Vike hooks for examples | Custom Vite plugin | Vike's \`+data.server.ts\` is designed for this |
| Pagefind post-build | Pre-build index | Post-build captures final rendered HTML |
| Tailwind CSS | Styled Components | Faster development, easier theming |
| Dark neon theme | Light theme | User requested distinctive, dark is more unique |

---

## Next Steps

Once this plan is approved:

1. Execute **Phase 1** (project setup)
2. Execute **Phase 2** (navigation + layout)
3. Execute **Phase 3** (page components)
4. Execute **Phase 4** (UI components)
5. Execute **Phase 5** (content integration)
6. Execute **Phase 6** (build + deployment)
7. Run quality checks and iterate

---

## Dependencies

- **Phase 5**: Core implementation complete (worker, messaging, connection)
- **Example system**: E2E tests passing, examples runnable
- **Nx workspace**: Configured and working
