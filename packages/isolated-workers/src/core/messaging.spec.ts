import {
  createRequest,
  createResponse,
  isResultMessage,
  isErrorMessage,
  defaultTxIdGenerator,
  type TypedMessage,
  type TypedResult,
} from './messaging.js';
import type { SerializedError } from '../utils/serializer.js';

describe('messaging', () => {
  describe('createRequest', () => {
    test('creates request with type and payload', () => {
      const request = createRequest('ping', { message: 'hello' });

      expect(request.type).toBe('ping');
      expect(request.payload).toEqual({ message: 'hello' });
      expect(request.tx).toBeDefined();
      expect(typeof request.tx).toBe('string');
    });

    test('generates unique transaction IDs', () => {
      const request1 = createRequest('test', {});
      const request2 = createRequest('test', {});

      expect(request1.tx).not.toBe(request2.tx);
    });

    test('uses custom TX ID generator', () => {
      let counter = 0;
      const customGenerator = () => `custom-${++counter}`;

      const request1 = createRequest('test', {}, customGenerator);
      const request2 = createRequest('test', {}, customGenerator);

      expect(request1.tx).toBe('custom-1');
      expect(request2.tx).toBe('custom-2');
    });

    test('passes message to TX ID generator', () => {
      const generator = (message: TypedMessage<unknown>) =>
        `tx-${message.type}`;

      const request = createRequest('myType', { data: 123 }, generator);

      expect(request.tx).toBe('tx-myType');
    });

    test('handles complex payload', () => {
      const payload = {
        nested: { deeply: { value: 42 } },
        array: [1, 2, 3],
        string: 'test',
        null: null,
      };
      const request = createRequest('complex', payload);

      expect(request.payload).toEqual(payload);
    });
  });

  describe('createResponse', () => {
    test('creates response with Result suffix', () => {
      const response = createResponse('tx-123', 'ping', { message: 'pong' });

      expect(response.type).toBe('pingResult');
      expect(response.tx).toBe('tx-123');
      expect(response.payload).toEqual({ message: 'pong' });
    });

    test('preserves transaction ID from request', () => {
      const request = createRequest('test', {});
      const response = createResponse(request.tx, 'test', { success: true });

      expect(response.tx).toBe(request.tx);
    });

    test('handles void payload', () => {
      const response = createResponse('tx-123', 'notify', undefined);

      expect(response.type).toBe('notifyResult');
      expect(response.payload).toBeUndefined();
    });
  });

  describe('isResultMessage', () => {
    test('returns true for valid result message', () => {
      const result: TypedResult = {
        type: 'pingResult',
        payload: { message: 'pong' },
        tx: 'tx-123',
      };

      expect(isResultMessage(result, 'ping')).toBe(true);
    });

    test('returns false for wrong type', () => {
      const result: TypedResult = {
        type: 'pongResult',
        payload: {},
        tx: 'tx-123',
      };

      expect(isResultMessage(result, 'ping')).toBe(false);
    });

    test('returns false for non-result type', () => {
      const message: TypedMessage = {
        type: 'ping',
        payload: {},
        tx: 'tx-123',
      };

      expect(isResultMessage(message, 'ping')).toBe(false);
    });

    test('returns false for null', () => {
      expect(isResultMessage(null, 'test')).toBe(false);
    });

    test('returns false for undefined', () => {
      expect(isResultMessage(undefined, 'test')).toBe(false);
    });

    test('returns false for primitive', () => {
      expect(isResultMessage('string', 'test')).toBe(false);
      expect(isResultMessage(123, 'test')).toBe(false);
    });

    test('returns false for missing tx', () => {
      const invalid = { type: 'testResult', payload: {} };
      expect(isResultMessage(invalid, 'test')).toBe(false);
    });
  });

  describe('isErrorMessage', () => {
    test('returns true for error message', () => {
      const error: TypedResult<SerializedError> = {
        type: 'pingError',
        payload: { message: 'Something failed', name: 'Error' },
        tx: 'tx-123',
      };

      expect(isErrorMessage(error)).toBe(true);
    });

    test('returns true for any message ending in Error', () => {
      const cases = ['computeError', 'fetchDataError', 'Error'];
      for (const type of cases) {
        const msg = { type, payload: {}, tx: 'tx' };
        expect(isErrorMessage(msg)).toBe(true);
      }
    });

    test('returns false for result message', () => {
      const result: TypedResult = {
        type: 'pingResult',
        payload: {},
        tx: 'tx-123',
      };

      expect(isErrorMessage(result)).toBe(false);
    });

    test('returns false for request message', () => {
      const request: TypedMessage = {
        type: 'ping',
        payload: {},
        tx: 'tx-123',
      };

      expect(isErrorMessage(request)).toBe(false);
    });

    test('returns false for null', () => {
      expect(isErrorMessage(null)).toBe(false);
    });

    test('returns false for undefined', () => {
      expect(isErrorMessage(undefined)).toBe(false);
    });

    test('returns false for non-object', () => {
      expect(isErrorMessage('string')).toBe(false);
    });

    test('returns false for missing tx', () => {
      const invalid = { type: 'testError', payload: {} };
      expect(isErrorMessage(invalid)).toBe(false);
    });
  });

  describe('defaultTxIdGenerator', () => {
    test('generates UUID format', () => {
      const tx = defaultTxIdGenerator({} as TypedMessage);

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(tx).toMatch(uuidRegex);
    });

    test('generates unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(defaultTxIdGenerator({} as TypedMessage));
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('message flow', () => {
    test('request and response have matching transaction IDs', () => {
      const request = createRequest('compute', { a: 1, b: 2 });
      const response = createResponse(request.tx, 'compute', { result: 3 });

      expect(request.tx).toBe(response.tx);
      expect(isResultMessage(response, 'compute')).toBe(true);
    });

    test('multiple requests have unique transactions', () => {
      const requests = [
        createRequest('add', { a: 1, b: 2 }),
        createRequest('multiply', { a: 3, b: 4 }),
        createRequest('add', { a: 5, b: 6 }),
      ];

      const txIds = requests.map((r) => r.tx);
      const uniqueIds = new Set(txIds);

      expect(uniqueIds.size).toBe(3);
    });
  });
});
