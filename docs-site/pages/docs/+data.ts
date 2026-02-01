import matter from 'gray-matter';
import type { RootContent } from 'mdast';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PageContextServer } from 'vike/types';
import { type DocMetadata } from '../../server/utils/docs';
import {
  getLanguageFromFilename,
  highlightCode,
} from '../../server/utils/highlighter';
import { type LiquidTag } from '../../server/utils/liquid-tags';
import {
  extractLiquidTag,
  parseMarkdown,
  processMarkdownChunk,
} from '../../server/utils/markdown';
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

interface ProcessingContext {
  docFilePath: string;
  examples: Record<
    string,
    { id: string; title: string; description: string; path: string }
  >;
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
        `{% file ${tag.path}${
          tag.hunk ? '#' + tag.hunk : ''
        } %} is not valid in docs. Use {% example name:path %} to reference example files.`
      );

    case 'example-link': {
      const example = context.examples[tag.example];
      if (!example) {
        throw new Error(
          `Example "${
            tag.example
          }" not found. Available examples: ${Object.keys(
            context.examples
          ).join(', ')}`
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
      const example = context.examples[tag.example];
      if (!example) {
        throw new Error(
          `Example "${
            tag.example
          }" not found. Available examples: ${Object.keys(
            context.examples
          ).join(', ')}`
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

      let content: string;
      if (tag.hunk) {
        try {
          content = extractHunk(fileContent, tag.hunk);
        } catch (err) {
          throw new Error(
            `Hunk "${tag.hunk}" not found in file "${tag.path}" of example "${
              tag.example
            }": ${err instanceof Error ? err.message : String(err)}`
          );
        }
      } else {
        content = stripMarkers(fileContent);
      }

      const language = getLanguageFromFilename(tag.path);
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
  const tree = parseMarkdown(markdown);
  let currentChunk: RootContent[] = [];

  for (const node of tree.children) {
    const placeholderCheck = extractLiquidTag(node);

    if (placeholderCheck.isPlaceholder) {
      // Flush current HTML chunk if any
      if (currentChunk.length > 0) {
        const html = await processMarkdownChunk(currentChunk);
        if (html.trim()) {
          segments.push({ type: 'html', html });
        }
        currentChunk = [];
      }

      const segment = await processLiquidTag(placeholderCheck.tag, context);
      segments.push(segment);
    } else {
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
  const wildcardPath = pageContext.routeParams['*'] || '';
  const urlPath = '/docs/' + wildcardPath;

  console.log('Fetching data for doc URL path:', urlPath);

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

  let rawContent: string;
  try {
    rawContent = await fs.readFile(doc.filePath, 'utf-8');
  } catch {
    return {
      doc: null,
      segments: [],
    };
  }

  const { content: markdown } = matter(rawContent);

  const context: ProcessingContext = {
    docFilePath: doc.filePath,
    examples: pageContext.globalContext.examples || {},
  };

  const segments = await parseMarkdownToSegments(markdown, context);

  return {
    doc,
    segments,
  };
}
