import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { vol, fs as memfs } from 'memfs';

// Mock fs module - must return default export matching fs/promises
vi.mock('node:fs/promises', () => {
  return {
    default: memfs.promises,
    ...memfs.promises,
  };
});

import { scanDocs, buildDocsNavigation, type DocMetadata } from './docs';

describe('scanDocs', () => {
  beforeEach(() => {
    vol.reset();
  });

  afterEach(() => {
    vol.reset();
  });

  it('scans docs folder and parses frontmatter', async () => {
    vol.fromJSON({
      '/docs/guides/error-handling.md': `---
title: Error Handling Guide
description: Learn error handling
nav:
  section: Guides
  order: 2
---

# Error Handling

Content here...`,
      '/docs/index.md': `---
title: Documentation
description: Main docs page
nav:
  section: Home
  order: 1
---

Welcome!`,
    });

    const docs = await scanDocs('/docs');

    expect(docs['/docs/']).toBeDefined();
    expect(docs['/docs/'].title).toBe('Documentation');

    expect(docs['/docs/guides/error-handling']).toBeDefined();
    expect(docs['/docs/guides/error-handling'].title).toBe(
      'Error Handling Guide'
    );
    expect(docs['/docs/guides/error-handling'].nav?.section).toBe('Guides');
  });

  it('supports path override in frontmatter', async () => {
    vol.fromJSON({
      '/docs/legacy/old-page.md': `---
title: New Page
path: /docs/new-location
---
Content`,
    });

    const docs = await scanDocs('/docs');
    expect(docs['/docs/new-location']).toBeDefined();
    expect(docs['/docs/legacy/old-page']).toBeUndefined();
  });

  it('handles index.md files correctly', async () => {
    vol.fromJSON({
      '/docs/guides/index.md': `---
title: Guides Overview
---
Content`,
    });

    const docs = await scanDocs('/docs');
    expect(docs['/docs/guides/']).toBeDefined();
    expect(docs['/docs/guides/index']).toBeUndefined();
  });
});

describe('buildDocsNavigation', () => {
  it('groups docs by nav.section and sorts by order', () => {
    const docs: Record<string, DocMetadata> = {
      '/docs/a': {
        path: '/docs/a',
        filePath: '/docs/a.md',
        title: 'A',
        nav: { section: 'Guides', order: 2 },
      },
      '/docs/b': {
        path: '/docs/b',
        filePath: '/docs/b.md',
        title: 'B',
        nav: { section: 'Guides', order: 1 },
      },
      '/docs/c': {
        path: '/docs/c',
        filePath: '/docs/c.md',
        title: 'C',
        nav: { section: 'API', order: 1 },
      },
    };

    const nav = buildDocsNavigation(docs);

    expect(nav).toHaveLength(2);
    expect(nav[0].title).toBe('API');
    expect(nav[1].title).toBe('Guides');
    expect(nav[1].children?.[0].title).toBe('B'); // order: 1
    expect(nav[1].children?.[1].title).toBe('A'); // order: 2
  });

  it('defaults docs without nav section to "Docs" section', () => {
    const docs: Record<string, DocMetadata> = {
      '/docs/orphan': {
        path: '/docs/orphan',
        filePath: '/docs/orphan.md',
        title: 'Orphan',
        // no nav - should default to Docs section
      },
    };

    const nav = buildDocsNavigation(docs);
    expect(nav).toHaveLength(1);
    expect(nav[0].title).toBe('Docs');
    expect(nav[0].children?.[0].title).toBe('Orphan');
  });
});
