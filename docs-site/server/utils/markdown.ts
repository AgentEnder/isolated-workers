import type { Root as MdastRoot, RootContent } from 'mdast';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { parseLiquidTag, type LiquidTag } from './liquid-tags';

/**
 * Parse markdown string into an AST
 */
export function parseMarkdown(markdown: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

/**
 * Process a markdown AST chunk into HTML
 */
export async function processMarkdownChunk(
  nodes: RootContent[]
): Promise<string> {
  if (nodes.length === 0) return '';

  const root: MdastRoot = {
    type: 'root',
    children: nodes,
  };

  const processor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify, { allowDangerousHtml: true });

  const result = await processor.run(root);
  return processor.stringify(result);
}

/**
 * Result of checking if a node is a liquid tag placeholder
 */
export type LiquidTagCheck =
  | { isPlaceholder: true; tag: LiquidTag }
  | { isPlaceholder: false };

/**
 * Check if a paragraph node contains only a liquid tag placeholder
 */
export function extractLiquidTag(node: RootContent): LiquidTagCheck {
  if (node.type !== 'paragraph' || node.children.length !== 1) {
    return { isPlaceholder: false };
  }

  const child = node.children[0];
  if (child.type !== 'text') {
    return { isPlaceholder: false };
  }

  const tag = parseLiquidTag(child.value.trim());
  if (tag) {
    return { isPlaceholder: true, tag };
  }

  return { isPlaceholder: false };
}

/**
 * Result of checking for file placeholder (supports legacy syntax)
 */
export type FilePlaceholderCheck =
  | { isPlaceholder: true; filename: string; hunk?: string }
  | { isPlaceholder: false };

/**
 * Check if a paragraph node contains a file placeholder.
 * Supports both legacy {{file:...}} and new {% file ... %} syntax.
 */
export function extractFilePlaceholder(node: RootContent): FilePlaceholderCheck {
  if (node.type !== 'paragraph' || node.children.length !== 1) {
    return { isPlaceholder: false };
  }

  const child = node.children[0];
  if (child.type !== 'text') {
    return { isPlaceholder: false };
  }

  const text = child.value.trim();

  // Try new Liquid syntax first: {% file path %} or {% file path#hunk %}
  const tag = parseLiquidTag(text);
  if (tag && tag.type === 'file') {
    return { isPlaceholder: true, filename: tag.path, hunk: tag.hunk };
  }

  // Fall back to legacy {{file:...}} syntax for backwards compatibility
  const legacyMatch = text.match(/^\{\{file:([^}]+)\}\}$/);
  if (legacyMatch) {
    const [filename, hunk] = legacyMatch[1].trim().split('#');
    return { isPlaceholder: true, filename, hunk };
  }

  return { isPlaceholder: false };
}
