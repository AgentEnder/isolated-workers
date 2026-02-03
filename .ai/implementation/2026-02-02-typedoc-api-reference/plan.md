# TypeDoc API Reference Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate dynamic API reference documentation at `/api/*` from TypeDoc JSON output of the isolated-workers package.

**Architecture:** TypeDoc generates JSON from the package source on server start. A server utility parses this into structured `ApiModule` and `ApiExport` types. Vike pages consume this data from globalContext, rendering with custom React components.

**Tech Stack:** TypeDoc (JSON output), Vike, React, Shiki (syntax highlighting)

---

## Phase 1: TypeDoc Setup

### Task 1.1: Add TypeDoc Dependency

**Files:**
- Modify: `docs-site/package.json`

**Step 1: Add typedoc to devDependencies**

```bash
cd docs-site && pnpm add -D typedoc
```

**Step 2: Verify installation**

Run: `cd docs-site && pnpm list typedoc`
Expected: Shows typedoc version

**Step 3: Commit**

```bash
git add docs-site/package.json pnpm-lock.yaml
git commit -m "chore(docs-site): add typedoc dependency"
```

---

### Task 1.2: Create TypeDoc Configuration

**Files:**
- Create: `typedoc.json`
- Modify: `.gitignore`

**Step 1: Create typedoc.json at repo root**

```json
{
  "$schema": "https://typedoc.org/schema.json",
  "entryPoints": ["./packages/isolated-workers/src/index.ts"],
  "tsconfig": "./packages/isolated-workers/tsconfig.json",
  "json": "./.typedoc/api.json",
  "pretty": false,
  "excludePrivate": true,
  "excludeProtected": true,
  "excludeInternal": true,
  "disableSources": false,
  "includeVersion": false,
  "categorizeByGroup": false,
  "readme": "none"
}
```

**Step 2: Add .typedoc to .gitignore**

Append to `.gitignore`:
```
# TypeDoc output
.typedoc/
```

**Step 3: Test TypeDoc generation**

Run: `cd /Users/agentender/repos/isolated-workers && npx typedoc`
Expected: Creates `.typedoc/api.json` file

**Step 4: Verify JSON output structure**

Run: `head -100 .typedoc/api.json`
Expected: JSON with `name`, `children`, `kind` fields

**Step 5: Commit**

```bash
git add typedoc.json .gitignore
git commit -m "chore: add typedoc configuration"
```

---

## Phase 2: Server Utility for TypeDoc Parsing

### Task 2.1: Define API Types

**Files:**
- Create: `docs-site/server/utils/typedoc.ts`

**Step 1: Create type definitions**

```typescript
/**
 * Parsed API module (e.g., "core", "types", "utils")
 */
export interface ApiModule {
  name: string;
  slug: string;
  path: string;
  description?: string;
  exports: ApiExport[];
}

/**
 * Parsed API export (function, type, interface, etc.)
 */
export interface ApiExport {
  name: string;
  slug: string;
  path: string;
  module: string;
  kind: ApiExportKind;
  signature?: string;
  description?: string;
  comment?: ApiComment;
  parameters?: ApiParameter[];
  returnType?: string;
  typeParameters?: ApiTypeParameter[];
  properties?: ApiProperty[];
  methods?: ApiMethod[];
}

export type ApiExportKind =
  | 'function'
  | 'type'
  | 'interface'
  | 'class'
  | 'variable'
  | 'enum';

export interface ApiComment {
  summary?: string;
  remarks?: string;
  examples?: string[];
  see?: string[];
  deprecated?: string;
}

export interface ApiParameter {
  name: string;
  type: string;
  description?: string;
  optional?: boolean;
  defaultValue?: string;
}

export interface ApiTypeParameter {
  name: string;
  constraint?: string;
  default?: string;
}

export interface ApiProperty {
  name: string;
  type: string;
  description?: string;
  optional?: boolean;
  readonly?: boolean;
}

export interface ApiMethod {
  name: string;
  signature: string;
  description?: string;
  parameters?: ApiParameter[];
  returnType?: string;
}

/**
 * Full API documentation structure
 */
export interface ApiDocs {
  modules: Record<string, ApiModule>;
  exports: Record<string, ApiExport>;
  allExports: ApiExport[];
}
```

**Step 2: Commit types**

```bash
git add docs-site/server/utils/typedoc.ts
git commit -m "feat(docs-site): add API documentation type definitions"
```

