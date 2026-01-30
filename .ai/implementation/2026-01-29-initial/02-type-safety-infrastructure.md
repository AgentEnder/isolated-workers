# Implementation Specification: Type Safety Infrastructure

## Goal

Implement the `DefineMessages` type system and type-tests package to validate TypeScript type inference.

## Current Status

### Prerequisites Status ✅

- [x] Package structure complete (src/ organized or will be organized per 01-package-structure.md)
- [x] Library builds successfully
- [x] Basic types exist (WorkerMessage, WorkerResult)

### What's Needed 📋

1. **DefineMessages type system** - Add to `src/types/messages.ts`
2. **Type extraction helpers** - Create `src/types/helpers.ts`
3. **Type-tests package** - Full setup in `type-tests/`
4. **Compile-time fixtures** - Validate types work

---

## Phase 1: DefineMessages Type System

### Step 1.1: Update src/types/messages.ts

**Action**: Add DefineMessages pattern alongside existing types

**Current content** (preserve these):

```typescript
export interface WorkerMessage<TType extends string, TPayload> {
  type: TType;
  payload: TPayload;
}

export interface WorkerResult<TType extends string, TPayload> {
  type: TType;
  payload: TPayload;
}

export type AnyMessage = WorkerMessage<string, unknown>;
export type AnyResult = WorkerResult<string, unknown>;
```

**Add new content**:

````typescript
/**
 * Base message with transaction ID for request/response pairing
 */
export interface BaseMessage {
  /** Transaction ID */
  tx: string;
}

/**
 * Message definition shape - each message has a payload and optional result
 */
export interface MessageDef {
  /** Payload type for the message */
  payload: unknown;
  /** Optional result type (if message expects a response) */
  result?: unknown;
}

/**
 * Collection of message definitions
 */
export type MessageDefs = Record<string, MessageDef>;

/**
 * Type constructor for defining message sets.
 *
 * @example
 * ```typescript
 * type MyMessages = DefineMessages<{
 *   load: { payload: { config: string }; result: { loaded: true } };
 *   compute: { payload: { data: number }; result: { value: number } };
 *   shutdown: { payload: void };
 * }>;
 * ```
 */
export type DefineMessages<TDefs extends MessageDefs> = TDefs;
````

---

### Step 1.2: Create src/types/helpers.ts

**File**: `packages/isolated-workers/src/types/helpers.ts`
**Action**: Implement type extraction helpers

````typescript
/**
 * Type extraction helpers for message definitions
 *
 * @packageDocumentation
 */

import type { BaseMessage, MessageDefs } from './messages.js';

/**
 * Utility type for values that may be promises
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Extract keys that have a result defined.
 *
 * @example
 * type WithRes = WithResult<Messages>; // 'load' | 'compute'
 */
export type WithResult<TDefs extends MessageDefs> = {
  [K in keyof TDefs]: TDefs[K] extends { result: unknown } ? K : never;
}[keyof TDefs];

/**
 * Extract the full message type for a given key.
 *
 * @example
 * type LoadMessage = MessageOf<MyMessages, 'load'>;
 * // { tx: string; type: 'load'; payload: { config: string } }
 */
export type MessageOf<
  TDefs extends MessageDefs,
  K extends keyof TDefs
> = BaseMessage & {
  type: K;
  payload: TDefs[K]['payload'];
};

/**
 * Extract the full result type for a given key.
 *
 * @example
 * type LoadResult = ResultOf<MyMessages, 'load'>;
 * // { tx: string; type: 'loadResult'; payload: { loaded: true } }
 */
export type ResultOf<
  TDefs extends MessageDefs,
  K extends WithResult<TDefs>
> = BaseMessage & {
  type: `${K & string}Result`;
  payload: TDefs[K] extends { result: unknown } ? TDefs[K]['result'] : never;
};

/**
 * Union of all message types in the definition.
 */
export type AllMessages<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: MessageOf<TDefs, K>;
}[keyof TDefs & string];

/**
 * Union of all result types in the definition.
 */
export type AllResults<TDefs extends MessageDefs> = {
  [K in WithResult<TDefs> & string]: ResultOf<TDefs, K>;
}[WithResult<TDefs> & string];

/**
 * Map a message type to its corresponding result type.
 */
export type MessageResult<
  TMessageType extends string,
  TDefs extends MessageDefs
> = TMessageType extends WithResult<TDefs>
  ? ResultOf<TDefs, TMessageType>
  : never;

/**
 * Handler function type for a message definition.
 *
 * Handlers receive the payload and return the result (or void if no result).
 *
 * @example
 * ```typescript
 * const handlers: Handlers<MyMessages> = {
 *   load: async (payload) => ({ loaded: true }),
 *   shutdown: () => { console.log('bye'); }
 * };
 * ```
 */
