import { describe, expect, it } from 'vitest';
import {
  buildSymbolLinks,
  findLinkableSymbols,
  linkHighlightedCode,
  type LinkableSymbol,
} from './code-links';
import type { ApiDocs } from './typedoc';

// Mock API docs for testing
const mockApiDocs: ApiDocs = {
  allExports: [
    { name: 'createWorker', path: '/api/createWorker', kind: 'function' },
    {
      name: 'startWorkerServer',
      path: '/api/startWorkerServer',
      kind: 'function',
    },
    { name: 'Middleware', path: '/api/Middleware', kind: 'type' },
    { name: 'Handlers', path: '/api/Handlers', kind: 'type' },
    {
      name: 'WorkerThreadsDriver',
      path: '/api/WorkerThreadsDriver',
      kind: 'variable',
    },
    { name: 'DefineMessages', path: '/api/DefineMessages', kind: 'type' },
  ],
} as ApiDocs;

const apiSymbols = new Set(mockApiDocs.allExports.map((e) => e.name));
import.meta.env.BASE_URL = '';

describe('findLinkableSymbols', () => {
  describe('import statements', () => {
    it('finds named imports', () => {
      const source = `import { createWorker, Middleware } from 'isolated-workers';`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'createWorker' })
      );
      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'Middleware' })
      );
    });

    it('finds type imports', () => {
      const source = `import type { Middleware, Handlers } from 'isolated-workers';`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'Middleware' })
      );
      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'Handlers' })
      );
    });

    it('finds default imports', () => {
      const source = `import WorkerThreadsDriver from 'isolated-workers/drivers';`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'WorkerThreadsDriver' })
      );
    });

    it('finds mixed imports', () => {
      const source = `import { createWorker, type Middleware } from 'isolated-workers';`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'createWorker' })
      );
      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'Middleware' })
      );
    });
  });

  describe('type annotations', () => {
    it('finds type annotations on variables', () => {
      const source = `const middleware: Middleware = {};`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'Middleware' })
      );
    });

    it('finds type annotations on function parameters', () => {
      const source = `function process(handlers: Handlers) {}`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'Handlers' })
      );
    });

    it('finds generic type parameters', () => {
      const source = `const workers: Array<Middleware> = [];`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'Middleware' })
      );
    });

    it('finds return type annotations', () => {
      const source = `function create(): Middleware { return {}; }`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'Middleware' })
      );
    });
  });

  describe('function calls and references', () => {
    it('finds function calls', () => {
      const source = `const worker = await createWorker({ script: './worker.ts' });`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'createWorker' })
      );
    });

    it('finds property access on known symbols', () => {
      const source = `console.log(WorkerThreadsDriver.name);`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'WorkerThreadsDriver' })
      );
    });

    it('finds variable references', () => {
      const source = `const driver = WorkerThreadsDriver;`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).toContainEqual(
        expect.objectContaining({ name: 'WorkerThreadsDriver' })
      );
    });
  });

  describe('exclusions', () => {
    it('does NOT find symbols inside single-line comments', () => {
      const source = `// Use createWorker to spawn workers`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).not.toContainEqual(
        expect.objectContaining({ name: 'createWorker' })
      );
    });

    it('does NOT find symbols inside multi-line comments', () => {
      const source = `/*
        The Middleware type is used for...
      */`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).not.toContainEqual(
        expect.objectContaining({ name: 'Middleware' })
      );
    });

    it('does NOT find symbols inside string literals', () => {
      const source = `const msg = "Use createWorker for this";`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).not.toContainEqual(
        expect.objectContaining({ name: 'createWorker' })
      );
    });

    it('does NOT find symbols inside template literals', () => {
      const source = 'const msg = `The Middleware handles requests`;';
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).not.toContainEqual(
        expect.objectContaining({ name: 'Middleware' })
      );
    });

    it('does NOT find non-API symbols', () => {
      const source = `const foo = someOtherFunction();`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).toHaveLength(0);
    });
  });

  describe('position accuracy', () => {
    it('returns correct start and end positions', () => {
      const source = `createWorker()`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      expect(symbols).toHaveLength(1);
      expect(symbols[0]).toEqual({
        name: 'createWorker',
        start: 0,
        end: 12,
      });
    });

    it('returns correct positions for multiple symbols', () => {
      const source = `import { createWorker, Middleware } from 'x';`;
      const symbols = findLinkableSymbols(source, apiSymbols);

      // Verify positions by extracting substrings
      for (const sym of symbols) {
        expect(source.substring(sym.start, sym.end)).toBe(sym.name);
      }
    });
  });
});

