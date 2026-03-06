/**
 * Unit tests for WebWorkerServerChannel (worker/server side)
 *
 * Mocks the MessagePort API since it is not available in Node.js.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { WebWorkerServerChannel } from '../server.js';
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebWorkerServerChannel', () => {
  let mockPort: MessagePort;
  let server: WebWorkerServerChannel;

  beforeEach(() => {
    mockPort = createMockMessagePort();
    server = new WebWorkerServerChannel(mockPort);
  });

  test('starts not running', () => {
    expect(server.isRunning).toBe(false);
  });

  test('socketPath returns empty string', () => {
    expect(server.socketPath).toBe('');
  });

  test('after start(), isRunning is true', () => {
    server.start();
    expect(server.isRunning).toBe(true);
  });

  test('start() calls port.start()', () => {
    server.start();
    expect(mockPort.start).toHaveBeenCalled();
  });

  test('start() is idempotent', () => {
    server.start();
    server.start();
    expect((mockPort.start as ReturnType<typeof vi.fn>).mock.calls)
      .toHaveLength(1);
  });

  test('after start(), routes port messages to handlers', () => {
    const handler = vi.fn();
    server.onMessage(handler);
    server.start();

    const message: DriverMessage = {
      type: 'request',
      payload: { key: 'value' },
      tx: 'tx-1',
    };

    const onmessage = mockPort.onmessage as
      | ((ev: MessageEvent) => void)
      | null;
    expect(onmessage).toBeDefined();
    (onmessage as (ev: MessageEvent) => void)({ data: message } as MessageEvent);

    expect(handler).toHaveBeenCalledTimes(1);
    // First arg is the message, second is the respond function
    expect(handler.mock.calls[0][0]).toEqual(message);
    expect(typeof handler.mock.calls[0][1]).toBe('function');
  });

  test('respond function posts message back to port', async () => {
    const handler = vi.fn();
    server.onMessage(handler);
    server.start();

    const message: DriverMessage = {
      type: 'request',
      payload: {},
      tx: 'tx-2',
    };

    const onmessage = mockPort.onmessage as
      | ((ev: MessageEvent) => void)
      | null;
    (onmessage as (ev: MessageEvent) => void)({ data: message } as MessageEvent);

    // Get the respond function passed to the handler
    const respond = handler.mock.calls[0][1] as (
      msg: DriverMessage
    ) => Promise<void>;

    const response: DriverMessage = {
      type: 'response',
      payload: { result: 'ok' },
      tx: 'tx-2',
    };

    await respond(response);

    expect(mockPort.postMessage).toHaveBeenCalledWith(response);
  });

  test('handler errors trigger error handlers', () => {
    const errorHandler = vi.fn();
    const throwingHandler = vi.fn(() => {
      throw new Error('handler error');
    });

    server.onMessage(throwingHandler);
    server.onError(errorHandler);
    server.start();

    const message: DriverMessage = {
      type: 'bad',
      payload: {},
      tx: 'tx-3',
    };

    const onmessage = mockPort.onmessage as
      | ((ev: MessageEvent) => void)
      | null;
    (onmessage as (ev: MessageEvent) => void)({ data: message } as MessageEvent);

    expect(errorHandler).toHaveBeenCalledTimes(1);
    const errorArg = errorHandler.mock.calls[0][0] as Error;
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toBe('handler error');
  });

  test('port message error triggers error handlers', () => {
    const errorHandler = vi.fn();
    server.onError(errorHandler);
    server.start();

    const onmessageerror = mockPort.onmessageerror as
      | ((ev: MessageEvent) => void)
      | null;
    expect(onmessageerror).toBeDefined();
    (onmessageerror as (ev: MessageEvent) => void)({} as MessageEvent);

    expect(errorHandler).toHaveBeenCalledTimes(1);
    const errorArg = errorHandler.mock.calls[0][0] as Error;
    expect(errorArg.message).toContain('deserialize');
  });

  test('stop() closes the port', async () => {
    server.start();
    await server.stop();

    expect(server.isRunning).toBe(false);
    expect(mockPort.close).toHaveBeenCalled();
  });
});
