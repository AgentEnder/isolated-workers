import {
  createHighlighter,
  type BundledLanguage,
  type Highlighter,
} from 'shiki';
import { applyBaseUrl } from '../../utils/base-url';

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
 * Skips text inside comments (identified by comment color in Shiki theme).
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
  const pattern = new RegExp(`\\b(${escapedNames.join('|')})\\b`, 'g');

  // Comment color in github-dark theme
  const COMMENT_COLOR = '#6A737D';

  // Only replace within text content (between > and <)
  // Check if the preceding span has comment color to skip comments
  return html.replace(
    /(<span[^>]*?>)([^<]+)(<\/span>)/g,
    (fullMatch, openTag, textContent, closeTag) => {
      // Skip if this is a comment span (has comment color)
      if (openTag.includes(COMMENT_COLOR)) {
        return fullMatch;
      }

      const linkedText = textContent.replace(pattern, (typeName: string) => {
        const href = knownExports[typeName];
        return `<a href="${applyBaseUrl(
          href
        )}" class="code-link">${typeName}</a>`;
      });
      return `${openTag}${linkedText}${closeTag}`;
    }
  );
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