describe('linkHighlightedCode', () => {
  const symbols: LinkableSymbol[] = [
    { name: 'createWorker', start: 0, end: 12 },
  ];

  it('injects links into simple HTML', () => {
    // Simulating Shiki output where token is in a single span
    const html = `<span style="color:#fff">createWorker</span>`;
    const result = linkHighlightedCode(html, symbols, mockApiDocs);

    expect(result).toContain('href="/api/createWorker"');
    expect(result).toContain('class="code-link"');
    expect(result).toContain('>createWorker</a>');
  });

  it('preserves HTML structure around links', () => {
    const html = `<pre><code><span style="color:#fff">createWorker</span>()</code></pre>`;
    const result = linkHighlightedCode(html, symbols, mockApiDocs);

    expect(result).toContain('<pre>');
    expect(result).toContain('</pre>');
    expect(result).toContain('()');
  });

  it('handles multiple symbols', () => {
    const multiSymbols: LinkableSymbol[] = [
      { name: 'createWorker', start: 0, end: 12 },
      { name: 'Middleware', start: 20, end: 30 },
    ];
    const html = `<span>createWorker</span>, <span>Middleware</span>`;
    const result = linkHighlightedCode(html, multiSymbols, mockApiDocs);

    expect(result).toContain('href="/api/createWorker"');
    expect(result).toContain('href="/api/Middleware"');
  });

  it('does not double-link already linked content', () => {
    const html = `<a href="/existing">createWorker</a>`;
    const result = linkHighlightedCode(html, symbols, mockApiDocs);

    // Should not add another link
    const linkCount = (result.match(/<a /g) || []).length;
    expect(linkCount).toBe(1);
  });

  it('does not link symbols split across spans (known limitation)', () => {
    // Edge case: symbol split across spans cannot be linked
    // This is unlikely with Shiki since it tokenizes complete identifiers
    const html = `<span>create</span><span>Worker</span>`;
    const result = linkHighlightedCode(html, symbols, mockApiDocs);

    // The symbol remains unlinked when split - this is expected behavior
    expect(result).not.toContain('href=');
    expect(result).toContain('<span>create</span><span>Worker</span>');
  });
});

describe('buildSymbolLinks (integration)', () => {
  it('combines AST parsing with API matching', () => {
    const source = `
import { createWorker, type Middleware } from 'isolated-workers';

const middleware: Middleware = (msg) => msg;
const worker = await createWorker({ script: './w.ts' });
    `.trim();

    const symbols = buildSymbolLinks(source, mockApiDocs);

    // Should find createWorker twice (import + call)
    const createWorkerSymbols = symbols.filter(
      (s) => s.name === 'createWorker'
    );
    expect(createWorkerSymbols.length).toBeGreaterThanOrEqual(2);

    // Should find Middleware twice (import + type annotation)
    const middlewareSymbols = symbols.filter((s) => s.name === 'Middleware');
    expect(middlewareSymbols.length).toBeGreaterThanOrEqual(2);
  });

  it('works with the real middleware example pattern', () => {
    const source = `
import { startWorkerServer, Handlers, type Middleware } from 'isolated-workers';

const workerLoggingMiddleware: Middleware<Messages> = (message, direction) => {
  console.log(\`[WORKER \${direction}] Processing: \${message.type}\`);
  return message;
};
    `.trim();

    const symbols = buildSymbolLinks(source, mockApiDocs);

    expect(symbols).toContainEqual(
      expect.objectContaining({ name: 'startWorkerServer' })
    );
    expect(symbols).toContainEqual(
      expect.objectContaining({ name: 'Handlers' })
    );
    expect(symbols).toContainEqual(
      expect.objectContaining({ name: 'Middleware' })
    );
  });
});
