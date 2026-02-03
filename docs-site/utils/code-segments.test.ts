import { describe, it, expect } from 'vitest';
import { linkifyCode, type CodeSegment } from './code-segments';

describe('linkifyCode', () => {
  const knownExports: Record<string, string> = {
    createWorker: '/api/create-worker',
    Worker: '/api/worker',
    WorkerOptions: '/api/worker-options',
    startWorkerServer: '/api/start-worker-server',
    Handlers: '/api/handlers',
  };

  it('returns plain text when no known exports match', () => {
    const result = linkifyCode('const x = 42;', knownExports);
    expect(result).toEqual([{ type: 'text', text: 'const x = 42;' }]);
  });

  it('links a single known export', () => {
    const result = linkifyCode('createWorker()', knownExports);
    expect(result).toEqual([
      { type: 'type-link', text: 'createWorker', href: '/api/create-worker' },
      { type: 'text', text: '()' },
    ]);
  });

  it('links multiple known exports', () => {
    const code = 'const worker: Worker = createWorker();';
    const result = linkifyCode(code, knownExports);

    const links = result.filter((s) => s.type === 'type-link');
    expect(links).toHaveLength(2);
    expect(links[0].text).toBe('Worker');
    expect(links[1].text).toBe('createWorker');
  });

  it('handles generic type syntax', () => {
    const code = 'createWorker<MyMessages>({ script: "./worker.js" })';
    const result = linkifyCode(code, knownExports);

    expect(result).toContainEqual({
      type: 'type-link',
      text: 'createWorker',
      href: '/api/create-worker',
    });
  });

  it('handles import statements', () => {
    const code = "import { createWorker, Worker } from 'isolated-workers';";
    const result = linkifyCode(code, knownExports);

    const links = result.filter((s) => s.type === 'type-link');
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.text)).toContain('createWorker');
    expect(links.map((l) => l.text)).toContain('Worker');
  });

  it('handles multiline code', () => {
    const code = `const worker = await createWorker({
  script: './worker.js',
});`;
    const result = linkifyCode(code, knownExports);

    expect(result.some((s) => s.type === 'type-link' && s.text === 'createWorker')).toBe(true);
    // Should preserve newlines
    expect(result.map((s) => s.text).join('')).toBe(code);
  });

  it('merges adjacent text segments', () => {
    const code = 'const x = 1 + 2;';
    const result = linkifyCode(code, knownExports);

    // Should be a single merged text segment
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
  });

  it('handles type annotations', () => {
    const code = 'const opts: WorkerOptions = {};';
    const result = linkifyCode(code, knownExports);

    expect(result).toContainEqual({
      type: 'type-link',
      text: 'WorkerOptions',
      href: '/api/worker-options',
    });
  });

  it('handles function signatures with known types', () => {
    const code = 'async function start(handlers: Handlers) {}';
    const result = linkifyCode(code, knownExports);

    expect(result).toContainEqual({
      type: 'type-link',
      text: 'Handlers',
      href: '/api/handlers',
    });
  });

  it('preserves exact code structure', () => {
    const code = `const worker = await createWorker<MyMessages>({
  script: './worker.js',
});`;
    const result = linkifyCode(code, knownExports);

    // Joining all segments should recreate the original code
    const reconstructed = result.map((s) => s.text).join('');
    expect(reconstructed).toBe(code);
  });
});
