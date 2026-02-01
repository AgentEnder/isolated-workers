import type { Root as MdastRoot, RootContent } from 'mdast';
import fs from 'node:fs/promises';
import path from 'node:path';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import type { BundledLanguage } from 'shiki';
import { createHighlighter } from 'shiki';
import { unified } from 'unified';
import type { PageContextServer } from 'vike/types';
import matter from 'gray-matter';
import { type DocMetadata } from '../../server/utils/docs';
import {
  parseLiquidTag,
  type LiquidTag,
} from '../../server/utils/liquid-tags';
import { extractHunk, stripMarkers } from '../../server/utils/regions';

/**
 * A segment of content - either rendered HTML, a file to display, or an example link
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
      type: 'example-link';
      exampleId: string;
      title: string;
      description: string;
    };

export interface DocsData {
  doc: DocMetadata | null;
  /** Content split into segments for proper rendering */
  segments: ContentSegment[];
}

// Highlighter singleton for build-time highlighting
let highlighterInit: Promise<
  Awaited<ReturnType<typeof createHighlighter>>
> | null = null;

async function getHighlighter() {
  if (!highlighterInit) {
    highlighterInit = createHighlighter({
      themes: ['github-dark'],
      langs: [
        'javascript',
        'jsx',
        'typescript',
        'tsx',
        'json',
        'yaml',
        'bash',
        'html',
        'css',
        'plaintext',
      ],
    });
  }
  return highlighterInit;
}

function mapLanguage(lang: string): string {
  const languageMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    yml: 'yaml',
    sh: 'bash',
    text: 'plaintext',
    cjs: 'javascript',
    mjs: 'javascript',
  };

  const normalized = lang.toLowerCase();
  return languageMap[normalized] || normalized;
}

async function highlightCode(code: string, language: string): Promise<string> {
  try {
    const h = await getHighlighter();
    return h.codeToHtml(code, {
      lang: mapLanguage(language) as BundledLanguage,
      theme: 'github-dark',
      colorReplacements: {
        '#24292e': '#00000000', // Make background transparent
      },
    });
  } catch {
    // Fallback to escaped code
    return `<pre class="shiki"><code>${code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</code></pre>`;
  }
}

function getLanguage(filename: string): string {
  const ext = path.extname(filename);
  switch (ext) {
    case '.ts':
      return 'typescript';
    case '.js':
      return 'javascript';
    case '.tsx':
      return 'typescript';
    case '.jsx':
      return 'javascript';
    case '.md':
      return 'markdown';
    case '.json':
      return 'json';
    case '.yml':
    case '.yaml':
      return 'yaml';
    default:
      return 'text';
  }
}

/**
 * Check if a paragraph node contains only a liquid tag placeholder
 */
function isLiquidTagPlaceholder(
  node: RootContent
): { isPlaceholder: true; tag: LiquidTag } | { isPlaceholder: false } {
  if (node.type !== 'paragraph' || node.children.length !== 1) {
    return { isPlaceholder: false };
  }

  const child = node.children[0];
  if (child.type !== 'text') {
    return { isPlaceholder: false };
  }

  const tag = parseLiquidTag(child.value);
  if (tag) {
    return { isPlaceholder: true, tag };
  }

  return { isPlaceholder: false };
}

/**
 * Process a markdown AST chunk into HTML
 */
