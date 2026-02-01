# Spec 06: Build & Deployment

## Overview

Configure the build process, Pagefind integration, and deployment setup for the documentation site.

## Dependencies

- [Spec 05: Content Integration](./05-content-integration.md) must be complete

## Tasks

### Task 6.1: Configure Nx Targets

**Action**: Register docs-site in Nx workspace configuration

**Nx Config Updates**:
Update `nx.json`:

```json
{
  "projects": {
    "docs-site": {
      "root": "docs",
      "sourceRoot": "docs",
      "projectType": "application",
      "implicitDependencies": ["isolated-workers"],
      "targets": {
        "build": {
          "executor": "@nx/vite:build",
          "options": {
            "configFile": "docs/vite.config.ts"
          },
          "outputs": ["{projectRoot}/dist"]
        },
        "dev": {
          "executor": "@nx/vite:dev-server",
          "options": {
            "configFile": "docs/vite.config.ts"
          }
        },
        "preview": {
          "executor": "@nx/vite:preview-server",
          "options": {
            "configFile": "docs/vite.config.ts"
          }
        }
      }
    }
  }
}
```

**Validation**:

- [ ] `nx show project docs-site` works
- [ ] `pnpm nx run docs-site:build` exists
- [ ] `pnpm nx run docs-site:dev` exists
- [ ] `pnpm nx run docs-site:preview` exists
- [ ] Implicit dependencies configured

### Task 6.2: Set Up Pagefind Configuration

**Action**: Create Pagefind config for search indexing

**Config File**: `docs/pagefind.json`

```json
{
  "rootSelector": "main",
  "glob": "**/*.{html,md}",
  "excludeSelectors": ["[data-pagefind-ignore]", ".pagefind-ui"]
}
```

**Configuration Details**:

- `rootSelector`: Main content area
- `glob`: Index all HTML and markdown files
- `excludeSelectors`: Ignore navigation, UI elements
- Index generated during build via Vite plugin

**Validation**:

- [ ] Config file exists
- [ ] JSON is valid
- [ ] Selectors are correct

### Task 6.3: Test Build Process

**Action**: Run build and verify all steps complete

**Build Steps**:

1. Run `pnpm nx run docs-site:build`
2. Verify Vite builds pages to `docs/dist/`
3. Verify Pagefind plugin runs automatically
4. Check Pagefind generates search files in `docs/dist/pagefind/`
5. Verify no build errors

**Build Output**:

```
docs/dist/
├── index.html
├── getting-started/
├── guides/
├── examples/
├── api/
└── pagefind/
    ├── pagefind-ui.js
    ├── pagefind-ui.css
    └── pagefind.pfjs
```

**Validation**:

- [ ] Build completes without errors
- [ ] All pages generated
- [ ] Pagefind runs successfully
- [ ] Search files created
- [ ] Output structure correct

### Task 6.4: Verify Pagefind Indexing

**Action**: Test that search functionality works

**Testing Steps**:

1. Start preview: `pnpm nx run docs-site:preview`
2. Open browser to preview URL
3. Type search query
4. Verify results appear
5. Click result and verify navigation

**Search Functionality**:

- Search input available on all pages
- Results show matching pages
- Excerpts display correctly
- Links navigate to correct pages
- Mobile responsive

**Validation**:

- [ ] Search UI displays
- [ ] Pagefind loads successfully
- [ ] Search returns results
- [ ] Results are relevant
- [ ] Clicking result navigates correctly

### Task 6.5: Configure Preview Server

**Action**: Set up local preview for development

**Preview Configuration**:

- Base URL: `/`
- Port: Auto-assigned by Vite
- Hot module replacement enabled
- Open browser automatically

**Usage**:

```bash
# Development with HMR
pnpm nx run docs-site:dev

# Production preview
pnpm nx run docs-site:preview

# Build for deployment
pnpm nx run docs-site:build
```

**Validation**:

- [ ] Dev server starts without errors
- [ ] HMR works for file changes
- [ ] Preview server serves build output
- [ ] All pages accessible

## Success Criteria

✅ All 5 tasks completed
✅ Build completes without errors
✅ Pagefind generates search index
✅ Preview server starts correctly
✅ Site loads in browser
✅ Search is functional
✅ All pages accessible

## Completion

All 6 specifications complete! The documentation site is ready for:

- Development with hot reload
- Production builds
- Static deployment
- Search functionality

## Deployment Notes

After completing this spec, the site can be deployed to:

- **Vercel**: Deploy `docs/dist/` as static site
- **Netlify**: Deploy with `docs/dist/` as publish directory
- **GitHub Pages**: Push to `gh-pages` branch
- **Cloudflare Pages**: Deploy from `docs/dist/`

The Pagefind search index is included in the build output, so no additional steps are needed.
