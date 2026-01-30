import {
  JsonSerializer,
  defaultSerializer,
  serializeError,
  deserializeError,
  getTerminatorBuffer,
  type SerializedError,
} from './serializer.js';

describe('serializer', () => {
  describe('JsonSerializer', () => {
    const serializer = new JsonSerializer();

    describe('serialize', () => {
      test('serializes simple objects', () => {
        const data = { type: 'test', payload: { value: 42 } };
        const result = serializer.serialize(data);
        expect(result).toBe('{"type":"test","payload":{"value":42}}');
      });

      test('serializes arrays', () => {
        const data = [1, 2, 3];
        const result = serializer.serialize(data);
        expect(result).toBe('[1,2,3]');
      });

      test('serializes strings', () => {
        const data = 'hello world';
        const result = serializer.serialize(data);
        expect(result).toBe('"hello world"');
      });

      test('serializes null', () => {
        const result = serializer.serialize(null);
        expect(result).toBe('null');
      });

      test('serializes nested objects', () => {
        const data = { a: { b: { c: 'deep' } } };
        const result = serializer.serialize(data);
        expect(result).toBe('{"a":{"b":{"c":"deep"}}}');
      });
    });

    describe('deserialize', () => {
      test('deserializes JSON string to object', () => {
        const json = '{"type":"test","payload":{"value":42}}';
        const result = serializer.deserialize<{
          type: string;
          payload: { value: number };
        }>(json);
        expect(result).toEqual({ type: 'test', payload: { value: 42 } });
      });

      test('deserializes Uint8Array to object', () => {
        const json = '{"type":"test"}';
        const data = new TextEncoder().encode(json);
        const result = serializer.deserialize<{ type: string }>(data);
        expect(result).toEqual({ type: 'test' });
      });

      test('deserializes arrays', () => {
        const json = '[1,2,3]';
        const result = serializer.deserialize<number[]>(json);
        expect(result).toEqual([1, 2, 3]);
      });

      test('throws on invalid JSON', () => {
        expect(() => serializer.deserialize('not valid json')).toThrow();
      });
    });

    describe('terminator', () => {
      test('has newline as default terminator', () => {
        expect(serializer.terminator).toBe('\n');
      });
    });
  });

  describe('defaultSerializer', () => {
    test('is an instance of JsonSerializer', () => {
      expect(defaultSerializer).toBeInstanceOf(JsonSerializer);
    });

    test('serializes and deserializes correctly', () => {
      const data = { message: 'test' };
      const serialized = defaultSerializer.serialize(data);
      const deserialized =
        defaultSerializer.deserialize<typeof data>(serialized);
      expect(deserialized).toEqual(data);
    });
  });

  describe('serializeError', () => {
    test('serializes basic Error', () => {
      const error = new Error('Something went wrong');
      const result = serializeError(error);

      expect(result.message).toBe('Something went wrong');
      expect(result.name).toBe('Error');
      expect(result.stack).toBeDefined();
    });

    test('serializes custom error types', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      const error = new CustomError('Custom error message');
      const result = serializeError(error);

      expect(result.message).toBe('Custom error message');
      expect(result.name).toBe('CustomError');
    });

    test('serializes Node.js errors with code', () => {
      const error = new Error('File not found') as Error & { code: string };
      error.code = 'ENOENT';
      const result = serializeError(error);

      expect(result.message).toBe('File not found');
      expect(result.code).toBe('ENOENT');
    });

    test('preserves stack trace', () => {
      const error = new Error('Test error');
      const result = serializeError(error);

      expect(result.stack).toContain('Error: Test error');
      expect(result.stack).toContain('serializer.spec.ts');
    });
  });

  describe('deserializeError', () => {
    test('deserializes to Error instance', () => {
      const serialized: SerializedError = {
        message: 'Test error',
        name: 'Error',
        stack: 'Error: Test error\n    at test.js:1:1',
      };
      const error = deserializeError(serialized);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('Error');
      expect(error.stack).toBe('Error: Test error\n    at test.js:1:1');
    });

    test('preserves error name', () => {
      const serialized: SerializedError = {
        message: 'Type error occurred',
        name: 'TypeError',
      };
      const error = deserializeError(serialized);

      expect(error.name).toBe('TypeError');
    });

    test('restores error code', () => {
      const serialized: SerializedError = {
        message: 'File not found',
        name: 'Error',
        code: 'ENOENT',
      };
      const error = deserializeError(serialized) as Error & { code: string };

      expect(error.code).toBe('ENOENT');
    });

    test('handles missing optional fields', () => {
      const serialized: SerializedError = {
        message: 'Minimal error',
        name: 'Error',
      };
      const error = deserializeError(serialized);

      expect(error.message).toBe('Minimal error');
      expect(error.stack).toBeUndefined();
    });
  });

  describe('getTerminatorBuffer', () => {
    test('returns Uint8Array for string terminator', () => {
      const serializer = new JsonSerializer();
      const buffer = getTerminatorBuffer(serializer);

      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(buffer)).toBe('\n');
    });

    test('returns same Uint8Array for Uint8Array terminator', () => {
      const customTerminator = new TextEncoder().encode('|||');
      const serializer = {
        serialize: <T>(data: T) => JSON.stringify(data),
        deserialize: <T>(data: string | Uint8Array) =>
          JSON.parse(
            typeof data === 'string' ? data : new TextDecoder().decode(data)
          ) as T,
        terminator: customTerminator,
      };
      const buffer = getTerminatorBuffer(serializer);

      expect(buffer).toBe(customTerminator);
    });
  });

  describe('round-trip serialization', () => {
    test('complex message survives round-trip', () => {
      const original = {
        type: 'compute',
        payload: {
          numbers: [1, 2, 3, 4, 5],
          operation: 'sum',
          metadata: {
            source: 'test',
            timestamp: Date.now(),
          },
        },
        tx: 'abc-123',
      };

      const serialized = defaultSerializer.serialize(original);
      const deserialized =
        defaultSerializer.deserialize<typeof original>(serialized);

      expect(deserialized).toEqual(original);
    });

    test('error survives round-trip serialization', () => {
      const original = new Error('Round-trip test');
      original.name = 'TestError';
      (original as Error & { code: string }).code = 'TEST_CODE';

      const serialized = serializeError(original);
      const jsonString = JSON.stringify(serialized);
      const parsed = JSON.parse(jsonString) as SerializedError;
      const restored = deserializeError(parsed);

      expect(restored.message).toBe(original.message);
      expect(restored.name).toBe(original.name);
      expect((restored as Error & { code: string }).code).toBe('TEST_CODE');
    });
  });
});
