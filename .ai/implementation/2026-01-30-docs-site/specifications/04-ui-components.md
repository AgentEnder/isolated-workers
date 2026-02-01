# Spec 04: UI Components

## Overview

Build reusable UI components for the documentation site including code blocks and search functionality.

## Dependencies

- [Spec 03: Page Components](./03-page-components.md) must be complete

## Tasks

### Task 4.1: Create CodeBlock Component

**Action**: Implement syntax-highlighted code blocks with copy functionality

**Component Requirements**:

- Syntax highlighting (use Prism.js or inline for MVP)
- Copy-to-clipboard button
- Language label
- Neon-themed styling
- Rounded corners, dark background

**Component Structure**:

```tsx
interface CodeBlockProps {
  code: string;
  language: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-white/10">
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/5">
        <span className="text-xs text-muted font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-neon-cyan hover:text-neon-mint transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-6 overflow-x-auto bg-black/60">
        <code
          className="text-sm font-mono"
          dangerouslySetInnerHTML={{ __html: code }}
        />
      </pre>
    </div>
  );
}
```

**Styling**:

- Container: `border border-white/10 rounded-xl`
- Header: `bg-black/40 border-b border-white/5`
- Pre: `bg-black/60 p-6`
- Code: `text-sm font-mono`
- Button: `text-neon-cyan hover:text-neon-mint`

**Validation**:

- [ ] Component compiles
- [ ] Copy button works
- [ ] Languages display
- [ ] Neon theme applied
- [ ] Code is syntax highlighted

### Task 4.2: Implement Pagefind Search UI

**Action**: Create custom Pagefind search integration

**Search Requirements**:

- Load Pagefind UI library dynamically
- Input with neon styling
- Results dropdown with backdrop blur
- Highlight search terms
- Mobile responsive width

**Component Structure**:

```tsx
export function PagefindSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load Pagefind UI library
    const script = document.createElement('script');
    script.src = '/pagefind/pagefind-ui.js';
    document.body.appendChild(script);
  }, []);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder="Search docs..."
        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-primary placeholder:text-muted focus:border-neon-cyan focus:outline-none transition-colors"
      />
      {isOpen && query && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-secondary/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-neon overflow-hidden max-h-96 overflow-y-auto">
          {results.map((result) => (
            <a
              key={result.url}
              href={result.url}
              className="block px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
            >
              <div className="font-semibold text-neon-cyan">{result.title}</div>
              <div className="text-sm text-secondary">{result.excerpt}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Validation**:

- [ ] Search input displays
- [ ] Pagefind library loads
- [ ] Results show on query
- [ ] Dropdown has glass morphism
- [ ] Links navigate correctly
- [ ] Mobile responsive

### Task 4.3: Add Copy-to-Clipboard Functionality

**Action**: Enhance CodeBlock with copy feedback

**Copy Requirements**:

- Click to copy code to clipboard
- Visual feedback (Copied! text)
- Auto-reset after 2 seconds
- Keyboard accessible

**Validation**:

- [ ] Copy works on all browsers
- [ ] Feedback displays
- [ ] Feedback disappears after timeout
- [ ] Button is accessible

### Task 4.4: Style Code Blocks with Neon Theme

**Action**: Apply consistent neon styling to all code elements

**Styling Requirements**:

- Background: Nearly black with slight tint
- Border: Thin white/10 border
- Neon hover effects
- Syntax highlighting colors
- Language badges with muted text

**Color Scheme**:

- Background: `bg-black/60` or `bg-black/40`
- Text: `text-primary` (white)
- Accent: `text-neon-cyan` for keywords
- Border: `border-white/10` with `hover:border-neon-cyan/30`
- Shadow: `shadow-neon-sm` on hover

**Validation**:

- [ ] All code blocks consistent
- [ ] Neon effects visible
- [ ] High contrast for readability
- [ ] Colors match design system

## Success Criteria

✅ All 4 tasks completed
✅ Code blocks display correctly
✅ Copy button works
✅ Search returns results
✅ Components match design system

## Next Spec

[Spec 05: Content Integration](./05-content-integration.md)
