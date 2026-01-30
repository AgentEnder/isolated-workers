/**
 * Debug logging utilities
 *
 * @packageDocumentation
 */

/**
 * Log level enum
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger interface - must implement all log level methods
 */
export interface Logger {
  debug(...parts: unknown[]): void;
  info(...parts: unknown[]): void;
  warn(...parts: unknown[]): void;
  error(...parts: unknown[]): void;
}

/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * MetaLogger wraps a logger and filters messages based on log level.
 * Suppresses errors thrown by the underlying logger.
 */
class MetaLogger implements Logger {
  private minPriority: number;

  constructor(private baseLogger: Logger, level: LogLevel) {
    this.minPriority = LOG_LEVEL_PRIORITY[level];
  }

  debug(...parts: unknown[]): void {
    if (LOG_LEVEL_PRIORITY.debug >= this.minPriority) {
      this.safeLog(() => this.baseLogger.debug(...parts));
    }
  }

  info(...parts: unknown[]): void {
    if (LOG_LEVEL_PRIORITY.info >= this.minPriority) {
      this.safeLog(() => this.baseLogger.info(...parts));
    }
  }

  warn(...parts: unknown[]): void {
    if (LOG_LEVEL_PRIORITY.warn >= this.minPriority) {
      this.safeLog(() => this.baseLogger.warn(...parts));
    }
  }

  error(...parts: unknown[]): void {
    if (LOG_LEVEL_PRIORITY.error >= this.minPriority) {
      this.safeLog(() => this.baseLogger.error(...parts));
    }
  }

  private safeLog(logFn: () => void): void {
    try {
      logFn();
    } catch (err) {
      // Suppress logger errors - logging shouldn't break functionality
      console.error('[MetaLogger] Logger error:', err);
    }
  }
}

/**
 * Default console-based logger
 */
export const defaultLogger: Logger = {
  debug: (...parts) => console.debug(...parts),
  info: (...parts) => console.info(...parts),
  warn: (...parts) => console.warn(...parts),
  error: (...parts) => console.error(...parts),
};

export const createScopedLogger = (
  scope: string,
  logger = defaultLogger
): Logger => ({
  debug: (...parts: unknown[]) => logger.debug(`[${scope}]`, ...parts),
  info: (...parts: unknown[]) => logger.info(`[${scope}]`, ...parts),
  warn: (...parts: unknown[]) => logger.warn(`[${scope}]`, ...parts),
  error: (...parts: unknown[]) => logger.error(`[${scope}]`, ...parts),
});

/**
 * Create a MetaLogger with the specified base logger and log level.
 * Default log level is 'warn'.
 */
export function createMetaLogger(
  logger?: Logger,
  level: LogLevel = 'warn'
): Logger {
  return new MetaLogger(logger ?? defaultLogger, level);
}
