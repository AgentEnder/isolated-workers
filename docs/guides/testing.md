---
title: Testing Workers
description: Strategies for testing worker-based code
nav:
  section: Guides
  order: 8
---

# Testing Workers

Testing worker-based code requires different strategies depending on what you want to verify. This guide covers unit testing handlers in isolation, integration testing with real workers, and patterns for mocking workers in host-side tests.

## Testing Strategies Overview

Worker-based applications have three natural testing layers:

| Layer           | What to Test                          | Speed  | Isolation |
| --------------- | ------------------------------------- | ------ | --------- |
| **Unit**        | Handler logic, message validation     | Fast   | High      |
| **Integration** | Full IPC round-trips, serialization   | Medium | Medium    |
| **E2E**         | Complete workflows, process lifecycle | Slow   | Low       |

### When to Use Each Strategy

- **Unit tests**: Business logic in handlers, validation, transformations
- **Integration tests**: IPC communication, serialization, timeouts, error propagation
- **E2E tests**: Full application workflows, deployment verification

## Testing Handlers in Isolation

The fastest and most reliable tests focus on handler functions directly, without spawning worker processes.

### Extract Handler Logic

Structure your workers to make handlers easily testable:

```typescript
// handlers.ts - Testable handler logic
import type { Handlers } from 'isolated-workers';
import type { Messages } from './messages.js';

export function createHandlers(deps: { db: Database }): Handlers<Messages> {
  return {
    getUser: async ({ userId }) => {
      const user = await deps.db.findUser(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      return { user };
    },

    createUser: async ({ name, email }) => {
      const id = await deps.db.createUser({ name, email });
      return { id };
    },
  };
}
```

```typescript
// worker.ts - Thin wrapper that starts the server
import { startWorkerServer } from 'isolated-workers';
import { createHandlers } from './handlers.js';
import { createDatabase } from './database.js';

const db = createDatabase();
const handlers = createHandlers({ db });

startWorkerServer(handlers);
```

### Unit Testing Handlers

Test handlers as regular async functions:

```typescript
// handlers.spec.ts
import { createHandlers } from './handlers.js';

describe('User Handlers', () => {
  const mockDb = {
    findUser: jest.fn(),
    createUser: jest.fn(),
  };

  const handlers = createHandlers({ db: mockDb });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    it('returns user when found', async () => {
      const user = { id: '123', name: 'Alice' };
      mockDb.findUser.mockResolvedValue(user);

      const result = await handlers.getUser({ userId: '123' });

      expect(result).toEqual({ user });
      expect(mockDb.findUser).toHaveBeenCalledWith('123');
    });

    it('throws when user not found', async () => {
      mockDb.findUser.mockResolvedValue(null);

      await expect(handlers.getUser({ userId: 'unknown' })).rejects.toThrow(
        'User unknown not found'
      );
  });
});

## Test File Organization

Organize your test files by layer to maintain clarity and enable selective test execution:

```

src/
├── handlers/
│ └── calculator.spec.ts # Unit tests - handler logic only
├── worker.ts
└── worker.integration.spec.ts # Integration tests - full IPC round-trips
tests/
├── e2e/
│ └── workflow.spec.ts # E2E tests - complete application flows
└── test-utils/
├── mock-worker.ts
└── ci-config.ts

````

**Naming Conventions**:

- `*.spec.ts` or `*.test.ts` - Unit tests for individual functions/modules
- `*.integration.spec.ts` - Integration tests with real workers and IPC
- `e2e/*.spec.ts` - End-to-end tests of complete workflows

**Package.json Scripts**:

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathIgnorePatterns='integration'",
    "test:integration": "jest --testPathPattern='integration'",
    "test:e2e": "jest --config=jest.e2e.config.js"
  }
}
````

This organization allows:

- Fast feedback from unit tests during development
- Separate integration test runs when needed
- E2E tests only during CI/CD or before releases
- Clear separation of concerns in test suites

## Async Testing Patterns

### Handling Timeouts

Test timeout behavior explicitly:

```typescript
describe('Timeout Handling', () => {
  it('times out slow operations', async () => {
    const worker = await createWorker<Messages>({
      script: './dist/worker.js',
      timeout: {
        WORKER_MESSAGE: 100, // Very short timeout for testing
      },
    });

    try {
      await expect(worker.send('slowOperation', {})).rejects.toThrow(
        /timeout/i
      );
    } finally {
      await worker.close();
    }
  });

  it('completes within timeout', async () => {
    const worker = await createWorker<Messages>({
      script: './dist/worker.js',
      timeout: {
        fastOperation: 5000,
      },
    });

    try {
      const result = await worker.send('fastOperation', {});
      expect(result).toBeDefined();
    } finally {
      await worker.close();
    }
  });
});
```

### Proper Cleanup with finally

Always clean up workers, even when tests fail:

