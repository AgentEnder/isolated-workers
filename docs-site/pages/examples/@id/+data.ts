import type { Root as MdastRoot, RootContent } from 'mdast';
import fs from 'node:fs/promises';
import path, { join } from 'node:path';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import type { BundledLanguage } from 'shiki';
import { createHighlighter } from 'shiki';
import { unified } from 'unified';
import type { PageContextServer } from 'vike/types';
import { type ExampleMetadata } from '../../../server/utils/examples';

interface CodeFile {
  filename: string;
  content: string;
  language: string;
}

/**
 * A segment of content - either rendered HTML or a file to display
 */
export type ContentSegment =
  | { type: 'html'; html: string }
  | {
      type: 'file';
      filename: string;
      language: string;
      content: string;
      highlightedHtml: string;
    };

export interface ExampleData {
  example: ExampleMetadata | null;
  /** Content split into segments for proper rendering */
  segments: ContentSegment[];
  /** All available files for this example */
  files: CodeFile[];
  /** Set of filenames that were rendered inline via {{file:...}} */
  renderedFiles: string[];
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

/**
 * Check if a paragraph node contains only a file placeholder
 */
function isFilePlaceholder(
  node: RootContent
): { isPlaceholder: true; filename: string } | { isPlaceholder: false } {
  if (node.type !== 'paragraph' || node.children.length !== 1) {
    return { isPlaceholder: false };
  }

  const child = node.children[0];
  if (child.type !== 'text') {
    return { isPlaceholder: false };
  }

  const match = child.value.match(/^\{\{file:([^}]+)\}\}$/);
  if (match) {
    return { isPlaceholder: true, filename: match[1].trim() };
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

/**
 * Parse markdown and split into segments at file placeholders.
 * Uses remark to parse, then walks the AST to find {{file:...}} markers.
 */
async function parseMarkdownToSegments(
  markdown: string,
  files: CodeFile[],
  example: ExampleMetadata
): Promise<{ segments: ContentSegment[]; renderedFiles: string[] }> {
  const segments: ContentSegment[] = [];
  const renderedFiles: string[] = [];

  // Parse markdown to AST
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);

  // Collect nodes between file placeholders
  let currentChunk: RootContent[] = [];

  for (const node of tree.children) {
    const placeholderCheck = isFilePlaceholder(node);

    if (placeholderCheck.isPlaceholder) {
      // Flush current HTML chunk if any
      if (currentChunk.length > 0) {
        const html = await processMarkdownChunk(currentChunk);
        if (html.trim()) {
          segments.push({ type: 'html', html });
        }
        currentChunk = [];
      }

      // Find the file and create a file segment
      const file = files.find((f) => f.filename === placeholderCheck.filename);
      if (file) {
        const highlightedHtml = await highlightCode(
          file.content,
          file.language
        );
        segments.push({
          type: 'file',
          filename: file.filename,
          language: file.language,
          content: file.content,
          highlightedHtml,
        });
        renderedFiles.push(file.filename);
      } else {
        // File not found - add error as HTML
        throw new Error(
          `Referenced file "${placeholderCheck.filename}" not found in example "${example.id}".`
        );
      }
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

  return { segments, renderedFiles };
}

export async function data(
  pageContext: PageContextServer
): Promise<ExampleData> {
  const { id } = pageContext.routeParams;

  // Get example metadata from shared utility
  const example = pageContext.globalContext.examples[id];

  if (!example) {
    return {
      example: null,
      segments: [],
      files: [],
      renderedFiles: [],
    };
  }

  // Read content.md
  let rawContent = '';
  try {
    rawContent = await fs.readFile(join(example.path, 'content.md'), 'utf-8');
  } catch {
    rawContent = `# ${example.title}\n\n${example.description}`;
  }

  // Read example files
  const files: CodeFile[] = [];
  const commonFiles = [
    'messages.ts',
    'host.ts',
    'worker.ts',
    'index.ts',
    'serializer.ts',
  ];

  for (const filename of commonFiles) {
    const filePath = path.join(example.path, filename);
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      files.push({
        filename,
        content: fileContent,
        language: getLanguage(filename),
      });
    } catch {
      // File doesn't exist, skip it
    }
  }

  // Parse markdown into segments
  const { segments, renderedFiles } = await parseMarkdownToSegments(
    rawContent,
    files,
    example
  );

  return {
    example,
    segments,
    files,
    renderedFiles,
  };
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
    default:
      return 'text';
  }
}