---

### Task 2.2: Implement TypeDoc JSON Parser

**Files:**
- Modify: `docs-site/server/utils/typedoc.ts`

**Step 1: Add TypeDoc JSON type definitions**

Add after the existing types:

```typescript
// TypeDoc JSON structure (simplified - only fields we use)
interface TypeDocJson {
  name: string;
  children?: TypeDocReflection[];
}

interface TypeDocReflection {
  id: number;
  name: string;
  kind: number;
  kindString?: string;
  comment?: TypeDocComment;
  signatures?: TypeDocSignature[];
  children?: TypeDocReflection[];
  type?: TypeDocType;
  typeParameters?: TypeDocTypeParameter[];
  sources?: Array<{ fileName: string; line: number }>;
}

interface TypeDocComment {
  summary?: Array<{ kind: string; text: string }>;
  blockTags?: Array<{
    tag: string;
    content: Array<{ kind: string; text: string }>;
  }>;
}

interface TypeDocSignature {
  name: string;
  kind: number;
  comment?: TypeDocComment;
  parameters?: TypeDocParameter[];
  type?: TypeDocType;
  typeParameter?: TypeDocTypeParameter[];
}

interface TypeDocParameter {
  name: string;
  type?: TypeDocType;
  comment?: TypeDocComment;
  flags?: { isOptional?: boolean };
  defaultValue?: string;
}

interface TypeDocTypeParameter {
  name: string;
  type?: TypeDocType;
  default?: TypeDocType;
}

interface TypeDocType {
  type: string;
  name?: string;
  value?: unknown;
  types?: TypeDocType[];
  declaration?: TypeDocReflection;
  typeArguments?: TypeDocType[];
  target?: TypeDocType;
  elementType?: TypeDocType;
}

// TypeDoc kind constants
const KIND = {
  Module: 2,
  Namespace: 4,
  Enum: 8,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  TypeAlias: 2097152,
  Reference: 16777216,
} as const;
```

**Step 2: Add helper functions**

```typescript
function slugify(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');
}

function extractCommentText(
  parts?: Array<{ kind: string; text: string }>
): string | undefined {
  if (!parts || parts.length === 0) return undefined;
  return parts.map((p) => p.text).join('').trim() || undefined;
}

function parseComment(comment?: TypeDocComment): ApiComment | undefined {
  if (!comment) return undefined;

  const result: ApiComment = {};

  if (comment.summary) {
    result.summary = extractCommentText(comment.summary);
  }

  if (comment.blockTags) {
    for (const tag of comment.blockTags) {
      const text = extractCommentText(tag.content);
      switch (tag.tag) {
        case '@remarks':
          result.remarks = text;
          break;
        case '@example':
          result.examples = result.examples || [];
          if (text) result.examples.push(text);
          break;
        case '@see':
          result.see = result.see || [];
          if (text) result.see.push(text);
          break;
        case '@deprecated':
          result.deprecated = text || 'Deprecated';
          break;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function typeToString(type?: TypeDocType): string {
  if (!type) return 'unknown';

  switch (type.type) {
    case 'intrinsic':
    case 'reference':
      return type.name || 'unknown';
    case 'literal':
      return JSON.stringify(type.value);
    case 'union':
      return type.types?.map(typeToString).join(' | ') || 'unknown';
    case 'intersection':
      return type.types?.map(typeToString).join(' & ') || 'unknown';
    case 'array':
      return `${typeToString(type.elementType)}[]`;
    case 'tuple':
      return `[${type.types?.map(typeToString).join(', ') || ''}]`;
    case 'reflection':
      if (type.declaration?.signatures) {
        return '(function)';
      }
      return '{ ... }';
    default:
      return type.name || 'unknown';
  }
}

function kindToApiKind(kind: number): ApiExportKind {
  switch (kind) {
    case KIND.Function:
      return 'function';
    case KIND.Class:
      return 'class';
    case KIND.Interface:
      return 'interface';
    case KIND.TypeAlias:
      return 'type';
    case KIND.Enum:
      return 'enum';
    case KIND.Variable:
      return 'variable';
    default:
      return 'variable';
  }
}
```

**Step 3: Commit helpers**

```bash
git add docs-site/server/utils/typedoc.ts
git commit -m "feat(docs-site): add TypeDoc JSON parsing helpers"
```

---

### Task 2.3: Implement Main Parser Function

