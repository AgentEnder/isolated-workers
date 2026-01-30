# Phase 4: Type Safety Infrastructure

## Overview

Implement comprehensive type safety infrastructure following cli-forge patterns, including type tests, assertion utilities, and runtime type checking.

## Type System Goals

1. **Full Inference**: Types inferred from usage, not manually specified
2. **Compile-Time Checks**: Catch errors at build time, not runtime
3. **Complex Generics**: Support advanced use cases without type widening
4. **Runtime Validation**: Type guards for dynamic scenarios

## Type-Tests Package Structure

```
type-tests/
├── assertions/              # Type assertion helpers
├── fixtures/              # Test fixture code
├── src/lib/               # Type test implementations
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── project.json
```

## Assertion Helpers (`type-tests/assertions/`)

### Purpose

Provide compile-time type assertions for validating complex type inference.

### Assertion Types

#### 1. `AssertEqual<T, U>`

Verifies that two types are exactly equal.

```typescript
type AssertEqual<T, U> = (<T>() => <U>() => ({})) extends ((<T>() => <U>() => ({})) ? never : true;

// Usage
type Test1 = AssertEqual<string, string>; // true
type Test2 = AssertEqual<string, number>; // compile error
```

#### 2. `AssertExtends<T, U>`

Verifies that T extends U.

```typescript
type AssertExtends<T, U> = T extends U ? true : false;

// Usage
type Test1 = AssertExtends<string, string>; // true
type Test2 = AssertExtends<string, number>; // false
```

#### 3. `AssertProperty<T, K, U>`

Verifies that property K exists on type T and has type U.

```typescript
type AssertProperty<T, K extends PropertyKey, U> = Pick<T, K>[K] extends U
  ? true
  : never;

// Usage
type Config = { host: string; port: number };
type Test = AssertProperty<Config, "host", string>; // true
```

#### 4. `AssertNotIndexSignature<T>`

Verifies that type T does not have an index signature.

```typescript
type AssertNotIndexSignature<T> = string extends keyof T ? never : true;

// Usage
type StrictConfig = { host: string };
type Test = AssertNotIndexSignature<StrictConfig>; // true
type LooseConfig = { [key: string]: string };
type Test2 = AssertNotIndexSignature<LooseConfig>; // compile error
```

#### 5. `AssertHasProperties<T, P>`

Verifies that type T has all properties in P.

```typescript
type AssertHasProperties<T, P extends PropertyKey[]> = P extends (keyof T)[]
  ? true
  : never;

// Usage
type Config = { host: string; port: number };
type Test = AssertHasProperties<Config, ["host", "port"]>; // true
type Test2 = AssertHasProperties<Config, ["host", "port", "missing"]>; // compile error
```

### Assertion File Structure

```typescript
// assertions/assertions.ts
export type AssertEqual<T, U> = (<T>() => <U>() => ({})) extends ((<T>() => <U>() => ({})) ? never : true;
export type AssertExtends<T, U> = T extends U ? true : false;
export type AssertProperty<T, K extends PropertyKey, U> = Pick<T, K>[K] extends U ? true : never;
export type AssertNotIndexSignature<T> = string extends keyof T ? never : true;
export type AssertHasProperties<T, P extends PropertyKey[]> = P extends (keyof T)[] ? true : never;

export type IsTrue<T extends boolean> = T extends true ? true : never;
export type IsFalse<T extends boolean> = T extends false ? true : never;
```

## Type Test Scenarios

### 1. Message Type Inference

**Scenario**: Verify that message types preserve exact payload types.

```typescript
// src/lib/message-types.spec.ts
it("should infer exact payload types for messages", () => {
  type Messages = {
    compute: { n: number };
    result: { value: number };
  };

  type ComputePayload = Extract<Messages, { type: "compute" }>["payload"];
  type ResultPayload = Extract<Messages, { type: "result" }>["payload"];

  // Should be exactly { n: number }, not { n: number } | undefined
  type Test1 = AssertEqual<ComputePayload, { n: number }>;
  // Should be exactly { value: number }
  type Test2 = AssertEqual<ResultPayload, { value: number }>;
  const test1 = (IsTrue<Test1> = true);
  const test2 = (IsTrue<Test2> = true);
});
```

