# Documentation Strategy

## Decision: Use Vike + Pagefind

**Status**: ✅ Accepted  
**Context**: Need documentation site for the library  
**Alternatives Considered**: Docusaurus, Astro, VitePress  
**Rationale**:

- Simpler than Docusaurus (less overhead)
- Native TypeScript support
- Pagefind for excellent search
- Matches cli-forge documentation setup
- Fast development with HMR

## Decision: Examples System with YAML Front-Matter

**Status**: ✅ Accepted  
**Context**: Need to demonstrate library usage  
**Alternatives Considered**: Inline docs only, Storybook  
**Rationale**:

- Matches cli-forge pattern for consistency
- Allows for automated testing of examples
- Single-file examples with metadata for easy organization
- Can generate documentation from examples

## Decision: API Reference Auto-Generation

**Status**: ✅ Accepted  
**Context**: Need accurate, up-to-date API docs  
**Alternatives Considered**: Manual API docs, Typedoc  
**Rationale**:

- Stays in sync with code changes
- Reduces maintenance burden
- Type annotations provide rich documentation
- Will integrate with Vike site