**Files:**
- Modify: `docs-site/server/utils/typedoc.ts`

**Step 1: Add parseExport function**

```typescript
function parseExport(
  reflection: TypeDocReflection,
  moduleName: string
): ApiExport | null {
  const kind = kindToApiKind(reflection.kind);
  const slug = slugify(reflection.name);
  const moduleSlug = slugify(moduleName);

  const exp: ApiExport = {
    name: reflection.name,
    slug,
    path: `/api/${moduleSlug}/${slug}`,
    module: moduleName,
    kind,
  };

  // Parse function signatures
  if (reflection.signatures && reflection.signatures.length > 0) {
    const sig = reflection.signatures[0];
    exp.comment = parseComment(sig.comment);
    exp.description = exp.comment?.summary;

    // Parse parameters
    if (sig.parameters) {
      exp.parameters = sig.parameters.map((p) => ({
        name: p.name,
        type: typeToString(p.type),
        description: extractCommentText(p.comment?.summary),
        optional: p.flags?.isOptional,
        defaultValue: p.defaultValue,
      }));
    }

    // Parse return type
    if (sig.type) {
      exp.returnType = typeToString(sig.type);
    }

    // Parse type parameters
    if (sig.typeParameter) {
      exp.typeParameters = sig.typeParameter.map((tp) => ({
        name: tp.name,
        constraint: tp.type ? typeToString(tp.type) : undefined,
        default: tp.default ? typeToString(tp.default) : undefined,
      }));
    }

    // Build signature string
    const typeParams = exp.typeParameters
      ? `<${exp.typeParameters.map((tp) => tp.name).join(', ')}>`
      : '';
    const params = exp.parameters
      ? exp.parameters
          .map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
          .join(', ')
      : '';
    exp.signature = `function ${reflection.name}${typeParams}(${params}): ${exp.returnType || 'void'}`;
  } else {
    // Non-function: type alias, interface, etc.
    exp.comment = parseComment(reflection.comment);
    exp.description = exp.comment?.summary;

    if (reflection.type) {
      exp.signature = `type ${reflection.name} = ${typeToString(reflection.type)}`;
    }

    // Parse interface/class children (properties, methods)
    if (reflection.children) {
      exp.properties = [];
      exp.methods = [];

      for (const child of reflection.children) {
        if (child.kind === KIND.Function || child.signatures) {
          // It's a method
          const methodSig = child.signatures?.[0];
          if (methodSig) {
            exp.methods.push({
              name: child.name,
              signature: `${child.name}(): ${typeToString(methodSig.type)}`,
              description: extractCommentText(methodSig.comment?.summary),
              returnType: typeToString(methodSig.type),
            });
          }
        } else {
          // It's a property
          exp.properties.push({
            name: child.name,
            type: typeToString(child.type),
            description: extractCommentText(child.comment?.summary),
            optional: child.flags?.isOptional,
            readonly: child.flags?.isReadonly,
          });
        }
      }

      if (exp.properties.length === 0) delete exp.properties;
      if (exp.methods.length === 0) delete exp.methods;
    }
  }

  return exp;
}
```

**Step 2: Add main parseTypedocJson function**

```typescript
export function parseTypedocJson(json: TypeDocJson): ApiDocs {
  const modules: Record<string, ApiModule> = {};
  const exports: Record<string, ApiExport> = {};
  const allExports: ApiExport[] = [];

  // Group exports by their source file path to determine module
  const moduleMap = new Map<string, TypeDocReflection[]>();

  function categorizeReflection(reflection: TypeDocReflection) {
    // Determine module from source file
    let moduleName = 'core';
    const source = reflection.sources?.[0]?.fileName;
    if (source) {
      if (source.includes('/types/')) moduleName = 'types';
      else if (source.includes('/utils/')) moduleName = 'utils';
      else if (source.includes('/core/')) moduleName = 'core';
    }

    if (!moduleMap.has(moduleName)) {
      moduleMap.set(moduleName, []);
    }
    moduleMap.get(moduleName)!.push(reflection);
  }

  // Process all top-level children
  if (json.children) {
    for (const child of json.children) {
      // Skip internal or private
      if (child.name.startsWith('_')) continue;

      categorizeReflection(child);
    }
  }

  // Build modules and exports
  for (const [moduleName, reflections] of moduleMap) {
    const moduleSlug = slugify(moduleName);
    const moduleExports: ApiExport[] = [];

    for (const reflection of reflections) {
      const exp = parseExport(reflection, moduleName);
      if (exp) {
        moduleExports.push(exp);
        exports[`${moduleSlug}/${exp.slug}`] = exp;
        allExports.push(exp);
      }
    }

    // Sort exports alphabetically
    moduleExports.sort((a, b) => a.name.localeCompare(b.name));

    modules[moduleSlug] = {
      name: moduleName,
      slug: moduleSlug,
      path: `/api/${moduleSlug}`,
      exports: moduleExports,
    };
  }

  return { modules, exports, allExports };
}
```

