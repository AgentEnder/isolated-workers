# Implementation Plans

This directory contains the phased implementation plans for the isolated-workers library.

## Plan Index

| #   | Plan                                                                                    | Status       | Description                                         |
| --- | --------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------- |
| 1   | [Initial Research](./01-initial-research.md)                                            | ✅ Completed | Requirements gathering and tech stack decisions     |
| 2   | [Architecture Design](./02-architecture.md)                                             | ✅ Completed | System architecture and component design            |
| 3   | [Package Structure](./03-package-structure.md)                                          | ✅ Completed | Nx monorepo setup and package configuration         |
| 4   | [Type Safety Infrastructure](./04-type-safety-infrastructure.md)                        | ✅ Completed | Type tests and assertion utilities                  |
| 5   | [Core Implementation](./05-core-implementation.md)                                      | ✅ Completed | Worker spawner, connection manager, messaging layer |
| 6   | [Testing, Examples & Docs](./06-testing-and-docs.md)                                    | ⏳ Pending   | Unit/type/E2E tests, runnable examples, docs site   |
| 7   | [Enhanced Configuration](./07-enhanced-configuration.md)                                | 📝 Draft     | Comprehensive configuration options and middleware  |
| 8   | [Markdown Docs & Code Hunks](./2026-02-01-markdown-docs-and-code-hunks-design.md)       | ✅ Completed | Markdown docs system with code region extraction    |
| 9   | [Driver Abstraction](./09-driver-abstraction.md)                                        | ✅ Completed | Driver pattern for child_process/worker_threads     |
| 10  | [TypeDoc API Reference](./10-typedoc-api-reference.md)                                  | ✅ Completed | Dynamic API docs from TypeDoc JSON                  |
| 11  | [TypeDoc with Liquid Tags Integration](./11-typedoc-liquid-integration.md)                          | 📝 Draft     | Accurate type references via typedoc liquid tags  |
| 12  | [Unexpected Shutdown Handling](./12-unexpected-shutdown-handling.md)                          | ✅ Completed | Crash detection and configurable recovery         |
| 13  | [Documentation Accuracy Fixes](./10-documentation-accuracy-fixes.md)                       | ✅ Completed | Fix all accuracy issues in /docs/ folder       |
| 14  | [E2E Isolation Tests](./e2e-isolation-tests.md)                                        | 🔄 In Progress | Global and module isolation tests with Vite           |
| 15  | [Cross-Environment Web Worker Driver](./15-cross-environment-web-worker-driver.md)     | 📝 Draft        | Web Worker driver for browser environments            |

## Status Legend

- ✅ **Completed**: Plan fully implemented and verified
- 🔄 **In Progress**: Currently being worked on
- ⏳ **Pending**: Not yet started, blocked by dependencies
- 📝 **Draft**: Plan exists but needs refinement

## Current Focus

**Recently Completed**: 14 - E2E Isolation Tests

**Status**: 🔄 In Progress

**Summary**: E2E isolation tests implemented with:
- Vitest configuration for Node environment with parallel execution
- 5 worker fixtures for isolation testing (global, module, require hooks, env, shared module)
- 5 test suites covering global, module, require hook, environment variable, and concurrent isolation
- 18/34 tests passing (all child_process driver tests)
- Updated e2e targets to include both examples and isolation tests
- Added root scripts for running e2e tests

**Known Issue**: WorkerThreadsDriver tests failing due to tsx bootstrapping conflict (ERR_REQUIRE_CYCLE_MODULE). This is an infrastructure issue in the driver, not an isolation failure.

**Validated Isolation** (child_process driver):
- ✅ Global properties isolated between workers
- ✅ Module-level state isolated (each worker has independent module instance)
- ✅ Require.extensions hooks isolated
- ✅ Environment variables isolated
- ✅ Spawn-time environment variables respected
- ✅ Concurrent workers maintain isolation (tested with 10-20 workers)

**Previously Completed**: 12 - Unexpected Shutdown Handling

**Summary**: Crash detection and configurable recovery implemented with:
- ShutdownReason discriminated union (exit/error/close)
- UnexpectedShutdownStrategy (reject or retry with attempts)
- UnexpectedShutdownConfig with per-message-type overrides
- WorkerCrashedError with rich context (reason, messageType, attempt, maxAttempts)
- Idempotent shutdown handling (shutdownHandled flag)
- Retry worker spawning with handler re-registration
- Both child_process and worker_threads drivers supported
- Comprehensive documentation in docs/guides/shutdown-handling.md

## Plan Dependencies

```
01-initial-research
       ↓
02-architecture
       ↓
03-package-structure
       ↓
       ├→ 04-type-safety-infrastructure
       └→ 05-core-implementation
             ↓
       06-testing-examples-docs
             ↓
             ├→ 07-enhanced-configuration
             └→ 09-driver-abstraction
                   ↓
                   10-typedoc-api-reference
                   ↓
                   11-typedoc-liquid-integration
```

**Note:** Phase 6 combines testing and documentation because examples serve as both E2E tests and documentation content. Phase 7 builds on the core implementation to add comprehensive configuration options. Phase 9 introduces the driver abstraction pattern for child_process/worker_threads support.

## Creating New Plans

When creating a new plan:

1. Use the naming convention: `##-descriptive-name.md`
2. Include a clear objective and scope section
3. Define success criteria with checkboxes
4. Reference any blocking dependencies
5. Update this README with the plan entry

## Success Criteria by Phase

### Phase 1-2: Foundation

- Repository structure established
- Design decisions documented
- Architecture patterns defined

### Phase 3: Setup

- Nx monorepo initialized
- pnpm workspace configured
- Core library package structure created
- Build and test targets working

### Phase 4: Type Safety

- Type tests package created
- Assertion helpers implemented
- Type extraction utilities ready

### Phase 5: Core Implementation

- Worker spawning mechanism implemented
- Connection manager with retry logic
- Type-safe messaging layer
- Cross-platform socket support

### Phase 6: Polish

- Unit tests passing
- E2E tests passing
- Documentation site building
- Examples working
