import { isWorkerMessage, isWorkerResult } from './guards.js';
import type { AnyMessage } from '../types/messages.js';

describe('type guards', () => {
  describe('isWorkerMessage', () => {
    test('returns true for valid worker message', () => {
      const message: AnyMessage = { type: 'test', payload: { data: 'test' } };
      expect(isWorkerMessage(message)).toBe(true);
    });

    test('returns false for invalid worker message', () => {
      expect(isWorkerMessage(null)).toBe(false);
      expect(isWorkerMessage(undefined)).toBe(false);
      expect(isWorkerMessage('string')).toBe(false);
      expect(isWorkerMessage({ type: 'test' })).toBe(false);
      expect(isWorkerMessage({ payload: 'test' })).toBe(false);
    });
  });

  describe('isWorkerResult', () => {
    test('returns true for valid worker result', () => {
      const result = { type: 'testResult', payload: { data: 'result' } };
      expect(isWorkerResult(result)).toBe(true);
    });

    test('returns false for invalid worker result', () => {
      expect(isWorkerResult(null)).toBe(false);
      expect(isWorkerResult(undefined)).toBe(false);
      expect(isWorkerResult('string')).toBe(false);
      expect(isWorkerResult({ type: 'test' })).toBe(false);
      expect(isWorkerResult({ payload: 'test' })).toBe(false);
    });
  });
});
