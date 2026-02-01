# AI Context Folder

This folder contains context and guidance for AI agents working on the isolated-workers project.

## Contents

- **plans/**: High-level implementation plans outlining WHAT to build and WHY
- **design-decisions/**: Architecture Decision Records (ADRs) documenting key design choices
- **implementation/**: Concrete implementation specifications covering HOW to build it

## Workflow Overview

The AI workflow follows a clear separation between **planning** and **implementation**:

```
Research & Planning          →          Implementation
(What & Why)                          (How)

    .ai/plans/                  →      .ai/implementation/
   - Consumer workflows                  - Technical specifications
   - Edge cases                          - File-by-file breakdowns
   - Success criteria                    - Concrete implementation steps
   - Guidance, not code                  - Executable specifications
```

## Folder Purposes

### `.ai/plans/`

**Purpose**: Define WHAT we're building and WHY

**Contents**:

- Consumer workflows and use cases
- Edge cases and error scenarios
- Success criteria and acceptance criteria
- High-level architecture guidance
- Research excerpts and references

**Style**:

- Focus on problems and requirements
- Minimal implementation details
- No specific file paths or code
- Guidance for thinking, not doing

**Naming**: `##-descriptive-name.md` (e.g., `03-package-structure.md`)

**Example**: A plan might say "Workers should support graceful shutdown with timeout" but won't specify which file contains the timeout logic.

### `.ai/design-decisions/`

**Purpose**: Document WHY we chose specific approaches

**Contents**:

- Architecture Decision Records (ADRs)
- Technology choices with rationale
- Alternatives considered
- Trade-offs and consequences

**Style**:

- Decision-focused
- Include context and consequences
- Reference relevant plans

**Naming**: `###-decision-name.md` (e.g., `001-messaging-pattern.md`)

### `.ai/implementation/`

**Purpose**: Define HOW to implement the plans

**Contents**:

- Technical specifications
- File-by-file breakdowns
- Concrete code patterns
- Implementation phases with dates
- Specific architectural decisions

**Style**:

- File paths and module structure
- Function signatures and types
- Step-by-step implementation guide
- Code examples and patterns

**Naming**: `YYYY-MM-DD-phase-name/` with `README.md` inside

**Example**: An implementation doc will say "Create `src/core/worker.ts` with `createWorker()` function that accepts `WorkerOptions` and returns `WorkerHandle`"

## Plan vs Implementation

| Aspect       | Plan (`.ai/plans/`)                 | Implementation (`.ai/implementation/`) |
| ------------ | ----------------------------------- | -------------------------------------- |
| **Focus**    | WHAT & WHY                          | HOW                                    |
| **Content**  | Workflows, edge cases, requirements | Files, functions, types, code          |
| **Timing**   | Before/during design                | After plan approved, during coding     |
| **Updates**  | Rarely changes once set             | Iterates as implementation proceeds    |
| **Audience** | All stakeholders                    | Implementers (AI agents, developers)   |

## Writing New Plans

When creating a plan in `.ai/plans/`:

1. **Start with the problem**: What are we trying to solve?
2. **Define success criteria**: How will we know it's done?
3. **Consider edge cases**: What could go wrong?
4. **Reference research**: Link to relevant code or documentation
5. **Avoid implementation details**: Don't specify files or code
6. **Update README**: Add to the plan index with status

### Plan Template

```markdown
# Phase N: Plan Title

## Overview

What are we building and why?

## Dependencies

What needs to be done first?

## Key Requirements

### Functional Requirements

- Feature A should do X
- Feature B should handle Y

### Non-Functional Requirements

- Performance criteria
- Type safety requirements

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Edge Cases

- What happens when...?
- Error scenarios

## Open Questions

1. Question 1?
2. Question 2?

## Research References

- Link to Nx code
- Link to cli-forge patterns
```

## Writing Implementation Phases

When creating implementation docs in `.ai/implementation/`:

1. **Reference the plan**: Link to the relevant `.ai/plans/` file
2. **Define file structure**: List all files to create/modify
3. **Specify interfaces**: Define types, function signatures
4. **Break into steps**: Ordered implementation tasks
5. **Include code examples**: Concrete patterns to follow
6. **Track status**: Mark complete as you finish

### Implementation Template

```markdown
# Implementation: Feature Name

## Status: 🔄 IN PROGRESS / ✅ COMPLETE

## Dependencies

- ✅ Plan N approved
- ✅ Previous phase complete

## What We're Building

Reference to plan and specific goals for this phase.

### Key Files
```

packages/isolated-workers/src/
├── core/
│ └── feature.ts # Main implementation
└── types/
└── feature.ts # Type definitions

````

### Public API

```typescript
export interface FeatureOptions {
  // ...
}

export async function createFeature(options: FeatureOptions): Promise<Feature>;
````

## Implementation Steps

1. Create type definitions
2. Implement core logic
3. Add error handling
4. Write tests

## Success Criteria

- [ ] Step 1 complete
- [ ] Step 2 complete

```

## Status Tracking

Keep plan status updated in `.ai/plans/README.md`:

- **Not Started**: Plan exists but no work begun
- **In Progress**: Implementation phase active
- **Completed**: All success criteria met
- **Blocked**: Waiting on dependencies

## Cross-References

Always link between related documents:

- Plans should reference design decisions
- Implementation should reference plans
- Design decisions should reference affected plans
- Use relative links: `[Plan Name](./##-plan-name.md)`

## AI Agent Guidelines

### When Starting Work

1. Check `.ai/plans/README.md` for current status
2. Read the relevant plan(s) for context
3. Check for existing implementation phases
4. Understand the WHAT before the HOW

### During Implementation

1. Create implementation docs as you go
2. Update plan status when starting/completing
3. Document technical decisions in implementation/
4. Reference source material (Nx, cli-forge)

### When Completing

1. Mark implementation phase as complete
2. Update plan status to reflect completion
3. Verify all success criteria met
4. Document any deviations from plan

### When Blocked

1. Document the blocker in implementation/
2. Consider if plan needs updating
3. Ask clarifying questions
4. Don't guess—reference source material

## Key Principles

1. **Plans are guidance**: They set direction but don't dictate implementation
2. **Implementation is concrete**: It specifies exactly what to build
3. **Keep them separate**: Don't mix planning details with implementation files
4. **Status matters**: Keep plan status accurate for visibility
5. **Reference liberally**: Link between docs to maintain context

## Contact

For questions about this workflow:
- Review existing plans and implementations for patterns
- Check `.ai/design-decisions/` for architectural context
- Reference `../nx/` and `../cli-forge/` for source patterns
```
