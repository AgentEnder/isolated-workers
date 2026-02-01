import { describe, expect, it } from 'vitest';
import { parseLiquidTag, isLiquidTag } from './liquid-tags';

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
