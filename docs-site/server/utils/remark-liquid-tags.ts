import type { Link as MdastLink, PhrasingContent, Root, Text } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { extractAllLiquidTags, type LiquidTag } from './liquid-tags';

export interface ExampleInfo {
  id: string;
  title: string;
}

export interface RemarkLiquidTagsOptions {
  /**
   * Map of example IDs to their info.
   * Used to resolve {% example name %} tags to links.
   */
  examples: Record<string, ExampleInfo>;
}

/**
 * Remark plugin that transforms inline liquid tags into proper markdown elements.
 *
 * Transforms:
 * - {% example name %} -> link to /examples/{name}
 *
 * This plugin handles inline tags within text (e.g., in list items).
 * Block-level tags are handled separately by the segment extraction system.
 */
export const remarkLiquidTags: Plugin<[RemarkLiquidTagsOptions], Root> = (
  options
) => {
  const { examples } = options;

  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return;

      const extracted = extractAllLiquidTags(node.value);
      if (extracted.length === 0) return;

      // Build new nodes: text segments interspersed with links
      const newNodes: PhrasingContent[] = [];
      let lastEnd = 0;

      for (const { tag, start, end } of extracted) {
        // Add text before this tag
        if (start > lastEnd) {
          newNodes.push({
            type: 'text',
            value: node.value.slice(lastEnd, start),
          });
        }

        // Transform tag to appropriate node
        const transformed = transformTag(tag, examples);
        if (transformed) {
          newNodes.push(transformed);
        } else {
          // Keep original text if transformation fails
          newNodes.push({
            type: 'text',
            value: node.value.slice(start, end),
          });
        }

        lastEnd = end;
      }

      // Add remaining text after last tag
      if (lastEnd < node.value.length) {
        newNodes.push({
          type: 'text',
          value: node.value.slice(lastEnd),
        });
      }

      // Replace original node with new nodes
      parent.children.splice(index, 1, ...newNodes);
    });
  };
};

function transformTag(
  tag: LiquidTag,
  examples: Record<string, ExampleInfo>
): MdastLink | null {
  switch (tag.type) {
    case 'example-link': {
      const example = examples[tag.example];
      if (!example) {
        console.warn(`[remark-liquid-tags] Example "${tag.example}" not found`);
        return null;
      }

      return {
        type: 'link',
        url: `/examples/${example.id}`,
        title: example.title,
        children: [{ type: 'text', value: example.title }],
      };
    }

    case 'example-file':
      // example-file tags should be handled at block level, not inline
      console.warn(
        `[remark-liquid-tags] example-file tag "${tag.example}:${tag.path}" found inline - use block level`
      );
      return null;

    case 'file':
      // file tags should be handled at block level, not inline
      console.warn(
        `[remark-liquid-tags] file tag "${tag.path}" found inline - use block level`
      );
      return null;
  }
  throw new Error(`Unknown tag type: ${tag.type}`);
}
