import type { RootContent } from 'mdast';
import fs from 'node:fs/promises';
import path, { join } from 'node:path';
import type { PageContextServer } from 'vike/types';
import { type ExampleMetadata } from '../../../server/utils/examples';
import {
  highlightCode,
  getLanguageFromFilename,
} from '../../../server/utils/highlighter';
import {
  parseMarkdown,
  processMarkdownChunk,
  extractFilePlaceholder,
} from '../../../server/utils/markdown';
import { extractHunk, stripMarkers } from '../../../server/utils/regions';

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

/**
 * Parse markdown and split into segments at file placeholders.
 * Uses remark to parse, then walks the AST to find file markers.
 */
async function parseMarkdownToSegments(
  markdown: string,
  files: CodeFile[],
  example: ExampleMetadata
): Promise<{ segments: ContentSegment[]; renderedFiles: string[] }> {
  const segments: ContentSegment[] = [];
  const renderedFiles: string[] = [];

  const tree = parseMarkdown(markdown);
  let currentChunk: RootContent[] = [];

  for (const node of tree.children) {
    const placeholderCheck = extractFilePlaceholder(node);

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
        // Extract hunk or strip markers from full file
        let content: string;
        if (placeholderCheck.hunk) {
          try {
            content = extractHunk(file.content, placeholderCheck.hunk);
          } catch {
            throw new Error(
              `Region '${placeholderCheck.hunk}' not found in file "${placeholderCheck.filename}" in example "${example.id}".`
            );
          }
        } else {
          content = stripMarkers(file.content);
        }

        const highlightedHtml = await highlightCode(content, file.language);
        const displayName = placeholderCheck.hunk
          ? `${file.filename}#${placeholderCheck.hunk}`
          : file.filename;

        segments.push({
          type: 'file',
          filename: displayName,
          language: file.language,
          content,
          highlightedHtml,
        });
        renderedFiles.push(file.filename);
      } else {
        throw new Error(
          `Referenced file "${placeholderCheck.filename}" not found in example "${example.id}".`
        );
      }
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

  return { segments, renderedFiles };
}

export async function data(
  pageContext: PageContextServer
): Promise<ExampleData> {
  const { id } = pageContext.routeParams;
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
        language: getLanguageFromFilename(filename),
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
