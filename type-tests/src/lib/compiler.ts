/**
 * TypeScript compiler utilities for type testing
 *
 * These utilities enable analyzing TypeScript fixture files
 * to verify type behavior programmatically.
 */

import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine project root - works from both src/ and dist/ directories
function findProjectRoot(): string {
  // First try based on __dirname
  let currentDir = __dirname;

  // Walk up to find the project root (contains packages/isolated-workers)
  for (let i = 0; i < 6; i++) {
    const potentialRoot = path.resolve(currentDir, '../'.repeat(i));
    const checkPath = path.join(potentialRoot, 'packages/isolated-workers');
    if (fs.existsSync(checkPath)) {
      return potentialRoot;
    }
  }

  // Fallback to process.cwd() if __dirname approach fails
  currentDir = process.cwd();
  for (let i = 0; i < 3; i++) {
    const potentialRoot = path.resolve(currentDir, '../'.repeat(i));
    const checkPath = path.join(potentialRoot, 'packages/isolated-workers');
    if (fs.existsSync(checkPath)) {
      return potentialRoot;
    }
  }

  throw new Error('Could not find project root with packages/isolated-workers');
}

const projectRoot = findProjectRoot();

// Resolve paths to isolated-workers package
const isolatedWorkersRoot = path.join(
  projectRoot,
  'packages/isolated-workers/dist'
);
const isolatedWorkersIndex = path.join(isolatedWorkersRoot, 'index.d.ts');

/**
 * Load and analyze a fixture file
 *
 * @param fixturePath - Path to the fixture file (relative to src/__fixtures__)
 * @returns Object with program, sourceFile, typeChecker, and utility methods
 */
