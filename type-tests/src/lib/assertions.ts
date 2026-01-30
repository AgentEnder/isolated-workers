/**
 * Type-narrowing assertion helpers for type tests
 *
 * These helpers provide type narrowing that vitest's expect().toBeDefined() doesn't provide.
 * Use these instead of non-null assertions (!) to satisfy lint rules.
 */

import { expect } from 'vitest';
import * as ts from 'typescript';

/**
 * Asserts that a value is defined and narrows the type to exclude undefined/null.
 * Replaces the pattern: `expect(x).toBeDefined(); x!.property`
 * With: `const definedX = assertDefined(x); definedX.property`
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): T {
  expect(value).toBeDefined();
  if (value === null || value === undefined) {
    throw new Error(message ?? 'Expected value to be defined');
  }
  return value;
}

/**
 * Asserts that a symbol has declarations and returns the first declaration.
 * Replaces: `symbol!.declarations![0]`
 */
export function getFirstDeclaration(
  symbol: ts.Symbol | undefined
): ts.Declaration {
  const definedSymbol = assertDefined(symbol, 'Expected symbol to be defined');
  const declarations = assertDefined(
    definedSymbol.declarations,
    'Expected symbol to have declarations'
  );
  const firstDecl = declarations[0];
  if (!firstDecl) {
    throw new Error('Expected at least one declaration');
  }
  return firstDecl;
}

/**
 * Gets a property from a type, asserting it exists.
 * Replaces: `type.getProperty('name')!`
 */
export function getRequiredProperty(
  type: ts.Type,
  propName: string
): ts.Symbol {
  const prop = type.getProperty(propName);
  return assertDefined(prop, `Expected type to have property '${propName}'`);
}

/**
 * Gets the type of a symbol from the type checker, asserting the symbol is defined.
 * Replaces: `typeChecker.getTypeOfSymbol(symbol!)`
 */
export function getTypeOfSymbolChecked(
  typeChecker: ts.TypeChecker,
  symbol: ts.Symbol | undefined
): ts.Type {
  const definedSymbol = assertDefined(symbol, 'Expected symbol to be defined');
  return typeChecker.getTypeOfSymbol(definedSymbol);
}