export type Handlers<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: (
    payload: TDefs[K]['payload']
  ) => TDefs[K] extends { result: unknown }
    ? MaybePromise<TDefs[K]['result'] | void>
    : MaybePromise<void>;
};

/**
 * Extract the payload type for a given message key.
 */
export type PayloadOf<
  TDefs extends MessageDefs,
  K extends keyof TDefs
> = TDefs[K]['payload'];

/**
 * Extract the result type for a given message key.
 */
export type ResultPayloadOf<
  TDefs extends MessageDefs,
  K extends WithResult<TDefs>
> = TDefs[K] extends { result: unknown } ? TDefs[K]['result'] : never;
````

---

### Step 1.3: Update src/types/index.ts

**Action**: Export all types

```typescript
// Existing types
export type {
  WorkerMessage,
  WorkerResult,
  AnyMessage,
  AnyResult,
} from './messages.js';

// New DefineMessages types
export type {
  BaseMessage,
  MessageDef,
  MessageDefs,
  DefineMessages,
} from './messages.js';

// Type helpers
export type {
  MaybePromise,
  WithResult,
  MessageOf,
  ResultOf,
  AllMessages,
  AllResults,
  MessageResult,
  Handlers,
  PayloadOf,
  ResultPayloadOf,
} from './helpers.js';
```

---

### Step 1.4: Update src/index.ts

**Action**: Export all public types

```typescript
/**
 * Isolated Workers - Type-safe worker process library
 *
 * @packageDocumentation
 */

// All types (existing + new)
export * from './types/index.js';

// Utilities
export { isWorkerMessage, isWorkerResult } from './utils/guards.js';
```

---

## Phase 2: Type-Tests Package

### Step 2.1: Create Type-Tests Structure

**Action**: Set up type-tests package

```bash
mkdir -p type-tests/{fixtures,src/lib}
```

**Create files**:

- `type-tests/package.json`
- `type-tests/tsconfig.json`
- `type-tests/vitest.config.ts`

---

### Step 2.2: Type-Tests package.json

**File**: `type-tests/package.json`

```json
{
  "name": "isolated-workers-type-tests",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest --watch"
  },
  "dependencies": {
    "isolated-workers": "workspace:*",
    "typescript": "catalog:"
  },
  "devDependencies": {
    "@nx/vitest": "catalog:",
    "vitest": "catalog:"
  }
}
```

---

### Step 2.3: Type-Tests tsconfig.json

**File**: `type-tests/tsconfig.json`

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": ".",
    "declaration": true,
    "sourceMap": true,
    "composite": true
  },
  "include": ["src/**/*.ts", "fixtures/**/*.ts"],
  "exclude": ["node_modules", "dist"],
  "references": [{ "path": "../packages/isolated-workers" }]
}
```

---

### Step 2.4: Type-Tests vitest.config.ts

**File**: `type-tests/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      'isolated-workers': path.resolve(
        __dirname,
        '../packages/isolated-workers/dist'
      ),
    },
  },
});
```

---

## Phase 3: Type Test Implementation

### Step 3.1: Create Compiler Utilities

**File**: `type-tests/src/lib/compiler.ts`

```typescript
/**
 * TypeScript compiler utilities for type testing
 */

import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

export function createTestProgram(
  code: string,
  fileName: string = '__test__.ts'
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
  };

  const sourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    true
  );

  const compilerHost: ts.CompilerHost = {
    ...ts.createCompilerHost(compilerOptions),
    getSourceFile: (name, target) => {
      if (name === fileName) return sourceFile;
      return ts.createCompilerHost(compilerOptions).getSourceFile(name, target);
    },
    readFile: (fileName) => {
      if (fileName === fileName) return code;
      return ts.createCompilerHost(compilerOptions).readFile(fileName);
    },
    fileExists: (fileName) => {
      if (fileName === fileName) return true;
      return ts.createCompilerHost(compilerOptions).fileExists(fileName);
    },
  };

  const program = ts.createProgram([fileName], compilerOptions, compilerHost);

  return {
    program,
    sourceFile,
    typeChecker: program.getTypeChecker(),
  };
}

export function typeHasProperty(type: ts.Type, propName: string): boolean {
  const props = type.getProperties();
  return props.some((p) => p.name === propName);
}
```

---

### Step 3.2: Create Assertion Helpers

**File**: `type-tests/src/lib/assertions.ts`

```typescript
/**
 * Type assertion utilities
 */

export type AssertEqual<T, U> = (<V>() => V extends T ? 1 : 2) extends <
  V
