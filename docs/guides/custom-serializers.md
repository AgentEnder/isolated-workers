---
title: Custom Serializers
description: Use custom serialization for binary formats, compression, or encryption
nav:
  section: Guides
  order: 4
---

# Custom Serializers

By default, isolated-workers uses JSON for message serialization. You can provide a custom serializer to use binary formats like MessagePack, add compression, or implement encryption.

## The Serializer Interface

Create a custom serializer by extending the `Serializer` base class:

```typescript
import { Serializer } from 'isolated-workers';

class MySerializer extends Serializer {
  serialize<T>(data: T): string | Uint8Array {
    // Convert data to string or bytes
  }

  deserialize<T>(input: string | Uint8Array): T {
    // Parse string or bytes back to data
  }

  // Required: custom message terminator
  // JsonSerializer uses '\n' by default
  terminator = '\n';
}

> **Note**: Terminator can also be `Uint8Array` for binary protocols.
```

## Example: Verbose JSON Serializer

Here's a serializer that wraps messages with metadata for debugging:

{% example custom-serializer:serializer.ts#serializer-class %}

## Using Custom Serializers

**Both host and worker must use the same serializer.** Pass the serializer instance to both.

On the host:

{% example custom-serializer:host.ts#create-worker-with-serializer %}

On the worker:

{% example custom-serializer:worker.ts#start-worker-with-serializer %}

## Use Cases

### Binary Formats (MessagePack, Protocol Buffers)

For better performance with large payloads:

```typescript
import { encode, decode } from '@msgpack/msgpack';

class MessagePackSerializer extends Serializer {
  serialize<T>(data: T): Uint8Array {
    return encode(data);
  }

  deserialize<T>(input: string | Uint8Array): T {
    const bytes =
      typeof input === 'string' ? new TextEncoder().encode(input) : input;
    return decode(bytes) as T;
  }
}
```

### Compression

For bandwidth-sensitive applications:

```typescript
import { gzipSync, gunzipSync } from 'zlib';

class CompressedSerializer extends Serializer {
  serialize<T>(data: T): Uint8Array {
    const json = JSON.stringify(data);
    return gzipSync(json);
  }

  deserialize<T>(input: string | Uint8Array): T {
    const bytes =
      typeof input === 'string' ? new TextEncoder().encode(input) : input;
    const json = gunzipSync(bytes).toString();
    return JSON.parse(json) as T;
  }
}
```

### Encryption

For sensitive data crossing process boundaries:

```typescript
import crypto from 'crypto';

class EncryptedSerializer extends Serializer {
  constructor(private key: Buffer, private iv: Buffer) {
    super();
  }

  serialize<T>(data: T): string {
    const json = JSON.stringify(data);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);
    return cipher.update(json, 'utf8', 'base64') + cipher.final('base64');
  }

  deserialize<T>(input: string | Uint8Array): T {
    const str =
      typeof input === 'string' ? input : new TextDecoder().decode(input);
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.iv);
    const json =
      decipher.update(str, 'base64', 'utf8') + decipher.final('utf8');
    return JSON.parse(json) as T;
  }
}
```

## Custom Terminators

Messages are delimited by a terminator string. The default is `'\n'` (newline). If your serialized data might contain newlines, use a different terminator:

```typescript
class MySerializer extends Serializer {
  // Use double newline as terminator
  terminator = '\n\n';

  // Or use a unique sequence unlikely to appear in data
  terminator = '\x00\x00END\x00\x00';
}
```

## Serializer Mismatch Detection

isolated-workers detects when host and worker use different serializers. Name your serializer class to enable this:

```typescript
// Good - named class enables mismatch detection
export class VerboseJsonSerializer extends Serializer { ... }

// Bad - anonymous class won't be detected properly
export const serializer = new (class extends Serializer { ... })();
```

## Best Practices

1. **Create singleton instances** - Serializers can maintain state (like message counters)
2. **Name your classes** - Enables serializer mismatch detection
3. **Handle both string and Uint8Array** - The `deserialize` method receives either
4. **Keep serialization fast** - It runs on every message
5. **Test with your actual payloads** - Ensure your data survives round-trip serialization

## See Also

- {% example-link custom-serializer %} - Complete custom serializer example
- [Error Handling](/docs/guides/error-handling) - How errors are serialized