**Step 3: Commit parser**

```bash
git add docs-site/server/utils/typedoc.ts
git commit -m "feat(docs-site): implement TypeDoc JSON parser"
```

---

### Task 2.4: Add TypeDoc Loading Function

**Files:**
- Modify: `docs-site/server/utils/typedoc.ts`

**Step 1: Add imports and loader at top of file**

```typescript
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
```

**Step 2: Add loadApiDocs function at end of file**

```typescript
let cachedApiDocs: ApiDocs | null = null;

/**
 * Load and parse TypeDoc JSON, with caching.
 * Runs TypeDoc if JSON doesn't exist.
 */
export async function loadApiDocs(): Promise<ApiDocs> {
  if (cachedApiDocs) {
    return cachedApiDocs;
  }

  const workspaceRoot = path.resolve(process.cwd(), '..');
  const jsonPath = path.join(workspaceRoot, '.typedoc', 'api.json');

  // Check if JSON exists, generate if not
  try {
    await fs.access(jsonPath);
  } catch {
    console.log('[typedoc] Generating API documentation...');
    try {
      execSync('npx typedoc', {
        cwd: workspaceRoot,
        stdio: 'inherit',
      });
    } catch (err) {
      console.error('[typedoc] Failed to generate documentation:', err);
      return { modules: {}, exports: {}, allExports: [] };
    }
  }

  // Read and parse JSON
  try {
    const jsonContent = await fs.readFile(jsonPath, 'utf-8');
    const json = JSON.parse(jsonContent) as TypeDocJson;
    cachedApiDocs = parseTypedocJson(json);
    console.log(
      `[typedoc] Loaded ${cachedApiDocs.allExports.length} exports from ${Object.keys(cachedApiDocs.modules).length} modules`
    );
    return cachedApiDocs;
  } catch (err) {
    console.error('[typedoc] Failed to parse documentation:', err);
    return { modules: {}, exports: {}, allExports: [] };
  }
}

/**
 * Build navigation items from API docs
 */
export function buildApiNavigation(api: ApiDocs): NavigationItem {
  const children: NavigationItem[] = [];

  // Sort modules: core first, then alphabetically
  const sortedModules = Object.values(api.modules).sort((a, b) => {
    if (a.slug === 'core') return -1;
    if (b.slug === 'core') return 1;
    return a.name.localeCompare(b.name);
  });

  for (const mod of sortedModules) {
    children.push({
      title: mod.name.charAt(0).toUpperCase() + mod.name.slice(1),
      path: mod.path,
      children: mod.exports.map((exp) => ({
        title: exp.name,
        path: exp.path,
      })),
    });
  }

  return {
    title: 'API Reference',
    path: '/api',
    children,
    order: 200,
  };
}
```

**Step 3: Add NavigationItem import**

Add at top of file:
```typescript
import type { NavigationItem } from '../../vike-types';
```

**Step 4: Commit loader**

```bash
git add docs-site/server/utils/typedoc.ts
git commit -m "feat(docs-site): add TypeDoc loader and navigation builder"
```

---

## Phase 3: GlobalContext Integration

### Task 3.1: Add API Types to Vike Types

**Files:**
- Modify: `docs-site/vike-types.d.ts`

**Step 1: Import and add API types**

```typescript
import { type DocMetadata } from './server/utils/docs';
import { type ExampleMetadata } from './server/utils/examples';
import { type ApiDocs } from './server/utils/typedoc';

export interface NavigationItem {
  title: string;
  path?: string;
  children?: NavigationItem[];
  order?: number;
}

declare global {
  namespace Vike {
    interface GlobalContext {
      examples: Record<string, ExampleMetadata>;
      docs: Record<string, DocMetadata>;
      api: ApiDocs;
      navigation: NavigationItem[];
    }
  }
}

export { NavigationItem };
```

