/**
 * Type tests for driver interface types
 *
 * Uses vitest's expectTypeOf for compile-time type assertions.
 */
import { describe, test, expectTypeOf } from 'vitest';
import type {
  DriverMessage,
  WorkerHandle,
  DriverCapabilities,
  Driver,
  ChildProcessCapabilities,
  WorkerThreadsCapabilities,
} from './driver.js';

describe('driver types', () => {
  describe('DriverMessage', () => {
    test('has type, payload, and tx fields', () => {
      expectTypeOf<DriverMessage>().toHaveProperty('type');
      expectTypeOf<DriverMessage>().toHaveProperty('payload');
      expectTypeOf<DriverMessage>().toHaveProperty('tx');
    });

    test('type is string', () => {
      expectTypeOf<DriverMessage['type']>().toBeString();
    });

    test('payload is unknown', () => {
      expectTypeOf<DriverMessage['payload']>().toBeUnknown();
    });

    test('tx is string', () => {
      expectTypeOf<DriverMessage['tx']>().toBeString();
    });
  });

  describe('WorkerHandle', () => {
    test('has send method returning Promise<void>', () => {
      expectTypeOf<WorkerHandle['send']>().toBeFunction();
      expectTypeOf<WorkerHandle['send']>().parameter(0).toMatchTypeOf<DriverMessage>();
      expectTypeOf<WorkerHandle['send']>().returns.toMatchTypeOf<Promise<void>>();
    });

    test('has onMessage method', () => {
      expectTypeOf<WorkerHandle['onMessage']>().toBeFunction();
    });

    test('has onError method', () => {
      expectTypeOf<WorkerHandle['onError']>().toBeFunction();
    });

    test('has onClose method', () => {
      expectTypeOf<WorkerHandle['onClose']>().toBeFunction();
    });

    test('has close method returning Promise<void>', () => {
      expectTypeOf<WorkerHandle['close']>().toBeFunction();
      expectTypeOf<WorkerHandle['close']>().returns.toMatchTypeOf<Promise<void>>();
    });

    test('has isConnected boolean property', () => {
      expectTypeOf<WorkerHandle['isConnected']>().toBeBoolean();
    });

    test('has pid that is number or undefined', () => {
      expectTypeOf<WorkerHandle['pid']>().toMatchTypeOf<number | undefined>();
    });

    test('has getHandle method', () => {
      expectTypeOf<WorkerHandle['getHandle']>().toBeFunction();
    });

    test('has optional disconnect method', () => {
      expectTypeOf<WorkerHandle>().toHaveProperty('disconnect');
    });

    test('has optional reconnect method', () => {
      expectTypeOf<WorkerHandle>().toHaveProperty('reconnect');
    });
  });

  describe('DriverCapabilities', () => {
    test('has reconnect boolean', () => {
      expectTypeOf<DriverCapabilities['reconnect']>().toBeBoolean();
    });

    test('has detach boolean', () => {
      expectTypeOf<DriverCapabilities['detach']>().toBeBoolean();
    });

    test('has sharedMemory boolean', () => {
      expectTypeOf<DriverCapabilities['sharedMemory']>().toBeBoolean();
    });
  });

  describe('ChildProcessCapabilities', () => {
    test('reconnect is literal true', () => {
      expectTypeOf<ChildProcessCapabilities['reconnect']>().toEqualTypeOf<true>();
    });

    test('detach is literal true', () => {
      expectTypeOf<ChildProcessCapabilities['detach']>().toEqualTypeOf<true>();
    });

    test('sharedMemory is literal false', () => {
      expectTypeOf<ChildProcessCapabilities['sharedMemory']>().toEqualTypeOf<false>();
    });

    test('extends DriverCapabilities', () => {
      expectTypeOf<ChildProcessCapabilities>().toMatchTypeOf<DriverCapabilities>();
    });
  });

  describe('WorkerThreadsCapabilities', () => {
    test('reconnect is literal false', () => {
      expectTypeOf<WorkerThreadsCapabilities['reconnect']>().toEqualTypeOf<false>();
    });

    test('detach is literal false', () => {
      expectTypeOf<WorkerThreadsCapabilities['detach']>().toEqualTypeOf<false>();
    });

    test('sharedMemory is literal true', () => {
      expectTypeOf<WorkerThreadsCapabilities['sharedMemory']>().toEqualTypeOf<true>();
    });

    test('extends DriverCapabilities', () => {
      expectTypeOf<WorkerThreadsCapabilities>().toMatchTypeOf<DriverCapabilities>();
    });
  });

  describe('Driver', () => {
    test('has name property', () => {
      expectTypeOf<Driver>().toHaveProperty('name');
      expectTypeOf<Driver['name']>().toBeString();
    });

    test('has capabilities property', () => {
      expectTypeOf<Driver>().toHaveProperty('capabilities');
    });

    test('has spawn method', () => {
      expectTypeOf<Driver>().toHaveProperty('spawn');
      expectTypeOf<Driver['spawn']>().toBeFunction();
    });

    test('spawn returns Promise<WorkerHandle>', () => {
      type SpawnReturn = ReturnType<Driver['spawn']>;
      expectTypeOf<SpawnReturn>().toMatchTypeOf<Promise<WorkerHandle>>();
    });
  });
});
