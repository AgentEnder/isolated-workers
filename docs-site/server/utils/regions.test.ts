import { describe, expect, it } from 'vitest';
import { parseRegions, extractHunk, stripMarkers } from './regions';

describe('parseRegions', () => {
  it('parses a single region', () => {
    const code = `const a = 1;
// #region setup
const worker = createWorker();
// #endregion setup
const b = 2;`;

    const regions = parseRegions(code);
    expect(regions).toEqual({
      setup: {
        startLine: 2,
        endLine: 4,
        content: 'const worker = createWorker();',
      },
    });
  });

  it('parses nested regions', () => {
    const code = `// #region outer
const a = 1;
// #region inner
const b = 2;
// #endregion inner
const c = 3;
// #endregion outer`;

    const regions = parseRegions(code);
    expect(regions.outer.content).toContain('const a = 1;');
    expect(regions.outer.content).toContain('const b = 2;');
    expect(regions.outer.content).toContain('const c = 3;');
    expect(regions.inner.content).toBe('const b = 2;');
  });

  it('throws on unclosed region', () => {
    const code = `// #region unclosed
const a = 1;`;
    expect(() => parseRegions(code)).toThrow(/Unclosed region 'unclosed'/);
  });

  it('throws on mismatched endregion', () => {
    const code = `// #region one
// #endregion two`;
    expect(() => parseRegions(code)).toThrow(/Mismatched/);
  });

  it('throws on orphan endregion', () => {
    const code = `const a = 1;
// #endregion orphan`;
    expect(() => parseRegions(code)).toThrow(/Unexpected #endregion 'orphan'/);
  });

  it('handles empty region', () => {
    const code = `// #region empty
// #endregion empty`;
    const regions = parseRegions(code);
    expect(regions.empty.content).toBe('');
  });
});

describe('extractHunk', () => {
  it('extracts a region by id', () => {
    const code = `const a = 1;
// #region setup
const worker = createWorker();
// #endregion setup`;

    const hunk = extractHunk(code, 'setup');
    expect(hunk).toBe('const worker = createWorker();');
  });

  it('throws on missing region', () => {
    const code = `const a = 1;`;
    expect(() => extractHunk(code, 'missing')).toThrow(
      /Region 'missing' not found/
    );
  });
});

describe('stripMarkers', () => {
  it('removes all region markers from code', () => {
    const code = `const a = 1;
// #region setup
const worker = createWorker();
// #endregion setup
const b = 2;`;

    const stripped = stripMarkers(code);
    expect(stripped).toBe(`const a = 1;
const worker = createWorker();
const b = 2;`);
  });

  it('handles multiple regions', () => {
    const code = `// #region a
one
// #endregion a
// #region b
two
// #endregion b`;

    const stripped = stripMarkers(code);
    expect(stripped).toBe(`one
two`);
  });
});
