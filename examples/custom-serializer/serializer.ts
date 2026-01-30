/**
 * Custom Serializer Implementation
 *
 * This example shows how to create a custom serializer.
 * A real use case might be using MessagePack, Protocol Buffers,
 * or adding compression/encryption.
 *
 * IMPORTANT: The serializer class must be named (not anonymous)
 * for mismatch detection to work properly.
 */

import { Serializer } from 'isolated-workers';

/**
 * A verbose JSON serializer that adds metadata to each message.
 * This is for demonstration - in production you might use a more
 * efficient binary format.
 */
export class VerboseJsonSerializer extends Serializer {
  private static messageCount = 0;

  serialize<T>(data: T): string {
    VerboseJsonSerializer.messageCount++;
    const wrapped = {
      _serializer: 'VerboseJsonSerializer',
      _messageId: VerboseJsonSerializer.messageCount,
      _timestamp: Date.now(),
      data,
    };
    return JSON.stringify(wrapped);
  }

  deserialize<T>(input: string | Uint8Array): T {
    const str =
      typeof input === 'string' ? input : new TextDecoder().decode(input);
    const wrapped = JSON.parse(str) as {
      _serializer: string;
      _messageId: number;
      _timestamp: number;
      data: T;
    };

    // Log metadata (in real code, you might use this for debugging/tracing)
    console.log(
      `[SERIALIZER] Message #${wrapped._messageId} from ${wrapped._serializer}`
    );

    return wrapped.data;
  }

  // Custom terminator - using double newline to avoid conflicts
  terminator = '\n\n';
}

// Export a singleton instance for convenience
export const verboseSerializer = new VerboseJsonSerializer();
