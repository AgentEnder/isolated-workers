/**
 * Parse a type string into parts, identifying type names vs symbols.
 * Used for linking type names to their API pages.
 */
export function parseTypeString(
  type: string
): Array<{ text: string; isType: boolean }> {
  const parts: Array<{ text: string; isType: boolean }> = [];
  let current = '';
  let isInTypeName = false;

  for (const char of type) {
    const isTypeChar = /[a-zA-Z0-9_]/.test(char);

    if (isTypeChar && !isInTypeName) {
      // Starting a type name
      if (current) {
        parts.push({ text: current, isType: false });
        current = '';
      }
      isInTypeName = true;
    } else if (!isTypeChar && isInTypeName) {
      // Ending a type name
      if (current) {
        parts.push({ text: current, isType: true });
        current = '';
      }
      isInTypeName = false;
    }

    current += char;
  }

  if (current) {
    parts.push({ text: current, isType: isInTypeName });
  }

  return parts;
}
