import { describe, expect, it } from 'vitest';
import { highlightCodeWithLinks } from './highlight-code';

import.meta.env.BASE_URL = '/';

describe('highlightCodeWithLinks', () => {
  const knownExports: Record<string, string> = {
    createWorker: '/api/create-worker',
    Worker: '/api/worker',
    startWorkerServer: '/api/start-worker-server',
  };

  it('highlights code and returns original code for copy', async () => {
    const code = 'const x = 1;';
    const result = await highlightCodeWithLinks(code, 'typescript', {});

    expect(result.code).toBe(code);
    expect(result.html).toContain('<pre');
    expect(result.html).toContain('shiki');
  });

  it('injects links for known exports', async () => {
    const code = 'const worker = createWorker();';
    const result = await highlightCodeWithLinks(
      code,
      'typescript',
      knownExports
    );

    expect(result.html).toContain('href="/api/create-worker"');
    expect(result.html).toContain('class="code-link"');
    expect(result.html).toContain('>createWorker<');
  });

  it('injects multiple links', async () => {
    const code = `import { createWorker, Worker } from 'isolated-workers';`;
    const result = await highlightCodeWithLinks(
      code,
      'typescript',
      knownExports
    );

    expect(result.html).toContain('href="/api/create-worker"');
    expect(result.html).toContain('href="/api/worker"');
  });

  it('does not link unknown identifiers', async () => {
    const code = 'const foo = bar();';
    const result = await highlightCodeWithLinks(
      code,
      'typescript',
      knownExports
    );

    expect(result.html).not.toContain('href=');
    expect(result.html).not.toContain('code-link');
  });

  it('handles multiline code', async () => {
    const code = `const worker = await createWorker({
  script: './worker.js',
});`;
    const result = await highlightCodeWithLinks(
      code,
      'typescript',
      knownExports
    );

    expect(result.html).toContain('href="/api/create-worker"');
    expect(result.code).toBe(code);
  });

  it('maps language aliases correctly', async () => {
    const code = 'const x = 1;';

    // These should all work without throwing
    const results = await Promise.all([
      highlightCodeWithLinks(code, 'ts', {}),
      highlightCodeWithLinks(code, 'js', {}),
      highlightCodeWithLinks(code, 'typescript', {}),
    ]);

    for (const result of results) {
      expect(result.html).toContain('<pre');
    }
  });
});