```typescript
describe('Resource Cleanup', () => {
  it('cleans up on success', async () => {
    const worker = await createWorker<Messages>({
      script: './dist/worker.js',
    });

    try {
      const result = await worker.send('compute', { data: 42 });
      expect(result.value).toBe(84);
    } finally {
      await worker.close();
      expect(worker.isActive).toBe(false);
    }
  });

  it('cleans up on failure', async () => {
    const worker = await createWorker<Messages>({
      script: './dist/worker.js',
    });

    try {
      await worker.send('fail', {});
    } catch {
      // Expected error
    } finally {
      await worker.close();
      expect(worker.isActive).toBe(false);
    }
  });
});
```

### Testing Worker Lifecycle Events

```typescript
describe('Lifecycle Events', () => {
  it('detects worker shutdown', async () => {
    const worker = await createWorker<Messages>({
      script: './dist/worker.js',
    });

    expect(worker.isActive).toBe(true);
    expect(worker.isConnected).toBe(true);

    await worker.close();

    expect(worker.isActive).toBe(false);
    expect(worker.isConnected).toBe(false);
  });

  it('rejects messages after close', async () => {
    const worker = await createWorker<Messages>({
      script: './dist/worker.js',
    });

    await worker.close();

    await expect(worker.send('ping', {})).rejects.toThrow(/not active/i);
  });
});
```

## CI Considerations

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build worker scripts
        run: npm run build

      - name: Run unit tests
        run: npm test -- --testPathPattern='\\.spec\\.ts$'

      - name: Run integration tests
        run: npm test -- --testPathPattern='\\.integration\\.ts$'
        timeout-minutes: 10
```

### CI-Specific Timeout Adjustments

CI environments are often slower than local machines:

```typescript
// test-utils/ci-config.ts
export const isCI = process.env.CI === 'true';

export const timeouts = {
  workerStartup: isCI ? 20000 : 10000,
  workerMessage: isCI ? 30000 : 10000,
  testTimeout: isCI ? 60000 : 30000,
};
```

```typescript
// integration.spec.ts
import { timeouts } from './test-utils/ci-config.js';

describe('Integration Tests', () => {
  let worker: WorkerClient<Messages>;

  beforeAll(async () => {
    worker = await createWorker<Messages>({
      script: './dist/worker.js',
      timeout: {
        WORKER_STARTUP: timeouts.workerStartup,
        WORKER_MESSAGE: timeouts.workerMessage,
      },
    });
  }, timeouts.testTimeout);

  // ...tests
});
```

### Avoiding Port/Socket Conflicts

Run integration tests sequentially to avoid socket conflicts:

```javascript
// jest.config.js
module.exports = {
  // Run test files sequentially
  maxWorkers: 1,

  // Or use runInBand for complete isolation
  // runInBand: true,
};
```

### Debugging Failed CI Tests

Enable debug logging in CI for troubleshooting:

```typescript
const worker = await createWorker<Messages>({
  script: './dist/worker.js',
  logLevel: process.env.CI ? 'debug' : 'error',
});
```

## Best Practices Summary

1. **Unit test handlers directly** - Extract handler logic into testable functions
2. **Use dependency injection** - Pass dependencies to handlers for easy mocking
3. **Mock workers for host tests** - Avoid process overhead when testing host code
4. **Clean up workers in finally blocks** - Prevent orphaned processes
5. **Adjust timeouts for CI** - CI environments are slower than local machines
6. **Run integration tests sequentially** - Avoid socket conflicts
7. **Separate unit and integration tests** - Run fast tests frequently, slow tests less often

### Custom Transaction ID Generator Testing

When testing code that uses custom transaction ID generators, ensure your generator produces unique IDs:

```typescript
// custom-tx-generator.ts
export const customTxIdGenerator: TransactionIdGenerator<Messages> = (
  message
) => {
  return `${message.type}-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
};

// custom-tx-generator.spec.ts
import { customTxIdGenerator } from './custom-tx-generator';

describe('Custom Transaction ID Generator', () => {
  it('generates unique IDs for different calls', () => {
    const id1 = customTxIdGenerator({ type: 'test', payload: {}, tx: 'init' });
    const id2 = customTxIdGenerator({ type: 'test', payload: {}, tx: 'init' });

    expect(id1).not.toBe(id2);
  });

  it('includes message type in ID', () => {
    const id = customTxIdGenerator({
      type: 'processImage',
      payload: {},
      tx: 'init',
    });
    expect(id).toContain('processImage');
  });

  it('generates IDs compatible with transaction tracking', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = customTxIdGenerator({ type: 'test', payload: {}, tx: 'init' });
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  });
});
```

### Mock Worker Limitations

When using mock workers for testing, be aware that:

- **Mock workers bypass driver capability constraints** - They don't enforce driver-specific features or limitations
- No actual serialization/deserialization occurs
- Network/IO latency is not simulated
- Real process lifecycle events are not tested
- Socket/file cleanup is not verified

Use real workers in integration tests to verify driver-specific behavior, especially when:

- Testing serialization formats or custom serializers
- Verifying timeout handling across process boundaries
- Validating error propagation through actual IPC
- Testing resource limits or worker crashes

## See Also

- [Error Handling](/docs/guides/error-handling) - Testing error propagation
- [Worker Lifecycle](/docs/guides/worker-lifecycle) - Testing lifecycle events
- [Timeout Configuration](/docs/guides/timeout-configuration) - Configuring test timeouts
