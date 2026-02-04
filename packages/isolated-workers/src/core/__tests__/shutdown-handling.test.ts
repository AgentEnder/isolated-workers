/**
 * Comprehensive tests for unexpected worker shutdown handling
 *
 * Tests cover:
 * - Unit tests with mocked driver
 *
 * @packageDocumentation
 */

import { describe, test, expect, vi } from 'vitest';
import { createWorker } from '../worker.js';
import { WorkerCrashedError } from '../../types/errors.js';
import type { ShutdownReason } from '../../types/config.js';
import type { DriverChannel, Driver } from '../driver.js';
import type { ChildProcessCapabilities } from '../driver.js';

// Test message definitions
type TestMessages = {
  testMessage: { payload: { value: number }; result: { doubled: number } };
  retryableMessage: { payload: { text: string }; result: { length: number } };
  noRetryMessage: { payload: { data: string }; result: string };
};

// Mock driver with shutdown triggering capabilities
function createMockDriver() {
  const messageHandlers: Array<(message: unknown) => void> = [];
  const errorHandlers: Array<(error: Error) => void> = [];
  const closeHandlers: Array<() => void> = [];
  const shutdownHandlers: Array<(reason: ShutdownReason) => void> = [];
  let connected = true;

  const mockChannel: DriverChannel = {
    get isConnected() {
      return connected;
    },
    pid: 12345,
    send: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn((handler) => {
      messageHandlers.push(handler);
    }),
    onError: vi.fn((handler) => {
      errorHandlers.push(handler);
    }),
    onClose: vi.fn((handler) => {
      closeHandlers.push(handler);
    }),
    onShutdown: vi.fn((handler) => {
      shutdownHandlers.push(handler);
    }),
    close: vi.fn().mockImplementation(async () => {
      connected = false;
      closeHandlers.forEach((h) => h());
      errorHandlers.forEach((h) => h(new Error('Worker closed')));
      shutdownHandlers.forEach((h) => h({ type: 'close' }));
    }),
  };

  const mockDriver: Driver<ChildProcessCapabilities> = {
    name: 'mock_driver',
    capabilities: { reconnect: true, detach: true, sharedMemory: false },
    spawn: vi.fn().mockResolvedValue(mockChannel),
  };

  // Trigger shutdown with specific reason
  const triggerShutdown = (reason: ShutdownReason) => {
    shutdownHandlers.forEach((h) => h(reason));
  };

  return {
    mockChannel,
    mockDriver,
    triggerShutdown,
    messageHandlers,
  };
}

