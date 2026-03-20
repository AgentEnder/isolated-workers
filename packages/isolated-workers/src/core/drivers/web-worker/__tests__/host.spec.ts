/**
 * Unit tests for WebWorkerWorkerHandle (host side)
 *
 * Mocks the browser Worker and MessagePort APIs since they are
 * not available in a Node.js test environment.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { WebWorkerWorkerHandle } from '../host.js';
import type { DriverMessage } from '../../../driver.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockMessagePort(): MessagePort {
  return {
    onmessage: null,
    onmessageerror: null,
    postMessage: vi.fn(),
    close: vi.fn(),
    start: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as MessagePort;
}

function createMockWorker(): Worker {
  return {
    onerror: null,
    onmessage: null,
    onmessageerror: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as Worker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebWorkerWorkerHandle', () => {
  let mockWorker: Worker;
  let mockPort: MessagePort;
  let channel: WebWorkerWorkerHandle;

  beforeEach(() => {
    mockWorker = createMockWorker();
    mockPort = createMockMessagePort();
    channel = new WebWorkerWorkerHandle(mockWorker, mockPort);
  });

  test('starts connected', () => {
    expect(channel.isConnected).toBe(true);
  });

  test('pid is undefined', () => {
    expect(channel.pid).toBeUndefined();
  });

  test('send() posts message to port', async () => {
    const message: DriverMessage = {
      type: 'test',
      payload: { value: 1 },
      tx: 'tx-1',
    };

    await channel.send(message);

    expect(mockPort.postMessage).toHaveBeenCalledWith(message);
  });

  test('send() throws when disconnected', async () => {
    await channel.close();

    const message: DriverMessage = {
      type: 'test',
      payload: {},
      tx: 'tx-2',
    };

    await expect(channel.send(message)).rejects.toThrow(
      'Channel is not connected'
    );
  });

  test('routes incoming port messages to handlers', () => {
    const handler = vi.fn();
    channel.onMessage(handler);

    const message: DriverMessage = {
      type: 'response',
      payload: { result: 42 },
      tx: 'tx-3',
    };

    // Simulate an incoming message on the port
    const onmessage = mockPort.onmessage as
      | ((ev: MessageEvent) => void)
      | null;
    expect(onmessage).toBeDefined();
    (onmessage as (ev: MessageEvent) => void)({ data: message } as MessageEvent);

    expect(handler).toHaveBeenCalledWith(message);
  });

  test('routes messages to multiple handlers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    channel.onMessage(handler1);
    channel.onMessage(handler2);

    const message: DriverMessage = {
      type: 'multi',
      payload: {},
      tx: 'tx-4',
    };

    const onmessage = mockPort.onmessage as
      | ((ev: MessageEvent) => void)
      | null;
    (onmessage as (ev: MessageEvent) => void)({ data: message } as MessageEvent);

    expect(handler1).toHaveBeenCalledWith(message);
    expect(handler2).toHaveBeenCalledWith(message);
  });

  test('swallows handler errors without breaking message loop', () => {
    const throwingHandler = vi.fn(() => {
      throw new Error('handler boom');
    });
    const safeHandler = vi.fn();
    channel.onMessage(throwingHandler);
    channel.onMessage(safeHandler);

    const message: DriverMessage = {
      type: 'err',
      payload: {},
      tx: 'tx-5',
    };

    const onmessage = mockPort.onmessage as
      | ((ev: MessageEvent) => void)
      | null;
    (onmessage as (ev: MessageEvent) => void)({ data: message } as MessageEvent);

    expect(throwingHandler).toHaveBeenCalled();
    expect(safeHandler).toHaveBeenCalledWith(message);
  });

  test('close() terminates worker and closes port', async () => {
    await channel.close();

    expect(channel.isConnected).toBe(false);
    expect(mockPort.close).toHaveBeenCalled();
    expect(mockWorker.terminate).toHaveBeenCalled();
  });

  test('close() is idempotent', async () => {
    await channel.close();
    await channel.close();

    // terminate and close should only be called once
    expect((mockWorker.terminate as ReturnType<typeof vi.fn>).mock.calls)
      .toHaveLength(1);
    expect((mockPort.close as ReturnType<typeof vi.fn>).mock.calls)
      .toHaveLength(1);
  });

  test('close() triggers close handlers', async () => {
    const closeHandler = vi.fn();
    channel.onClose(closeHandler);

    await channel.close();

    expect(closeHandler).toHaveBeenCalledTimes(1);
  });

  test('worker error events trigger error and shutdown handlers', () => {
    const errorHandler = vi.fn();
    const shutdownHandler = vi.fn();
    channel.onError(errorHandler);
    channel.onShutdown(shutdownHandler);

    // Simulate a worker error
    const onerror = mockWorker.onerror as
      | ((ev: ErrorEvent) => void)
      | null;
    expect(onerror).toBeDefined();
    (onerror as (ev: ErrorEvent) => void)({ message: 'Script error' } as ErrorEvent);

    expect(errorHandler).toHaveBeenCalledTimes(1);
    const errorArg = errorHandler.mock.calls[0][0] as Error;
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toBe('Script error');

    expect(shutdownHandler).toHaveBeenCalledTimes(1);
    const shutdownArg = shutdownHandler.mock.calls[0][0];
    expect(shutdownArg).toEqual({
      type: 'error',
      error: expect.any(Error),
    });
  });

  test('port message error triggers error handlers', () => {
    const errorHandler = vi.fn();
    channel.onError(errorHandler);

    const onmessageerror = mockPort.onmessageerror as
      | ((ev: MessageEvent) => void)
      | null;
    expect(onmessageerror).toBeDefined();
    (onmessageerror as (ev: MessageEvent) => void)({} as MessageEvent);

    expect(errorHandler).toHaveBeenCalledTimes(1);
    const errorArg = errorHandler.mock.calls[0][0] as Error;
    expect(errorArg.message).toContain('deserialize');
  });
});