>() => V extends U ? 1 : 2
  ? true
  : false;

export type AssertExtends<T, U> = T extends U ? true : false;

export type IsTrue<T extends true> = T;
export type IsFalse<T extends false> = T;

export type AssertProperty<T, K extends string, TExpected> = K extends keyof T
  ? AssertEqual<T[K], TExpected>
  : { error: 'Missing property'; property: K; on: T };
```

---

### Step 3.3: Create Type Tests

**File**: `type-tests/src/lib/type-helpers.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createTestProgram, typeHasProperty } from './compiler.js';
import * as ts from 'typescript';

describe('Type Helpers', () => {
  describe('MessageOf', () => {
    it('should create message type with correct structure', () => {
      const code = `
        import type { DefineMessages, MessageOf } from 'isolated-workers';

        type MyMessages = DefineMessages<{
          load: { payload: { config: string }; result: { loaded: true } };
        }>;

        type LoadMessage = MessageOf<MyMessages, 'load'>;

        const checkTx: LoadMessage['tx'] = 'abc123';
        const checkType: LoadMessage['type'] = 'load';
        const checkPayload: LoadMessage['payload'] = { config: 'test' };
      `;

      const { program, sourceFile } = createTestProgram(code);
      const diagnostics = program.getSemanticDiagnostics(sourceFile);
      const typeErrors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error
      );

      expect(typeErrors.length).toBe(0);
    });
  });

  describe('WithResult', () => {
    it('should only include keys with result defined', () => {
      const code = `
        import type { DefineMessages, WithResult } from 'isolated-workers';

        type MyMessages = DefineMessages<{
          load: { payload: {}; result: {} };
          compute: { payload: {}; result: {} };
          shutdown: { payload: {} };
        }>;

        type WithRes = WithResult<MyMessages>;
        const testLoad: Extract<WithRes, 'load'> = 'load';
        const testCompute: Extract<WithRes, 'compute'> = 'compute';
      `;

      const { program, sourceFile } = createTestProgram(code);
      const diagnostics = program.getSemanticDiagnostics(sourceFile);
      const typeErrors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error
      );

      expect(typeErrors.length).toBe(0);
    });
  });
});
```

---

### Step 3.4: Create Compile-Time Fixture

**File**: `type-tests/fixtures/basic-messages.ts`

```typescript
/**
 * Fixture: Basic message definitions
 * This file validates types at compile time.
 */

import type {
  DefineMessages,
  MessageOf,
  ResultOf,
  WithResult,
  Handlers,
} from 'isolated-workers';

// Define messages
interface WorkerMessages
  extends DefineMessages<{
    load: {
      payload: { config: string };
      result: { loaded: true };
    };
    compute: {
      payload: { data: number[] };
      result: { sum: number };
    };
    shutdown: {
      payload: { force?: boolean };
    };
  }> {}

// Type tests
type LoadMessage = MessageOf<WorkerMessages, 'load'>;
type LoadResult = ResultOf<WorkerMessages, 'load'>;

// Verify structures
declare const loadMsg: LoadMessage;
const _tx: string = loadMsg.tx;
const _type: 'load' = loadMsg.type;

// Verify WithResult
type WithRes = WithResult<WorkerMessages>;
const _hasLoad: Extract<WithRes, 'load'> = 'load';
const _hasCompute: Extract<WithRes, 'compute'> = 'compute';

// Define handlers
const handlers: Handlers<WorkerMessages> = {
  load: async (payload) => {
    return { loaded: true };
  },
  compute: (payload) => {
    return { sum: payload.data.reduce((a, b) => a + b, 0) };
  },
  shutdown: (payload) => {
    if (payload.force) console.log('Force');
  },
};

export { handlers };
```

---

## Phase 4: Verification

### Step 4.1: Build Library

```bash
cd packages/isolated-workers && pnpm run build
```

### Step 4.2: Run Type Tests

```bash
cd type-tests && pnpm install && pnpm test
```

### Step 4.3: Verify Fixtures Compile

```bash
npx tsc -p type-tests/tsconfig.json --noEmit
```

---

## Success Criteria

- [ ] DefineMessages type system added to library
- [ ] All type helpers implemented
- [ ] type-tests/package.json created
- [ ] type-tests/tsconfig.json created
- [ ] type-tests/vitest.config.ts created
- [ ] Compiler utilities implemented
- [ ] Assertion helpers implemented
- [ ] At least 2 type test specs passing
- [ ] Fixture files compile without errors
- [ ] Library builds with new types

## Notes

- Existing WorkerMessage/WorkerResult types preserved for backward compatibility
- New DefineMessages system provides more powerful type inference
- Type-tests package follows cli-forge pattern exactly
