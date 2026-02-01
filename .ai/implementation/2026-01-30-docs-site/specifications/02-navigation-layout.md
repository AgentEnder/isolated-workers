# Spec 02: Navigation & Layout

## Overview

Build the navigation system and hybrid floating layout for the documentation site.

## Dependencies

- [Spec 01: Project Setup & Infrastructure](./01-project-setup.md) must be complete

## Tasks

### Task 2.1: Create +data.server.ts Hook

**Action**: Implement Vike data hook for navigation generation

**Implementation**:
Create `docs/+data.server.ts`:

- Scan `examples/` directory for example front-matter
- Build navigation structure with sections
- Return navigation and examples data

**Key Functions**:

```typescript
export async function data(pageContext: PageContextServer) {
  // Scan examples
  const examplesDir = path.resolve(process.cwd(), '../examples');
  const exampleDirs = await fs.readdir(examplesDir, { withFileTypes: true });

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

  return { navigation, examples };
}
```

**Validation**:

- [ ] Hook compiles without errors
- [ ] TypeScript types are correct
- [ ] Navigation structure is valid

### Task 2.2: Implement Hybrid Floating Layout

**Action**: Create Layout.tsx with floating navigation

**Layout Requirements**:

- Fixed top bar (always visible)
- Floating glass sidebar (only on docs pages)
- Mobile-responsive sidebar toggle
- Glass morphism effects
- Neon glow on active items

**Key Elements**:

- Logo with subtle cyan glow
- Navigation links in top bar
- Sidebar with rounded corners, backdrop blur
- Active page highlighting with neon border
- Pagefind search placeholder in top-right

**Validation**:

- [ ] Layout renders without errors
- [ ] Sidebar slides in/out on mobile
- [ ] Sidebar hidden on landing page
- [ ] Neon effects display correctly
- [ ] Active page highlighted

### Task 2.3: Create Link Component

**Action**: Implement custom Link component for navigation

**Implementation**:
Create `docs/renderer/Link.tsx`:

- Use `navigate()` from Vike client router
- Support className prop
- Prevent default anchor behavior

```typescript
import { navigate } from 'vike/client/router';

export function Link({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} onClick={(e) => { e.preventDefault(); navigate(href); }} className={className}>
      {children}
    </a>
  );
}
```

**Validation**:

- [ ] Link component compiles
- [ ] Navigation works correctly
- [ ] Active state preserved

### Task 2.4: Add Example Scanning Logic

**Action**: Implement front-matter parsing and example scanning

**Implementation**:
In `+data.server.ts`:

- Read `content.md` from each example directory
- Parse YAML front-matter (title, description, difficulty)
- Extract example metadata
- Handle missing content.md gracefully

**Front-matter Format**:

```yaml
---
title: Basic Ping-Pong Worker
description: This example demonstrates the fundamental request/response pattern
difficulty: beginner
tags:
  - basics
  - request-response
---
```

**Validation**:

- [ ] All examples scanned
- [ ] Front-matter parsed correctly
- [ ] Examples with missing content.md skipped
- [ ] Metadata is correct

### Task 2.5: Build Navigation Structure

**Action**: Create hierarchical navigation with sections

**Navigation Sections**:

1. Getting Started (3 items)
2. Guides (3 items)
3. Examples (dynamic from examples/)
4. API Reference (4 items)

**Structure**:

```typescript
interface NavigationItem {
  title: string;
  path: string;
  children?: NavigationItem[];
}
```

**Validation**:

- [ ] All sections present
- [ ] Examples auto-populate
- [ ] Links are correct
- [ ] Structure is consistent

## Success Criteria

✅ All 5 tasks completed
✅ Navigation displays on all docs pages
✅ Sidebar toggles correctly on mobile
✅ Active page highlighted in nav
✅ Examples auto-populate in nav

## Next Spec

[Spec 03: Page Components](./03-page-components.md)
