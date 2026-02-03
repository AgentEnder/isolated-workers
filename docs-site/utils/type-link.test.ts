import { describe, it, expect } from 'vitest';
import { parseTypeString } from './type-link';

describe('parseTypeString', () => {
  it('parses simple type name', () => {
    const result = parseTypeString('string');
    expect(result).toEqual([{ text: 'string', isType: true }]);
  });

  it('parses generic type', () => {
    const result = parseTypeString('Promise<void>');
    expect(result).toEqual([
      { text: 'Promise', isType: true },
      { text: '<', isType: false },
      { text: 'void', isType: true },
      { text: '>', isType: false },
    ]);
  });

  it('parses complex generic with multiple type params', () => {
    const result = parseTypeString('Map<string, Array<number>>');
    expect(result).toEqual([
      { text: 'Map', isType: true },
      { text: '<', isType: false },
      { text: 'string', isType: true },
      { text: ', ', isType: false },
      { text: 'Array', isType: true },
      { text: '<', isType: false },
      { text: 'number', isType: true },
      { text: '>>', isType: false },
    ]);
  });

  it('parses union types', () => {
    const result = parseTypeString('string | number');
    expect(result).toEqual([
      { text: 'string', isType: true },
      { text: ' | ', isType: false },
      { text: 'number', isType: true },
    ]);
  });

  it('parses function type', () => {
    const result = parseTypeString('(data: T) => string');
    expect(result).toEqual([
      { text: '(', isType: false },
      { text: 'data', isType: true },
      { text: ': ', isType: false },
      { text: 'T', isType: true },
      { text: ') => ', isType: false },
      { text: 'string', isType: true },
    ]);
  });

  it('parses object type', () => {
    const result = parseTypeString('{ name: string }');
    expect(result).toEqual([
      { text: '{ ', isType: false },
      { text: 'name', isType: true },
      { text: ': ', isType: false },
      { text: 'string', isType: true },
      { text: ' }', isType: false },
    ]);
  });

  it('handles empty string', () => {
    const result = parseTypeString('');
    expect(result).toEqual([]);
  });

  it('parses WorkerOptions<TDefs> correctly', () => {
    const result = parseTypeString('WorkerOptions<TDefs>');
    expect(result).toEqual([
      { text: 'WorkerOptions', isType: true },
      { text: '<', isType: false },
      { text: 'TDefs', isType: true },
      { text: '>', isType: false },
    ]);
  });
});
