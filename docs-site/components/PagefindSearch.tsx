import { useCallback, useEffect, useRef, useState } from 'react';

interface SearchResult {
  id: string;
  url: string;
  title: string;
  excerpt: string;
}

interface PagefindSearchResponse {
  results: Array<{
    id: string;
    data: () => Promise<{
      url: string;
      meta: { title?: string };
      excerpt: string;
    }>;
  }>;
}

interface PagefindModule {
  search: (query: string) => Promise<PagefindSearchResponse>;
  debouncedSearch: (
    query: string,
    options?: { debounceTimeoutMs?: number }
  ) => Promise<PagefindSearchResponse>;
}

declare global {
  interface Window {
    pagefind?: PagefindModule;
  }
}

/**
 * Custom Pagefind search component with full keyboard support.
 * Features:
 * - Cmd/Ctrl+K to open/focus
 * - Escape to close
 * - Arrow up/down to navigate results
 * - Enter to select result
 * - Click outside to close
 */
export function PagefindSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pagefindReady, setPagefindReady] = useState(false);
  const [pagefindError, setPagefindError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load Pagefind API
  useEffect(() => {
    const loadPagefind = async () => {
      try {
        // Dynamic import with vite-ignore to load from built output
        const pagefindUrl = '/pagefind/pagefind.js';
        const pagefind = await import(/* @vite-ignore */ pagefindUrl);
        window.pagefind = pagefind as PagefindModule;
        setPagefindReady(true);
      } catch {
        // Pagefind not available (dev mode or not built yet)
        console.debug('Pagefind not available - will work after build');
        setPagefindError(true);
      }
    };
    loadPagefind();
  }, []);

  // Search handler
  const handleSearch = useCallback(
    async (searchQuery: string) => {
      setQuery(searchQuery);
      setSelectedIndex(0);

      if (!searchQuery.trim()) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      if (!pagefindReady || !window.pagefind) {
        // Show warning when Pagefind isn't available
        setIsOpen(true);
        return;
      }

      setIsLoading(true);
      setIsOpen(true);

      try {
        const response = await window.pagefind.debouncedSearch(searchQuery, {
          debounceTimeoutMs: 150,
        });

        if (!response?.results) {
          setResults([]);
          return;
        }

        // Load result data (limit to first 8 for performance)
        const loadedResults = await Promise.all(
          response.results.slice(0, 8).map(async (result) => {
            const data = await result.data();
            return {
              id: result.id,
              url: data.url,
              title: data.meta?.title || 'Untitled',
              excerpt: data.excerpt,
            };
          })
        );

        setResults(loadedResults);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [pagefindReady]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl+K to focus search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Input keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;

      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;

      case 'Enter':
        event.preventDefault();
        if (results[selectedIndex]) {
          navigateToResult(results[selectedIndex]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Navigate to selected result
  const navigateToResult = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    window.location.href = result.url;
  };

  // Scroll selected result into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedElement = resultsRef.current.children[
        selectedIndex
      ] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, results.length]);

  return (
    <div ref={containerRef} className="relative">
      {/* Search Input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search docs..."
          className="
            w-64 pl-10 pr-16 py-2 rounded-lg text-sm
            bg-black/40 border border-white/10
            text-gray-100 placeholder:text-gray-500
            focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/50
            focus:outline-none transition-all duration-200
            hover:border-white/20
          "
        />

        {/* Keyboard shortcut hint */}
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs bg-white/5 border border-white/10 rounded text-gray-500 pointer-events-none flex items-center gap-0.5">
          <span className="text-[10px]">⌘</span>K
        </kbd>
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div
          className="
            absolute top-full right-0 mt-2 z-50
            w-96 max-h-[400px] overflow-y-auto
            bg-secondary/98 backdrop-blur-xl
            rounded-xl border border-white/10
            shadow-[0_0_30px_-10px_rgba(0,240,255,0.3)]
          "
        >
          {pagefindError ? (
            <div className="p-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-neon-orange/10 border border-neon-orange/30">
                <svg
                  className="w-5 h-5 text-neon-orange shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <div className="text-sm font-medium text-neon-orange">
                    Search unavailable
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    The search index failed to load. Try refreshing the page or
                    building the site with{' '}
                    <code className="text-neon-mint">pnpm build</code>.
                  </div>
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-neon-cyan border-t-transparent" />
              <span className="ml-2">Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="px-4 py-2 text-xs text-gray-500 border-b border-white/5">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </div>
              <div ref={resultsRef}>
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    onClick={() => navigateToResult(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`
                      w-full text-left px-4 py-3
                      border-b border-white/5 last:border-0
                      transition-colors duration-100
                      ${
                        index === selectedIndex
                          ? 'bg-neon-cyan/10'
                          : 'hover:bg-white/5'
                      }
                    `}
                  >
                    <div
                      className={`
                        font-medium text-sm
                        ${
                          index === selectedIndex
                            ? 'text-neon-cyan'
                            : 'text-gray-200'
                        }
                      `}
                    >
                      {result.title}
                    </div>
                    <div
                      className="text-xs text-gray-500 mt-1 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: result.excerpt }}
                    />
                  </button>
                ))}
              </div>
              <div className="px-4 py-2 text-xs text-gray-600 border-t border-white/5 flex items-center gap-4">
                <span>
                  <kbd className="px-1 py-0.5 bg-white/5 rounded text-[10px]">
                    ↑↓
                  </kbd>{' '}
                  navigate
                </span>
                <span>
                  <kbd className="px-1 py-0.5 bg-white/5 rounded text-[10px]">
                    ↵
                  </kbd>{' '}
                  select
                </span>
                <span>
                  <kbd className="px-1 py-0.5 bg-white/5 rounded text-[10px]">
                    esc
                  </kbd>{' '}
                  close
                </span>
              </div>
            </>
          ) : query ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No results for &quot;{query}&quot;
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
