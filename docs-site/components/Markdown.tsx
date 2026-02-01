import { useEffect, useState } from 'react';
import type { BundledLanguage } from 'shiki';
import { createHighlighter } from 'shiki';

// Singleton highlighter instance
let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null;
let highlighterInit: Promise<
  Awaited<ReturnType<typeof createHighlighter>>
> | null = null;

/**
 * Get or create the Shiki highlighter instance
 */
async function getHighlighter() {
  if (highlighter) {
    return highlighter;
  }

  if (highlighterInit) {
    return highlighterInit;
  }

  highlighterInit = createHighlighter({
    themes: ['github-dark'],
    langs: [
      'javascript',
      'jsx',
      'typescript',
      'tsx',
      'json',
      'yaml',
      'markdown',
      'bash',
      'html',
      'css',
      'plaintext',
    ],
  });

  highlighter = await highlighterInit;
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

interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * Markdown component with Shiki syntax highlighting.
 * This component handles async code highlighting.
 */
export function Markdown({ content, className = '' }: MarkdownProps) {
  const [highlightedContent, setHighlightedContent] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);

      // First pass: identify code blocks and highlight them
      const codeBlocks: Array<{
        match: RegExpExecArray;
        lang: string;
        index: number;
      }> = [];
      const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
      let match;

      while ((match = codeBlockRegex.exec(content)) !== null) {
        codeBlocks.push({
          match,
          lang: match[1] || 'typescript',
          index: match.index,
        });
      }

      // Get highlighter
      const h = await getHighlighter();

      // Highlight all code blocks in parallel
      const highlightedBlocks = await Promise.all(
        codeBlocks.map(async ({ match, lang }) => {
          const normalizedLang = mapLanguage(lang);

          // Use codeToHtml with the highlighter
          let html: string;
          try {
            html = await h.codeToHtml(match[2], {
              lang: normalizedLang as BundledLanguage,
              theme: 'github-dark',
            });
          } catch {
            // Fallback if language not supported - escape HTML
            html = `<pre><code>${match[2]
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</code></pre>`;
          }

          return {
            original: match[0],
            highlighted: html,
            index: match.index,
          };
        })
      );

      if (cancelled) return;

      // Replace code blocks with highlighted versions
      let result = content;
      for (const block of highlightedBlocks) {
        const before = result.substring(0, block.index);
        const after = result.substring(block.index + block.original.length);
        result =
          before +
          '<div class="shiki-wrapper">' +
          block.highlighted +
          '</div>' +
          after;
      }

      setHighlightedContent(result);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [content]);

  if (isLoading || !highlightedContent) {
    // Show placeholder during initial load
    return (
      <div className={`prose prose-invert prose-neon max-w-none ${className}`}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div
      className={`prose prose-invert prose-neon max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: highlightedContent }}
    />
  );
}