async function processMarkdownChunk(nodes: RootContent[]): Promise<string> {
  if (nodes.length === 0) return '';

  // Create a root node with just these children
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

interface ProcessingContext {
  docFilePath: string;
  examples: Record<string, { id: string; title: string; description: string; path: string }>;
}

/**
 * Process a liquid tag and return a ContentSegment
 */
async function processLiquidTag(
  tag: LiquidTag,
  context: ProcessingContext
): Promise<ContentSegment> {
  switch (tag.type) {
    case 'file':
      // {% file %} is NOT valid in docs - only in examples
      throw new Error(
        `{% file ${tag.path}${tag.hunk ? '#' + tag.hunk : ''} %} is not valid in docs. Use {% example name:path %} to reference example files.`
      );

    case 'example-link': {
      // {% example name %} - just a link to the example
      const example = context.examples[tag.example];
      if (!example) {
        throw new Error(
          `Example "${tag.example}" not found. Available examples: ${Object.keys(context.examples).join(', ')}`
        );
      }
      return {
        type: 'example-link',
        exampleId: example.id,
        title: example.title,
        description: example.description,
      };
    }

    case 'example-file': {
      // {% example name:path %} or {% example name:path#hunk %}
      const example = context.examples[tag.example];
      if (!example) {
        throw new Error(
          `Example "${tag.example}" not found. Available examples: ${Object.keys(context.examples).join(', ')}`
        );
      }

      const filePath = path.join(example.path, tag.path);
      let fileContent: string;

      try {
        fileContent = await fs.readFile(filePath, 'utf-8');
      } catch {
        throw new Error(
          `File "${tag.path}" not found in example "${tag.example}" (looked at: ${filePath})`
        );
      }

      // Extract hunk if specified
      let content: string;
      if (tag.hunk) {
        try {
          content = extractHunk(fileContent, tag.hunk);
        } catch (err) {
          throw new Error(
            `Hunk "${tag.hunk}" not found in file "${tag.path}" of example "${tag.example}": ${err instanceof Error ? err.message : String(err)}`
          );
        }
      } else {
        // Strip region markers from full file
        content = stripMarkers(fileContent);
      }

      const language = getLanguage(tag.path);
      const highlightedHtml = await highlightCode(content, language);

      return {
        type: 'file',
        filename: tag.path,
        language,
        content,
        highlightedHtml,
      };
    }
  }
}

/**
 * Parse markdown and split into segments at liquid tag placeholders.
 */
async function parseMarkdownToSegments(
  markdown: string,
  context: ProcessingContext
): Promise<ContentSegment[]> {
  const segments: ContentSegment[] = [];

  // Parse markdown to AST
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);

  // Collect nodes between liquid tag placeholders
  let currentChunk: RootContent[] = [];

  for (const node of tree.children) {
    const placeholderCheck = isLiquidTagPlaceholder(node);

    if (placeholderCheck.isPlaceholder) {
      // Flush current HTML chunk if any
      if (currentChunk.length > 0) {
        const html = await processMarkdownChunk(currentChunk);
        if (html.trim()) {
          segments.push({ type: 'html', html });
        }
        currentChunk = [];
      }

      // Process the liquid tag
      const segment = await processLiquidTag(placeholderCheck.tag, context);
      segments.push(segment);
    } else {
      // Regular content node - accumulate
      currentChunk.push(node);
    }
  }

  // Flush remaining chunk
  if (currentChunk.length > 0) {
    const html = await processMarkdownChunk(currentChunk);
    if (html.trim()) {
      segments.push({ type: 'html', html });
    }
  }

  return segments;
}

export async function data(pageContext: PageContextServer): Promise<DocsData> {
  // Extract wildcard path from route params
  const wildcardPath = pageContext.routeParams['*'] || '';
  const urlPath = '/docs/' + wildcardPath;

  // Look up doc metadata from globalContext (will be added in Task 5)
  const docs = pageContext.globalContext.docs as
    | Record<string, DocMetadata>
    | undefined;
  const doc = docs?.[urlPath];

  if (!doc) {
    return {
      doc: null,
      segments: [],
    };
  }

  // Read the markdown file
  let rawContent: string;
  try {
    rawContent = await fs.readFile(doc.filePath, 'utf-8');
  } catch {
    return {
      doc: null,
      segments: [],
    };
  }

  // Parse frontmatter and get content
  const { content: markdown } = matter(rawContent);

  // Create processing context with examples from globalContext
  const context: ProcessingContext = {
    docFilePath: doc.filePath,
    examples: pageContext.globalContext.examples || {},
  };

  // Parse markdown into segments
  const segments = await parseMarkdownToSegments(markdown, context);

  return {
    doc,
    segments,
  };
}
