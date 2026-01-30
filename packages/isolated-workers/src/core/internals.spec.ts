import {
  calculateDelay,
  normalizeTimeoutConfig,
  getTimeoutValue,
  applyMiddleware,
  parseEnvTimeout,
  DEFAULT_STARTUP_TIMEOUT,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
  DEFAULT_MESSAGE_TIMEOUT,
} from './internals.js';
import type { DefineMessages, Middleware, AnyMessage } from '../types/index.js';

// Test message types
type TestMessages = DefineMessages<{
  fast: { payload: { value: number }; result: { doubled: number } };
  slow: { payload: { delay: number }; result: { done: boolean } };
}>;

describe('core/internals', () => {
  describe('calculateDelay', () => {
    describe('with numeric base delay', () => {
      test('calculates exponential backoff', () => {
        // With 0 jitter for predictable testing
        expect(calculateDelay(100, 0, 10000, 0)).toBe(100); // 100 * 2^0 = 100
        expect(calculateDelay(100, 1, 10000, 0)).toBe(200); // 100 * 2^1 = 200
        expect(calculateDelay(100, 2, 10000, 0)).toBe(400); // 100 * 2^2 = 400
        expect(calculateDelay(100, 3, 10000, 0)).toBe(800); // 100 * 2^3 = 800
        expect(calculateDelay(100, 4, 10000, 0)).toBe(1600); // 100 * 2^4 = 1600
      });

      test('respects maxDelay cap', () => {
        // 100 * 2^10 = 102400, but capped at 5000
        expect(calculateDelay(100, 10, 5000, 0)).toBe(5000);
        // 100 * 2^5 = 3200, under cap
        expect(calculateDelay(100, 5, 5000, 0)).toBe(3200);
      });

      test('adds jitter when provided', () => {
        expect(calculateDelay(100, 0, 10000, 50)).toBe(150);
        expect(calculateDelay(100, 0, 10000, 100)).toBe(200);
      });

      test('adds random jitter by default', () => {
        const delay = calculateDelay(100, 0, 10000);
        // Should be between 100 and 200 (100 + 0-100 jitter)
        expect(delay).toBeGreaterThanOrEqual(100);
        expect(delay).toBeLessThan(200);
      });

      test('handles zero base delay', () => {
        expect(calculateDelay(0, 5, 10000, 0)).toBe(0);
      });
    });

    describe('with custom delay function', () => {
      test('uses function return value', () => {
        const linear = (attempt: number) => attempt * 500;
        expect(calculateDelay(linear, 0, 10000, 0)).toBe(0);
        expect(calculateDelay(linear, 1, 10000, 0)).toBe(500);
        expect(calculateDelay(linear, 2, 10000, 0)).toBe(1000);
        expect(calculateDelay(linear, 5, 10000, 0)).toBe(2500);
      });

      test('still respects maxDelay cap', () => {
        const aggressive = (attempt: number) => attempt * 10000;
        expect(calculateDelay(aggressive, 1, 5000, 0)).toBe(5000);
      });

      test('throws on negative return', () => {
        const negative = () => -100;
        expect(() => calculateDelay(negative, 0, 10000, 0)).toThrow(
          'Delay function must return a positive number'
        );
      });

      test('throws on NaN return', () => {
        const nan = () => NaN;
        expect(() => calculateDelay(nan, 0, 10000, 0)).toThrow(
          'Delay function must return a positive number'
        );
      });

      test('throws on Infinity return', () => {
        const inf = () => Infinity;
        expect(() => calculateDelay(inf, 0, 10000, 0)).toThrow(
          'Delay function must return a positive number'
        );
      });

      test('allows zero return', () => {
        const zero = () => 0;
        expect(calculateDelay(zero, 0, 10000, 0)).toBe(0);
      });
    });
  });

  describe('normalizeTimeoutConfig', () => {
    test('converts number to config object', () => {
      const config = normalizeTimeoutConfig<TestMessages>(5000);
      expect(config.WORKER_STARTUP).toBe(5000);
      expect(config.SERVER_CONNECT).toBe(5000);
      expect(config.WORKER_MESSAGE).toBe(5000);
    });

    test('passes through config object unchanged', () => {
      const input = {
        WORKER_STARTUP: 1000,
        WORKER_MESSAGE: 60000,
        fast: 500,
      };
      const config = normalizeTimeoutConfig<TestMessages>(input);
      expect(config).toEqual(input);
    });

    test('returns empty object for undefined', () => {
      const config = normalizeTimeoutConfig<TestMessages>(undefined);
      expect(config).toEqual({});
    });

    test('preserves per-message-type timeouts', () => {
      const input = {
        WORKER_STARTUP: 1000,
        fast: 100,
        slow: 30000,
      };
      const config = normalizeTimeoutConfig<TestMessages>(input);
      expect(config.fast).toBe(100);
      expect(config.slow).toBe(30000);
    });
  });

  describe('getTimeoutValue', () => {
    const defaults = {
      WORKER_STARTUP: DEFAULT_STARTUP_TIMEOUT,
      SERVER_CONNECT: DEFAULT_SERVER_CONNECT_TIMEOUT,
      WORKER_MESSAGE: DEFAULT_MESSAGE_TIMEOUT,
    };

    test('returns explicit value when set', () => {
      const config = { WORKER_STARTUP: 5000 };
      expect(getTimeoutValue(config, 'WORKER_STARTUP', defaults)).toBe(5000);
    });

    test('returns default for WORKER_STARTUP when not set', () => {
      expect(getTimeoutValue({}, 'WORKER_STARTUP', defaults)).toBe(
        DEFAULT_STARTUP_TIMEOUT
      );
    });

    test('returns default for SERVER_CONNECT when not set', () => {
      expect(getTimeoutValue({}, 'SERVER_CONNECT', defaults)).toBe(
        DEFAULT_SERVER_CONNECT_TIMEOUT
      );
    });

    test('returns WORKER_MESSAGE for unknown message types', () => {
      const config = { WORKER_MESSAGE: 60000 };
      expect(getTimeoutValue<TestMessages>(config, 'fast', defaults)).toBe(
        60000
      );
    });

    test('returns default WORKER_MESSAGE when not configured', () => {
      expect(getTimeoutValue<TestMessages>({}, 'fast', defaults)).toBe(
        DEFAULT_MESSAGE_TIMEOUT
      );
    });

    test('returns per-message-type timeout when set', () => {
      const config = {
        WORKER_MESSAGE: 60000,
        fast: 100,
        slow: 120000,
      };
      expect(getTimeoutValue<TestMessages>(config, 'fast', defaults)).toBe(100);
      expect(getTimeoutValue<TestMessages>(config, 'slow', defaults)).toBe(
        120000
      );
    });

    test('per-message-type takes precedence over WORKER_MESSAGE', () => {
      const config = {
        WORKER_MESSAGE: 60000,
        fast: 100,
      };
      expect(getTimeoutValue<TestMessages>(config, 'fast', defaults)).toBe(100);
    });
  });

  describe('applyMiddleware', () => {
    test('returns original message with empty middleware array', async () => {
      const message = { type: 'fast', payload: { value: 42 }, tx: 'tx-1' };
      const result = await applyMiddleware<TestMessages>(
        message as AnyMessage<TestMessages>,
        'outgoing',
        []
      );
      expect(result).toEqual(message);
    });

    test('applies middleware in order', async () => {
      const order: string[] = [];
      const mw1: Middleware<TestMessages> = (msg, dir) => {
        order.push(`mw1-${dir}`);
        return msg;
      };
      const mw2: Middleware<TestMessages> = (msg, dir) => {
        order.push(`mw2-${dir}`);
        return msg;
      };

      const message = { type: 'fast', payload: { value: 1 }, tx: 'tx-1' };
      await applyMiddleware<TestMessages>(
        message as AnyMessage<TestMessages>,
        'outgoing',
        [mw1, mw2]
      );

      expect(order).toEqual(['mw1-outgoing', 'mw2-outgoing']);
    });

    test('middleware can transform message', async () => {
      const doubler: Middleware<TestMessages> = (msg) => {
        if (msg.type === 'fast') {
          return {
            ...msg,
            payload: { value: (msg.payload as { value: number }).value * 2 },
          };
        }
        return msg;
      };

      const message = { type: 'fast', payload: { value: 21 }, tx: 'tx-1' };
      const result = await applyMiddleware<TestMessages>(
        message as AnyMessage<TestMessages>,
        'outgoing',
        [doubler]
      );

      expect((result.payload as { value: number }).value).toBe(42);
    });

    test('middleware returning undefined passes through', async () => {
      const noopMw: Middleware<TestMessages> = () => undefined;

      const message = { type: 'fast', payload: { value: 42 }, tx: 'tx-1' };
      const result = await applyMiddleware<TestMessages>(
        message as AnyMessage<TestMessages>,
        'outgoing',
        [noopMw]
      );

      expect(result).toEqual(message);
    });

    test('async middleware works correctly', async () => {
      const asyncMw: Middleware<TestMessages> = async (msg) => {
        await new Promise((r) => setTimeout(r, 10));
        return msg;
      };

      const message = { type: 'fast', payload: { value: 42 }, tx: 'tx-1' };
      const result = await applyMiddleware<TestMessages>(
        message as AnyMessage<TestMessages>,
        'outgoing',
        [asyncMw]
      );

      expect(result).toEqual(message);
    });

    test('seals message before passing to middleware', async () => {
      let wasSealed = false;
      const checkSeal: Middleware<TestMessages> = (msg) => {
        wasSealed = !Object.isExtensible(msg);
        return msg;
      };

      const message = { type: 'fast', payload: { value: 42 }, tx: 'tx-1' };
      await applyMiddleware<TestMessages>(
        message as AnyMessage<TestMessages>,
        'outgoing',
        [checkSeal]
      );

      expect(wasSealed).toBe(true);
    });

    test('receives correct direction', async () => {
      let capturedDirection: string | undefined;
      const captureMw: Middleware<TestMessages> = (msg, dir) => {
        capturedDirection = dir;
        return msg;
      };

      const message = { type: 'fast', payload: { value: 42 }, tx: 'tx-1' };

      await applyMiddleware<TestMessages>(
        message as AnyMessage<TestMessages>,
        'incoming',
        [captureMw]
      );
      expect(capturedDirection).toBe('incoming');

      await applyMiddleware<TestMessages>(
        message as AnyMessage<TestMessages>,
        'outgoing',
        [captureMw]
      );
      expect(capturedDirection).toBe('outgoing');
    });
  });

  describe('parseEnvTimeout', () => {
    test('returns default for undefined', () => {
      expect(parseEnvTimeout(undefined, 5000)).toBe(5000);
    });

    test('returns default for empty string', () => {
      expect(parseEnvTimeout('', 5000)).toBe(5000);
    });

    test('parses valid number', () => {
      expect(parseEnvTimeout('10000', 5000)).toBe(10000);
    });

    test('returns default for non-numeric string', () => {
      expect(parseEnvTimeout('not-a-number', 5000)).toBe(5000);
    });

    test('returns default for negative number', () => {
      expect(parseEnvTimeout('-100', 5000)).toBe(5000);
    });

    test('allows zero', () => {
      expect(parseEnvTimeout('0', 5000)).toBe(0);
    });

    test('handles decimal strings (truncates)', () => {
      expect(parseEnvTimeout('1500.7', 5000)).toBe(1500);
    });
  });

  describe('default timeout constants', () => {
    test('WORKER_STARTUP is 10 seconds', () => {
      expect(DEFAULT_STARTUP_TIMEOUT).toBe(10_000);
    });

    test('SERVER_CONNECT is 30 seconds', () => {
      expect(DEFAULT_SERVER_CONNECT_TIMEOUT).toBe(30_000);
    });

    test('WORKER_MESSAGE is 5 minutes', () => {
      expect(DEFAULT_MESSAGE_TIMEOUT).toBe(5 * 60 * 1000);
    });
  });
});
