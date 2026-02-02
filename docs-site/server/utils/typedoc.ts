import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { NavigationItem } from '../../vike-types';

// ============================================================================
// Public API Types
// ============================================================================

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

// ============================================================================
// TypeDoc JSON Types (TypeDoc 2.0 schema)
// ============================================================================

interface TypeDocJson {
  schemaVersion: string;
  id: number;
  name: string;
  variant: string;
  kind: number;
  flags: Record<string, unknown>;
  comment?: TypeDocComment;
  children?: TypeDocReflection[];
}

interface TypeDocReflection {
  id: number;
  name: string;
  variant: string;
  kind: number;
  flags: TypeDocFlags;
  comment?: TypeDocComment;
  signatures?: TypeDocSignature[];
  children?: TypeDocReflection[];
  type?: TypeDocType;
  typeParameters?: TypeDocTypeParameter[];
  sources?: Array<{ fileName: string; line: number; character: number }>;
  extendedTypes?: TypeDocType[];
  implementedTypes?: TypeDocType[];
  inheritedFrom?: { type: string; target: number; name: string };
  overwrites?: { type: string; target: number; name: string };
  defaultValue?: string;
}

interface TypeDocFlags {
  isOptional?: boolean;
  isReadonly?: boolean;
  isPrivate?: boolean;
  isProtected?: boolean;
  isStatic?: boolean;
  isAbstract?: boolean;
}

interface TypeDocComment {
  summary?: Array<{ kind: string; text: string }>;
  blockTags?: Array<{
    tag: string;
    content: Array<{ kind: string; text: string }>;
  }>;
}

interface TypeDocSignature {
  id: number;
  name: string;
  variant: string;
  kind: number;
  flags: TypeDocFlags;
  comment?: TypeDocComment;
  parameters?: TypeDocParameter[];
  type?: TypeDocType;
  typeParameter?: TypeDocTypeParameter[];
}

interface TypeDocParameter {
  id: number;
  name: string;
  variant: string;
  kind: number;
  flags: TypeDocFlags;
  type?: TypeDocType;
  comment?: TypeDocComment;
  defaultValue?: string;
}

interface TypeDocTypeParameter {
  id: number;
  name: string;
  variant: string;
  kind: number;
  flags: TypeDocFlags;
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
  target?: number | TypeDocType;
  elementType?: TypeDocType;
  package?: string;
  qualifiedName?: string;
  operator?: string;
  objectType?: TypeDocType;
  indexType?: TypeDocType;
  checkType?: TypeDocType;
  extendsType?: TypeDocType;
  trueType?: TypeDocType;
  falseType?: TypeDocType;
}

// TypeDoc kind constants (from TypeDoc 2.0)
const KIND = {
  Project: 1,
  Module: 2,
  Namespace: 4,
  Enum: 8,
  EnumMember: 16,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  Method: 2048,
  CallSignature: 4096,
  IndexSignature: 8192,
  ConstructorSignature: 16384,
  Parameter: 32768,
  TypeLiteral: 65536,
  TypeParameter: 131072,
  Accessor: 262144,
  GetSignature: 524288,
  SetSignature: 1048576,
  TypeAlias: 2097152,
  Reference: 16777216,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

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
      return type.name || 'unknown';
    case 'reference': {
      let result = type.name || 'unknown';
      if (type.typeArguments && type.typeArguments.length > 0) {
        result += `<${type.typeArguments.map(typeToString).join(', ')}>`;
      }
      return result;
    }
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
        const sig = type.declaration.signatures[0];
        const params =
          sig.parameters?.map((p) => `${p.name}: ${typeToString(p.type)}`).join(', ') || '';
        return `(${params}) => ${typeToString(sig.type)}`;
      }
      if (type.declaration?.children) {
        const props = type.declaration.children
          .map((c) => `${c.name}: ${typeToString(c.type)}`)
          .join('; ');
        return `{ ${props} }`;
      }
      return '{ ... }';
    case 'indexedAccess':
      return `${typeToString(type.objectType)}[${typeToString(type.indexType)}]`;
    case 'conditional':
      return `${typeToString(type.checkType)} extends ${typeToString(type.extendsType)} ? ${typeToString(type.trueType)} : ${typeToString(type.falseType)}`;
    case 'mapped':
      return '{ [key: string]: ... }';
    case 'typeOperator':
      return `${type.operator || ''} ${typeToString(type.target as TypeDocType)}`;
    case 'query':
      return `typeof ${typeToString(type.target as TypeDocType)}`;
    case 'predicate':
      return 'boolean';
    case 'rest':
      return `...${typeToString(type.elementType)}`;
    case 'optional':
      return `${typeToString(type.elementType)}?`;
    case 'templateLiteral':
      return 'string';
    case 'namedTupleMember':
      return type.name || 'unknown';
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