export function loadFixture(fixturePath: string): {
  program: ts.Program;
  sourceFile: ts.SourceFile;
  typeChecker: ts.TypeChecker;
  getTypeOfSymbol: (symbolName: string) => ts.Type | undefined;
  getSymbolAtLocation: (node: ts.Node) => ts.Symbol | undefined;
} {
  const fullPath = path.resolve(__dirname, '../__fixtures__', fixturePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Fixture file not found: ${fullPath}`);
  }

  const compilerOptions: ts.CompilerOptions = {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    noEmit: true,
    paths: {
      'isolated-workers': [isolatedWorkersIndex],
    },
    baseUrl: process.cwd(),
  };

  // Read fixture file content
  const fileContents = new Map<string, string>();
  const fixtureContent = fs.readFileSync(fullPath, 'utf-8');
  fileContents.set(fullPath, fixtureContent);

  // Read all declaration files from isolated-workers
  function readDeclarationFiles(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        readDeclarationFiles(fullPath);
      } else if (entry.name.endsWith('.d.ts')) {
        fileContents.set(fullPath, fs.readFileSync(fullPath, 'utf-8'));
      }
    }
  }
  readDeclarationFiles(isolatedWorkersRoot);

  // Create source files
  const sourceFiles = new Map<string, ts.SourceFile>();
  const fixtureSourceFile = ts.createSourceFile(
    fullPath,
    fixtureContent,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  sourceFiles.set(fullPath, fixtureSourceFile);

  for (const [filePath, content] of fileContents) {
    if (filePath === fullPath) continue;
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    sourceFiles.set(filePath, sourceFile);
  }

  const defaultCompilerHost = ts.createCompilerHost(compilerOptions);

  // Helper to resolve .js imports to .d.ts files
  const resolveDeclarationFile = (
    requestedPath: string
  ): string | undefined => {
    if (requestedPath.endsWith('.d.ts')) {
      return fileContents.has(requestedPath) ? requestedPath : undefined;
    }
    if (requestedPath.endsWith('.js')) {
      const dtsPath = requestedPath.slice(0, -3) + '.d.ts';
      if (fileContents.has(dtsPath)) {
        return dtsPath;
      }
    }
    const withDts = requestedPath + '.d.ts';
    if (fileContents.has(withDts)) {
      return withDts;
    }
    const withIndex = path.join(requestedPath, 'index.d.ts');
    if (fileContents.has(withIndex)) {
      return withIndex;
    }
    return undefined;
  };

  const compilerHost: ts.CompilerHost = {
    ...defaultCompilerHost,
    getSourceFile: (name, target) => {
      if (sourceFiles.has(name)) {
        return sourceFiles.get(name);
      }
      const resolvedPath = resolveDeclarationFile(name);
      if (resolvedPath && sourceFiles.has(resolvedPath)) {
        return sourceFiles.get(resolvedPath);
      }
      return defaultCompilerHost.getSourceFile(name, target);
    },
    readFile: (fileName) => {
      if (fileContents.has(fileName)) {
        return fileContents.get(fileName) as string;
      }
      const resolvedPath = resolveDeclarationFile(fileName);
      if (resolvedPath && fileContents.has(resolvedPath)) {
        return fileContents.get(resolvedPath) as string;
      }
      return defaultCompilerHost.readFile(fileName);
    },
    fileExists: (fileName) => {
      if (sourceFiles.has(fileName)) return true;
      if (fileContents.has(fileName)) return true;
      const resolvedPath = resolveDeclarationFile(fileName);
      if (resolvedPath && fileContents.has(resolvedPath)) {
        return true;
      }
      return defaultCompilerHost.fileExists(fileName);
    },
    resolveModuleNames: (moduleNames, containingFile) => {
      return moduleNames.map((moduleName) => {
        if (moduleName === 'isolated-workers') {
          return {
            resolvedFileName: isolatedWorkersIndex,
            isExternalLibraryImport: false,
          };
        }
        if (
          containingFile.startsWith(isolatedWorkersRoot) &&
          moduleName.startsWith('.')
        ) {
          const resolved = path.resolve(
            path.dirname(containingFile),
            moduleName
          );
          let finalPath = resolved;
          if (moduleName.endsWith('.js')) {
            const dtsPath = resolved.slice(0, -3) + '.d.ts';
            if (fileContents.has(dtsPath)) {
              finalPath = dtsPath;
            }
          } else if (!resolved.endsWith('.d.ts')) {
            const dtsPath = resolved + '.d.ts';
            if (fileContents.has(dtsPath)) {
              finalPath = dtsPath;
            } else {
              const indexPath = path.join(resolved, 'index.d.ts');
              if (fileContents.has(indexPath)) {
                finalPath = indexPath;
              }
            }
          }
          if (fileContents.has(finalPath)) {
            return {
              resolvedFileName: finalPath,
              isExternalLibraryImport: false,
            };
          }
        }
        const result = ts.resolveModuleName(
          moduleName,
          containingFile,
          compilerOptions,
          compilerHost
        );
        return result.resolvedModule;
      });
    },
  };

  const program = ts.createProgram([fullPath], compilerOptions, compilerHost);
  const typeChecker = program.getTypeChecker();

  /**
   * Get the type of a named symbol from the fixture
   */
  function getTypeOfSymbol(symbolName: string): ts.Type | undefined {
    const symbol = typeChecker
      .getSymbolsInScope(
        fixtureSourceFile,
        ts.SymbolFlags.TypeAlias |
          ts.SymbolFlags.Interface |
          ts.SymbolFlags.Variable
      )
      .find((s) => s.name === symbolName);

    if (!symbol) return undefined;

    const type = typeChecker.getTypeOfSymbolAtLocation(
      symbol,
      symbol.valueDeclaration ?? fixtureSourceFile
    );
    return type;
  }

  /**
   * Get symbol at a specific node location
   */
  function getSymbolAtLocation(node: ts.Node): ts.Symbol | undefined {
    return typeChecker.getSymbolAtLocation(node);
  }

  return {
    program,
    sourceFile: fixtureSourceFile,
    typeChecker,
    getTypeOfSymbol,
    getSymbolAtLocation,
  };
}

/**
 * Create a test program from inline code
 *
 * @param code - TypeScript code string
 * @param fileName - Optional file name
 * @returns Object with program, sourceFile, and typeChecker
 */
export function createTestProgram(
  code: string,
  fileName = '__test__.ts'
): {
  program: ts.Program;
  sourceFile: ts.SourceFile;
  typeChecker: ts.TypeChecker;
} {
  const compilerOptions: ts.CompilerOptions = {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    noEmit: true,
    paths: {
      'isolated-workers': [isolatedWorkersIndex],
    },
    baseUrl: process.cwd(),
  };

  // Read all declaration files upfront
  const fileContents = new Map<string, string>();

  if (fs.existsSync(isolatedWorkersIndex)) {
    fileContents.set(
      isolatedWorkersIndex,
      fs.readFileSync(isolatedWorkersIndex, 'utf-8')
    );
  }

  function readDeclarationFiles(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        readDeclarationFiles(fullPath);
      } else if (entry.name.endsWith('.d.ts')) {
        fileContents.set(fullPath, fs.readFileSync(fullPath, 'utf-8'));
      }
    }
  }
  readDeclarationFiles(isolatedWorkersRoot);

  const sourceFiles = new Map<string, ts.SourceFile>();
  const testSourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  sourceFiles.set(fileName, testSourceFile);

  for (const [filePath, content] of fileContents) {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    sourceFiles.set(filePath, sourceFile);
  }

  const defaultCompilerHost = ts.createCompilerHost(compilerOptions);

  const resolveDeclarationFile = (
    requestedPath: string
  ): string | undefined => {
    if (requestedPath.endsWith('.d.ts')) {
      return fileContents.has(requestedPath) ? requestedPath : undefined;
    }
    if (requestedPath.endsWith('.js')) {
      const dtsPath = requestedPath.slice(0, -3) + '.d.ts';
      if (fileContents.has(dtsPath)) {
        return dtsPath;
      }
    }
    const withDts = requestedPath + '.d.ts';
    if (fileContents.has(withDts)) {
      return withDts;
    }
    const withIndex = path.join(requestedPath, 'index.d.ts');
    if (fileContents.has(withIndex)) {
      return withIndex;
    }
    return undefined;
  };

  const compilerHost: ts.CompilerHost = {
    ...defaultCompilerHost,
    getSourceFile: (name, target) => {
      if (sourceFiles.has(name)) {
        return sourceFiles.get(name);
      }
      const resolvedPath = resolveDeclarationFile(name);
      if (resolvedPath && sourceFiles.has(resolvedPath)) {
        return sourceFiles.get(resolvedPath);
      }
      return defaultCompilerHost.getSourceFile(name, target);
    },
    readFile: (fileName) => {
      if (fileContents.has(fileName)) {
        return fileContents.get(fileName) as string;
      }
      const resolvedPath = resolveDeclarationFile(fileName);
      if (resolvedPath && fileContents.has(resolvedPath)) {
        return fileContents.get(resolvedPath) as string;
      }
      return defaultCompilerHost.readFile(fileName);
    },
    fileExists: (fileName) => {
      if (sourceFiles.has(fileName)) return true;
      if (fileContents.has(fileName)) return true;
      const resolvedPath = resolveDeclarationFile(fileName);
      if (resolvedPath && fileContents.has(resolvedPath)) {
        return true;
      }
      return defaultCompilerHost.fileExists(fileName);
    },
    resolveModuleNames: (moduleNames, containingFile) => {
      return moduleNames.map((moduleName) => {
        if (moduleName === 'isolated-workers') {
          return {
            resolvedFileName: isolatedWorkersIndex,
            isExternalLibraryImport: false,
          };
        }
        if (
          containingFile.startsWith(isolatedWorkersRoot) &&
          moduleName.startsWith('.')
        ) {
          const resolved = path.resolve(
            path.dirname(containingFile),
            moduleName
          );
          let finalPath = resolved;
          if (moduleName.endsWith('.js')) {
            const dtsPath = resolved.slice(0, -3) + '.d.ts';
            if (fileContents.has(dtsPath)) {
              finalPath = dtsPath;
            }
          } else if (!resolved.endsWith('.d.ts')) {
            const dtsPath = resolved + '.d.ts';
            if (fileContents.has(dtsPath)) {
              finalPath = dtsPath;
            } else {
              const indexPath = path.join(resolved, 'index.d.ts');
              if (fileContents.has(indexPath)) {
                finalPath = indexPath;
              }
            }
          }
          if (fileContents.has(finalPath)) {
            return {
              resolvedFileName: finalPath,
              isExternalLibraryImport: false,
            };
          }
        }
        const result = ts.resolveModuleName(
          moduleName,
          containingFile,
          compilerOptions,
          compilerHost
        );
        return result.resolvedModule;
      });
    },
  };

  const program = ts.createProgram([fileName], compilerOptions, compilerHost);

  return {
    program,
    sourceFile: testSourceFile,
    typeChecker: program.getTypeChecker(),
  };
}

/**
 * Check if a type has a specific property
 */
export function typeHasProperty(type: ts.Type, propName: string): boolean {
  const props = type.getProperties();
  return props.some((p) => p.name === propName);
}

/**
 * Get string representation of a type
 */
export function typeToString(
  typeChecker: ts.TypeChecker,
  type: ts.Type
): string {
  return typeChecker.typeToString(type);
}

/**
 * Get union type members if the type is a union
 */
export function getUnionMembers(type: ts.Type): ts.Type[] | undefined {
  if (type.isUnion()) {
    return type.types;
  }
  return undefined;
}

/**
 * Get all properties of a type
 */
export function getTypeProperties(type: ts.Type): ts.Symbol[] {
  return type.getProperties();
}

/**
 * Check if a type is assignable to another type (structural check)
 */
export function hasPropertyWithType(
  typeChecker: ts.TypeChecker,
  type: ts.Type,
  propName: string,
  expectedTypeStr: string
): boolean {
  const prop = type.getProperty(propName);
  if (!prop) return false;

  const propType = typeChecker.getTypeOfSymbol(prop);
  const propTypeStr = typeChecker.typeToString(propType);

  return propTypeStr === expectedTypeStr;
}
