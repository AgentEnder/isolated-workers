# Type Safety and Testing

## Decision: Follow cli-forge Type Testing Pattern

**Status**: ✅ Accepted  
**Context**: Ensure complex TypeScript type inference works correctly  
**Alternatives Considered**: Runtime tests only, tsd  
**Rationale**:

- Validates compile-time type behavior
- Catches type errors early
- Proven pattern from cli-forge
- Complements unit tests

## Decision: Zero `any` in Public API

**Status**: ✅ Accepted  
**Context**: Maintain strict type safety for users  
**Alternatives Considered**: Allow `any` in internal utilities  
**Rationale**:

- Full type inference for users
- Prevents accidental type loss
- Clear expectations for contributors
- Improves DX with IDE autocomplete

## Decision: Table-Driven Tests

**Status**: ✅ Accepted  
**Context**: Test complex business logic efficiently  
**Alternatives Considered**: One test per assertion, Property-based testing  
**Rationale**:

- Clear test structure
- Easy to add new test cases
- Follows Go/Node testing best practices
- Readable and maintainable

## Decision: Type Guards for Runtime Validation

**Status**: ✅ Accepted
**Context**: Validate message types at runtime
**Alternatives Considered**: Trust serialization, JSON Schema
**Rationale**:

- Simple and lightweight
- Works with TypeScript types
- Catches serialization errors
- No additional dependencies needed

## Decision: Type Extraction Helper Library

**Status**: ✅ Accepted
**Context**: Provide core type helpers for message definitions
**Alternatives Considered**: Inline types, External libraries
**Rationale**:

- Reusable patterns reduce boilerplate
- Consistent type extraction across library
- Easier to test and validate
- No external dependencies

**Core Type Helpers:**

- `MessageOf<TDefs, K>` - Extract full message type for a key
- `ResultOf<TDefs, K>` - Extract full result type for a key
- `WithResult<TDefs>` - Get keys that have results defined
- `AllMessages<TDefs>` - Union of all message types
- `AllResults<TDefs>` - Union of all result types
- `MessageResult<T>` - Map message type to result type
