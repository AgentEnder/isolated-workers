import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';

// Singleton highlighter for server-side use
let highlighter: Highlighter | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
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
  return highlighter;
}

/**
 * Map common language names/aliases to Shiki's supported languages
 */
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

/**
 * Inject links into highlighted HTML for known type names.
 * Finds type names within span text content and wraps them with links.
 */
function injectTypeLinks(
  html: string,
  knownExports: Record<string, string>
): string {
  const exportNames = Object.keys(knownExports);
  if (exportNames.length === 0) return html;

  // Sort by length descending to match longer names first
  exportNames.sort((a, b) => b.length - a.length);

  // Escape special regex characters in names
  const escapedNames = exportNames.map((name) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );

  // Match type names as whole words (with word boundaries)
  // This handles cases like "> createWorker</span>" where there may be
  // whitespace before the name
  const pattern = new RegExp(
    `\\b(${escapedNames.join('|')})\\b`,
    'g'
  );

  // Only replace within text content (between > and <)
  // We process the HTML by finding text segments and replacing within them
  return html.replace(/>([^<]+)</g, (_fullMatch, textContent: string) => {
    const linkedText = textContent.replace(pattern, (typeName) => {
      const href = knownExports[typeName];
      return `<a href="${href}" class="code-link">${typeName}</a>`;
    });
    return `>${linkedText}<`;
  });
}

export interface HighlightedCode {
  /** The highlighted HTML with type links injected */
  html: string;
  /** The original code (for copy functionality) */
  code: string;
}

/**
 * Highlight code with Shiki and inject type links.
 * Returns HTML that can be passed to CodeBlock's preHighlightedHtml prop.
 */
export async function highlightCodeWithLinks(
  code: string,
  language: string,
  knownExports: Record<string, string>
): Promise<HighlightedCode> {
  const h = await getHighlighter();
  const normalizedLang = mapLanguage(language);

  const html = h.codeToHtml(code, {
    lang: normalizedLang as BundledLanguage,
    theme: 'github-dark',
    colorReplacements: {
      '#24292e': '#00000000', // Make background transparent
    },
  });

  // Inject links for known types
  const linkedHtml = injectTypeLinks(html, knownExports);

  return {
    html: linkedHtml,
    code,
  };
}
