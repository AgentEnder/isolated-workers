# Phase 3: Package Structure & Monorepo Setup

## Overview

Establish monorepo structure using Nx, pnpm, and workspace catalog, matching cli-forge pattern.

## Repository Structure

```
isolated-workers/
├── plans/                        # Phase documentation (YOU ARE HERE)
├── packages/
│   └── isolated-workers/     # Main library package
├── docs-site/                    # Vike documentation site
├── examples/                      # Runnable examples
├── e2e/                          # End-to-end tests
├── type-tests/                    # TypeScript type inference validation
├── tools/scripts/                  # Build utilities
├── .github/                      # GitHub workflows, templates
├── .nx/                          # Nx cache directory
├── package.json                   # Root package.json
├── pnpm-workspace.yaml          # pnpm workspace configuration
├── nx.json                       # Nx workspace configuration
├── tsconfig.base.json             # Base TypeScript configuration
├── tsconfig.json                 # Root TypeScript configuration
└── .gitignore                     # Git ignore patterns
```

## Package Configuration

### Root `package.json`

```json
{
  "name": "isolated-workers-source",
  "version": "0.0.0",
  "license": "MIT",
  "private": true,
  "scripts": {},
  "devDependencies": {
    "@nx/eslint": "catalog:",
    "@nx/eslint-plugin": "catalog:",
    "@nx/js": "catalog:",
    "@nx/vite": "catalog:",
    "@nx/vitest": "catalog:",
    "@nx/web": "catalog:",
    "@nx/workspace": "catalog:",
    "@nx/webpack": "catalog:",
    "@swc-node/register": "catalog:",
    "@swc/core": "catalog:",
    "@swc/helpers": "catalog:",
    "@types/node": "catalog:",
    "@typescript-eslint/eslint-plugin": "catalog:",
    "@typescript-eslint/parser": "catalog:",
    "eslint": "catalog:",
    "eslint-config-prettier": "catalog:",
    "prettier": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:",
    "vite": "catalog:",
    "vike": "catalog:",
    "pagefind": "catalog:"
  },
  "nx": {
    "includedScripts": []
  }
}
```

### pnpm Workspace (`pnpm-workspace.yaml`)

```yaml
packages:
  - packages/*
  - docs-site
  - examples
  - e2e
  - tools/scripts
  - type-tests

catalog:
  nx: 22.2.0
  "@nx/js": 22.2.0
  "@nx/vite": 22.2.0
  "@nx/vitest": 1.3.1
  "@nx/web": 22.2.0
  "@nx/workspace": 22.2.0
  "@nx/webpack": 22.2.0
  "@swc-node/register": 1.11.1
  "@swc/core": 1.15.3
  "@swc/helpers": 0.5.17
  "@types/node": 18.16.9
  "@typescript-eslint/eslint-plugin": 7.16.0
  "@typescript-eslint/parser": 7.16.0
  eslint: 8.57.0
  eslint-config-prettier: 10.1.8
  prettier: 2.6.2
  typescript: 5.9.3
  vitest: 1.3.1
  vite: 5.4.0
  vike: 0.4.252
  pagefind: 1.1.0
```

