import type { Root as MdastRoot, RootContent } from 'mdast';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import type { Plugin } from 'unified';
import { unified } from 'unified';
import { Literal, Node, Parent } from 'unist';
import { visit } from 'unist-util-visit';
import { applyBaseUrl } from '../../utils/base-url';
import { parseLiquidTag, type LiquidTag } from './liquid-tags';
import {
  remarkLiquidTags,
  type RemarkLiquidTagsOptions,
} from './remark-liquid-tags';
import type { ApiDocs, ApiExport } from './typedoc';

// Note: Code linking is handled in segments.ts on highlighted HTML output,
// not at the remark/markdown level (since raw code can't contain HTML links)

export type { RemarkLiquidTagsOptions };

export interface ProcessMarkdownChunkOptions {
  liquidTags?: RemarkLiquidTagsOptions;
  apiDocs: ApiDocs;
}

export function parseMarkdown(markdown: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

export const hydrateInlineCodeLinks: Plugin<
  [
    {
      apiDocs: ApiDocs;
    }
  ]
> = ({ apiDocs }: { apiDocs: ApiDocs }) => {
  const symbolToExport = new Map<string, ApiExport>();
  for (const apiExport of apiDocs.allExports) {
    if (!symbolToExport.has(apiExport.name)) {
      if (apiExport) {
        symbolToExport.set(apiExport.name, apiExport);
      }
    }
  }

  return (tree: Node) => {
    visit(
      tree,
      'inlineCode',
      (node: Literal, index: number, parent: Parent) => {
        if (typeof node.value !== 'string') return;

        const apiDoc = symbolToExport.get(node.value);

        const codeNode = {
          type: 'html',
          value: `<code class="inline-code">${
            apiDoc
              ? `<a class="code-link" href=${applyBaseUrl(apiDoc.path)}>${
                  node.value
                }</a>`
              : node.value
          }</code>`,
        };

        // Replace node with HTML snippet
        parent.children.splice(index, 1, codeNode);
      }
    );
  };
};

export interface HtmlElementNode extends Node {
  type: 'element';
  tagName: string;
  properties?: {
    [prop: string]: unknown;
  };
  children?: Node[];
}

export const applyBaseUrlToLinks: Plugin<[]> = () => {
  return (tree: Node) => {
    visit(tree, 'element', (node: HtmlElementNode) => {
      if (node.tagName === 'a' && typeof node.properties?.href === 'string') {
        node.properties.href = applyBaseUrl(node.properties.href);
      }
    });
  };
};

export async function processMarkdownChunk(
  nodes: RootContent[],
  options: ProcessMarkdownChunkOptions
): Promise<string> {
  if (nodes.length === 0) return '';

  const root: MdastRoot = {
    type: 'root',
    children: nodes,
  };

  const processor = unified();

  if (options.liquidTags) {
    processor.use(remarkLiquidTags, options.liquidTags);
  }

  processor.use(hydrateInlineCodeLinks, options);

  // Note: Code linking happens in segments.ts on the highlighted HTML,
  // not here on raw markdown (which can't contain HTML links)

  processor
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(applyBaseUrlToLinks)
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
  options: ProcessMarkdownChunkOptions
): Promise<string> {
  const root = parseMarkdown(markdown);
  return processMarkdownChunk(root.children, options);
}
