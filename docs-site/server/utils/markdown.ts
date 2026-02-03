/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Root as MdastRoot, RootContent } from 'mdast';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { parseLiquidTag, type LiquidTag } from './liquid-tags';
import {
  remarkLiquidTags,
  type RemarkLiquidTagsOptions,
} from './remark-liquid-tags';
import {
  remarkCodeLinks,
  type RemarkCodeLinksOptions,
} from './remark-code-links';

export type { RemarkLiquidTagsOptions, RemarkCodeLinksOptions };

export interface ProcessMarkdownChunkOptions {
  liquidTags?: RemarkLiquidTagsOptions;
  codeLinks?: RemarkCodeLinksOptions;
}

export function parseMarkdown(markdown: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

export async function processMarkdownChunk(
  nodes: RootContent[],
  options: ProcessMarkdownChunkOptions = {}
): Promise<string> {
  if (nodes.length === 0) return '';

  const root: MdastRoot = {
    type: 'root',
    children: nodes,
  };

  const processor: any = unified();

  if (options.liquidTags) {
    processor.use(remarkLiquidTags, options.liquidTags);
  }

  if (options.codeLinks) {
    processor.use(remarkCodeLinks, options.codeLinks);
  }

  processor
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify, { allowDangerousHtml: true });

  const result = await processor.run(root);
  return String(processor.stringify(result));
}

export type LiquidTagCheck =
  | { isPlaceholder: true; tag: LiquidTag }
  | { isPlaceholder: false };

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

export type FilePlaceholderCheck =
  | { isPlaceholder: true; filename: string; hunk?: string }
  | { isPlaceholder: false };

export function extractFilePlaceholder(
  node: RootContent
): FilePlaceholderCheck {
  if (node.type !== 'paragraph' || node.children.length !== 1) {
    return { isPlaceholder: false };
  }

  const child = node.children[0];
  if (child.type !== 'text') {
    return { isPlaceholder: false };
  }

  const text = child.value.trim();

  const tag = parseLiquidTag(text);
  if (tag && tag.type === 'file') {
    return { isPlaceholder: true, filename: tag.path, hunk: tag.hunk };
  }

  const legacyMatch = text.match(/^\{\{file:([^}]+)\}\}$/);
  if (legacyMatch) {
    const [filename, hunk] = legacyMatch[1].trim().split('#');
    return { isPlaceholder: true, filename, hunk };
  }

  return { isPlaceholder: false };
}

export async function processMarkdownWithTypedoc(
  markdown: string,
  options: ProcessMarkdownChunkOptions = {}
): Promise<string> {
  const root = parseMarkdown(markdown);
  return processMarkdownChunk(root.children, options);
}
