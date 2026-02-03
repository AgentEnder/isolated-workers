import type { BundledLanguage } from 'shiki';
import { createHighlighter } from 'shiki';

// Highlighter singleton for build-time highlighting
let highlighterInit: Promise<
  Awaited<ReturnType<typeof createHighlighter>>
> | null = null;

export async function getHighlighter() {
  if (!highlighterInit) {
    highlighterInit = createHighlighter({
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
        'markdown',
      ],
    });
  }
  return highlighterInit;
}

const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  yml: 'yaml',
  sh: 'bash',
  text: 'plaintext',
  cjs: 'javascript',
  mjs: 'javascript',
};

export function mapLanguage(lang: string): string {
  const normalized = lang.toLowerCase();
  return LANGUAGE_MAP[normalized] || normalized;
}

export async function highlightCode(
  code: string,
  language: string
): Promise<string> {
  try {
    const h = await getHighlighter();
    return h.codeToHtml(code, {
      lang: mapLanguage(language) as BundledLanguage,
      theme: 'github-dark',
      colorReplacements: {
        '#24292e': '#00000000', // Make background transparent
      },
    });
  } catch {
    // Fallback to escaped code
    return `<pre class="shiki"><code>${code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</code></pre>`;
  }
}

const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.md': 'markdown',
  '.json': 'json',
  '.yml': 'yaml',
  '.yaml': 'yaml',
};

export function getLanguageFromFilename(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.'));
  return EXTENSION_MAP[ext] || 'text';
}
