/**
 * Tests for worker threads driver
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorkerThreadsDriver,
  WorkerThreadsChannel,
  workerThreadsDriver,
  isWorkerThreadsDriverAvailable,
} from './worker-threads.js';

// Check if worker_threads is available for conditional tests
const workerThreadsAvailable = isWorkerThreadsDriverAvailable();

describe('isWorkerThreadsDriverAvailable', () => {
  test('returns a boolean', () => {
    const result = isWorkerThreadsDriverAvailable();
    expect(typeof result).toBe('boolean');
  });

  test('is consistent across calls', () => {
    const first = isWorkerThreadsDriverAvailable();
    const second = isWorkerThreadsDriverAvailable();
    expect(first).toBe(second);
  });
});

// Tests that require worker_threads to be available
const describeIfAvailable = workerThreadsAvailable ? describe : describe.skip;

describeIfAvailable('WorkerThreadsDriver', () => {
  describe('driver properties', () => {
    test('has correct name', () => {
      const driver = new WorkerThreadsDriver();
      expect(driver.name).toBe('worker_threads');
    });

    test('singleton instance has correct name', () => {
      expect(workerThreadsDriver).not.toBeNull();
      if (workerThreadsDriver) {
        expect(workerThreadsDriver.name).toBe('worker_threads');
      }
    });
  });

  describe('capabilities', () => {
    test('has correct capabilities', () => {
      const driver = new WorkerThreadsDriver();
      expect(driver.capabilities).toEqual({
        reconnect: false,
        detach: false,
        sharedMemory: true,
      });
    });

    test('reconnect capability is false', () => {
      const driver = new WorkerThreadsDriver();
      expect(driver.capabilities.reconnect).toBe(false);
    });

    test('detach capability is false', () => {
      const driver = new WorkerThreadsDriver();
      expect(driver.capabilities.detach).toBe(false);
    });

    test('sharedMemory capability is true', () => {
      const driver = new WorkerThreadsDriver();
      expect(driver.capabilities.sharedMemory).toBe(true);
    });

    test('capabilities object structure is correct', () => {
      const driver = new WorkerThreadsDriver();
      const caps = driver.capabilities;

      // Check that all expected keys exist
      expect(caps).toHaveProperty('reconnect');
      expect(caps).toHaveProperty('detach');
      expect(caps).toHaveProperty('sharedMemory');

      // Check types
      expect(typeof caps.reconnect).toBe('boolean');
      expect(typeof caps.detach).toBe('boolean');
      expect(typeof caps.sharedMemory).toBe('boolean');
    });

    test('singleton instance has same capabilities', () => {
      expect(workerThreadsDriver).not.toBeNull();
      if (workerThreadsDriver) {
        expect(workerThreadsDriver.capabilities).toEqual({
          reconnect: false,
          detach: false,
          sharedMemory: true,
        });
      }
    });
  });

  describe('implements Driver interface', () => {
    test('has spawn method', () => {
      const driver = new WorkerThreadsDriver();
      expect(typeof driver.spawn).toBe('function');
    });

    test('has readonly name property', () => {
      const driver = new WorkerThreadsDriver();
      expect(driver.name).toBeDefined();
    });

    test('has readonly capabilities property', () => {
      const driver = new WorkerThreadsDriver();
      expect(driver.capabilities).toBeDefined();
    });
  });
});

describeIfAvailable('workerThreadsDriver singleton', () => {
  test('is a WorkerThreadsDriver instance', () => {
    expect(workerThreadsDriver).toBeInstanceOf(WorkerThreadsDriver);
  });

  test('has all required properties', () => {
    expect(workerThreadsDriver).not.toBeNull();
    if (workerThreadsDriver) {
      expect(workerThreadsDriver.name).toBe('worker_threads');
      expect(workerThreadsDriver.capabilities).toBeDefined();
      expect(typeof workerThreadsDriver.spawn).toBe('function');
    }
  });
});

// Tests when worker_threads is NOT available
const describeIfUnavailable = !workerThreadsAvailable ? describe : describe.skip;

describeIfUnavailable('WorkerThreadsDriver (unavailable)', () => {
  test('workerThreadsDriver singleton is null', () => {
    expect(workerThreadsDriver).toBeNull();
  });
});

describe('WorkerThreadsChannel', () => {
  describeIfAvailable('channel interface', () => {
    let mockWorker: {
      on: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
      postMessage: ReturnType<typeof vi.fn>;
      terminate: ReturnType<typeof vi.fn>;
      threadId: number;
    };
    let channel: WorkerThreadsChannel;
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const mockSerializer = {
      serialize: vi.fn((data: unknown) => JSON.stringify(data)),
      deserialize: vi.fn((data: string) => JSON.parse(data)),
      terminator: '\n',
    };

    beforeEach(() => {
      vi.clearAllMocks();

      mockWorker = {
        on: vi.fn(),
        removeListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn().mockResolvedValue(undefined),
        threadId: 1,
      };

      // Cast mock to expected type
      channel = new WorkerThreadsChannel(
        mockWorker as unknown as InstanceType<typeof import('worker_threads').Worker>,
        { serializer: mockSerializer as never, logger: mockLogger }
      );
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    test('starts as connected', () => {
      expect(channel.isConnected).toBe(true);
    });

    test('pid returns undefined', () => {
      expect(channel.pid).toBeUndefined();
    });

    test('send throws when not connected', async () => {
      // Simulate disconnect via the exit handler
      const exitHandler = mockWorker.on.mock.calls.find(
        (call) => call[0] === 'exit'
      )?.[1];

      if (exitHandler) {
        exitHandler(0);
      }

      await expect(
        channel.send({ type: 'test', payload: {}, tx: '123' })
      ).rejects.toThrow('Channel is not connected');
    });

    test('send posts serialized message', async () => {
      const message = { type: 'test', payload: { data: 'value' }, tx: '123' };
      await channel.send(message);

      expect(mockSerializer.serialize).toHaveBeenCalledWith(message);
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        JSON.stringify(message)
      );
    });

    test('onMessage registers handler', () => {
      const handler = vi.fn();
      channel.onMessage(handler);

      // Verify handler is registered by checking it gets called
      // Find the message event handler
      const messageHandler = mockWorker.on.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      expect(messageHandler).toBeDefined();
    });

    test('onError registers handler', () => {
      const handler = vi.fn();
      channel.onError(handler);

      // Verify handler is registered
      const errorHandler = mockWorker.on.mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1];

      expect(errorHandler).toBeDefined();
    });

    test('onClose registers handler', () => {
      const handler = vi.fn();
      channel.onClose(handler);

      // Verify handler is registered
      const exitHandler = mockWorker.on.mock.calls.find(
        (call) => call[0] === 'exit'
      )?.[1];

      expect(exitHandler).toBeDefined();
    });

    test('close terminates worker', async () => {
      await channel.close();

      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(channel.isConnected).toBe(false);
    });

    test('close is idempotent when already disconnected', async () => {
      // First close
      await channel.close();
      mockWorker.terminate.mockClear();

      // Second close should be a no-op
      await channel.close();
      expect(mockWorker.terminate).not.toHaveBeenCalled();
    });
  });
});
