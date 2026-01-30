# Phase 6: Testing, Examples & Documentation

## Overview

Complete the project with comprehensive testing (unit, type, and E2E), usage examples that serve as both documentation and executable tests, and a documentation site built from the examples.

## Philosophy: Examples as Tests

The E2E tests and documentation are unified through the **examples system**. Each example is:

- A runnable TypeScript file with YAML front-matter metadata
- Automatically tested as part of the E2E suite
- Rendered as documentation on the site
- Organized by difficulty and topic

This ensures documentation never drifts from working code.

## Testing

### Unit Tests (`packages/isolated-workers/src/**/*.spec.ts`)

**Worker Spawner Tests:**

- Process creation and lifecycle
- Environment variable injection
- Socket path generation
- Graceful shutdown behavior
- Error handling on spawn failure

**Connection Manager Tests:**

- Connection establishment
- Reconnect with exponential backoff
- Timeout handling
- Event emission
- Cleanup on disconnect

**Messaging Tests:**

- Message serialization/deserialization
- Transaction ID generation
- Error serialization
- Type guard validation

**Utilities Tests:**

- Platform detection
- Socket path generation
- Temp directory handling

### Type Tests (`type-tests/src/**/*.spec.ts`)

**Message Type Inference:**

```typescript
it('should infer exact payload types for messages', () => {
  type Messages = DefineMessages<{
    compute: { payload: { n: number }; result: { value: number } };
  }>;

  // Verify payload type is exactly { n: number }
  type Test = AssertProperty<
    MessageOf<Messages, 'compute'>,
    'payload',
    { n: number }
  >;
  const test: IsTrue<Test> = true;
});
```

**Handler Type Inference:**

```typescript
it('should infer correct handler types', () => {
  type Messages = DefineMessages<{
    load: { payload: { config: string }; result: { loaded: true } };
  }>;

  type HandlersType = Handlers<Messages>;

  // Verify handler accepts correct payload
  type Test1 = AssertProperty<
    Parameters<HandlersType['load']>[0],
    'config',
    string
  >;
  // Verify handler returns correct result
  type LoadReturn = Awaited<ReturnType<HandlersType['load']>>;
  type Test2 = AssertEqual<LoadReturn, { loaded: true } | void>;

  const test1: IsTrue<Test1> = true;
  const test2: IsTrue<Test2> = true;
});
```

### E2E Tests (`e2e/`)

**Basic Worker Test:**

```typescript
it('should spawn worker and send/receive messages', async () => {
  const worker = await createWorkerClient<{
    ping: { payload: { msg: string }; result: { pong: string } };
  }>({ script: './e2e/fixtures/ping-worker.ts' });

  const result = await worker.send('ping', { msg: 'hello' });
  expect(result).toEqual({ pong: 'hello' });

  await worker.close();
});
```

**Error Handling Test:**

```typescript
it('should propagate errors from worker', async () => {
  const worker = await createWorkerClient<{
    error: { payload: { msg: string } };
  }>({ script: './e2e/fixtures/error-worker.ts' });

  await expect(worker.send('error', { msg: 'test' })).rejects.toThrow(
    'test error'
  );

  await worker.close();
});
```

**Reconnection Test:**

```typescript
it('should reconnect after worker restart', async () => {
  // Test connection retry logic
});
```

### E2E Fixtures

Create worker scripts in `e2e/fixtures/`:

- `ping-worker.ts` - Simple request/response
- `error-worker.ts` - Error throwing
- `slow-worker.ts` - Timeout testing
- `multi-message-worker.ts` - Multiple message types

## Documentation Site (`docs/`)

### Structure

```
docs/
├── pages/
│   ├── index.md              # Home/landing
│   ├── getting-started/
│   │   ├── index.md          # Quick start
│   │   ├── installation.md
│   │   └── first-worker.md
│   ├── guides/
│   │   ├── basic-usage.md
│   │   ├── type-safety.md
│   │   ├── error-handling.md
│   │   └── best-practices.md
│   ├── api/
│   │   ├── index.md          # API overview
│   │   ├── worker-client.md
│   │   ├── worker-server.md
│   │   ├── messaging.md
│   │   └── types.md
│   └── examples/
│       ├── index.md
│       └── simple-computation.md
├── _default.page.route.ts
├── _default.page.server.ts
└── renderer/
    └── _default.page.client.ts
```

### Content

**Getting Started:**

1. Installation instructions
2. Basic worker creation
3. First message exchange
4. Type-safe setup

