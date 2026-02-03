import { describe, expect, it } from 'vitest';
import { parseLiquidTag, isLiquidTag, extractAllLiquidTags } from './liquid-tags';

describe('parseLiquidTag', () => {
  it('parses {% file path %}', () => {
    const result = parseLiquidTag('{% file host.ts %}');
    expect(result).toEqual({
      type: 'file',
      path: 'host.ts',
      hunk: undefined,
    });
  });

  it('parses {% file path#hunk %}', () => {
    const result = parseLiquidTag('{% file host.ts#setup %}');
    expect(result).toEqual({
      type: 'file',
      path: 'host.ts',
      hunk: 'setup',
    });
  });

  it('parses {% example name %}', () => {
    const result = parseLiquidTag('{% example basic-ping %}');
    expect(result).toEqual({
      type: 'example-link',
      example: 'basic-ping',
    });
  });

  it('parses {% example name:path %}', () => {
    const result = parseLiquidTag('{% example basic-ping:host.ts %}');
    expect(result).toEqual({
      type: 'example-file',
      example: 'basic-ping',
      path: 'host.ts',
      hunk: undefined,
    });
  });

  it('parses {% example name:path#hunk %}', () => {
    const result = parseLiquidTag('{% example basic-ping:host.ts#setup %}');
    expect(result).toEqual({
      type: 'example-file',
      example: 'basic-ping',
      path: 'host.ts',
      hunk: 'setup',
    });
  });

  it('returns null for invalid tags', () => {
    expect(parseLiquidTag('{{ handlebars }}')).toBeNull();
    expect(parseLiquidTag('not a tag')).toBeNull();
    expect(parseLiquidTag('{% unknown foo %}')).toBeNull();
  });

  it('returns null for self-closing Markdoc-style tags', () => {
    // These use a different syntax that we don't support
    expect(parseLiquidTag('{% example id="basic-ping" /%}')).toBeNull();
    expect(parseLiquidTag('{% file path="host.ts" /%}')).toBeNull();
  });

  it('returns null for attribute-style syntax', () => {
    // We use positional args, not key="value" attributes
    expect(parseLiquidTag('{% example id="basic-ping" %}')).toBeNull();
  });
});

describe('extractAllLiquidTags', () => {
  it('extracts a single inline tag', () => {
    const result = extractAllLiquidTags('See {% example basic-ping %} for details');
    expect(result).toEqual([
      {
        tag: { type: 'example-link', example: 'basic-ping' },
        start: 4,
        end: 28,
      },
    ]);
  });

  it('extracts multiple inline tags', () => {
    const result = extractAllLiquidTags(
      '{% example foo %} and {% example bar %}'
    );
    expect(result).toHaveLength(2);
    expect(result[0].tag).toEqual({ type: 'example-link', example: 'foo' });
    expect(result[1].tag).toEqual({ type: 'example-link', example: 'bar' });
  });

  it('extracts tag from list item text', () => {
    // This is how it appears after markdown parsing strips the "- " prefix
    const result = extractAllLiquidTags(
      '{% example worker-threads-driver %} - Using worker threads'
    );
    expect(result).toHaveLength(1);
    expect(result[0].tag).toEqual({
      type: 'example-link',
      example: 'worker-threads-driver',
    });
  });

  it('returns empty array when no tags found', () => {
    expect(extractAllLiquidTags('No tags here')).toEqual([]);
    expect(extractAllLiquidTags('{{ handlebars }}')).toEqual([]);
  });

  it('ignores invalid tag syntax', () => {
    const result = extractAllLiquidTags(
      '{% unknown foo %} but {% example valid %}'
    );
    expect(result).toHaveLength(1);
    expect(result[0].tag).toEqual({ type: 'example-link', example: 'valid' });
  });
});

describe('isLiquidTag', () => {
  it('returns true for valid liquid tag format', () => {
    expect(isLiquidTag('{% file host.ts %}')).toBe(true);
    expect(isLiquidTag('{% example basic-ping %}')).toBe(true);
    expect(isLiquidTag('  {% file test.ts %}  ')).toBe(true);
  });

  it('returns false for non-liquid tag strings', () => {
    expect(isLiquidTag('{{ handlebars }}')).toBe(false);
    expect(isLiquidTag('not a tag')).toBe(false);
    expect(isLiquidTag('{% %}')).toBe(false);
    expect(isLiquidTag('')).toBe(false);
  });
});