// ============================================================================
// Parser Functions
// ============================================================================

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
    // Non-function: type alias, interface, class, etc.
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
        // Skip constructors and inherited members for cleaner output
        if (child.kind === KIND.Constructor) continue;
        if (child.inheritedFrom) continue;

        if (child.kind === KIND.Method || child.signatures) {
          // It's a method
          const methodSig = child.signatures?.[0];
          if (methodSig) {
            const methodParams =
              methodSig.parameters
                ?.map(
                  (p) =>
                    `${p.name}${p.flags?.isOptional ? '?' : ''}: ${typeToString(p.type)}`
                )
                .join(', ') || '';
            exp.methods.push({
              name: child.name,
              signature: `${child.name}(${methodParams}): ${typeToString(methodSig.type)}`,
              description: extractCommentText(methodSig.comment?.summary),
              parameters: methodSig.parameters?.map((p) => ({
                name: p.name,
                type: typeToString(p.type),
                description: extractCommentText(p.comment?.summary),
                optional: p.flags?.isOptional,
              })),
              returnType: typeToString(methodSig.type),
            });
          }
        } else if (child.kind === KIND.Property) {
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

    // Build signature for interfaces and classes
    if (
      reflection.kind === KIND.Interface ||
      reflection.kind === KIND.Class
    ) {
      const keyword =
        reflection.kind === KIND.Interface ? 'interface' : 'class';
      let typeParams = '';
      if (reflection.typeParameters && reflection.typeParameters.length > 0) {
        typeParams = `<${reflection.typeParameters.map((tp) => tp.name).join(', ')}>`;
      }
      exp.signature = `${keyword} ${reflection.name}${typeParams}`;

      // Add extends clause if present
      if (reflection.extendedTypes && reflection.extendedTypes.length > 0) {
        exp.signature += ` extends ${reflection.extendedTypes.map(typeToString).join(', ')}`;
      }
    }
  }

  return exp;
}

/**
 * Determine module name from source file path
 */
function getModuleFromSource(source?: string): string {
  if (!source) return 'core';

  // Match patterns like /types/, /utils/, /core/
  if (source.includes('/types/')) return 'types';
  if (source.includes('/utils/')) return 'utils';
  if (source.includes('/core/')) return 'core';

  return 'core';
}

export function parseTypedocJson(json: TypeDocJson): ApiDocs {
  const modules: Record<string, ApiModule> = {};
  const exports: Record<string, ApiExport> = {};
  const allExports: ApiExport[] = [];

  // Group exports by their source file path to determine module
  const moduleMap = new Map<string, TypeDocReflection[]>();

  function categorizeReflection(reflection: TypeDocReflection) {
    // Skip internal or private items
    if (reflection.name.startsWith('_')) return;
    if (reflection.flags.isPrivate || reflection.flags.isProtected) return;

    // Determine module from source file
    const source = reflection.sources?.[0]?.fileName;
    const moduleName = getModuleFromSource(source);

    if (!moduleMap.has(moduleName)) {
      moduleMap.set(moduleName, []);
    }
    moduleMap.get(moduleName)!.push(reflection);
  }

  // Process all top-level children
  if (json.children) {
    for (const child of json.children) {
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

// ============================================================================
// Loader Functions
// ============================================================================

let cachedApiDocs: ApiDocs | null = null;

/**
 * Get the workspace root directory (parent of docs-site)
 */
function getWorkspaceRoot(): string {
  // When running from docs-site, go up one level
  return path.resolve(process.cwd(), '..');
}

/**
 * Load and parse TypeDoc JSON, with caching.
 * Runs TypeDoc if JSON doesn't exist.
 */
export async function loadApiDocs(): Promise<ApiDocs> {
  if (cachedApiDocs) {
    return cachedApiDocs;
  }

  const workspaceRoot = getWorkspaceRoot();
  const jsonPath = path.join(workspaceRoot, '.typedoc', 'api.json');

  // Check if JSON exists, generate if not
  try {
    await fs.access(jsonPath);
  } catch {
    console.log('[typedoc] Generating API documentation...');
    try {
      execSync('npx typedoc', {
        cwd: path.join(workspaceRoot, 'packages', 'isolated-workers'),
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
