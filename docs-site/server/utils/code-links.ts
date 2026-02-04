/**
 * Code linking utilities using TypeScript AST for accurate symbol detection.
 *
 * This module parses TypeScript/JavaScript code to find symbols that should be
 * linked to API documentation. It uses the TypeScript compiler API to accurately
 * identify identifiers while excluding comments and string literals.
 */

import type { Element, ElementContent, Text } from 'hast';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import ts from 'typescript';
import { visit } from 'unist-util-visit';
import { applyBaseUrl } from '../../utils/base-url';
import type { ApiDocs, ApiExport } from './typedoc';

/**
 * A symbol in the source code that should be linked to API documentation.
 */
export interface LinkableSymbol {
  /** The symbol name (e.g., "createWorker") */
  name: string;
  /** Start position in the source code (0-indexed) */
  start: number;
  /** End position in the source code (exclusive) */
  end: number;
}

/**
 * Find all identifiers in TypeScript/JavaScript source that match API symbols.
 *
 * Uses the TypeScript compiler API to parse the source and walk the AST.
 * This naturally excludes identifiers inside comments and string literals.
 *
 * @param source - The source code to parse
 * @param apiSymbols - Set of symbol names to look for
 * @returns Array of linkable symbols with their positions
 */
export function findLinkableSymbols(
  source: string,
  apiSymbols: Set<string>
): LinkableSymbol[] {
  const symbols: LinkableSymbol[] = [];

  // Parse the source as TypeScript (works for JS too)
  const sourceFile = ts.createSourceFile(
    'source.ts',
    source,
    ts.ScriptTarget.Latest,
    true, // setParentNodes - needed for walking
    ts.ScriptKind.TSX // Handle JSX/TSX as well
  );

  /**
   * Recursively walk the AST and collect matching identifiers
   */
  function visit(node: ts.Node): void {
    // Check if this is an identifier that matches an API symbol
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (apiSymbols.has(name)) {
        // Get the position in the source
        const start = node.getStart(sourceFile);
        const end = node.getEnd();

        symbols.push({ name, start, end });
      }
    }

    // Recurse into children
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Sort by position for consistent ordering
  symbols.sort((a, b) => a.start - b.start);

  return symbols;
}

/**
 * Find an API export by name
 */
export function findApiExport(
  apiDocs: ApiDocs,
  symbolName: string
): ApiExport | null {
  for (const apiExport of apiDocs.allExports) {
    if (apiExport.name === symbolName) {
      return apiExport;
    }
  }
  return null;
}

/**
 * Build a list of linkable symbols from source code matched against API docs.
 *
 * This is the main entry point for finding symbols to link.
 *
 * @param source - The source code to analyze
 * @param apiDocs - The API documentation to match against
 * @returns Array of linkable symbols with positions
 */
export function buildSymbolLinks(
  source: string,
  apiDocs: ApiDocs
): LinkableSymbol[] {
  // Build set of API symbol names for fast lookup
  const apiSymbols = new Set(apiDocs.allExports.map((e) => e.name));

  // Find all matching symbols using AST
  return findLinkableSymbols(source, apiSymbols);
}

/**
 * Inject links into Shiki-highlighted HTML for the given symbols.
 *
 * This walks the HAST (HTML AST) and finds text nodes that contain
 * the symbol names, then wraps them in anchor elements.
 *
 * @param html - Shiki-highlighted HTML string
 * @param symbols - Symbols to link (with positions in original source)
 * @param apiDocs - API docs for generating link URLs
 * @returns HTML string with links injected
 */
