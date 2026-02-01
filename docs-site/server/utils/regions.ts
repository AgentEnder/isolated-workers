export interface RegionInfo {
  startLine: number;
  endLine: number;
  content: string;
}

export type RegionMap = Record<string, RegionInfo>;

const REGION_START = /^\s*\/\/\s*#region\s+(\S+)\s*$/;
const REGION_END = /^\s*\/\/\s*#endregion\s+(\S+)\s*$/;

/**
 * Parse all #region/#endregion pairs from code.
 * Supports nested regions.
 * Throws on unclosed or mismatched regions.
 */
export function parseRegions(code: string): RegionMap {
  const lines = code.split('\n');
  const regions: RegionMap = {};
  const stack: Array<{ id: string; startLine: number; startIndex: number }> =
    [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const startMatch = line.match(REGION_START);
    if (startMatch) {
      stack.push({ id: startMatch[1], startLine: i + 1, startIndex: i });
      continue;
    }

    const endMatch = line.match(REGION_END);
    if (endMatch) {
      const endId = endMatch[1];
      const openRegion = stack.pop();

      if (!openRegion) {
        throw new Error(`Unexpected #endregion '${endId}' at line ${i + 1}`);
      }

      if (openRegion.id !== endId) {
        throw new Error(
          `Mismatched region: opened '${openRegion.id}' at line ${openRegion.startLine}, closed '${endId}' at line ${i + 1}`
        );
      }

      // Extract content between markers (exclusive)
      const contentLines = lines.slice(openRegion.startIndex + 1, i);
      // Strip nested region markers from content
      const content = stripMarkers(contentLines.join('\n'));

      regions[openRegion.id] = {
        startLine: openRegion.startLine,
        endLine: i + 1,
        content: content.trim(),
      };
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    throw new Error(
      `Unclosed region '${unclosed.id}' starting at line ${unclosed.startLine}`
    );
  }

  return regions;
}

/**
 * Extract a specific region's content by ID.
 * Throws if region not found.
 */
export function extractHunk(code: string, regionId: string): string {
  const regions = parseRegions(code);

  if (!(regionId in regions)) {
    throw new Error(`Region '${regionId}' not found in code`);
  }

  return regions[regionId].content;
}

/**
 * Remove all #region and #endregion marker lines from code.
 */
export function stripMarkers(code: string): string {
  const lines = code.split('\n');
  const filtered = lines.filter(
    (line) => !REGION_START.test(line) && !REGION_END.test(line)
  );
  return filtered.join('\n');
}