### 2. Generic Handler Types

**Scenario**: Verify that generic handler parameters are correctly typed.

```typescript
// src/lib/handler-types.spec.ts
it("should infer correct handler parameter types", () => {
  type Handlers = {
    load: (payload: { config: string }) => Promise<{ loaded: true }>;
    process: (payload: { data: number[] }) => { processed: number };
  };

  // Extract handler types
  type LoadHandler = Handlers["load"];
  type ProcessHandler = Handlers["process"];

  // Verify parameter types
  type Test1 = AssertProperty<Parameters<LoadHandler>[0], "config", string>;
  type Test2 = AssertProperty<Parameters<ProcessHandler>[0], "data", number[]>;

  const test1 = (IsTrue<Test1> = true);
  const test2 = (IsTrue<Test2> = true);
});
```

### 3. Request/Response Type Safety

**Scenario**: Verify that request and response types are properly paired.

```typescript
// src/lib/request-response.spec.ts
it("should pair request with correct response type", () => {
  type Messages = {
    request: { data: string };
    response: { result: boolean };
  };

  // Request should send { data: string }
  type RequestType = Extract<Messages, { type: "request" }>["payload"];
  type Test1 = AssertEqual<RequestType, { data: string }>;
  // Response should be { result: boolean }
  type ResponseType = Extract<Messages, { type: "response" }>["payload"];
  type Test2 = AssertEqual<ResponseType, { result: boolean }>;
  const test1 = (IsTrue<Test1> = true);
  const test2 = (IsTrue<Test2> = true);
});
```

### 4. Worker Options Type Inference

**Scenario**: Verify that worker options with generic constraints are correctly typed.

```typescript
// src/lib/worker-options.spec.ts
it("should constrain worker options types", () => {
  type Options = {
    workerScript: string;
    env?: Record<string, string>;
    timeout?: number;
  };

  // Required properties should be present
  type Test1 = AssertProperty<Options, "workerScript", string>;

  // Optional properties should be optional
  type Test2 = AssertEqual<Options["env"], Record<string, string> | undefined>;

  const test1 = (IsTrue<Test1> = true);
  const test2 = (IsTrue<Test2> = true);
});
```

### 5. Union Type Narrowing

**Scenario**: Verify that union types can be narrowed correctly.

```typescript
// src/lib/union-narrowing.spec.ts
it("should narrow union types correctly", () => {
  type Message =
    | { type: "load"; payload: { config: string } }
    | { type: "compute"; payload: { data: number } }
    | { type: "shutdown" };

  // Discriminated union should narrow based on type
  type Payload = Message["payload"];

  // Should be discriminated union
  type Test = AssertEqual<
    Payload,
    { config: string } | { data: number } | undefined
  >;

  const test = (IsTrue<Test> = true);
});
```

### 6. Message Definition Type System

**Scenario**: Verify that the `DefineMessages` pattern creates proper type relationships.

```typescript
// src/lib/message-def-system.spec.ts
it("should create proper message type relationships", () => {
  interface BaseMessage {
    tx: string;
  }

  type MessageDef = {
    payload: unknown;
    result?: unknown;
  };

  type MessageDefs = Record<string, MessageDef>;

  type DefineMessages<TDefs extends MessageDefs> = TDefs;

  type MessageOf<TDefs extends MessageDefs, K extends keyof TDefs> = BaseMessage & {
    type: K;
    payload: TDefs[K]['payload'];
  };

  type ResultOf<TDefs extends MessageDefs, K extends keyof TDefs> = BaseMessage & {
    type: `${K & string}Result`;
    payload: TDefs[K]['result'];
  };

  type MyMessages = DefineMessages<{
    load: {
      payload: { config: string };
      result: { loaded: true };
    };
    compute: {
      payload: { data: number };
      result: { value: number };
    };
  }>;

  type LoadMessage = MessageOf<MyMessages, 'load'>;
  type LoadResult = ResultOf<MyMessages, 'load'>;

  // Message should have correct payload type
  type Test1 = AssertProperty<LoadMessage, 'payload', { config: string }>;
  // Result should have correct payload type
  type Test2 = AssertProperty<LoadResult, 'payload', { loaded: true }>;
  // Result type should have correct type name
  type Test3 = AssertProperty<LoadResult, 'type', 'loadResult'>;

  const test1 = (IsTrue<Test1> = true);
  const test2 = (IsTrue<Test2> = true);
  const Test3Result = (Test3 extends true ? true : false);
  const test3 = Test3Result === true ? true : (IsFalse<Test3> = true);
});
```