### Nx Workspace (`nx.json`)

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/.eslintrc.json",
      "!{projectRoot}/eslint.config.js",
      "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
      "!{projectRoot}/tsconfig.spec.json"
    ],
    "sharedGlobals": ["{workspaceRoot}/.github/workflows/ci.yml"]
  },
  "targetDefaults": {
    "build": {
      "cache": true,
      "inputs": ["default", "^production"]
    },
    "test": {
      "cache": true,
      "inputs": ["default", "^production"]
    }
  },
  "plugins": [
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    },
    {
      "plugin": "@nx/js/typescript",
      "options": {
        "typecheck": {
          "targetName": "typecheck"
        },
        "build": {
          "targetName": "build",
          "configName": "tsconfig.lib.json"
        }
      }
    },
    {
      "plugin": "@nx/vitest"
    }
  ]
}
```

## Main Package Structure (`packages/isolated-workers/`)

```
packages/isolated-workers/
├── src/
│   ├── index.ts                 # Public API exports
│   ├── core/
│   │   ├── worker.ts          # Worker process script
│   │   ├── connection.ts      # Client connection manager
│   │   ├── messaging.ts       # Type-safe messaging layer
│   │   └── lifecycle.ts       # Worker lifecycle
│   ├── utils/
│   │   ├── socket.ts          # Socket utilities
│   │   ├── serializer.ts      # Error serialization
│   │   ├── paths.ts           # OS-specific socket paths
│   │   └── logger.ts          # Debug logging
│   └── types/
│       ├── public-api.ts      # User-facing types
│       ├── internal.ts        # Internal types
│       └── worker-api.ts     # Worker communication types
├── package.json
├── tsconfig.json
├── tsconfig.lib.json
├── vitest.config.ts
├── project.json
└── .eslintrc.json
```

## Main Package Configuration

### `packages/isolated-workers/package.json`

```json
{
  "name": "isolated-workers",
  "version": "0.0.0",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.lib.json",
    "typecheck": "tsc -p tsconfig.lib.json --noEmit",
    "lint": "eslint src",
    "test": "vitest",
    "test:ui": "vitest --ui"
  },
  "devDependencies": {
    "@nx/js": "catalog:",
    "@nx/vitest": "catalog:",
    "@nx/eslint": "catalog:",
    "@nx/eslint-plugin": "catalog:",
    "typescript": "catalog:",
    "eslint": "catalog:",
    "eslint-config-prettier": "catalog:",
    "prettier": "catalog:",
    "vitest": "catalog:",
    "vite": "catalog:"
  },
  "nx": {
    "includedScripts": []
  }
}
```

### `packages/isolated-workers/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### `packages/isolated-workers/tsconfig.lib.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "incremental": true,
    "tsBuildInfoFile": "./dist/tsconfig.lib.tsbuildinfo"
  },
  "include": ["src/**/*.ts"]
}
```

### `packages/isolated-workers/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts"],
    exclude: ["node_modules", "dist"],
  },
});
```

## TypeScript Configuration

### Root `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true
  },
  "exclude": ["node_modules"]
}
```

### Root `tsconfig.json`

```json
{
  "references": [],
  "files": [],
  "include": []
}
```

## Nx Project Configuration

### `packages/isolated-workers/project.json`

```json
{
  "name": "isolated-workers",
  "sourceRoot": "src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "options": {
        "tsConfig": "tsconfig.lib.json"
      },
      "outputs": ["{projectRoot}/dist"],
      "dependsOn": []
    },
    "typecheck": {
      "executor": "@nx/js:tsc",
      "options": {
        "tsConfig": "tsconfig.lib.json",
        "skipEmit": true
      },
      "outputs": []
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "options": {
        "lintFilePatterns": ["src/**/*.ts"]
      },
      "outputs": []
    },
    "test": {
      "executor": "@nx/vitest:vitest",
      "options": {
        "config": "vitest.config.ts",
        "passWithNoTests": true
      },
      "outputs": ["{projectRoot}/coverage"]
    }
  }
}
```

## Tooling Configuration

### ESLint

`.eslintrc.json` (root):

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ],
  "ignorePatterns": ["node_modules", "dist", "coverage", ".nx"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-argument-types": "error"
  },
  "plugins": ["@typescript-eslint", "prettier"]
}
```

### Prettier

`.prettierrc` (root):

```json
{
  "singleQuote": true,
  "trailingComma": "es5",
  "semi": false,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

## Git Configuration

### `.gitignore`

```
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
coverage/
.nx/

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment
.env
.env.local
.env.*.local

# Temporary files
*.tmp
*.temp
```

## Workspace Features Enabled

### Nx Integration

- **Workspace caching** with `.nx/` directory
- **Affected graph** for efficient task execution
- **Module boundaries** with `@nx/js`, `@nx/vitest` plugins
- **Code generation** (future: generators for scaffolding)

### pnpm Catalog

- **Centralized versions** for all Nx and tooling dependencies
- **Easy updates** via catalog management
- **Version consistency** across workspace packages

### Monorepo Benefits

1. **Shared Dependencies**: Single install for all packages
2. **Atomic Commits**: Version changes across all affected packages
3. **Affected Testing**: Only run tests for changed packages
4. **Type Safety**: Shared tsconfig ensures consistency
5. **IDE Support**: Monorepo-aware IDE features (Go to Definition)

## Next Steps

Once this phase is complete:

1. Initialize git repository
2. Install dependencies (`pnpm install`)
3. Set up Nx workspace (`nx init` or manual config)
4. Create directory structure
5. Configure linting and formatting
6. Verify builds (`nx build isolated-workers`)
7. Run initial tests (`nx test isolated-workers`)
