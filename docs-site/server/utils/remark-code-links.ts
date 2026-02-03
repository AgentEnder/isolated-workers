import type { Code, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { loadApiDocs } from './typedoc';
import { extractImports, buildSymbolLinks, linkSymbols } from './code-links';

export interface RemarkCodeLinksOptions {
  apiDocs?: Awaited<ReturnType<typeof loadApiDocs>>;
}

export const remarkCodeLinks: Plugin<[RemarkCodeLinksOptions], Root> = (
  options
) => {
  return async (tree) => {
    const apiDocs = options.apiDocs;
    if (!apiDocs) return;

    visit(tree, 'code', (node: Code) => {
      const lang = node.lang || '';

      if (
        !['ts', 'typescript', 'js', 'javascript'].includes(lang.toLowerCase())
      ) {
        return;
      }

      const imports = extractImports(node.value);
      if (imports.length === 0) return;

      const symbolLinks = buildSymbolLinks(node.value, apiDocs);
      if (symbolLinks.size === 0) return;

      const linkedCode = linkSymbols(node.value, symbolLinks);
      if (linkedCode !== node.value) {
        node.value = linkedCode;
      }
    });
  };
};
