# Plan: E2E Isolation Tests with Vite

## Objective

Add comprehensive e2e tests that verify worker process isolation using Vite as the test runner. These tests will validate that each driver provides true process isolation, ensuring that state modifications in one worker do not leak to other workers.

## Background

Currently, the e2e tests rely solely on examples run via a custom runner (`run-examples.ts`). While examples demonstrate basic functionality, they don't systematically test isolation guarantees across multiple workers spawned simultaneously.

## Success Criteria

1. **Test Suite Created**: A dedicated e2e test suite using Vite that can run in parallel
2. **Multiple Drivers Tested**: Tests cover both `child_process` and `worker_threads` drivers
3. **Isolation Validated**: Tests verify that the following are isolated between workers:
   - Global properties (`globalThis`, `global`)
   - Module-level properties (monkey-patching of required modules)
   - Require hooks (modifying `require.extensions`)
   - Environment variables
   - Process state (argv, cwd, etc.)
4. **Parallel Execution**: Tests can spawn multiple workers concurrently without interference
5. **CI Integration**: Tests run as part of the existing e2e target
6. **Documentation**: Test files include comments explaining what's being tested

## Implementation Plan

### Phase 1: Setup Test Infrastructure

**File**: `e2e/isolation/vitest.config.ts`

- Create Vite/Vitest config for e2e isolation tests
- Configure to run in Node environment
- Set up proper workspace root resolution for test files
- Enable parallel test execution

**File**: `e2e/isolation/package.json` (if needed)

- Create minimal package.json for isolation tests
- Define dependencies (vitest, typescript, tsx, etc.)
- Define test scripts

### Phase 2: Create Test Fixtures

**Directory**: `e2e/isolation/fixtures/`

Create reusable worker scripts that can be used across tests:

1. **`global-pollution-worker.ts`**: Sets global properties, returns them
2. **`module-pollution-worker.ts`**: Requires a module and modifies its exports
3. **require-hook-worker.ts`**: Sets up require hooks
4. **`env-modification-worker.ts`**: Modifies process.env
5. **`shared-module.ts`**: A simple module that can be monkey-patched

### Phase 3: Implement Isolation Tests

**File**: `e2e/isolation/global-isolation.test.ts`

Test that global properties are isolated:
- Spawn 3 workers
- Each worker sets a unique global property
- Query each worker for its globals
- Verify workers only see their own properties
- Test both drivers (child_process, worker_threads)

**File**: `e2e/isolation/module-isolation.test.ts`

Test that module-level modifications are isolated:
- Workers require a shared module
- Each worker modifies the module's exports
- Verify each worker sees its own modifications, not others'
- Test both drivers

**File**: `e2e/isolation/require-hook-isolation.test.ts`

Test that require hooks are isolated:
- Workers set up custom require hooks
- Verify hooks don't interfere across workers
- Test that one worker's require extensions don't affect another
- Test both drivers

**File**: `e2e/isolation/environment-isolation.test.ts`

Test that environment variables are isolated:
- Workers modify process.env
- Verify modifications don't leak to other workers
- Test with env options passed at spawn time
- Test both drivers

**File**: `e2e/isolation/concurrent-isolation.test.ts`

Stress test with high concurrency:
- Spawn 10-20 workers concurrently
- Each worker performs multiple isolation violations
- Verify no interference across any workers
- Test both drivers separately

### Phase 4: Update E2E Target

**File**: `e2e/project.json`

Update e2e target to include both:
- Existing example runner (`run-examples.ts`)
- New isolation test suite (Vitest)

Example:
```json
{
  "targets": {
    "e2e": {
      "command": "pnpm run:e2e",
      "dependsOn": ["isolated-workers:build"]
    },
    "e2e:examples": {
      "command": "tsx {projectRoot}/run-examples.ts",
      "dependsOn": ["isolated-workers:build"]
    },
    "e2e:isolation": {
      "command": "pnpm --filter isolated-workers-e2e test",
      "dependsOn": ["isolated-workers:build"]
    }
  }
}
```

### Phase 5: Update Root Scripts

**File**: `package.json` (root)

Add convenience scripts for running specific e2e tests:
```json
{
  "scripts": {
    "e2e": "pnpm nx run-many -t e2e",
    "e2e:examples": "pnpm nx run-many -t e2e:examples",
    "e2e:isolation": "pnpm nx run-many -t e2e:isolation"
  }
}
```

## Test Patterns

### Basic Isolation Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { createWorker } from 'isolated-workers';
import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';

describe('X isolation', () => {
  it.each([
    ['child_process', undefined],
    ['worker_threads', WorkerThreadsDriver],
  ])('isolates %s', async (name, driver) => {
    // Spawn multiple workers
    const workers = await Promise.all([
      createWorker(..., { driver }),
      createWorker(..., { driver }),
      createWorker(..., { driver }),
    ]);

    // Each worker modifies state
    await Promise.all([
      workers[0].send('modifyState', { ... }),
      workers[1].send('modifyState', { ... }),
      workers[2].send('modifyState', { ... }),
    ]);

    // Verify each worker only sees its own state
    const states = await Promise.all([
      workers[0].send('getState'),
      workers[1].send('getState'),
      workers[2].send('getState'),
    ]);

    expect(states[0]).toEqual({ ... });
    expect(states[1]).toEqual({ ... });
    expect(states[2]).toEqual({ ... });

    // Cleanup
    await Promise.all(workers.map(w => w.close()));
  });
});
```

## Edge Cases to Consider

1. **Shared Modules**: Multiple workers requiring the same file path - should each get their own module cache
2. **Module Resolution**: Ensure workers don't share the same require.cache entries
3. **Timing**: Workers spawned in quick succession should still be isolated
4. **Crash Recovery**: If a worker crashes, other workers should remain unaffected
5. **Memory**: Verify isolation doesn't cause excessive memory usage

## Open Questions

1. **Test Execution**: Should isolation tests run in parallel with each other? (Probably yes, to verify parallel isolation)
2. **Fixture Location**: Should fixtures live in `e2e/isolation/fixtures/` or be inline? (Separate fixtures for reusability)
3. **Cleanup**: How to ensure workers are cleaned up even if tests fail? (Use `afterEach` hooks)

## Dependencies

- vitest (already in workspace catalog)
- typescript (already in workspace catalog)
- tsx (already in workspace catalog)
- isolated-workers (main package)

## Estimated Effort

- Phase 1: 1 hour (setup config)
- Phase 2: 2 hours (create fixtures)
- Phase 3: 4 hours (implement tests)
- Phase 4: 0.5 hours (update targets)
- Phase 5: 0.5 hours (update scripts)
- Total: 8 hours
