# Spec 05: Content Integration

## Overview

Integrate examples and documentation content, including front-matter processing and API documentation.

## Dependencies

- [Spec 04: UI Components](./04-ui-components.md) must be complete

## Tasks

### Task 5.1: Enhance Example Front-Matter

**Action**: Ensure all example content.md files have consistent front-matter

**Front-Matter Format**:

```yaml
---
title: Basic Ping-Pong Worker
description: This example demonstrates the fundamental request/response pattern
difficulty: beginner
tags:
  - basics
  - request-response
---

## Overview

The ping-pong example shows:

- How to define message types using `DefineMessages`
- How to spawn a worker process
- How to send messages and receive responses
- Proper cleanup and shutdown

{{file:messages.ts}}

{{file:host.ts}}

{{file:worker.ts}}
```

**Metadata Fields**:

- `title`: Example name (required)
- `description`: Brief description (required)
- `difficulty`: beginner | intermediate | advanced (required)
- `tags`: Array of related topics (optional)

**Files to Update**:

- `examples/basic-ping/content.md`
- `examples/error-handling/content.md`
- `examples/worker-lifecycle/content.md`
- `examples/custom-serializer/content.md`
- `examples/timeout-config/content.md`
- `examples/middleware/content.md`

**Validation**:

- [ ] All examples have content.md
- [ ] Front-matter is valid YAML
- [ ] Required fields present
- [ ] Difficulty values correct
- [ ] Tags format valid

### Task 5.2: Implement File Inclusion for Examples

**Action**: Parse and replace {{file:filename}} placeholders with code blocks

**Implementation**:
In `docs/pages/examples/[id]/+Page.tsx`:

```typescript
export async function onBeforeRender(pageContext: PageContextServer) {
  const { id } = pageContext.routeParams;
  const exampleDir = path.resolve(process.cwd(), '../examples', id);

  // Read files
  const [content, messages, host, worker] = await Promise.all([
    fs.readFile(path.join(exampleDir, 'content.md'), 'utf-8'),
    fs.readFile(path.join(exampleDir, 'messages.ts'), 'utf-8'),
    fs.readFile(path.join(exampleDir, 'host.ts'), 'utf-8'),
    fs.readFile(path.join(exampleDir, 'worker.ts'), 'utf-8'),
  ]);

  // Parse front-matter
  const frontmatter = extractFrontmatter(content);

  return {
    pageContext: {
      title: frontmatter.title,
      data: { example: { id, content, messages, host, worker } },
    },
  };
}

export default function Page({ pageContext }: { pageContext: PageContext }) {
  const { example } = pageContext.data;

  // Replace placeholders with CodeBlock components
  const processedContent = example.content.replace(
    /\{\{file:(.*?)\}\}/g,
    (match, filename) => {
      if (filename === 'messages.ts') {
        return `<CodeBlock code={\`${example.messages}\`} language="typescript" />`;
      }
      if (filename === 'host.ts') {
        return `<CodeBlock code={\`${example.host}\`} language="typescript" />`;
      }
      if (filename === 'worker.ts') {
        return `<CodeBlock code={\`${example.worker}\`} language="typescript" />`;
      }
      return match;
    }
  );

  return (
    <article className="prose prose-invert prose-neon max-w-none">
      <div dangerouslySetInnerHTML={{ __html: processedContent }} />
    </article>
  );
}
```

**Validation**:

- [ ] Placeholders replaced correctly
- [ ] Code blocks display with syntax highlighting
- [ ] All example files loaded
- [ ] Markdown content renders properly

### Task 5.3: Create API Documentation Pages

**Action**: Write API reference documentation with type information

**API Pages to Create**:

- `docs/pages/api/create-worker.md`
- `docs/pages/api/start-worker-server.md`
- `docs/pages/api/handlers.md`
- `docs/pages/api/define-messages.md`

**Page Structure**:

````markdown
# createWorker

Spawn a type-safe worker process.

## Signature

```typescript
function createWorker<Messages>(
  config: WorkerConfig,
): Promise<WorkerClient<Messages>>;
```
````

## Parameters

### config: WorkerConfig

- `script`: Path to worker script
- `env`: Environment variables (optional)
- `timeout`: Request timeout in milliseconds (default: 600000)

## Returns

`WorkerClient<Messages>` - Typed client for sending messages

## Example

\`\`\`typescript
const worker = await createWorker<Messages>({
script: './worker.ts',
env: { WORKER: 'true' },
});

const result = await worker.send('ping', { msg: 'hello' });
await worker.close();
\`\`\`

## See Also

- [startWorkerServer](./start-worker-server.md)
- [Handlers Type](./handlers.md)

```

**Validation**:
- [ ] All API pages created
- [ ] Signatures documented
- [ ] Examples included
- [ ] Cross-references work

### Task 5.4: Add Getting-Started Documentation
**Action**: Write comprehensive getting-started guides

**Pages to Create**:
- `docs/pages/getting-started/installation.md`
- `docs/pages/getting-started/quick-start.md`
- `docs/pages/getting-started/first-worker.md`

**Content Requirements**:
- Installation commands with pnpm
- Basic project setup
- First message exchange
- Type safety explanation
- Links to examples

**Validation**:
- [ ] All guides complete
- [ ] Code examples work
- [ ] Links navigate correctly
- [ ] Content is clear

### Task 5.5: Create Guides Documentation
**Action**: Write in-depth guides for advanced topics

**Pages to Create**:
- `docs/pages/guides/type-safety.md`
- `docs/pages/guides/error-handling.md`
- `docs/pages/guides/best-practices.md`

**Content Requirements**:
- Detailed explanations
- Type inference examples
- Error patterns and handling
- Best practices and tips
- Code examples

**Validation**:
- [ ] All guides complete
- [ ] Advanced topics covered
- [ ] Examples provided
- [ ] Cross-references work

## Success Criteria

✅ All 5 tasks completed
✅ Example files render in code blocks
✅ Front-matter parsed correctly
✅ API pages display type info
✅ Content links work properly
✅ Documentation is comprehensive

## Next Spec

[Spec 06: Build & Deployment](./06-build-deployment.md)
```
