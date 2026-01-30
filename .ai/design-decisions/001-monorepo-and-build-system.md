# Monorepo and Build System

## Decision: Use Nx for Workspace Management
**Status**: ✅ Accepted  
**Context**: Need to manage multiple packages (core library, examples, documentation)  
**Alternatives Considered**: Lerna, Turborepo, Rush  
**Rationale**:
- Nx provides excellent TypeScript support
- Built-in caching for faster builds
- Matches the tooling used in cli-forge project
- Good monorepo visualization tools
- Supports both Node.js and web-based projects

## Decision: Use pnpm with Workspace Catalog
**Status**: ✅ Accepted  
**Context**: Need efficient package management with strict dependencies  
**Alternatives Considered**: npm workspaces, Yarn workspaces  
**Rationale**:
- Faster than npm/Yarn due to content-addressable storage
- Workspace catalog simplifies version management
- Prevents phantom dependencies
- Matches the setup in cli-forge for consistency

## Decision: Single Package Structure (Phase 1)
**Status**: ✅ Accepted  
**Context**: Initial phase focusing on core library  
**Alternatives Considered**: Multiple packages from start  
**Rationale**:
- Simplifies early development
- Can split into packages later if needed
- Matches cli-forge pattern of starting focused
