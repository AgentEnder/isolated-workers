import {
  createMetaLogger,
  defaultLogger,
  type Logger,
  type LogLevel,
} from './logger.js';

describe('logger', () => {
  describe('defaultLogger', () => {
    test('has all log methods', () => {
      expect(typeof defaultLogger.debug).toBe('function');
      expect(typeof defaultLogger.info).toBe('function');
      expect(typeof defaultLogger.warn).toBe('function');
      expect(typeof defaultLogger.error).toBe('function');
    });

    test('does not throw when logging', () => {
      // Suppress console output during test
      const noop = () => {
        /* noop */
      };
      const spy = vi.spyOn(console, 'debug').mockImplementation(noop);
      const spy2 = vi.spyOn(console, 'info').mockImplementation(noop);
      const spy3 = vi.spyOn(console, 'warn').mockImplementation(noop);
      const spy4 = vi.spyOn(console, 'error').mockImplementation(noop);

      expect(() => defaultLogger.debug('test')).not.toThrow();
      expect(() => defaultLogger.info('test')).not.toThrow();
      expect(() => defaultLogger.warn('test')).not.toThrow();
      expect(() => defaultLogger.error('test')).not.toThrow();

      spy.mockRestore();
      spy2.mockRestore();
      spy3.mockRestore();
      spy4.mockRestore();
    });

    test('accepts multiple arguments', () => {
      const noop = () => {
        /* noop */
      };
      const spy = vi.spyOn(console, 'info').mockImplementation(noop);
      expect(() =>
        defaultLogger.info('message', { key: 'value' }, 123)
      ).not.toThrow();
      spy.mockRestore();
    });
  });

  describe('createMetaLogger', () => {
    describe('with default logger', () => {
      test('creates logger with default level (warn)', () => {
        const logger = createMetaLogger();
        expect(logger).toBeDefined();
        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.error).toBe('function');
      });

      test('respects log level filtering', () => {
        const logs: string[] = [];
        const customLogger: Logger = {
          debug: () => logs.push('debug'),
          info: () => logs.push('info'),
          warn: () => logs.push('warn'),
          error: () => logs.push('error'),
        };

        // With 'warn' level, only warn and error should log
        const warnLogger = createMetaLogger(customLogger, 'warn');
        warnLogger.debug('debug message');
        warnLogger.info('info message');
        warnLogger.warn('warn message');
        warnLogger.error('error message');

        expect(logs).toHaveLength(2);
        expect(logs[0]).toBe('warn');
        expect(logs[1]).toBe('error');
      });
    });

    describe('log level hierarchy', () => {
      const testLogLevel = (level: LogLevel): string[] => {
        const logs: string[] = [];
        const customLogger: Logger = {
          debug: () => logs.push('debug'),
          info: () => logs.push('info'),
          warn: () => logs.push('warn'),
          error: () => logs.push('error'),
        };

        const logger = createMetaLogger(customLogger, level);
        logger.debug('');
        logger.info('');
        logger.warn('');
        logger.error('');

        return logs;
      };

      test('debug level logs everything', () => {
        const logs = testLogLevel('debug');
        expect(logs).toEqual(['debug', 'info', 'warn', 'error']);
      });

      test('info level logs info, warn, error', () => {
        const logs = testLogLevel('info');
        expect(logs).toEqual(['info', 'warn', 'error']);
      });

      test('warn level logs warn, error', () => {
        const logs = testLogLevel('warn');
        expect(logs).toEqual(['warn', 'error']);
      });

      test('error level logs only error', () => {
        const logs = testLogLevel('error');
        expect(logs).toEqual(['error']);
      });
    });

    describe('with custom logger', () => {
      test('uses custom logger methods', () => {
        const messages: string[] = [];
        const customLogger: Logger = {
          debug: (...parts) => messages.push(`[DEBUG] ${parts.join(' ')}`),
          info: (...parts) => messages.push(`[INFO] ${parts.join(' ')}`),
          warn: (...parts) => messages.push(`[WARN] ${parts.join(' ')}`),
          error: (...parts) => messages.push(`[ERROR] ${parts.join(' ')}`),
        };

        const logger = createMetaLogger(customLogger, 'debug');
        logger.debug('test debug');
        logger.info('test info');

        expect(messages).toContain('[DEBUG] test debug');
        expect(messages).toContain('[INFO] test info');
      });

      test('passes all arguments to custom logger', () => {
        const capturedArgs: unknown[][] = [];
        const noop = () => {
          /* noop */
        };
        const customLogger: Logger = {
          debug: noop,
          info: (...parts) => capturedArgs.push(parts),
          warn: noop,
          error: noop,
        };

        const logger = createMetaLogger(customLogger, 'info');
        logger.info('message', { key: 'value' }, 42);

        expect(capturedArgs).toHaveLength(1);
        expect(capturedArgs[0]).toEqual(['message', { key: 'value' }, 42]);
      });
    });

    describe('edge cases', () => {
      test('handles undefined custom logger', () => {
        const noop = () => {
          /* noop */
        };
        const spy = vi.spyOn(console, 'debug').mockImplementation(noop);
        const logger = createMetaLogger(undefined, 'debug');
        expect(() => logger.debug('test')).not.toThrow();
        spy.mockRestore();
      });

      test('handles logger that throws', () => {
        const noop = () => {
          /* noop */
        };
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(noop);
        const brokenLogger: Logger = {
          debug: () => {
            throw new Error('Logger broken');
          },
          info: noop,
          warn: noop,
          error: noop,
        };

        const logger = createMetaLogger(brokenLogger, 'debug');
        // Should not throw, error is caught internally
        expect(() => logger.debug('test')).not.toThrow();
        errorSpy.mockRestore();
      });

      test('handles complex arguments', () => {
        const capturedArgs: unknown[][] = [];
        const noop = () => {
          /* noop */
        };
        const customLogger: Logger = {
          debug: noop,
          info: (...parts) => capturedArgs.push(parts),
          warn: noop,
          error: noop,
        };

        const logger = createMetaLogger(customLogger, 'info');
        logger.info('message', {
          nested: { deep: { value: true } },
          array: [1, 2, 3],
          error: new Error('test'),
        });

        expect(capturedArgs).toHaveLength(1);
        expect(capturedArgs[0][0]).toBe('message');
        expect(capturedArgs[0][1]).toEqual({
          nested: { deep: { value: true } },
          array: [1, 2, 3],
          error: expect.any(Error),
        });
      });
    });
  });
});