**Step 2: Commit**

```bash
git add docs-site/vike-types.d.ts
git commit -m "feat(docs-site): add API docs to GlobalContext types"
```

---

### Task 3.2: Load API Docs in GlobalContext

**Files:**
- Modify: `docs-site/pages/+onCreateGlobalContext.server.ts`

**Step 1: Add imports**

```typescript
import { loadApiDocs, buildApiNavigation } from '../server/utils/typedoc';
```

**Step 2: Load API docs and replace static API Reference**

Update the `onCreateGlobalContext` function:

```typescript
export async function onCreateGlobalContext(
  context: Partial<GlobalContextServer>
): Promise<void> {
  const examples = await scanExamples();
  const docsDir = await getDocsDir();
  const docs = await scanDocs(docsDir);
  const docsNavigation = buildDocsNavigation(docs);
  const api = await loadApiDocs();

  const navigation: NavigationItem[] = combineNavigationItems([
    // Dynamic docs navigation (from frontmatter)
    ...docsNavigation,
    // Static sections
    {
      title: 'Getting Started',
      children: [],
      path: '/docs/getting-started',
      order: 0,
    },
    {
      title: 'Concepts',
      children: [],
      path: '/docs/concepts',
      order: 10,
    },
    {
      title: 'Guides',
      children: [],
      path: '/docs/guides',
      order: 20,
    },
    {
      title: 'Examples',
      path: '/examples',
      children: examples
        .filter((ex) => !ex.hidden)
        .map((ex) => ({
          title: ex.title,
          path: `/examples/${ex.id}`,
        })),
      order: 100,
    },
    // Dynamic API navigation from TypeDoc
    buildApiNavigation(api),
  ]);

  context.examples = Object.fromEntries(examples.map((ex) => [ex.id, ex]));
  context.docs = docs;
  context.api = api;
  context.navigation = sortNavigationItems(navigation);
}
```

**Step 3: Commit**

```bash
git add docs-site/pages/+onCreateGlobalContext.server.ts
git commit -m "feat(docs-site): integrate TypeDoc API docs into globalContext"
```

---

## Phase 4: Vike Pages for API Routes

### Task 4.1: Create API Route Handler

**Files:**
- Create: `docs-site/pages/api/+route.ts`

**Step 1: Create route file**

```typescript
import { PageContext } from 'vike/types';

export function route(pageContext: PageContext) {
  const { urlPathname } = pageContext;

  // Match /api, /api/:module, /api/:module/:export
  if (urlPathname === '/api' || urlPathname.startsWith('/api/')) {
    return true;
  }

  return false;
}
```

**Step 2: Commit**

```bash
git add docs-site/pages/api/+route.ts
git commit -m "feat(docs-site): add API route handler"
```

---

### Task 4.2: Create API Data Loader

**Files:**
- Create: `docs-site/pages/api/+data.ts`

**Step 1: Create data file**

```typescript
import type { PageContextServer } from 'vike/types';
import type { ApiDocs, ApiExport, ApiModule } from '../../server/utils/typedoc';

export type ApiPageType = 'landing' | 'module' | 'export';

export interface ApiDataLanding {
  type: 'landing';
  modules: ApiModule[];
}

export interface ApiDataModule {
  type: 'module';
  module: ApiModule;
}

export interface ApiDataExport {
  type: 'export';
  export: ApiExport;
  module: ApiModule;
}

export type ApiData = ApiDataLanding | ApiDataModule | ApiDataExport | { type: 'not-found' };

export async function data(pageContext: PageContextServer): Promise<ApiData> {
  const { api } = pageContext.globalContext;
  const { urlPathname } = pageContext;

  // Parse URL: /api, /api/:module, /api/:module/:export
  const parts = urlPathname.split('/').filter(Boolean);
  // parts[0] = 'api', parts[1] = module?, parts[2] = export?

  const moduleSlug = parts[1];
  const exportSlug = parts[2];

  // Landing page: /api
  if (!moduleSlug) {
    return {
      type: 'landing',
      modules: Object.values(api.modules).sort((a, b) => {
        if (a.slug === 'core') return -1;
        if (b.slug === 'core') return 1;
        return a.name.localeCompare(b.name);
      }),
    };
  }

  const module = api.modules[moduleSlug];
  if (!module) {
    return { type: 'not-found' };
  }

  // Module page: /api/:module
  if (!exportSlug) {
    return {
      type: 'module',
      module,
    };
  }

  // Export page: /api/:module/:export
  const exp = api.exports[`${moduleSlug}/${exportSlug}`];
  if (!exp) {
    return { type: 'not-found' };
  }

  return {
    type: 'export',
    export: exp,
    module,
  };
}
```