### 7. Handler Type Inference

**Scenario**: Verify that handler types correctly infer payload and result types.

```typescript
// src/lib/handler-inference.spec.ts
it("should infer handler types correctly", () => {
  interface BaseMessage {
    tx: string;
  }

  type MessageDef = {
    payload: unknown;
    result?: unknown;
  };

  type MessageDefs = Record<string, MessageDef>;

  type Handlers<TDefs extends MessageDefs> = {
    [K in keyof TDefs & string]: (
      payload: TDefs[K]['payload']
    ) => TDefs[K] extends { result: unknown }
      ? MaybePromise<TDefs[K]['result'] | void>
      : MaybePromise<void>;
  };

  type MyMessages = DefineMessages<{
    load: {
      payload: { config: string };
      result: { loaded: true };
    };
    compute: {
      payload: { data: number };
      result: { value: number };
    };
  }>;

  type MyHandlers = Handlers<MyMessages>;

  // Load handler should accept correct payload type
  type LoadHandler = MyHandlers['load'];
  type Test1 = AssertProperty<Parameters<LoadHandler>[0], 'config', string>;
  // Load handler should return correct result type or void
  type LoadHandlerReturn = Awaited<ReturnType<LoadHandler>>;
  type Test2 = AssertEqual<LoadHandlerReturn, { loaded: true } | void>;

  const test1 = (IsTrue<Test1> = true);
  const test2 = (IsTrue<Test2> = true);
});
```

### 8. Type Extraction Helpers

**Scenario**: Verify that type extraction helpers work correctly.

```typescript
// src/lib/type-extraction.spec.ts
it("should extract types correctly", () => {
  type MessageDefs = {
    load: {
      payload: { config: string };
      result: { loaded: true };
    };
    compute: {
      payload: { data: number };
      result: { value: number };
    };
    shutdown: {
      payload: void;
    };
  };

  // Extract keys with results
  type WithResult<T extends MessageDefs> = {
    [K in keyof T]: T[K] extends { result: unknown } ? K : never;
  }[keyof T];

  type MessagesWithResult = WithResult<MessageDefs>;
  type Test1 = AssertEqual<MessagesWithResult, 'load' | 'compute'>;

  // Union of all messages
  type AllMessages<T extends MessageDefs> = {
    [K in keyof T & string]: BaseMessage & {
      type: K;
      payload: T[K]['payload'];
    };
  }[keyof T & string];

  type MyMessages = AllMessages<MessageDefs>;
  type Test2 = AssertProperty<Extract<MyMessages, { type: 'load' }>, 'payload', { config: string }>;

  const test1 = (IsTrue<Test1> = true);
  const test2 = (IsTrue<Test2> = true);
});
```

## Type Test Utilities

### `createTestProgram(code: string)`

Creates an in-memory TypeScript compiler program.

```typescript
// src/lib/test-program.ts
import * as ts from "typescript";

export function createTestProgram(code: string) {
  const compilerOptions: ts.CompilerOptions = {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    skipLibCheck: true,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const sourceFile = ts.createSourceFile(
    "test.ts",
    code,
    ts.ScriptTarget.Latest,
  );

  return {
    program: ts.createProgram(["test.ts"], compilerOptions, {
      host,
      rootNames: ["test.ts"],
    }),
    sourceFile,
    typeChecker: program.getTypeChecker(),
  };
}
```

