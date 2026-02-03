import fs from 'node:fs/promises';
import path, { join } from 'node:path';
import type { PageContextServer } from 'vike/types';
import { type ExampleMetadata } from '../../../server/utils/examples';
import { getLanguageFromFilename } from '../../../server/utils/highlighter';
import { extractFilePlaceholder } from '../../../server/utils/markdown';
import { extractHunk, stripMarkers } from '../../../server/utils/regions';
import {
  type ContentSegment,
  createFileSegment,
  parseMarkdownToSegments,
} from '../../../server/utils/segments';

// Re-export ContentSegment for the Page component
export type { ContentSegment };

interface CodeFile {
  filename: string;
  content: string;
  language: string;
}

export interface ExampleData {
  example: ExampleMetadata | null;
  /** Content split into segments for proper rendering */
  segments: ContentSegment[];
  /** All available files for this example */
  files: CodeFile[];
  /** Set of filenames that were rendered inline via {{file:...}} */
  renderedFiles: string[];
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

  // Track which files are rendered inline
  const renderedFiles: string[] = [];

  const segments = await parseMarkdownToSegments(rawContent, {
    // Examples don't extract inline code blocks - they use file references
    extractCodeBlocks: false,
    nodeHandler: async (node) => {
      const placeholderCheck = extractFilePlaceholder(node);
      if (!placeholderCheck.isPlaceholder) {
        return null;
      }

      // Find the file
      const file = files.find((f) => f.filename === placeholderCheck.filename);
      if (!file) {
        throw new Error(
          `Referenced file "${placeholderCheck.filename}" not found in example "${example.id}".`
        );
      }

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

      const displayName = placeholderCheck.hunk
        ? `${file.filename}#${placeholderCheck.hunk}`
        : file.filename;

      renderedFiles.push(file.filename);
      return createFileSegment(displayName, content, file.language);
    },
  });

  return {
    example,
    segments,
    files,
    renderedFiles,
  };
}