**Guides:**

- Complete API walkthrough
- Type safety deep dive
- Error handling patterns
- Best practices and tips

**API Reference:**

- Auto-generated from TSDoc comments
- Function signatures
- Type definitions
- Usage examples

**Examples:**

- Simple computation worker
- File processing pipeline
- Multi-step workflow
- Error recovery patterns

## Examples (`examples/`)

### Example Format

Each example is a single TypeScript file with YAML front-matter:

```typescript
---
title: Simple Computation Worker
description: Spawn a worker that performs calculations
difficulty: beginner
---

import { createWorkerClient, DefineMessages, startWorkerServer } from 'isolated-workers';

// Define message types
type Messages = DefineMessages<{
  compute: {
    payload: { n: number };
    result: { factorial: number };
  };
}>;

// Worker implementation
if (process.env.WORKER === 'true') {
  startWorkerServer<Messages>({
    compute: ({ n }) => {
      let result = 1;
      for (let i = 2; i <= n; i++) result *= i;
      return { factorial: result };
    },
  });
} else {
  // Client usage
  const worker = await createWorkerClient<Messages>({
    script: import.meta.url,
    env: { WORKER: 'true' },
  });

  const result = await worker.send('compute', { n: 5 });
  console.log('5! =', result.factorial); // 120

  await worker.close();
}
```

### Example Collection

1. **basic-calculation** - Factorial computation
2. **file-processor** - Read and process files
3. **error-handling** - Error propagation patterns
4. **multi-worker** - Multiple concurrent workers
5. **streaming** - Progress updates (if supported)

## Documentation Strategy

### Technology Stack

**Vike (Framework)** - Simpler than Docusaurus, better TypeScript integration, file-based routing
**Pagefind (Search)** - Pure JS search index, no backend required, excellent for docs

### Site Structure

```
docs-site/
├── src/
│   ├── pages/
│   │   ├── +Page.tsx              # Layout wrapper
│   │   ├── index/+Page.tsx        # Home page
│   │   ├── api/+Page.tsx          # API reference (auto-generated)
│   │   ├── guides/*.md            # Guide pages
│   │   └── examples/              # Generated from examples/
│   │       ├── +Page.tsx          # Examples index
│   │       └── [id]/+Page.tsx     # Individual example pages
│   ├── components/                # Reusable React components
│   └── plugins/
│       └── examples-plugin.ts     # Generate docs from examples
├── vike.config.ts
└── pagefind.config.json
```

### Documentation Principles

1. **Example-Driven**: Every feature has a corresponding runnable example
2. **Type-First**: All code examples fully typed, no implicit `any`
3. **Progressive**: Start with basics, add advanced topics gradually
4. **Tested**: Examples run as E2E tests, ensuring they always work
5. **Auto-Generated**: API docs extracted from TSDoc, example pages from front-matter

### Content Organization

**Getting Started:**

- Installation and setup
- First worker creation
- Basic message exchange
- Type-safe patterns

**Guides:**

- Worker creation patterns
- Message patterns (request/response, streaming)
- Advanced configuration
- Error handling strategies
- Troubleshooting

**API Reference:**

- Auto-generated from TSDoc comments
- Type signatures with explanations
- Cross-linked to relevant examples

**Examples:**

- Auto-generated from `examples/` directory
- Organized by difficulty (beginner → advanced)
- Runnable code with expected output
- Links to related guides

## Quality Gates

### Test Coverage

- Unit tests: >80% coverage
- Type tests: All public APIs
- E2E tests: All example workflows

### Documentation

- All public APIs documented
- Getting started guide complete
- At least 3 examples working
- Docs site building without errors

### Build Verification

```bash
# All tests passing
pnpm nx run-many -t test

# Type checking
pnpm nx run-many -t typecheck

# Linting
pnpm nx run-many -t lint

# E2E tests
pnpm nx run-many -t e2e

# Docs build
pnpm nx build docs-site

# Examples run
pnpm nx run examples:verify
```

## Success Criteria

- [ ] Unit tests for all core components
- [ ] Type tests validating inference
- [ ] E2E tests for common workflows
- [ ] 3+ working examples with documentation
- [ ] Getting started guide complete
- [ ] API reference generated
- [ ] All tests passing in CI
- [ ] Documentation site deployed

## Dependencies

- Phase 5: Core implementation complete

## Project Completion

When this phase is complete:

- Library is fully functional
- All tests passing
- Documentation complete
- Examples working
- Ready for initial release