describe('Unexpected Worker Shutdown Handling - Unit Tests', () => {
  describe('shutdown event handling', () => {
    test('exit event triggers shutdown handler with correct reason', async () => {
      const { mockDriver, triggerShutdown } = createMockDriver();

      const worker = await createWorker<
        TestMessages,
        Driver<ChildProcessCapabilities>
      >({
        script: './worker.js',
        driver: mockDriver,
      });

      const pendingPromise = worker.send('testMessage', { value: 42 });

      triggerShutdown({ type: 'exit', code: 137, signal: 'SIGKILL' });

      await expect(pendingPromise).rejects.toThrow(WorkerCrashedError);
    });

    test('socket error triggers shutdown handler with correct reason', async () => {
      const { mockDriver, triggerShutdown } = createMockDriver();

      const worker = await createWorker<
        TestMessages,
        Driver<ChildProcessCapabilities>
      >({
        script: './worker.js',
        driver: mockDriver,
      });

      const pendingPromise = worker.send('testMessage', { value: 42 });

      triggerShutdown({
        type: 'error',
        error: new Error('Socket connection lost'),
      });

      await expect(pendingPromise).rejects.toThrow(WorkerCrashedError);
    });

    test('socket close triggers shutdown handler with correct reason', async () => {
      const { mockDriver, triggerShutdown } = createMockDriver();

      const worker = await createWorker<
        TestMessages,
        Driver<ChildProcessCapabilities>
      >({
        script: './worker.js',
        driver: mockDriver,
      });

      const pendingPromise = worker.send('testMessage', { value: 42 });

      triggerShutdown({ type: 'close' });

      await expect(pendingPromise).rejects.toThrow();
    });
  });

  describe('idempotency', () => {
    test('multiple shutdown events do not cause duplicate handling', async () => {
      const { mockDriver, triggerShutdown } = createMockDriver();
      const errorSpy = vi.fn();

      const worker = await createWorker<
        TestMessages,
        Driver<ChildProcessCapabilities>
      >({
        script: './worker.js',
        driver: mockDriver,
      });

      const pendingPromise = worker.send('testMessage', { value: 42 });
      pendingPromise.catch(errorSpy);

      triggerShutdown({ type: 'exit', code: 137, signal: 'SIGKILL' });
      triggerShutdown({ type: 'close' });
      triggerShutdown({ type: 'error', error: new Error('Duplicate event') });

      await new Promise((resolve) => setTimeout(resolve, 50));

      await expect(pendingPromise).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('graceful shutdown', () => {
    test('close() uses normal rejection, not retry logic', async () => {
      const { mockDriver } = createMockDriver();

      const worker = await createWorker<
        TestMessages,
        Driver<ChildProcessCapabilities>
      >({
        script: './worker.js',
        driver: mockDriver,
      });

      const pendingPromise = worker.send('testMessage', { value: 42 });

      await worker.close();

      await expect(pendingPromise).rejects.toThrow('Worker closed');
      await expect(pendingPromise).rejects.not.toThrow(WorkerCrashedError);
    });
  });

  describe('reject strategy', () => {
    test('reject strategy rejects all pending requests with WorkerCrashedError', async () => {
      const { mockDriver, triggerShutdown } = createMockDriver();

      const worker = await createWorker<
        TestMessages,
        Driver<ChildProcessCapabilities>
      >({
        script: './worker.js',
        driver: mockDriver,
        unexpectedShutdown: { strategy: 'reject' },
      });

      const promises = [
        worker.send('testMessage', { value: 1 }),
        worker.send('testMessage', { value: 2 }),
        worker.send('testMessage', { value: 3 }),
      ];

      triggerShutdown({ type: 'exit', code: 1, signal: null });

      for (const promise of promises) {
        await expect(promise).rejects.toThrow(WorkerCrashedError);
      }
    });
  });

  describe('retry strategy', () => {
    test('retry strategy rejects requests when no retry capability exists', async () => {
      const { mockDriver, triggerShutdown } = createMockDriver();

      const worker = await createWorker<
        TestMessages,
        Driver<ChildProcessCapabilities>
      >({
        script: './worker.js',
        driver: mockDriver,
        unexpectedShutdown: { strategy: 'retry', attempts: 1 },
      });

      const pendingPromise = worker.send('testMessage', { value: 42 });

      triggerShutdown({ type: 'exit', code: 1, signal: null });

      await expect(pendingPromise).rejects.toThrow(WorkerCrashedError);
    });

    test('retry strategy rejects requests at or above attempt limit', async () => {
      const { mockDriver, triggerShutdown } = createMockDriver();

      const worker = await createWorker<
        TestMessages,
        Driver<ChildProcessCapabilities>
      >({
        script: './worker.js',
        driver: mockDriver,
        unexpectedShutdown: { strategy: 'retry', attempts: 1 },
      });

      const pendingPromise = worker.send('testMessage', { value: 42 });

      triggerShutdown({ type: 'exit', code: 1, signal: null });

      await expect(pendingPromise).rejects.toThrow(WorkerCrashedError);
    });
  });

  describe('per-message-type configuration', () => {
    test('per-message-type configuration overrides apply correctly', async () => {
      const { mockDriver, triggerShutdown } = createMockDriver();

      const worker = await createWorker<
        TestMessages,
        Driver<ChildProcessCapabilities>
      >({
        script: './worker.js',
        driver: mockDriver,
        unexpectedShutdown: {
          strategy: 'reject',
          retryableMessage: { strategy: 'reject' },
        },
      });

      const rejectPromise = worker.send('noRetryMessage', { data: 'test' });
      const retryablePromise = worker.send('retryableMessage', {
        text: 'hello',
      });

      triggerShutdown({ type: 'exit', code: 1, signal: null });

      await expect(rejectPromise).rejects.toThrow(WorkerCrashedError);
      await expect(retryablePromise).rejects.toThrow(WorkerCrashedError);
    });
  });

  describe('WorkerCrashedError details', () => {
    test('WorkerCrashedError includes correct exit details and attempt count', async () => {
      const { mockDriver, triggerShutdown } = createMockDriver();

      const worker = await createWorker<
        TestMessages,
        Driver<ChildProcessCapabilities>
      >({
        script: './worker.js',
        driver: mockDriver,
        unexpectedShutdown: { strategy: 'reject' },
      });

      const pendingPromise = worker.send('testMessage', { value: 42 });

      triggerShutdown({ type: 'exit', code: 137, signal: 'SIGKILL' });

      try {
        await pendingPromise;
        throw new Error('Expected promise to reject');
      } catch (error) {
        expect(error).toBeInstanceOf(WorkerCrashedError);

        const crashError = error as WorkerCrashedError;
        expect(crashError.name).toBe('WorkerCrashedError');
        expect(crashError.message).toContain('testMessage');
        expect(crashError.messageType).toBe('testMessage');
        expect(crashError.attempt).toBe(1);
        expect(crashError.maxAttempts).toBe(1);
        expect(crashError.reason).toEqual({
          type: 'exit',
          code: 137,
          signal: 'SIGKILL',
        });
      }
    });
  });
});

describe('Unexpected Worker Shutdown Handling - Driver Integration', () => {
  test('onShutdown callback is registered when worker is created', async () => {
    const { mockDriver, mockChannel } = createMockDriver();

    await createWorker<TestMessages, Driver<ChildProcessCapabilities>>({
      script: './worker.js',
      driver: mockDriver,
    });

    expect(mockChannel.onShutdown).toHaveBeenCalled();
  });

  test('shutdown handler processes all registered shutdown callbacks', async () => {
    const { mockDriver, triggerShutdown, mockChannel } = createMockDriver();

    const worker = await createWorker<
      TestMessages,
      Driver<ChildProcessCapabilities>
    >({
      script: './worker.js',
      driver: mockDriver,
    });

    const pendingPromise = worker.send('testMessage', { value: 42 });

    expect(mockChannel.onShutdown).toHaveBeenCalled();

    triggerShutdown({ type: 'exit', code: 137, signal: 'SIGKILL' });

    await expect(pendingPromise).rejects.toThrow(WorkerCrashedError);
  });

  test('graceful shutdown uses normal rejection, not retry logic', async () => {
    const { mockDriver } = createMockDriver();

    const worker = await createWorker<
      TestMessages,
      Driver<ChildProcessCapabilities>
    >({
      script: './worker.js',
      driver: mockDriver,
    });

    const pendingPromise = worker.send('testMessage', { value: 42 });

    await worker.close();

    await expect(pendingPromise).rejects.toThrow('Worker closed');
    await expect(pendingPromise).rejects.not.toThrow(WorkerCrashedError);
  });
});
