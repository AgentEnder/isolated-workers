/**
 * Type tests for driver interface types
 *
 * Uses vitest's expectTypeOf for compile-time type assertions.
 */
import { describe, test, expectTypeOf } from 'vitest';
import type {
  DriverMessage,
  DriverChannel,
  DriverCapabilities,
  Driver,
  ChildProcessCapabilities,
  WorkerThreadsCapabilities,
  ReconnectCapability,
  DetachCapability,
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

  describe('DriverChannel', () => {
    test('has send method returning Promise<void>', () => {
      expectTypeOf<DriverChannel['send']>().toBeFunction();
      expectTypeOf<DriverChannel['send']>().parameter(0).toMatchTypeOf<DriverMessage>();
      expectTypeOf<DriverChannel['send']>().returns.toMatchTypeOf<Promise<void>>();
    });

    test('has onMessage method', () => {
      expectTypeOf<DriverChannel['onMessage']>().toBeFunction();
    });

    test('has onError method', () => {
      expectTypeOf<DriverChannel['onError']>().toBeFunction();
    });

    test('has onClose method', () => {
      expectTypeOf<DriverChannel['onClose']>().toBeFunction();
    });

    test('has close method returning Promise<void>', () => {
      expectTypeOf<DriverChannel['close']>().toBeFunction();
      expectTypeOf<DriverChannel['close']>().returns.toMatchTypeOf<Promise<void>>();
    });

    test('has isConnected boolean property', () => {
      expectTypeOf<DriverChannel['isConnected']>().toBeBoolean();
    });

    test('has pid that is number or undefined', () => {
      expectTypeOf<DriverChannel['pid']>().toMatchTypeOf<number | undefined>();
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

  describe('ReconnectCapability', () => {
    test('has disconnect method returning Promise<void>', () => {
      expectTypeOf<ReconnectCapability['disconnect']>().toBeFunction();
      expectTypeOf<ReconnectCapability['disconnect']>().returns.toMatchTypeOf<Promise<void>>();
    });

    test('has reconnect method returning Promise<void>', () => {
      expectTypeOf<ReconnectCapability['reconnect']>().toBeFunction();
      expectTypeOf<ReconnectCapability['reconnect']>().returns.toMatchTypeOf<Promise<void>>();
    });
  });

  describe('DetachCapability', () => {
    test('has detached boolean property', () => {
      expectTypeOf<DetachCapability['detached']>().toBeBoolean();
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

    test('spawn returns Promise<DriverChannel>', () => {
      type SpawnReturn = ReturnType<Driver['spawn']>;
      expectTypeOf<SpawnReturn>().toMatchTypeOf<Promise<DriverChannel>>();
    });
  });
});