**Step 2: Commit**

```bash
git add docs-site/pages/api/+data.ts
git commit -m "feat(docs-site): add API data loader"
```

---

### Task 4.3: Create API Page Component

**Files:**
- Create: `docs-site/pages/api/+Page.tsx`

**Step 1: Create page component**

```typescript
import { useData } from 'vike-react/useData';
import { Link } from '../../components/Link';
import type { ApiData } from './+data';
import { ApiLanding } from './components/ApiLanding';
import { ApiModulePage } from './components/ApiModule';
import { ApiExportPage } from './components/ApiExport';

export default function Page() {
  const data = useData<ApiData>();

  if (data.type === 'not-found') {
    return (
      <div className="text-center py-20">
        <h1 className="text-4xl font-bold text-gray-100 mb-4">
          API Reference Not Found
        </h1>
        <p className="text-gray-400 mb-8">
          The API documentation page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/api"
          className="px-6 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30"
        >
          Back to API Reference
        </Link>
      </div>
    );
  }

  switch (data.type) {
    case 'landing':
      return <ApiLanding modules={data.modules} />;
    case 'module':
      return <ApiModulePage module={data.module} />;
    case 'export':
      return <ApiExportPage export={data.export} module={data.module} />;
  }
}
```

**Step 2: Commit**

```bash
git add docs-site/pages/api/+Page.tsx
git commit -m "feat(docs-site): add API page component"
```

---

### Task 4.4: Create Prerender Start Hook

**Files:**
- Create: `docs-site/pages/api/+onBeforePrerenderStart.ts`

**Step 1: Create prerender hook**

```typescript
import type { OnBeforePrerenderStartAsync } from 'vike/types';
import { loadApiDocs } from '../../server/utils/typedoc';

export const onBeforePrerenderStart: OnBeforePrerenderStartAsync = async () => {
  const api = await loadApiDocs();

  const urls: string[] = ['/api'];

  // Add module pages
  for (const module of Object.values(api.modules)) {
    urls.push(module.path);

    // Add export pages
    for (const exp of module.exports) {
      urls.push(exp.path);
    }
  }

  return urls;
};
```

**Step 2: Commit**

```bash
git add docs-site/pages/api/+onBeforePrerenderStart.ts
git commit -m "feat(docs-site): add API prerender hook"
```

---

## Phase 5: React Components

### Task 5.1: Create API Landing Component

**Files:**
- Create: `docs-site/pages/api/components/ApiLanding.tsx`

**Step 1: Create component**

```typescript
import { Link } from '../../../components/Link';
import type { ApiModule } from '../../../server/utils/typedoc';

interface ApiLandingProps {
  modules: ApiModule[];
}

export function ApiLanding({ modules }: ApiLandingProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-100 mb-4">API Reference</h1>
        <p className="text-gray-400 text-lg">
          Complete API documentation for the isolated-workers library.
        </p>
      </div>

      {/* Module Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <Link
            key={mod.slug}
            href={mod.path}
            className="block p-6 rounded-xl bg-tertiary/50 border border-tertiary/50 hover:border-neon-cyan/50 transition-all group"
          >
            <h2 className="text-xl font-semibold text-gray-100 group-hover:text-neon-cyan transition-colors mb-2">
              {mod.name.charAt(0).toUpperCase() + mod.name.slice(1)}
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              {mod.description || `${mod.exports.length} exports`}
            </p>
            <div className="flex flex-wrap gap-2">
              {mod.exports.slice(0, 5).map((exp) => (
                <span
                  key={exp.name}
                  className="text-xs px-2 py-1 rounded bg-secondary/50 text-gray-300"
                >
                  {exp.name}
                </span>
              ))}
              {mod.exports.length > 5 && (
                <span className="text-xs px-2 py-1 rounded bg-secondary/50 text-gray-400">
                  +{mod.exports.length - 5} more
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add docs-site/pages/api/components/ApiLanding.tsx
git commit -m "feat(docs-site): add API landing component"
```

---

### Task 5.2: Create API Module Component

