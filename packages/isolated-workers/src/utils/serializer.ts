/**
 * Pluggable serialization with error handling
 *
 * @packageDocumentation
 */

/**
 * Serialized error structure for cross-process communication
 */
export interface SerializedError {
  /** Error message */
  message: string;
  /** Error type name */
  name: string;
  /** Stack trace (optional) */
  stack?: string;
  /** Error code for Node.js errors */
  code?: string;
}

/**
 * Abstract serializer class for custom message serialization.
 * Includes terminator sequence to delimit messages in the stream.
 *
 * IMPORTANT: Must be a named class (not anonymous) for mismatch detection.
 *
 * @category Serialization
 */
export abstract class Serializer {
  /**
   * Serialize data to string or Uint8Array
   */
  abstract serialize<T>(data: T): string | Uint8Array;

  /**
   * Deserialize string or Uint8Array back to data
   */
  abstract deserialize<T>(data: string | Uint8Array): T;

  /**
   * Terminator sequence used to delimit messages in the stream.
   * Must be the same on both client and server.
   */
  abstract terminator: string | Uint8Array;
}

/**
 * Default JSON serializer with newline terminator
 *
 * @category Serialization
 */
export class JsonSerializer extends Serializer {
  serialize<T>(data: T): string {
    return JSON.stringify(data);
  }

  deserialize<T>(data: string | Uint8Array): T {
    const str =
      typeof data === 'string' ? data : new TextDecoder().decode(data);
    return JSON.parse(str) as T;
  }

  terminator = '\n';
}

/**
 * Default serializer instance
 */
export const defaultSerializer = new JsonSerializer();

/**
 * Get the serializer terminator as a Uint8Array
 */
export function getTerminatorBuffer(serializer: Serializer): Uint8Array {
  if (serializer.terminator instanceof Uint8Array) {
    return serializer.terminator;
  }
  return new TextEncoder().encode(serializer.terminator);
}

/**
 * Validate that worker serializer matches host serializer.
 * Called on worker startup.
 */
export function validateSerializer(serializer: Serializer): void {
  const expectedName = process.env.ISOLATED_WORKERS_SERIALIZER;
  const actualName = serializer.constructor.name;

  if (expectedName && actualName !== expectedName) {
    throw new Error(
      `Serializer mismatch: host uses ${expectedName}, worker uses ${actualName}. ` +
        `Ensure both client and server use the same serializer class.`
    );
  }
}

/**
 * Serialize an error to a plain object
 * @param error - Error to serialize
 * @returns Serialized error
 */
export function serializeError(error: Error): SerializedError {
  const serialized: SerializedError = {
    message: error.message,
    name: error.name,
    stack: error.stack,
  };

  // Handle Node.js errors with code property
  if ('code' in error && typeof error.code === 'string') {
    serialized.code = error.code;
  }

  return serialized;
}

/**
 * Deserialize a serialized error back to an Error instance
 * @param serialized - Serialized error
 * @returns Reconstructed Error instance
 */
export function deserializeError(serialized: SerializedError): Error {
  const error = new Error(serialized.message);
  error.name = serialized.name;
  error.stack = serialized.stack;

  // Restore code if present
  if (serialized.code) {
    (error as Error & { code: string }).code = serialized.code;
  }

  return error;
}
