import matter from 'gray-matter';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PageContextServer } from 'vike/types';
import { type DocMetadata } from '../../server/utils/docs';
import { getLanguageFromFilename } from '../../server/utils/highlighter';
import { extractLiquidTag } from '../../server/utils/markdown';
import { extractHunk, stripMarkers } from '../../server/utils/regions';
import {
  type ContentSegment,
  createFileSegment,
  parseMarkdownToSegments,
} from '../../server/utils/segments';
import { loadApiDocs } from '../../server/utils/typedoc';

export type { ContentSegment };

export interface DocsData {
  doc: DocMetadata | null;
  segments: ContentSegment[];
}

interface ProcessingContext {
  examples: Record<
    string,
    { id: string; title: string; description: string; path: string }
  >;
}

export async function data(pageContext: PageContextServer): Promise<DocsData> {
  const urlPath = pageContext.urlPathname;

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
    examples: pageContext.globalContext.examples || {},
  };

  const examplesForLiquidTags: Record<string, { id: string; title: string }> =
    {};
  for (const [id, example] of Object.entries(context.examples)) {
    examplesForLiquidTags[id] = { id: example.id, title: example.title };
  }

  const apiDocs = await loadApiDocs();

  const segments = await parseMarkdownToSegments(markdown, {
    extractCodeBlocks: true,
    liquidTags: { examples: examplesForLiquidTags },
    apiDocs,
    nodeHandler: async (node) => {
      const placeholderCheck = extractLiquidTag(node);
      if (!placeholderCheck.isPlaceholder) {
        return null;
      }

      const tag = placeholderCheck.tag;

      switch (tag.type) {
        case 'file':
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
                `Hunk "${tag.hunk}" not found in file "${
                  tag.path
                }" of example "${tag.example}": ${
                  err instanceof Error ? err.message : String(err)
                }`
              );
            }
          } else {
            content = stripMarkers(fileContent);
          }

          const language = getLanguageFromFilename(tag.path);
          return createFileSegment(tag.path, content, language, apiDocs);
        }

        default:
          throw new Error(`Unknown tag type: ${tag.type}`);
      }
    },
  });

  return {
    doc,
    segments,
  };
}
