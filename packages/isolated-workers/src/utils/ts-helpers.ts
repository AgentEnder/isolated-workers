/**
 * TypeScript helper utilities
 *
 * @packageDocumentation
 */

/**
 * Type-safe Object.seal that preserves the input type.
 * Seals the object to prevent adding new properties while
 * maintaining full type information.
 */
export function seal<T extends object>(obj: T): T {
  return Object.seal(obj);
}
