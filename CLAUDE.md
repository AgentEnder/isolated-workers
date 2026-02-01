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
- Unix domain sockets (\*nix) / named pipes (Windows)
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

### Installing Dependencies

- In general, avoid it. Only add dependencies when absolutely necessary, or explicitly instructed.
- When adding dependencies, dev tooling that is going to be used across multiple packages should be added at the root level.
- Any package-specific dependencies should be added to that package's `package.json`.
- Use `pnpm` for package management, and store versions in `pnpm-workspace.yaml`'s default catalog.

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
5. **Keep plan status in sync**: When working on an implementation phase that ties back to a plan in `.ai/plans/`, update the plan status in the README to reflect current work (e.g., mark as "In Progress" when starting, "Completed" when finished)

### When Stuck

1. Reference the Nx isolation code for patterns
2. Check cli-forge for monorepo/testing patterns
3. Review design decisions when relevant to your work
4. Ask clarifying questions about requirements

### After Changes

1. Run typechecks and linting: `pnpm run-many -t  lint,build`
2. Run unit tests: `pnpm nx run-many -t test`
3. Run e2e: `pnpm nx run-many -t e2e`

## AI Workflow

This project uses a structured approach for AI agent collaboration. See [`.ai/README.md`](./.ai/README.md) for full details.

### ⚠️ MANDATORY: Implementation Workflow Checklist

**Before writing ANY code, complete these steps:**

1. [ ] **Create/update plan** in `.ai/plans/YYYY-MM-DD-feature-name.md`
2. [ ] **Update plan index** in `.ai/plans/README.md` with new entry and status
3. [ ] **Create ADR** in `.ai/design-decisions/` for each significant choice:
   - New library/dependency additions
   - Syntax or API design decisions
   - Architecture pattern choices
   - Trade-off decisions between alternatives
4. [ ] **Create implementation doc** in `.ai/implementation/YYYY-MM-DD-feature-name/`

**During implementation:**

5. [ ] **Update plan status** to "🔄 In Progress" in `.ai/plans/README.md`

**After implementation:**

6. [ ] **Mark plan completed** (✅) in `.ai/plans/README.md`
7. [ ] **Verify ADRs** capture all significant decisions made during implementation
8. [ ] **Update implementation doc** with any deviations from original plan

> **This checklist is not optional.** External skills (like superpowers) provide workflows, but this project's documentation structure must still be followed.

### Quick Reference

**Three Layers of Documentation:**

1. **Plans** (`.ai/plans/`): **WHAT & WHY** — Consumer workflows, edge cases, success criteria
2. **Design Decisions** (`.ai/design-decisions/`): **WHY** — ADRs documenting key choices
3. **Implementation** (`.ai/implementation/`): **HOW** — Technical specs, file structure, code

### When to Create an ADR

Create an ADR in `.ai/design-decisions/` when you:

- Add a new dependency (e.g., "Why gray-matter for frontmatter parsing?")
- Choose between syntax options (e.g., "Why Liquid tags over Handlebars?")
- Make architectural decisions (e.g., "Why build-time validation over runtime?")
- Reject an alternative approach (document what was considered and why)

ADR filename format: `###-short-description.md` (e.g., `008-liquid-tag-syntax.md`)

### Working with Plans

- Plans provide guidance, not implementation details
- Read the plan first to understand the problem
- Update plan status in `.ai/plans/README.md` as you work
- Create implementation docs in `.ai/implementation/` for the HOW

### Plan vs Implementation

| Plan (`.ai/plans/`)              | Implementation (`.ai/implementation/`)                            |
| -------------------------------- | ----------------------------------------------------------------- |
| "Workers need graceful shutdown" | "Create `src/core/worker.ts` with `shutdown()` method"            |
| "Support cross-platform sockets" | "Implement `SocketAdapter` interface with Unix/Windows adapters"  |
| "Type-safe messaging"            | "Define `MessageOf<T, K>` helper type in `src/types/messages.ts`" |

### Key Rule

**Never mix planning and implementation details.** Plans stay high-level; implementation gets specific.

## Contact

For questions about architecture or decisions, reference `.ai/` folder:

- AI workflow guide: `.ai/README.md`
- Design decisions: `.ai/design-decisions/`
- Implementation plans: `.ai/plans/`
- Nx isolation patterns: `../nx/packages/nx/src/project-graph/plugins/isolation/`

For questions about monorepo setup or testing patterns, reference:

- cli-forge repository: `../cli-forge`
