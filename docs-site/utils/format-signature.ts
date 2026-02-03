const DEFAULT_MAX_WIDTH = 60;
const INDENT = '  ';

/**
 * Format a TypeScript signature for better readability.
 * Breaks long signatures at logical points (parameters, type params).
 */
export function formatSignature(
  signature: string,
  maxWidth = DEFAULT_MAX_WIDTH
): string {
  // If it fits, don't modify
  if (signature.length <= maxWidth) {
    return signature;
  }

  // Match function signatures: keyword name<typeParams>(params): returnType
  const funcMatch = signature.match(
    /^(function|class|interface|type)\s+(\w+)(<[^>]+>)?\s*(\([^)]*\))?\s*(?::\s*(.+))?$/
  );

  if (!funcMatch) {
    // For type aliases or complex signatures, just return as-is
    return signature;
  }

  const [, keyword, name, typeParams, params, returnType] = funcMatch;

  const lines: string[] = [];
  let firstLine = `${keyword} ${name}`;

  // Handle type parameters
  if (typeParams) {
    const typeParamContent = typeParams.slice(1, -1); // Remove < >
    const typeParamList = splitAtTopLevel(typeParamContent, ',');

    if (typeParamList.length > 1 && typeParams.length > 30) {
      firstLine += '<';
      lines.push(firstLine);
      typeParamList.forEach((tp, i) => {
        const suffix = i < typeParamList.length - 1 ? ',' : '';
        lines.push(`${INDENT}${tp.trim()}${suffix}`);
      });
      firstLine = '>';
    } else {
      firstLine += typeParams;
    }
  }

  // Handle parameters
  if (params) {
    const paramContent = params.slice(1, -1); // Remove ( )
    const paramList = splitAtTopLevel(paramContent, ',');

    if (paramList.length > 0 && params.length > 30) {
      firstLine += '(';
      if (lines.length === 0) {
        lines.push(firstLine);
      } else {
        lines[lines.length - 1] += '(';
      }

      paramList.forEach((p, i) => {
        const suffix = i < paramList.length - 1 ? ',' : '';
        lines.push(`${INDENT}${p.trim()}${suffix}`);
      });

      if (returnType) {
        lines.push(`): ${returnType}`);
      } else {
        lines.push(')');
      }
    } else {
      // Params fit on one line
      if (lines.length === 0) {
        firstLine += params;
        if (returnType) {
          firstLine += `: ${returnType}`;
        }
        lines.push(firstLine);
      } else {
        lines[lines.length - 1] += params;
        if (returnType) {
          lines[lines.length - 1] += `: ${returnType}`;
        }
      }
    }
  } else if (lines.length === 0) {
    // No params (interface/class declaration)
    if (returnType) {
      firstLine += ` = ${returnType}`;
    }
    lines.push(firstLine);
  }

  return lines.join('\n');
}

/**
 * Split a string by delimiter, but only at the top level
 * (not inside nested brackets/parens/generics)
 */
function splitAtTopLevel(str: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of str) {
    if (char === '<' || char === '(' || char === '{' || char === '[') {
      depth++;
      current += char;
    } else if (char === '>' || char === ')' || char === '}' || char === ']') {
      depth--;
      current += char;
    } else if (char === delimiter && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}
