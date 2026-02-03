import type { RootContent } from 'mdast';
import { buildSymbolLinks, linkHighlightedCode } from './code-links';
import { highlightCode } from './highlighter';
import {
  parseMarkdown,
  processMarkdownChunk,
  type RemarkCodeLinksOptions,
  type RemarkLiquidTagsOptions,
} from './markdown';

/**
 * A segment of content for rendering markdown with embedded special content.
 * Used by both docs and examples pages.
 */
export type ContentSegment =
  | { type: 'html'; html: string }
  | {
      type: 'file';
      filename: string;
      language: string;
      content: string;
      highlightedHtml: string;
    }
  | {
      type: 'code-block';
      language: string;
      content: string;
      highlightedHtml: string;
    }
  | {
      type: 'example-link';
      exampleId: string;
      title: string;
      description: string;
    };

/**
 * Handler for processing special nodes during markdown parsing.
 * Return a ContentSegment to replace the node, or null to include it in the HTML chunk.
 */
export type NodeHandler = (
  node: RootContent
) => Promise<ContentSegment | null> | ContentSegment | null;

/**
 * Options for parsing markdown into segments
 */
export interface ParseMarkdownOptions {
  /** Custom handler for special nodes (liquid tags, file placeholders, etc.) */
  nodeHandler?: NodeHandler;
  /** Whether to extract fenced code blocks as separate segments (default: true) */
  extractCodeBlocks?: boolean;
  /**
   * Options for transforming inline liquid tags to links.
   * If provided, inline {% example name %} tags will be converted to links.
   */
  liquidTags?: RemarkLiquidTagsOptions;
  /**
   * Options for auto-linking API symbols in code blocks.
   */
  codeLinks?: RemarkCodeLinksOptions;
}

/**
 * Parse markdown into content segments, extracting special content.
 *
 * This is the core parsing logic shared between docs and examples pages.
 * It walks the markdown AST and:
 * 1. Calls nodeHandler for each node to check for special content
 * 2. Optionally extracts fenced code blocks as code-block segments
 * 3. Accumulates regular nodes into HTML segments
 */
export async function parseMarkdownToSegments(
  markdown: string,
  options: ParseMarkdownOptions = {}
): Promise<ContentSegment[]> {
  const {
    nodeHandler,
    extractCodeBlocks = true,
    liquidTags,
    codeLinks,
  } = options;

  const segments: ContentSegment[] = [];
  const tree = parseMarkdown(markdown);
  let currentChunk: RootContent[] = [];

  /**
   * Flush accumulated markdown nodes to an HTML segment
   */
  async function flushChunk() {
    if (currentChunk.length > 0) {
      const html = await processMarkdownChunk(currentChunk, {
        liquidTags,
        codeLinks,
      });
      if (html.trim()) {
        segments.push({ type: 'html', html });
      }
      currentChunk = [];
    }
  }

  for (const node of tree.children) {
    // Check custom node handler first
    if (nodeHandler) {
      const segment = await nodeHandler(node);
      if (segment) {
        await flushChunk();
        segments.push(segment);
        continue;
      }
    }

    // Extract fenced code blocks as separate segments
    if (extractCodeBlocks && node.type === 'code') {
      await flushChunk();

      const language = node.lang || 'text';
      const content = node.value;

      let highlightedHtml = await highlightCode(content, language);

      // Apply code links if option is provided
      if (codeLinks?.apiDocs) {
        const symbolLinks = buildSymbolLinks(content, codeLinks.apiDocs);
        if (symbolLinks.size > 0) {
          highlightedHtml = linkHighlightedCode(highlightedHtml, symbolLinks);
        }
      }

      segments.push({
        type: 'code-block',
        language,
        content,
        highlightedHtml,
      });
      continue;
    }

    // Regular markdown content - accumulate for HTML rendering
    currentChunk.push(node);
  }

  // Flush remaining chunk
  await flushChunk();

  return segments;
}

/**
 * Create a file segment with syntax highlighting
 */
export async function createFileSegment(
  filename: string,
  content: string,
  language: string
): Promise<ContentSegment> {
  const highlightedHtml = await highlightCode(content, language);
  return {
    type: 'file',
    filename,
    language,
    content,
    highlightedHtml,
  };
}