### `findNodeBySelector(sourceFile: ts.SourceFile, query: string)`

Finds an AST node using tsquery-like selection.

```typescript
// src/lib/node-selector.ts
import * as ts from "typescript";

export function findNodeBySelector<T extends ts.Node>(
  sourceFile: ts.SourceFile,
  query: string,
): T | null {
  // Simple implementation for common patterns
  // e.g., "PropertyAssignment[name.text='config'] ArrowFunction > Parameter"

  // In full implementation, use ts-morph or similar
  // For now, traverse manually

  let found: T | null = null;

  function visit(node: ts.Node) {
    if (found) return true; // Stop when found

    // Simple selector matching
    if (query.includes("PropertyAssignment")) {
      if (ts.isPropertyAssignment(node)) {
        // Check name, etc.
      }
    }

    ts.forEachChild(node, visit);
    return false;
  }

  visit(sourceFile);
  return found;
}
```

### `compareTypes(expected: string, actual: string)`

Compares two type strings for equality.

```typescript
// src/lib/type-comparison.ts
import { createTestProgram } from "./test-program";

export function compareTypes(expected: string, actual: string) {
  const { typeChecker: expectedChecker } = createTestProgram(expected);
  const { typeChecker: actualChecker } = createTestProgram(actual);

  // Simplified comparison - check if types are equivalent
  // Full implementation would normalize and compare structure

  const expectedType = expectedChecker.getTypeAtLocation(expectedSourceFile, 0);

  const actualType = actualChecker.getTypeAtLocation(actualSourceFile, 0);

  // For now, just compare string representations
  // Full implementation would be more sophisticated

  return expectedType === actualType;
}
```

## Type-Tests Package Configuration

### `type-tests/package.json`

```json
{
  "name": "isolated-workers-type-tests",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui"
  },
  "devDependencies": {
    "@nx/vitest": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  },
  "nx": {
    "includedScripts": []
  }
}
```

### `type-tests/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "skipLibCheck": true,
    "strictNullChecks": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## Running Type Tests

```bash
# All type tests
nx test type-tests

# Specific test file
nx test type-tests -- src/lib/message-types.spec.ts

# Watch mode
nx test type-tests --watch
```

## Type Safety Principles

### 1. No `any` in Public API

All exported types must be fully typed. Use `unknown` instead when type is truly unknown.

**Bad:**

```typescript
export function handle(data: any): void {}
```

**Good:**

```typescript
export function handle<T>(data: T): void {}
// or
export function handle(data: unknown): void {
  if (typeof data === "string") {
    /* ... */
  }
}
```

### 2. Prefer Union Types Over Optional

Use discriminated unions instead of optional properties for clearer type flow.

**Bad:**

```typescript
type Message = {
  type: string;
  payload?: unknown;
};
```

**Good:**

```typescript
type Message<T extends MessageTypes> = {
  type: T;
  payload: PayloadForType<T>;
};
```

### 3. Generic Constraints

Use generic constraints to restrict type parameters appropriately.

**Bad:**

```typescript
function createWorker<T>(options: T): WorkerClient<T> {}
```

**Good:**

```typescript
function createWorker<T extends Record<string, unknown>>(
  options: T,
): WorkerClient<T> {}
```

### 4. Type Guards

Provide runtime type guards for dynamic scenarios.

```typescript
function isWorkerMessage(message: unknown): message is WorkerMessage {
  return (
    typeof message === "object" &&
    "type" in message &&
    "payload" in message &&
    typeof message.type === "string"
  );
}
```

## Success Criteria

- [ ] Type tests package structure created
- [ ] Assertion helpers implemented
- [ ] Type test utilities implemented
- [ ] Initial type tests passing
- [ ] Nx configuration for type-tests
- [ ] Test runner working (`nx test type-tests`)

## Next Steps

After completing type safety infrastructure:

1. Implement core worker components with validated types
2. Add type tests for all new APIs
3. Ensure no `any` in public API
4. Document type safety features in guides
