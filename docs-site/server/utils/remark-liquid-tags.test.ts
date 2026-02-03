import { describe, expect, it } from 'vitest';
import { parseMarkdown, processMarkdownChunk } from './markdown';
import type { RemarkLiquidTagsOptions } from './remark-liquid-tags';

const examples: RemarkLiquidTagsOptions['examples'] = {
  'basic-ping': { id: 'basic-ping', title: 'Basic Ping Example' },
  'worker-threads': { id: 'worker-threads', title: 'Worker Threads' },
};

async function transform(markdown: string): Promise<string> {
  const tree = parseMarkdown(markdown);
  return processMarkdownChunk(tree.children, {
    liquidTags: { examples },
    apiDocs: {
      allExports: [],
      exports: {},
      modules: {},
    },
  });
}

describe('remarkLiquidTags', () => {
  it('transforms inline example tag in paragraph', async () => {
    const input = 'See {% example basic-ping %} for details.';
    const output = await transform(input);
    // Should produce an anchor tag in HTML
    expect(output).toContain('<a href="/examples/basic-ping"');
    expect(output).toContain('Basic Ping Example</a>');
    expect(output).toContain('for details');
  });

  it('transforms example tag in list item', async () => {
    const input = '- {% example basic-ping %} - The basic example';
    const output = await transform(input);
    expect(output).toContain('<a href="/examples/basic-ping"');
    expect(output).toContain('The basic example');
  });

  it('transforms multiple tags in same text node', async () => {
    const input = '{% example basic-ping %} and {% example worker-threads %}';
    const output = await transform(input);
    expect(output).toContain('href="/examples/basic-ping"');
    expect(output).toContain('href="/examples/worker-threads"');
  });

  it('preserves text around tags', async () => {
    const input = 'Before {% example basic-ping %} after';
    const output = await transform(input);
    expect(output).toContain('Before');
    expect(output).toContain('after');
    expect(output).toContain('Basic Ping Example');
  });

  it('leaves unknown example tags as-is', async () => {
    const input = 'See {% example unknown-example %} here';
    const output = await transform(input);
    // Tag should remain as literal text since example doesn't exist
    expect(output).toContain('{% example unknown-example %}');
  });

  it('ignores invalid liquid tag syntax', async () => {
    const input = '{{ handlebars }} and {% unknown command %}';
    const output = await transform(input);
    // Invalid syntax should remain unchanged
    expect(output).toContain('{{ handlebars }}');
    expect(output).toContain('{% unknown command %}');
  });

  it('transforms standalone tag on its own line', async () => {
    const input = `Some text

{% example basic-ping %}

More text`;
    const output = await transform(input);
    expect(output).toContain('href="/examples/basic-ping"');
  });
});