**Files:**
- Create: `docs-site/pages/api/components/ApiModule.tsx`

**Step 1: Create component**

```typescript
import { Link } from '../../../components/Link';
import type { ApiModule, ApiExportKind } from '../../../server/utils/typedoc';

interface ApiModulePageProps {
  module: ApiModule;
}

const KIND_ICONS: Record<ApiExportKind, string> = {
  function: 'ƒ',
  type: 'T',
  interface: 'I',
  class: 'C',
  variable: 'V',
  enum: 'E',
};

const KIND_COLORS: Record<ApiExportKind, string> = {
  function: 'text-neon-cyan',
  type: 'text-neon-purple',
  interface: 'text-neon-green',
  class: 'text-neon-orange',
  variable: 'text-neon-yellow',
  enum: 'text-neon-pink',
};

export function ApiModulePage({ module }: ApiModulePageProps) {
  // Group exports by kind
  const grouped = module.exports.reduce(
    (acc, exp) => {
      if (!acc[exp.kind]) acc[exp.kind] = [];
      acc[exp.kind].push(exp);
      return acc;
    },
    {} as Record<ApiExportKind, typeof module.exports>
  );

  const kindOrder: ApiExportKind[] = [
    'function',
    'class',
    'interface',
    'type',
    'enum',
    'variable',
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/api" className="hover:text-neon-cyan">
          API Reference
        </Link>
        <span>/</span>
        <span className="text-gray-100">
          {module.name.charAt(0).toUpperCase() + module.name.slice(1)}
        </span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-100 mb-4">
          {module.name.charAt(0).toUpperCase() + module.name.slice(1)}
        </h1>
        {module.description && (
          <p className="text-gray-400 text-lg">{module.description}</p>
        )}
      </div>

      {/* Grouped Exports */}
      <div className="space-y-8">
        {kindOrder.map((kind) => {
          const exports = grouped[kind];
          if (!exports || exports.length === 0) return null;

          return (
            <div key={kind}>
              <h2 className="text-lg font-semibold text-gray-200 mb-4 capitalize">
                {kind === 'type' ? 'Types' : `${kind}s`}
              </h2>
              <div className="space-y-2">
                {exports.map((exp) => (
                  <Link
                    key={exp.name}
                    href={exp.path}
                    className="flex items-center gap-3 p-3 rounded-lg bg-tertiary/30 hover:bg-tertiary/50 border border-transparent hover:border-neon-cyan/30 transition-all group"
                  >
                    <span
                      className={`w-6 h-6 flex items-center justify-center rounded text-sm font-mono font-bold ${KIND_COLORS[exp.kind]}`}
                    >
                      {KIND_ICONS[exp.kind]}
                    </span>
                    <span className="font-mono text-gray-100 group-hover:text-neon-cyan transition-colors">
                      {exp.name}
                    </span>
                    {exp.description && (
                      <span className="text-gray-500 text-sm truncate">
                        — {exp.description}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add docs-site/pages/api/components/ApiModule.tsx
git commit -m "feat(docs-site): add API module component"
```

---

### Task 5.3: Create API Export Component

**Files:**
- Create: `docs-site/pages/api/components/ApiExport.tsx`

**Step 1: Create component**

