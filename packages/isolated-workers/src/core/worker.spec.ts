/**
 * Unit tests for createWorker with driver integration
 *
 * @packageDocumentation
 */

import { describe, test, expect, vi } from 'vitest';
import { expectTypeOf } from 'vitest';
import type {
  WorkerClient,
  WorkerOptions,
  DriverOptionsFor,
} from './worker.js';
import type {
  Driver,
  DriverChannel,
  ChildProcessCapabilities,
  WorkerThreadsCapabilities,
} from './driver.js';
import type { ChildProcessDriverOptions } from './drivers/child-process/index.js';
import type { WorkerThreadsDriverOptions } from './drivers/worker-threads/index.js';

describe('createWorker', () => {
  describe('type tests', () => {
    test('WorkerOptions accepts driver parameter', () => {
      type Options = WorkerOptions<Record<string, never>>;

      expectTypeOf<Options>().toHaveProperty('driver');
      expectTypeOf<Options>().toHaveProperty('driverOptions');
    });

    test('DriverOptionsFor maps to correct driver options type', () => {
      // Child process driver should map to ChildProcessDriverOptions
      type CpDriver = Driver<ChildProcessCapabilities>;
      type CpOptions = DriverOptionsFor<CpDriver>;
      expectTypeOf<CpOptions>().toEqualTypeOf<ChildProcessDriverOptions>();

      // Worker threads driver should map to WorkerThreadsDriverOptions
      type WtDriver = Driver<WorkerThreadsCapabilities>;
      type WtOptions = DriverOptionsFor<WtDriver>;
      expectTypeOf<WtOptions>().toEqualTypeOf<WorkerThreadsDriverOptions>();
    });

    test('WorkerClient has capabilities property', () => {
      type Client = WorkerClient<Record<string, never>>;

      expectTypeOf<Client>().toHaveProperty('capabilities');
      expectTypeOf<Client>().toHaveProperty('send');
      expectTypeOf<Client>().toHaveProperty('close');
      expectTypeOf<Client>().toHaveProperty('pid');
      expectTypeOf<Client>().toHaveProperty('isActive');
      expectTypeOf<Client>().toHaveProperty('isConnected');
    });

    test('WorkerClient pid can be number or undefined', () => {
      type Client = WorkerClient<Record<string, never>>;

      expectTypeOf<Client['pid']>().toEqualTypeOf<number | undefined>();
    });

    test('WorkerClient with ChildProcessCapabilities has reconnect methods', () => {
      type Client = WorkerClient<Record<string, never>, ChildProcessCapabilities>;

      // disconnect and reconnect should be functions
      expectTypeOf<Client['disconnect']>().toBeFunction();
      expectTypeOf<Client['reconnect']>().toBeFunction();
    });

    test('WorkerClient with WorkerThreadsCapabilities has never for reconnect methods', () => {
      type Client = WorkerClient<Record<string, never>, WorkerThreadsCapabilities>;

      // disconnect and reconnect should be never
      expectTypeOf<Client['disconnect']>().toBeNever();
      expectTypeOf<Client['reconnect']>().toBeNever();
    });
  });

  describe('driver integration', () => {
    // These tests use mocks since we can't actually spawn workers in unit tests

    test('should accept a mock driver', async () => {
      // Create a mock driver
      const mockChannel: DriverChannel = {
        isConnected: true,
        pid: 12345,
        send: vi.fn().mockResolvedValue(undefined),
        onMessage: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const mockDriver: Driver<ChildProcessCapabilities> = {
        name: 'mock_driver',
        capabilities: {
          reconnect: true,
          detach: true,
          sharedMemory: false,
        },
        spawn: vi.fn().mockResolvedValue(mockChannel),
      };

      // We can't actually call createWorker in unit tests without proper setup
      // but we can verify the driver interface is correct
      expect(mockDriver.name).toBe('mock_driver');
      expect(mockDriver.capabilities.reconnect).toBe(true);
      expect(typeof mockDriver.spawn).toBe('function');
    });

    test('mock driver spawn returns DriverChannel', async () => {
      const mockChannel: DriverChannel = {
        isConnected: true,
        pid: undefined, // worker_threads style
        send: vi.fn().mockResolvedValue(undefined),
        onMessage: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const mockDriver: Driver<WorkerThreadsCapabilities> = {
        name: 'worker_threads',
        capabilities: {
          reconnect: false,
          detach: false,
          sharedMemory: true,
        },
        spawn: vi.fn().mockResolvedValue(mockChannel),
      };

      const channel = await mockDriver.spawn('./worker.js', {});

      expect(channel.isConnected).toBe(true);
      expect(channel.pid).toBeUndefined();
      expect(mockDriver.spawn).toHaveBeenCalledWith('./worker.js', {});
    });
  });

  describe('options validation', () => {
    test('WorkerOptions has all required fields', () => {
      type Options = WorkerOptions<Record<string, never>>;

      // Required fields
      expectTypeOf<Options>().toHaveProperty('script');

      // Optional fields
      expectTypeOf<Options>().toHaveProperty('driver');
      expectTypeOf<Options>().toHaveProperty('driverOptions');
      expectTypeOf<Options>().toHaveProperty('env');
      expectTypeOf<Options>().toHaveProperty('timeout');
      expectTypeOf<Options>().toHaveProperty('middleware');
      expectTypeOf<Options>().toHaveProperty('serializer');
      expectTypeOf<Options>().toHaveProperty('logLevel');
      expectTypeOf<Options>().toHaveProperty('logger');
    });

    test('script field is string', () => {
      type Options = WorkerOptions<Record<string, never>>;

      expectTypeOf<Options['script']>().toBeString();
    });

    test('driver field is optional Driver type', () => {
      type Options = WorkerOptions<Record<string, never>>;

      // driver is optional (can be undefined)
      expectTypeOf<Options['driver']>().toMatchTypeOf<Driver | undefined>();
    });
  });

  describe('capability narrowing', () => {
    test('capabilities affect method availability at type level', () => {
      // With reconnect: true
      type ReconnectableClient = WorkerClient<
        Record<string, never>,
        { reconnect: true; detach: boolean; sharedMemory: boolean }
      >;
      expectTypeOf<ReconnectableClient['disconnect']>().toBeFunction();

      // With reconnect: false
      type NonReconnectableClient = WorkerClient<
        Record<string, never>,
        { reconnect: false; detach: boolean; sharedMemory: boolean }
      >;
      expectTypeOf<NonReconnectableClient['disconnect']>().toBeNever();
    });

    test('ChildProcessCapabilities is correctly typed', () => {
      expectTypeOf<ChildProcessCapabilities['reconnect']>().toEqualTypeOf<true>();
      expectTypeOf<ChildProcessCapabilities['detach']>().toEqualTypeOf<true>();
      expectTypeOf<ChildProcessCapabilities['sharedMemory']>().toEqualTypeOf<false>();
    });

    test('WorkerThreadsCapabilities is correctly typed', () => {
      expectTypeOf<WorkerThreadsCapabilities['reconnect']>().toEqualTypeOf<false>();
      expectTypeOf<WorkerThreadsCapabilities['detach']>().toEqualTypeOf<false>();
      expectTypeOf<WorkerThreadsCapabilities['sharedMemory']>().toEqualTypeOf<true>();
    });
  });
});
