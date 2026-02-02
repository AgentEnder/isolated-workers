/**
 * Tests for startup data utilities
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getStartupData,
  encodeStartupData,
  STARTUP_DATA_ENV_KEY,
  STARTUP_DATA_WORKER_KEY,
  type StartupData,
} from './startup.js';

describe('startup data utilities', () => {
  describe('constants', () => {
    test('STARTUP_DATA_ENV_KEY has expected value', () => {
      expect(STARTUP_DATA_ENV_KEY).toBe('ISOLATED_WORKERS_STARTUP_DATA');
    });

    test('STARTUP_DATA_WORKER_KEY has expected value', () => {
      expect(STARTUP_DATA_WORKER_KEY).toBe('__isolatedWorkers');
    });
  });

  describe('getStartupData', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env[STARTUP_DATA_ENV_KEY];
      delete process.env[STARTUP_DATA_ENV_KEY];
    });

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env[STARTUP_DATA_ENV_KEY] = originalEnv;
      } else {
        delete process.env[STARTUP_DATA_ENV_KEY];
      }
      vi.resetModules();
    });

    test('returns null when no startup data present', () => {
      // No env var, not in worker_threads context
      const result = getStartupData();
      expect(result).toBeNull();
    });

    test('parses env var correctly for child_process driver', () => {
      const data: StartupData = {
        driver: 'child_process',
        socketPath: '/tmp/test.sock',
        serializer: 'json',
        serverConnectTimeout: 5000,
      };
      process.env[STARTUP_DATA_ENV_KEY] = JSON.stringify(data);

      const result = getStartupData();

      expect(result).toEqual(data);
      expect(result?.driver).toBe('child_process');
      expect(result?.socketPath).toBe('/tmp/test.sock');
      expect(result?.serializer).toBe('json');
      expect(result?.serverConnectTimeout).toBe(5000);
    });

    test('returns null for malformed JSON in env var', () => {
      process.env[STARTUP_DATA_ENV_KEY] = 'not valid json {{{';

      const result = getStartupData();

      expect(result).toBeNull();
    });

    test('parses additional driver-specific fields', () => {
      const data: StartupData = {
        driver: 'worker_threads',
        customField: 'custom value',
        numericField: 42,
        nestedField: { key: 'value' },
      };
      process.env[STARTUP_DATA_ENV_KEY] = JSON.stringify(data);

      const result = getStartupData();

      expect(result).toEqual(data);
      expect(result?.customField).toBe('custom value');
      expect(result?.numericField).toBe(42);
      expect(result?.nestedField).toEqual({ key: 'value' });
    });

    test('handles empty object in env var', () => {
      // StartupData requires driver, but this tests the JSON parsing
      const data = { driver: 'test' };
      process.env[STARTUP_DATA_ENV_KEY] = JSON.stringify(data);

      const result = getStartupData();

      expect(result).toEqual(data);
    });
  });

  describe('encodeStartupData', () => {
    test('produces valid JSON', () => {
      const data: StartupData = {
        driver: 'child_process',
        socketPath: '/tmp/test.sock',
      };

      const encoded = encodeStartupData(data);

      expect(() => JSON.parse(encoded)).not.toThrow();
    });

    test('roundtrips correctly with getStartupData', () => {
      const original: StartupData = {
        driver: 'child_process',
        socketPath: '/var/folders/socket.sock',
        serializer: 'json',
        serverConnectTimeout: 10000,
        customOption: true,
      };

      const encoded = encodeStartupData(original);
      process.env[STARTUP_DATA_ENV_KEY] = encoded;

      const decoded = getStartupData();

      expect(decoded).toEqual(original);

      // Cleanup
      delete process.env[STARTUP_DATA_ENV_KEY];
    });

    test('encodes all standard fields', () => {
      const data: StartupData = {
        driver: 'worker_threads',
        socketPath: '/path/to/socket',
        serializer: 'custom',
        serverConnectTimeout: 30000,
      };

      const encoded = encodeStartupData(data);
      const parsed = JSON.parse(encoded);

      expect(parsed.driver).toBe('worker_threads');
      expect(parsed.socketPath).toBe('/path/to/socket');
      expect(parsed.serializer).toBe('custom');
      expect(parsed.serverConnectTimeout).toBe(30000);
    });

    test('encodes additional driver-specific fields', () => {
      const data: StartupData = {
        driver: 'custom_driver',
        extraConfig: { nested: true },
        flags: ['flag1', 'flag2'],
      };

      const encoded = encodeStartupData(data);
      const parsed = JSON.parse(encoded);

      expect(parsed.driver).toBe('custom_driver');
      expect(parsed.extraConfig).toEqual({ nested: true });
      expect(parsed.flags).toEqual(['flag1', 'flag2']);
    });

    test('handles special characters in string values', () => {
      const data: StartupData = {
        driver: 'test',
        socketPath: '/path/with spaces/and"quotes',
        description: 'Line1\nLine2\tTabbed',
      };

      const encoded = encodeStartupData(data);
      const parsed = JSON.parse(encoded);

      expect(parsed.socketPath).toBe('/path/with spaces/and"quotes');
      expect(parsed.description).toBe('Line1\nLine2\tTabbed');
    });
  });
});