```typescript
import { Link } from '../../../components/Link';
import { CodeBlock } from '../../../components/CodeBlock';
import type { ApiExport, ApiModule } from '../../../server/utils/typedoc';

interface ApiExportPageProps {
  export: ApiExport;
  module: ApiModule;
}

export function ApiExportPage({ export: exp, module }: ApiExportPageProps) {
  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/api" className="hover:text-neon-cyan">
          API Reference
        </Link>
        <span>/</span>
        <Link href={module.path} className="hover:text-neon-cyan">
          {module.name.charAt(0).toUpperCase() + module.name.slice(1)}
        </Link>
        <span>/</span>
        <span className="text-gray-100">{exp.name}</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs px-2 py-1 rounded bg-neon-cyan/20 text-neon-cyan uppercase font-semibold">
            {exp.kind}
          </span>
          {exp.comment?.deprecated && (
            <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 uppercase font-semibold">
              Deprecated
            </span>
          )}
        </div>
        <h1 className="text-4xl font-bold text-gray-100 font-mono">{exp.name}</h1>
      </div>

      {/* Signature */}
      {exp.signature && (
        <div className="mb-8">
          <CodeBlock code={exp.signature} language="typescript" />
        </div>
      )}

      {/* Description */}
      {exp.description && (
        <div className="mb-8">
          <p className="text-gray-300 text-lg">{exp.description}</p>
        </div>
      )}

      {/* Deprecation Warning */}
      {exp.comment?.deprecated && (
        <div className="mb-8 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-red-400">
            <strong>Deprecated:</strong> {exp.comment.deprecated}
          </p>
        </div>
      )}

      {/* Parameters */}
      {exp.parameters && exp.parameters.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Parameters</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-tertiary">
                  <th className="py-2 pr-4 text-gray-400 font-medium">Name</th>
                  <th className="py-2 pr-4 text-gray-400 font-medium">Type</th>
                  <th className="py-2 text-gray-400 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {exp.parameters.map((param) => (
                  <tr key={param.name} className="border-b border-tertiary/50">
                    <td className="py-3 pr-4 font-mono text-neon-cyan">
                      {param.name}
                      {param.optional && (
                        <span className="text-gray-500">?</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-gray-300">
                      {param.type}
                    </td>
                    <td className="py-3 text-gray-400">
                      {param.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Return Type */}
      {exp.returnType && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Returns</h2>
          <p className="font-mono text-gray-300">{exp.returnType}</p>
        </div>
      )}

      {/* Properties */}
      {exp.properties && exp.properties.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Properties</h2>
          <div className="space-y-4">
            {exp.properties.map((prop) => (
              <div
                key={prop.name}
                className="p-4 rounded-lg bg-tertiary/30 border border-tertiary/50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-neon-cyan">{prop.name}</span>
                  {prop.optional && (
                    <span className="text-xs text-gray-500">(optional)</span>
                  )}
                  {prop.readonly && (
                    <span className="text-xs text-gray-500">(readonly)</span>
                  )}
                </div>
                <p className="font-mono text-sm text-gray-400 mb-2">
                  {prop.type}
                </p>
                {prop.description && (
                  <p className="text-gray-300 text-sm">{prop.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remarks */}
      {exp.comment?.remarks && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Remarks</h2>
          <p className="text-gray-300">{exp.comment.remarks}</p>
        </div>
      )}

      {/* Examples */}
      {exp.comment?.examples && exp.comment.examples.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Examples</h2>
          <div className="space-y-4">
            {exp.comment.examples.map((example, i) => (
              <CodeBlock key={i} code={example} language="typescript" />
            ))}
          </div>
        </div>
      )}

      {/* See Also */}
      {exp.comment?.see && exp.comment.see.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">See Also</h2>
          <ul className="list-disc list-inside text-gray-300">
            {exp.comment.see.map((ref, i) => (
              <li key={i}>{ref}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-12 pt-8 border-t border-tertiary/50">
        <Link
          href={module.path}
          className="text-neon-cyan hover:text-neon-purple transition-colors"
        >
          &larr; Back to {module.name.charAt(0).toUpperCase() + module.name.slice(1)}
        </Link>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add docs-site/pages/api/components/ApiExport.tsx
git commit -m "feat(docs-site): add API export component"
```

---

## Phase 6: Final Integration & Testing

### Task 6.1: Test the Implementation

**Step 1: Generate TypeDoc JSON**

Run: `cd /Users/agentender/repos/isolated-workers && npx typedoc`
Expected: `.typedoc/api.json` created

**Step 2: Start dev server**

Run: `cd /Users/agentender/repos/isolated-workers/docs-site && pnpm dev`
Expected: Server starts, logs show API docs loaded

**Step 3: Test routes manually**

- Visit `http://localhost:3000/api` - should show module grid
- Visit `http://localhost:3000/api/core` - should show core module exports
- Visit `http://localhost:3000/api/core/create-worker` - should show createWorker docs (if available)

**Step 4: Run lint**

Run: `pnpm nx lint docs-site`
Expected: No errors

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(docs-site): complete TypeDoc API reference integration"
```

---

## Success Criteria

- [ ] TypeDoc generates JSON from isolated-workers source
- [ ] `/api` shows all modules with descriptions
- [ ] `/api/:module` shows module overview + hierarchical export list
- [ ] `/api/:module/:export` shows full export documentation
- [ ] Navigation sidebar dynamically populated from TypeDoc
- [ ] JSDoc examples render as code blocks
- [ ] All lint checks pass
