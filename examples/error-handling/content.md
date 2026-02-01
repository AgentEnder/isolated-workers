# Error Handling Example

Demonstrates error propagation from worker to host.

## Overview

This example shows:

- How errors thrown in worker handlers propagate back to the host
- Proper error handling with try/catch
- Error messages are preserved across process boundaries
- Shared message definitions between host and worker

## Files

### Shared Message Definitions

First, define the message types in a shared file that both host and worker import:

{{file:messages.ts}}

### Host

The host imports the message types and handles both success and error cases:

{{file:host.ts}}

### Worker

The worker imports the same message types and throws errors for invalid operations:

{{file:worker.ts}}

## Running

```bash
cd examples && pnpm run:error-handling
```

## Key Concepts

1. **Shared Types**: Message definitions in `messages.ts` imported by both sides
2. **Error Propagation**: Errors thrown in worker are serialized and re-thrown in host
3. **Type Safety**: Full TypeScript inference from shared message definitions
