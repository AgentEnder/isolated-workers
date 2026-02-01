import { useEffect, useState } from 'react';
import type { BundledLanguage } from 'shiki';
import { createHighlighter } from 'shiki';

// Singleton highlighter instance for client-side highlighting
let highlighterInit: Promise<
  Awaited<ReturnType<typeof createHighlighter>>
> | null = null;

interface CodeBlockProps {
  code?: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  /** Pre-highlighted HTML to render directly (skips client-side highlighting) */
  preHighlightedHtml?: string;
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
 * Code block component with Shiki syntax highlighting.
 * Features terminal chrome styling and enhanced hover effects.
 * Falls back to simple text display during SSR or if Shiki fails to load.
 * Can accept pre-highlighted HTML from server-side rendering.
 */
export function CodeBlock({
  code,
  language = 'typescript',
  filename,
  showLineNumbers = false,
  preHighlightedHtml,
}: CodeBlockProps) {
  const [highlightedCode, setHighlightedCode] = useState<string | null>(
    preHighlightedHtml || null
  );
  const [isCopied, setIsCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const normalizedLang = mapLanguage(language);

  // Client-side highlighting only if no pre-highlighted HTML provided
  useEffect(() => {
    if (preHighlightedHtml || !code) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // Get or create highlighter instance
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
            ],
          });
        }

        const h = await highlighterInit;

        if (cancelled) return;

        const html = h.codeToHtml(code, {
          lang: normalizedLang as BundledLanguage,
          theme: 'github-dark',
          colorReplacements: {
            '#24292e': '#00000000', // Make background transparent
          },
        });

        if (!cancelled) {
          setHighlightedCode(html);
        }
      } catch {
        // Fallback: just escape the HTML
        if (!cancelled) {
          setHighlightedCode(
            `<pre class="shiki"><code>${code
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</code></pre>`
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, normalizedLang, preHighlightedHtml]);

  const handleCopy = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const displayLabel = filename || normalizedLang;
  const lines = code?.split('\n') ?? [];
  const hasContent = code || preHighlightedHtml;

  return (
    <div
      className="relative group my-6"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`
          rounded-lg overflow-hidden border border-white/10 bg-tertiary/80
          transition-all duration-300 border-glow
          ${isHovered ? 'shadow-neon' : 'shadow-neon-sm'}
        `}
      >
        {/* Terminal Chrome Header */}
        <div className="px-4 py-3 bg-black/50 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* macOS Window Dots */}
            <div className="flex gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-[0_0_6px_rgba(255,95,86,0.4)]" />
              <span className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-[0_0_6px_rgba(255,189,46,0.4)]" />
              <span className="w-3 h-3 rounded-full bg-[#27ca40] shadow-[0_0_6px_rgba(39,202,64,0.4)]" />
            </div>
            {/* Filename/Language Label */}
            <span className="text-xs text-gray-500 font-mono">
              {displayLabel}
            </span>
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className={`
              text-xs flex items-center gap-1.5 px-2 py-1 rounded
              transition-all duration-200
              ${
                isCopied
                  ? 'text-neon-mint bg-neon-mint/10'
                  : 'text-neon-cyan hover:text-neon-mint hover:bg-neon-cyan/10'
              }
            `}
            title={isCopied ? 'Copied!' : 'Copy code'}
          >
            {isCopied ? (
              <>
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>

        {/* Code Content */}
        <div className="overflow-x-auto bg-black/60">
          {showLineNumbers && hasContent ? (
            <div className="flex">
              {/* Line Numbers */}
              <div className="flex-none py-4 pl-4 pr-2 select-none">
                {lines.map((_, i) => (
                  <div
                    key={i}
                    className="text-xs text-gray-600 font-mono text-right leading-relaxed"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Code */}
              <div className="flex-1 p-4 pl-2">
                {!highlightedCode && code && (
                  <code className="text-sm font-mono">{code}</code>
                )}
                {highlightedCode && (
                  <div
                    className="text-sm [&_pre]:m-0 [&_code]:m-0 [&_pre]:bg-transparent [&_code]:bg-transparent"
                    dangerouslySetInnerHTML={{ __html: highlightedCode }}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 [&_pre]:bg-transparent [&_code]:bg-transparent">
              {!highlightedCode && code && (
                <code className="text-sm font-mono">{code}</code>
              )}
              {highlightedCode && (
                <div
                  className="text-sm [&_pre]:m-0 [&_code]:m-0"
                  dangerouslySetInnerHTML={{ __html: highlightedCode }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
