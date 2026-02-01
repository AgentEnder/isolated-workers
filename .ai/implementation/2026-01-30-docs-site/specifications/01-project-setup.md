# Spec 01: Project Setup & Infrastructure

## Overview

Initialize the documentation site project using Vike's CLI scaffolding with React, Tailwind CSS, and ESLint, then add Pagefind integration. Nx will auto-detect the project via workspace plugins.

## Dependencies

None - First spec to execute.

## Tasks

### Task 1.1: Scaffold Project with Vike CLI

**Action**: Use Vike CLI to create the initial project structure

**Command**:

```bash
# From workspace root
cd docs-site && pnpm create vike@latest . --react --tailwindcss --eslint
```

**What this creates**:

- `package.json` with dependencies
- `vite.config.ts`
- `vike.config.ts`
- `tailwind.config.js` / `tailwind.css`
- `renderer/` directory with `Layout.tsx` and `Link.tsx`
- `pages/` directory with `index/+Page.tsx`
- TypeScript configuration
- ESLint configuration
- `.gitignore`

**Validation**:

- [ ] Command completes without errors
- [ ] Project structure created in `docs-site/`
- [ ] `pnpm install` completes successfully
- [ ] Dev server starts (`pnpm run dev`)

### Task 1.2: Add Pagefind Dependency

**Action**: Install Pagefind for search functionality

**Command**:

```bash
cd docs-site && pnpm add -D pagefind
```

**Validation**:

- [ ] `pagefind` in `package.json` devDependencies
- [ ] `pnpm exec pagefind --version` works

### Task 1.3: Create Pagefind Plugin

**Action**: Implement post-build Vite plugin for Pagefind

**File**: `docs-site/plugins/pagefind-plugin.ts`

**Implementation**:

```typescript
import { Plugin } from 'vite';
import { execSync } from 'child_process';
import path from 'path';

export function pagefindPlugin(): Plugin {
  return {
    name: 'pagefind-plugin',
    apply: 'build',
    closeBundle() {
      const outDir = this.meta?.config?.build?.outDir || 'dist';
      const pagefindPath = path.resolve(
        process.cwd(),
        'node_modules/.bin/pagefind',
      );

      console.log('🔍 Running Pagefind indexing...');
      execSync(`node ${pagefindPath} --site ${outDir}`, {
        stdio: 'inherit',
      });
      console.log('✨ Pagefind indexing complete!');
    },
  };
}
```

**Validation**:

- [ ] Plugin compiles without errors
- [ ] Plugin has correct type signature
- [ ] Plugin exports correctly

### Task 1.4: Update Vite Config

**Action**: Add Pagefind plugin to Vite configuration

**Edit**: `docs-site/vite.config.ts`

Add the import and plugin:

```typescript
import { pagefindPlugin } from './plugins/pagefind-plugin';

export default defineConfig({
  plugins: [
    react(),
    vike(),
    pagefindPlugin(), // Add after vike()
  ],
  // ... rest of config
});
```

**Validation**:

- [ ] Vite config compiles
- [ ] No TypeScript errors
- [ ] Build runs without errors

### Task 1.5: Configure Tailwind CSS with Dark Neon Theme

**Action**: Customize Tailwind with the design system colors

**Edit**: `docs-site/tailwind.config.js` or `tailwind.css`

**Configuration**:

- Content paths: `./renderer/**/*.{js,ts,jsx,tsx}`, `./pages/**/*.{js,ts,jsx,tsx,md}`
- Colors:
  - Primary: `#09090b` (nearly black)
  - Secondary: `#131316`
  - Tertiary: `#1c1c21`
  - Neon Cyan: `#00f0ff`
  - Neon Purple: `#bf00ff`
  - Neon Mint: `#00ff9d`
  - Neon Orange: `#ff6b35`
- Shadows: Custom neon shadows
- Text colors: `#f0f0f0` (primary), `#a0a0b0` (secondary), `#6b6b75` (muted)

**Tailwind config extension**:

```javascript
export default {
  content: [
    './renderer/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx,md}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#09090b',
        secondary: '#131316',
        tertiary: '#1c1c21',
        neon: {
          cyan: '#00f0ff',
          purple: '#bf00ff',
          mint: '#00ff9d',
          orange: '#ff6b35',
        },
      },
      boxShadow: {
        neon: '0 0 20px -5px #00f0ff',
        'neon-sm': '0 0 10px -3px #00f0ff',
      },
    },
  },
  plugins: [],
};
```

**Validation**:

- [ ] Tailwind config is valid
- [ ] No TypeScript errors
- [ ] Colors match design system

### Task 1.6: Verify Nx Auto-Detection

**Action**: Confirm Nx picks up the project via workspace plugins

**Nx auto-detection** (no manual config needed):

- `pnpm-workspace.yaml` already includes `docs-site`
- `@nx/vite` plugin auto-detects `vite.config.ts`
- `@nx/js` plugin auto-detects TypeScript
- Targets automatically available: `build`, `dev`, `preview`, `typecheck`, `lint`

**Validation**:

- [ ] `nx show project docs-site` displays project info
- [ ] `pnpm nx run docs-site:build` works
- [ ] `pnpm nx run docs-site:dev` works
- [ ] `pnpm nx run docs-site:preview` works

### Task 1.7: Create Pagefind Config

**Action**: Configure Pagefind search indexing

**File**: `docs-site/pagefind.json`

```json
{
  "rootSelector": "main",
  "glob": "**/*.{html,md}",
  "excludeSelectors": ["[data-pagefind-ignore]", ".pagefind-ui"]
}
```

**Validation**:

- [ ] Config file exists
- [ ] JSON is valid
- [ ] Selectors are correct

## Success Criteria

✅ All 7 tasks completed
✅ All validation criteria passed
✅ Dev server starts successfully (`pnpm nx run docs-site:dev`)
✅ Build completes without errors (`pnpm nx run docs-site:build`)

## Next Spec

[Spec 02: Navigation & Layout](./02-navigation-layout.md)
