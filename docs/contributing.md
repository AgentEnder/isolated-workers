---
title: Contributing
description: How to contribute to isolated-workers
nav:
  section: Resources
  order: 1
---

# Contributing to isolated-workers

Thank you for your interest in contributing to isolated-workers! This guide will help you get started with development and understand our workflow.

## Getting Started

### Prerequisites

- Node.js 18.0 or later
- pnpm 10.x (the project uses pnpm workspaces)
- Git

### Clone and Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/isolated-workers.git
cd isolated-workers

# Install dependencies
pnpm install

# Build all packages
pnpm nx run-many -t build
```

### Verify Your Setup

Run the test suite to ensure everything is working:

```bash
pnpm nx run-many -t test
```

## Project Structure

The repository is organized as an Nx monorepo:

```
isolated-workers/
├── packages/
│   └── isolated-workers/     # Main library package
├── examples/                  # Runnable usage examples
├── docs/                     # Documentation (markdown files)
├── docs-site/                # Documentation website (Vike + Pagefind)
├── e2e/                      # End-to-end tests
└── .ai/                      # AI context and design decisions
```

### Key Directories

- **packages/isolated-workers**: The core library containing type-safe worker management code
- **examples/**: Self-contained examples demonstrating library features
- **docs/**: Markdown documentation rendered by the docs site
- **docs-site/**: The Vike-based documentation website with search powered by Pagefind
- **e2e/**: Integration tests that verify full workflows

## Development Workflow

### Running Tests

```bash
# Run all unit tests
pnpm nx run-many -t test

# Run tests for a specific package
pnpm nx run isolated-workers:test

# Run end-to-end tests
pnpm nx run-many -t e2e
```

### Running Examples

Examples are located in the `examples/` directory. Each example is a self-contained demonstration of a feature.

```bash
# Run a specific example
pnpm nx run examples:run-example --example=basic-ping

# List available examples
ls examples/
```

### Building the Documentation Site

```bash
# Build the docs site
pnpm nx run docs-site:build

# Preview the docs site locally
pnpm nx run docs-site:preview
```

### Linting and Type Checking

```bash
# Run linting across all packages
pnpm nx run-many -t lint

# Run type checking
pnpm nx run-many -t build
```

## Code Standards

### TypeScript

This project uses TypeScript strict mode. Key rules:

- **No `any` types**: Use concrete types for all public APIs
- **Explicit return types**: Functions should have explicit return types
- **Meaningful names**: Use descriptive variable and function names (e.g., `userID` not `id`)
- **Early returns**: Reduce nesting with early return statements

### ESLint Configuration

The project enforces several TypeScript-specific rules:

- `@typescript-eslint/no-explicit-any`: Disallows `any` type
- `@typescript-eslint/no-unused-vars`: Flags unused variables (allows `_` prefix for intentionally unused)
- `@typescript-eslint/no-non-null-assertion`: Disallows non-null assertions (`!`)

### Formatting

Code is formatted with Prettier using single quotes. Format your code before committing:

```bash
pnpm prettier --write .
```

## Submitting Changes

### Fork and Branch

1. Fork the repository on GitHub
2. Clone your fork locally
3. Create a feature branch:

```bash
git checkout -b feature/your-feature-name
```

### Development Process

1. Make your changes in the feature branch
2. Write tests for new functionality
3. Update documentation if you're changing APIs or adding features
4. Ensure all checks pass:

```bash
pnpm nx run-many -t lint,build,test
```

### Creating a Pull Request

1. Push your branch to your fork
2. Open a Pull Request against the `main` branch
3. Fill out the PR template with:
   - Description of changes
   - Related issues (if any)
   - Testing performed
4. Wait for review and address feedback

### Commit Messages

Write clear, descriptive commit messages:

```
feat(workers): add graceful shutdown with configurable timeout

- Add shutdown() method to WorkerConnection
- Support configurable timeout (default 5s)
- Clean up pending operations on shutdown
```

## Adding Examples

Examples help users understand how to use the library. Each example lives in its own directory under `examples/`.

### Example Structure

```
examples/
└── my-example/
    ├── meta.yml        # Example metadata
    ├── content.md      # Documentation content
    ├── host.ts         # Host process code
    ├── worker.ts       # Worker process code
    └── messages.ts     # Shared message definitions
```

### meta.yml Format

```yaml
id: my-example
title: My Example Title
description: |
  A clear description of what this example demonstrates
  and what users will learn from it.
entryPoint: host.ts
fileMap:
  './messages.ts': 'messages.ts'
  './host.ts': 'host.ts'
  './worker.ts': 'worker.ts'
commands:
  - command: 'pnpm run:my-example'
    title: 'Run the example'
    assertions:
      - contains: 'Expected output'
```

### content.md Format

Write documentation that explains the example:

```markdown
# My Example Title

Brief introduction to what this example shows.

## Overview

- Key concept 1
- Key concept 2

## Files

### Shared Message Definitions

{% file messages.ts %}

### Host (Client)

{% file host.ts %}

### Worker

{% file worker.ts %}

## Running the Example

\`\`\`bash
pnpm nx run examples:run-example --example=my-example
\`\`\`
```

### Region Markers for Code Embedding

Use region markers to embed specific code sections in documentation:

```typescript
// #region message-definitions
export type Messages = DefineMessages<{
  ping: { payload: { value: string }; result: { pong: string } };
}>;
// #endregion message-definitions
```

Reference in markdown:

```markdown
{% file messages.ts region="message-definitions" %}
```

## Getting Help

- Check existing [issues](https://github.com/YOUR_ORG/isolated-workers/issues) for similar problems
- Review the [documentation](/docs) for usage guidance
- Open a new issue if you find a bug or have a feature request

## License

By contributing to isolated-workers, you agree that your contributions will be licensed under the MIT License.
