export type LiquidTag =
  | { type: 'file'; path: string; hunk: string | undefined }
  | { type: 'example-link'; example: string }
  | {
      type: 'example-file';
      example: string;
      path: string;
      hunk: string | undefined;
    };

const LIQUID_TAG = /^\{%\s+(\w+)\s+(.+?)\s*%\}$/;

/**
 * Parse a Liquid-style tag string.
 * Returns null if not a valid tag.
 *
 * Supported formats:
 * - {% file path %} or {% file path#hunk %}
 * - {% example name %} (link only)
 * - {% example name:path %} or {% example name:path#hunk %}
 */
export function parseLiquidTag(tag: string): LiquidTag | null {
  const match = tag.trim().match(LIQUID_TAG);
  if (!match) return null;

  const [, command, args] = match;

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
 * Check if a string contains a Liquid tag placeholder.
 */
export function isLiquidTag(text: string): boolean {
  return /^\{%\s+\w+\s+.+?\s*%\}$/.test(text.trim());
}
