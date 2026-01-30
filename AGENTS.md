# AI Agent Context for isolated-workers

## Project Overview

**isolated-workers** is a type-safe worker process library for Node.js, extracting proven patterns from Nx's isolated plugin architecture. The goal is to provide a reusable library for spawning and managing worker processes with full TypeScript type safety.

### Key Goals

- Type-safe IPC (inter-process communication) with full TypeScript inference
- Worker lifecycle management (spawn, connect, shutdown)
- Request/response pattern with timeout support
- Cross-platform support (Unix domain sockets / named pipes)
- Developer-friendly API with clear error messages

### Tech Stack

- **Build System**: Nx monorepo
- **Package Manager**: pnpm with workspace catalog
- **Language**: TypeScript
- **Testing**: Jest for unit tests, type tests for inference validation
- **Documentation**: Vike + Pagefind
- **Examples**: Single-file examples with YAML front-matter

## Repository Structure

```
isolated-workers/
├── packages/
│   └── isolated-workers/       # Main library package
├── examples/                    # Usage examples
├── docs/                       # Documentation site (Vike)
├── e2e/                        # End-to-end tests
├── .ai/                        # AI context and planning
│   ├── plans/                  # Implementation plans
│   └── design-decisions/       # ADR (Architecture Decision Records)
├── CLAUDE.md                   # Symlink to development guidelines
└── AGENTS.md                   # This file
```

## Current Phase

**Phase**: Initial Setup (Plans 1-2)
- Defining repository structure
- Establishing build tooling (Nx + pnpm)
- Documenting design decisions
- Setting up development environment

## Important Context

### Source of Inspiration

This project extracts patterns from Nx's isolated plugin architecture:
- Worker spawning and socket management
- Type-safe messaging with transaction IDs
- Connection lifecycle management
- Error serialization across process boundaries

### Related Projects

- **Nx**: Source of isolation patterns (`../nx/packages/nx/src/project-graph/plugins/isolation/`)
- **cli-forge**: Reference for monorepo structure, documentation, and testing patterns

### Type Safety Philosophy

- **Zero `any` in public API**: All user-facing APIs must be fully typed
- **Type tests**: Validate complex type inference behavior
- **DefineMessages pattern**: Use `DefineMessages<T>` for message definitions
- **Type extraction helpers**: Leverage `MessageOf`, `ResultOf`, `WithResult`
- **Handler payload return**: Handlers return raw payloads, infrastructure wraps them
- **Discriminated unions**: Use for message types with `type` field
- **Type guards**: Runtime validation for message types

## Architecture Decisions

### Communication Pattern

- Request/response with transaction IDs (not just fire-and-forget)
- Unix domain sockets (*nix) / named pipes (Windows)
- Timeout guards (default 10 minutes, configurable)
- Pending operation tracking
- Message definitions use `DefineMessages<T>` pattern (from Nx3)
- Type extraction helpers: `MessageOf`, `ResultOf`, `WithResult`
- Handlers return raw payloads, infrastructure wraps them automatically

### Component Layers

1. **Public API**: User-facing exports (createWorker, types)
2. **Core Components**: Worker spawner, connection manager, messaging
3. **Utilities**: Socket helpers, serializer, paths, logger

### Testing Strategy

- Unit tests for core components
- Type tests for complex inference scenarios
- E2E tests for full workflows
- Examples system with auto-generated documentation

## Development Guidelines

### Code Style

- Follow existing patterns from Nx isolation code
- Use TypeScript strict mode
- Concrete types over `any`/`unknown`
- Early returns to reduce nesting
- Meaningful variable names

### Before Making Changes

1. Understand the Nx pattern being extracted
2. Consider the type safety implications of your changes
3. Reference design decisions when relevant to specific work (`.ai/design-decisions/`)
4. Check implementation plans when needed for context (`.ai/plans/`)

### When Stuck

1. Reference the Nx isolation code for patterns
2. Check cli-forge for monorepo/testing patterns
3. Review design decisions when relevant to your work
4. Ask clarifying questions about requirements

## Current Task Status

- [x] Design decisions documented
- [x] Architecture plan updated with Nx3 messaging patterns
- [ ] Nx monorepo initialized
- [ ] pnpm workspace configured
- [ ] Core library package structure created
- [ ] Worker spawning mechanism implemented
- [ ] Type-safe messaging layer implemented
- [ ] Tests written and passing

## Next Steps

After this initial setup:
1. Implement worker spawner with socket server
2. Build connection manager with retry logic
3. Create messaging layer with DefineMessages pattern and type helpers
4. Add tests for all components (unit + type tests)
5. Set up documentation site
6. Create initial examples

## Contact

For questions about architecture or decisions, reference `.ai/` folder:
- Design decisions: `.ai/design-decisions/`
- Implementation plans: `.ai/plans/`
- Nx isolation patterns: `../nx/packages/nx/src/project-graph/plugins/isolation/`

For questions about monorepo setup or testing patterns, reference:
- cli-forge repository: `../cli-forge`
