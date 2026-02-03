export interface ApiReferenceTag {
  type: 'typedoc-export';
  module?: string;
  exportName?: string;
}

export type LiquidTag =
  | { type: 'file'; path: string; hunk: string | undefined }
  | { type: 'example-link'; example: string }
  | {
      type: 'example-file';
      example: string;
      path: string;
      hunk: string | undefined;
    }
  | ApiReferenceTag;

export interface TypedocTagResult {
  module: string;
  export?: string;
  displayName: string;
  path: string;
  found: boolean;
}

// Match: {% command args %}
// Rejects:
// - Self-closing tags: {% foo /%} (Markdoc style)
// - Attribute syntax: id="value" (must be positional args)
const LIQUID_TAG = /^\{%\s+(\w+)\s+(.+?)\s*%\}$/;

// Valid example/file name pattern: alphanumeric, hyphens, underscores, dots, colons, hashes
// Explicitly rejects quotes and equals signs (attribute syntax)
const VALID_ARGS_PATTERN = /^[a-zA-Z0-9_\-.:/#]+$/;

/**
 * Parse a Liquid-style tag string.
 * Returns null if not a valid tag.
 *
 * Supported formats:
 * - {% file path %} or {% file path#hunk %}
 * - {% example name %} (link only)
 * - {% example name:path %} or {% example name:path#hunk %}
 *
 * Rejected formats:
 * - {% example id="name" %} (attribute syntax)
 * - {% example name /%} (self-closing)
 */
export function parseLiquidTag(tag: string): LiquidTag | null {
  const trimmed = tag.trim();

  // Reject self-closing Markdoc-style syntax: /%}
  if (trimmed.includes('/%}')) {
    return null;
  }

  const match = trimmed.match(LIQUID_TAG);
  if (!match) return null;

  const [, command, args] = match;

  // Reject attribute-style syntax (contains quotes or equals)
  if (!VALID_ARGS_PATTERN.test(args)) {
    return null;
  }

  if (command === 'file') {
    const [path, hunk] = args.split('#');
    return { type: 'file', path: path.trim(), hunk: hunk?.trim() };
  }

  if (command === 'example') {
    // Check if it's just a link or has a file reference
    if (args.includes(':')) {
      const colonIndex = args.indexOf(':');
      const example = args.slice(0, colonIndex).trim();
      const rest = args.slice(colonIndex + 1).trim();
      const [path, hunk] = rest.split('#');
      return {
        type: 'example-file',
        example,
        path: path.trim(),
        hunk: hunk?.trim(),
      };
    } else {
      // Just an example link
      return { type: 'example-link', example: args.trim() };
    }
  }

  return null;
}

/**
 * Check if a string is a valid Liquid tag placeholder.
 */
export function isLiquidTag(text: string): boolean {
  return parseLiquidTag(text) !== null;
}

export interface ExtractedTag {
  tag: LiquidTag;
  start: number;
  end: number;
}

// Pattern to find liquid tags within text (not anchored to start/end)
const INLINE_LIQUID_TAG = /\{%\s+(\w+)\s+(.+?)\s*%\}/g;

/**
 * Extract all liquid tags from a string, including inline tags.
 * Returns position information for each tag to enable replacement.
 *
 * Use this for processing text that contains liquid tags mixed with other content,
 * such as list items: "- {% example foo %} - description"
 */
export function extractAllLiquidTags(text: string): ExtractedTag[] {
  const results: ExtractedTag[] = [];

  // Reset lastIndex for global regex
  INLINE_LIQUID_TAG.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = INLINE_LIQUID_TAG.exec(text)) !== null) {
    const fullMatch = match[0];
    const tag = parseLiquidTag(fullMatch);

    if (tag) {
      results.push({
        tag,
        start: match.index,
        end: match.index + fullMatch.length,
      });
    }
  }

  return results;
}

/**
 * Parse a typedoc API reference tag.
 * Syntax: {% typedoc export:module %} or {% typedoc export:module:export %}
 */
export function parseTypedocTag(text: string): ApiReferenceTag | null {
  const match = text.match(/^typedoc:export:([\w.-]+)(?::([\w.-]+))?$/);

  if (!match) {
    return null;
  }

  const [, module, exportParam] = match;

  return {
    type: 'typedoc-export',
    module,
    ...(exportParam ? { exportName: exportParam } : {}),
  };
}
