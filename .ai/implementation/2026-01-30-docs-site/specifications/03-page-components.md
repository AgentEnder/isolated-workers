# Spec 03: Page Components

## Overview

Create the main page templates for the documentation site including landing, examples index, and dynamic example pages.

## Dependencies

- [Spec 02: Navigation & Layout](./02-navigation-layout.md) must be complete

## Tasks

### Task 3.1: Create Landing Page

**Action**: Build the homepage with neon aesthetic and feature highlights

**Page Requirements**:

- Animated background glow elements
- Large hero text with gradient
- Feature cards (3 items)
- Call-to-action buttons
- Full-screen, centered layout

**Key Elements**:

```tsx
- Animated pulse circles (cyan/purple)
- Gradient text: "Type-Safe Worker Processes"
- Feature icons: ⚡ Fast, 🔒 Type-Safe, 🛠️ Simple
- "Get Started" button with neon gradient
- "View Examples" button with border
```

**Validation**:

- [ ] Page renders without errors
- [ ] Glow effects animate correctly
- [ ] Gradient text displays properly
- [ ] Buttons hover with neon effects
- [ ] Mobile responsive (stacks vertically)

### Task 3.2: Create Examples Index Page

**Action**: Build examples listing page with difficulty badges

**Page Requirements**:

- List all examples from navigation data
- Show title, description, difficulty
- Hover effects with neon borders
- Link to individual example pages

**Example Card Structure**:

```tsx
<Link
  href={`/examples/${example.id}`}
  className="block p-6 bg-tertiary rounded-2xl border border-white/5 hover:border-neon-cyan/50 transition-all group"
>
  <h2 className="text-2xl font-semibold mb-2 text-neon-cyan group-hover:text-neon-mint">
    {example.title}
  </h2>
  <p className="text-secondary">{example.description}</p>
  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-neon-mint/20 text-neon-mint">
    {example.difficulty}
  </span>
</Link>
```

**Validation**:

- [ ] All examples display
- [ ] Difficulty badges show correct colors
- [ ] Hover effects work
- [ ] Links navigate correctly

### Task 3.3: Create Dynamic Example Detail Page

**Action**: Build [id] route that displays example content with code blocks

**Page Requirements**:

- Read example files on server
- Parse {{file:filename}} placeholders in content.md
- Replace with CodeBlock components
- Display messages.ts, host.ts, worker.ts files

**Implementation**:
Create `docs/pages/examples/[id]/+Page.tsx`:

```tsx
// In onBeforeRender:
- Read content.md
- Read messages.ts
- Read host.ts
- Read worker.ts
- Parse front-matter

// In Page component:
- Replace {{file:messages.ts}} with <CodeBlock code={example.messages} language="typescript" />
- Replace {{file:host.ts}} with <CodeBlock code={example.host} language="typescript" />
- Replace {{file:worker.ts}} with <CodeBlock code={example.worker} language="typescript" />
```

**Validation**:

- [ ] Dynamic route works for all examples
- [ ] Files read correctly
- [ ] Placeholders replaced with code blocks
- [ ] Markdown content renders properly

### Task 3.4: Create Default Page Wrapper

**Action**: Set up \_default.page.tsx for all markdown pages

**Wrapper Requirements**:

- Wrap content with Layout
- Apply prose styling for markdown
- Enable syntax highlighting for code blocks

**Implementation**:

```tsx
import { PageContext } from 'vike/types';

export default function Page({
  pageContext,
  children,
}: {
  pageContext: PageContext;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

**Validation**:

- [ ] Wrapper renders correctly
- [ ] Markdown displays properly
- [ ] Code blocks styled correctly
- [ ] Layout wraps content

### Task 3.5: Add Placeholder Documentation Pages

**Action**: Create getting-started and guide placeholder pages

**Pages to Create**:

- `docs/pages/getting-started/installation.md`
- `docs/pages/getting-started/quick-start.md`
- `docs/pages/getting-started/first-worker.md`
- `docs/pages/guides/type-safety.md`
- `docs/pages/guides/error-handling.md`
- `docs/pages/guides/best-practices.md`
- `docs/pages/api/create-worker.md`
- `docs/pages/api/start-worker-server.md`
- `docs/pages/api/handlers.md`
- `docs/pages/api/define-messages.md`

**Page Structure**:

- H1 title
- Content with markdown formatting
- Code examples in code blocks
- Links to related topics

**Validation**:

- [ ] All pages render
- [ ] Navigation links work
- [ ] Code blocks display correctly
- [ ] Layout applies to all pages

## Success Criteria

✅ All 5 tasks completed
✅ Landing page renders with glow effects
✅ Examples show difficulty badges
✅ Example pages include file code blocks
✅ All pages responsive
✅ Markdown content displays properly

## Next Spec

[Spec 04: UI Components](./04-ui-components.md)
