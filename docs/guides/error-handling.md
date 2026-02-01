---
title: Error Handling
description: How errors propagate from workers to hosts
nav:
  section: Docs
  order: 2
---

# Error Handling in isolated-workers

When a worker throws an error, isolated-workers automatically serializes it and re-throws it in the host process. This guide explains how error propagation works and best practices for handling errors.

## How Error Propagation Works

When you call `worker.sendRequest()`, the message is sent to the worker process over IPC. If the worker's handler throws an error:

1. The error is caught by the worker infrastructure
2. The error message and stack trace are serialized
3. The serialized error is sent back to the host
4. The host reconstructs the error and throws it

This means you can use standard try/catch patterns in your host code:

```typescript
try {
  const result = await worker.sendRequest({ type: 'divide', a: 10, b: 0 });
} catch (error) {
  console.error('Worker threw an error:', error.message);
}
```

## Example: Division with Error Handling

Here's a complete example showing error propagation. First, the shared message definitions:

{% example error-handling:messages.ts %}

The worker validates input and throws for invalid operations:

{% example error-handling:worker.ts %}

The host catches and handles the error:

{% example error-handling:host.ts %}

## Best Practices

### 1. Use Descriptive Error Messages

Since errors cross process boundaries, make your error messages descriptive:

```typescript
// Good - clear context
throw new Error(`Division by zero: cannot divide ${a} by ${b}`);

// Bad - vague
throw new Error('Invalid input');
```

### 2. Handle Errors at the Right Level

Catch errors where you can meaningfully handle them:

```typescript
// Handle specific operations
try {
  const result = await worker.sendRequest({ type: 'riskyOperation' });
  return result;
} catch (error) {
  // Log and provide fallback
  console.error('Risky operation failed, using default');
  return defaultValue;
}
```

### 3. Validate Early

Validate inputs in the worker before performing operations:

```typescript
handlers: {
  divide: ({ a, b }) => {
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error('Both arguments must be numbers');
    }
    if (b === 0) {
      throw new Error('Cannot divide by zero');
    }
    return a / b;
  }
}
```

## Error Types

Currently, isolated-workers preserves:

- Error message (`error.message`)
- Error stack trace (`error.stack`)

Custom error properties may not be preserved across the process boundary. If you need to pass structured error data, consider returning an error result instead of throwing:

```typescript
type DivideResult =
  | { success: true; value: number }
  | { success: false; error: string; code: 'DIVISION_BY_ZERO' | 'INVALID_INPUT' };
```

## See Also

- {% example-link error-handling %} - Complete error handling example
- [API Reference: createWorker](/api/create-worker) - Worker creation options
