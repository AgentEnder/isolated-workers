/**
 * A segment of code - either plain text or a linkable type reference.
 */
export interface CodeSegment {
  type: 'text' | 'type-link';
  text: string;
  href?: string;
}

/**
 * Process a code string and identify type references that can be linked.
 * Returns an array of segments for rendering.
 *
 * @param code - The code string to process
 * @param knownExports - Map of export names to their paths
 * @returns Array of segments
 */
export function processCodeWithLinks(
  code: string,
  knownExports: Record<string, string>
): CodeSegment[] {
  const segments: CodeSegment[] = [];
  let current = '';
  let isInIdentifier = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const isIdentifierChar = /[a-zA-Z0-9_]/.test(char);

    if (isIdentifierChar && !isInIdentifier) {
      // Starting an identifier - flush current non-identifier text
      if (current) {
        segments.push({ type: 'text', text: current });
        current = '';
      }
      isInIdentifier = true;
    } else if (!isIdentifierChar && isInIdentifier) {
      // Ending an identifier - check if it's a known export
      if (current && knownExports[current]) {
        segments.push({
          type: 'type-link',
          text: current,
          href: knownExports[current],
        });
      } else if (current) {
        segments.push({ type: 'text', text: current });
      }
      current = '';
      isInIdentifier = false;
    }

    current += char;
  }

  // Flush remaining content
  if (current) {
    if (isInIdentifier && knownExports[current]) {
      segments.push({
        type: 'type-link',
        text: current,
        href: knownExports[current],
      });
    } else {
      segments.push({ type: 'text', text: current });
    }
  }

  return segments;
}

/**
 * Merge adjacent text segments for cleaner output.
 */
export function mergeTextSegments(segments: CodeSegment[]): CodeSegment[] {
  const merged: CodeSegment[] = [];

  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (last && last.type === 'text' && segment.type === 'text') {
      last.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }

  return merged;
}

/**
 * Process code and return merged segments.
 */
export function linkifyCode(
  code: string,
  knownExports: Record<string, string>
): CodeSegment[] {
  return mergeTextSegments(processCodeWithLinks(code, knownExports));
}
