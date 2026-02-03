import type { ApiDocs, ApiExport } from './typedoc';

export interface ImportedSymbol {
  name: string;
  source: string;
  isTypeImport: boolean;
}

export interface ImportInfo {
  source: string;
  symbols: ImportedSymbol[];
}

const IMPORT_PATTERNS = [
  // Named imports: import { a, b } from 'source'
  /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
  // Default import: import a from 'source'
  /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
  // Mixed: import a, { b, c } from 'source'
  /import\s+(\w+)(?:,\s*\{([^}]+)\})?\s+from\s+['"]([^'"]+)['"]/g,
] as const;

function cleanSymbolName(symbol: string): string {
  return symbol
    .trim()
    .replace(/\/\/.*$/, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
}

function extractSymbolsFromImports(importsText: string): ImportedSymbol[] {
  const symbols: ImportedSymbol[] = [];
  const parts = importsText
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s);

  for (const part of parts) {
    const cleaned = cleanSymbolName(part);
    if (!cleaned) continue;

    const isTypeImport = part.trim().startsWith('type ');
    const name = isTypeImport
      ? cleaned.replace(/^type\s+/, '').trim()
      : cleaned;

    if (name) {
      symbols.push({ name, source: '', isTypeImport });
    }
  }

  return symbols;
}

export function extractImports(code: string): ImportInfo[] {
  const imports: ImportInfo[] = [];

  for (const pattern of IMPORT_PATTERNS) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(code)) !== null) {
      const fullMatch = match[0];
      const isTypeImport = fullMatch.includes('import type');

      if (match[3]) {
        const defaultImport = match[1];
        const namedImports = match[2];
        const source = match[3];

        const symbols: ImportedSymbol[] = [];

        if (defaultImport) {
          symbols.push({
            name: defaultImport,
            source,
            isTypeImport,
          });
        }

        if (namedImports) {
          const namedSymbols = extractSymbolsFromImports(namedImports);
          for (const s of namedSymbols) {
            symbols.push({ ...s, source, isTypeImport });
          }
        }

        imports.push({ source, symbols });
      } else if (match[2]) {
        const namedImports = match[1];
        const source = match[2];

        const symbols = extractSymbolsFromImports(namedImports);
        for (const s of symbols) {
          imports.push({
            source,
            symbols: [{ ...s, source, isTypeImport }],
          });
        }
      } else if (match[1]) {
        const defaultImport = match[1];
        const source = match[2];

        imports.push({
          source,
          symbols: [{ name: defaultImport, source, isTypeImport }],
        });
      }
    }
  }

  return imports;
}

export function findApiExport(
  apiDocs: ApiDocs,
  symbolName: string,
  _importSource?: string
): ApiExport | null {
  for (const apiExport of apiDocs.allExports) {
    if (apiExport.name === symbolName) {
      return apiExport;
    }
  }

  return null;
}

function isIdentifierLike(text: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(text);
}

interface SymbolReplacement {
  start: number;
  end: number;
  replacement: string;
}

function findSymbolReplacementsInText(
  text: string,
  symbolLinks: Map<string, { path: string; name: string }>
): SymbolReplacement[] {
  const replacements: SymbolReplacement[] = [];

  // Split by word boundaries and check each token
  const tokens = text.split(/(\b|[a-zA-Z0-9_$]+|[^\w\s])/g);
  let currentIndex = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Only link identifiers (alphanumeric + underscore/dollar)
    if (!isIdentifierLike(token)) {
      currentIndex += token.length;
      continue;
    }

    if (symbolLinks.has(token)) {
      const link = symbolLinks.get(token)!;
      replacements.push({
        start: currentIndex,
        end: currentIndex + token.length,
        replacement: `<a href="${link.path}" class="code-link" title="View ${link.name} documentation">${link.name}</a>`,
      });
    }

    currentIndex += token.length;
  }

  return replacements;
}

function applyReplacements(
  text: string,
  replacements: SymbolReplacement[]
): string {
  if (replacements.length === 0) {
    return text;
  }

  let result = '';
  let lastIndex = 0;

  for (const replacement of replacements) {
    result += text.slice(lastIndex, replacement.start);
    result += replacement.replacement;
    lastIndex = replacement.end;
  }

  result += text.slice(lastIndex);

  return result;
}

export function linkSymbols(
  code: string,
  symbolLinks: Map<string, { path: string; name: string }>
): string {
  if (symbolLinks.size === 0) {
    return code;
  }

  const replacements = findSymbolReplacementsInText(code, symbolLinks);

  if (replacements.length === 0) {
    return code;
  }

  return applyReplacements(code, replacements);
}

export function buildSymbolLinks(
  code: string,
  apiDocs: ApiDocs
): Map<string, { path: string; name: string }> {
  const symbolLinks = new Map<string, { path: string; name: string }>();

  // Build from all API exports - link any occurrence in code
  const words = code
    .split(/\s+/)
    .flatMap((w) => w.split(/[\{\[\]();,:]/))
    .filter((w) => w.length > 0 && isIdentifierLike(w));

  for (const word of new Set(words)) {
    const apiExport = findApiExport(apiDocs, word);
    if (apiExport) {
      symbolLinks.set(word, {
        path: apiExport.path,
        name: apiExport.name,
      });
    }
  }

  return symbolLinks;
}

export function linkHighlightedCode(
  highlightedHtml: string,
  symbolLinks: Map<string, { path: string; name: string }>
): string {
  if (symbolLinks.size === 0) {
    return highlightedHtml;
  }

  let result = highlightedHtml;

  for (const [symbol, link] of symbolLinks.entries()) {
    const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match text inside span tags, accounting for closing </span> tags
    const regex = new RegExp(
      `(>([^<]*?))(${escapedSymbol})([^<]*?)(</?span)`,
      'g'
    );

    result = result.replace(
      regex,
      (match, beforeTag, symbolMatch, afterTag, nextSpan) => {
        const beforeText = beforeTag;
        const afterText = afterTag;

        // Check word boundaries
        const beforeChar = beforeText.slice(-1);
        const afterChar = afterText[0];

        const hasWordBoundaryBefore =
          !beforeChar ||
          /\s/.test(beforeChar) ||
          /[\{\[\(,;:]/.test(beforeChar);

        const hasWordBoundaryAfter =
          !afterChar || /\s/.test(afterChar) || /[\}\]\),;:]/.test(afterChar);

        if (hasWordBoundaryBefore && hasWordBoundaryAfter) {
          return `>${beforeText}<a href="${link.path}" class="code-link" title="View ${link.name} documentation">${symbolMatch}</a>${afterText}${nextSpan}`;
        }

        return match;
      }
    );
  }

  return result;
}