export function linkHighlightedCode(
  html: string,
  symbols: LinkableSymbol[],
  apiDocs: ApiDocs
): string {
  if (symbols.length === 0) {
    return html;
  }

  // Build a map of symbol name -> API export for quick lookup
  const symbolToExport = new Map<string, ApiExport>();
  for (const sym of symbols) {
    if (!symbolToExport.has(sym.name)) {
      const apiExport = findApiExport(apiDocs, sym.name);
      if (apiExport) {
        symbolToExport.set(sym.name, apiExport);
      }
    }
  }

  if (symbolToExport.size === 0) {
    return html;
  }

  // Parse HTML to HAST
  const tree = fromHtml(html, { fragment: true });

  // Track which symbol names we need to link
  const symbolNames = new Set(symbolToExport.keys());

  // Walk the tree and process text nodes
  visit(tree, 'text', (node: Text, index, parent) => {
    if (!parent || index === undefined) return;

    // Skip if parent is already an anchor
    if ((parent as Element).tagName === 'a') return;

    const text = node.value;
    const newNodes: (Text | Element)[] = [];
    let lastIndex = 0;
    let modified = false;

    // Find all occurrences of linkable symbols in this text
    for (const symbolName of symbolNames) {
      const apiExport = symbolToExport.get(symbolName)!;

      // Find all occurrences of this symbol with word boundaries
      let searchIndex = 0;
      while (searchIndex < text.length) {
        const foundIndex = text.indexOf(symbolName, searchIndex);
        if (foundIndex === -1) break;

        // Check word boundaries
        const beforeChar = foundIndex > 0 ? text[foundIndex - 1] : '';
        const afterChar = text[foundIndex + symbolName.length] || '';

        const isWordBoundaryBefore =
          !beforeChar || /[\s\{\[\(,;:<>]/.test(beforeChar);
        const isWordBoundaryAfter =
          !afterChar || /[\s\}\]\),;:<>]/.test(afterChar);

        if (isWordBoundaryBefore && isWordBoundaryAfter) {
          // Add text before this symbol
          if (foundIndex > lastIndex) {
            newNodes.push({
              type: 'text',
              value: text.slice(lastIndex, foundIndex),
            });
          }

          // Add the link
          newNodes.push({
            type: 'element',
            tagName: 'a',
            properties: {
              href: applyBaseUrl(apiExport.path),
              className: ['code-link'],
              title: `View ${apiExport.name} documentation`,
            },
            children: [{ type: 'text', value: symbolName }],
          });

          lastIndex = foundIndex + symbolName.length;
          modified = true;
        }

        searchIndex = foundIndex + 1;
      }
    }

    // If we made modifications, update the parent's children
    if (modified) {
      // Add remaining text
      if (lastIndex < text.length) {
        newNodes.push({
          type: 'text',
          value: text.slice(lastIndex),
        });
      }

      // Replace this node with the new nodes
      const parentElement = parent as Element;
      parentElement.children.splice(
        index,
        1,
        ...(newNodes as ElementContent[])
      );
    }
  });

  // Serialize back to HTML
  return toHtml(tree);
}

// =============================================================================
// Legacy exports for backward compatibility
// =============================================================================

export interface ImportedSymbol {
  name: string;
  source: string;
  isTypeImport: boolean;
}

export interface ImportInfo {
  source: string;
  symbols: ImportedSymbol[];
}

/**
 * @deprecated Use buildSymbolLinks instead
 */
export function extractImports(code: string): ImportInfo[] {
  const imports: ImportInfo[] = [];

  const sourceFile = ts.createSourceFile(
    'source.ts',
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const source = moduleSpecifier.text;
        const symbols: ImportedSymbol[] = [];

        const importClause = node.importClause;
        if (importClause) {
          // Default import
          if (importClause.name) {
            symbols.push({
              name: importClause.name.text,
              source,
              isTypeImport: importClause.isTypeOnly,
            });
          }

          // Named imports
          const namedBindings = importClause.namedBindings;
          if (namedBindings && ts.isNamedImports(namedBindings)) {
            for (const element of namedBindings.elements) {
              symbols.push({
                name: element.name.text,
                source,
                isTypeImport: importClause.isTypeOnly || element.isTypeOnly,
              });
            }
          }
        }

        if (symbols.length > 0) {
          imports.push({ source, symbols });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return imports;
}
