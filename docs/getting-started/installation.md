---
title: Installation
description: Install isolated-workers using your favorite package manager
nav:
  section: Getting Started
  order: 0
---

# Installation

Install isolated-workers using your favorite package manager.

## Package Managers

isolated-workers is available on npm and can be installed with any popular package manager.

```bash
# npm
npm install isolated-workers

# yarn
yarn add isolated-workers

# pnpm
pnpm add isolated-workers

# bun
bun add isolated-workers
```

## TypeScript Requirements

isolated-workers is built with TypeScript 5.7.2 (TypeScript 5.0 or later required). Ensure your tsconfig.json has the following settings:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true
  }
}
```

## Requirements

- Node.js 20.10 or later (required for ES2022 features)
- TypeScript 5.0 or later (recommended but not required)

## Next Steps

Once installed, continue to the [Quick Start](/docs/getting-started/quick-start) guide to create your first worker.
