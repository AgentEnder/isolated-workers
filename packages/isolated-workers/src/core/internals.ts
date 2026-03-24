/**
 * Internal pure functions for core modules.
 * Exported for testing purposes.
 *
 * @packageDocumentation
 * @internal
 */

import { seal } from '../utils/index.js';
import type { MessageDefs, AnyMessage, Middleware } from '../types/index.js';
import type { BuiltInTimeoutKey, TimeoutConfig } from './worker.js';

// Re-export constants for use in this module
export {
  DEFAULT_STARTUP_TIMEOUT,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
  DEFAULT_MESSAGE_TIMEOUT,
} from './worker.js';

/**
 * The type accepted for retry delay configuration.
 *
 * - **`number`** — base delay in ms, used with exponential backoff
 * - **`(attempt) => number`** — custom delay curve returning ms
 * - **`(attempt) => Promise<void>`** — async delay where the promise IS the wait
 *
 * @internal
 */
export type DelayConfig =
  | number
  | ((attempt: number) => number | Promise<void>);

/**
 * Calculate delay for connection retry.
 * Supports number (exponential backoff), sync function (custom curve),
 * and async function (promise-based delay).
 *
 * @param config - Base delay in ms, or custom delay function
 * @param attempt - Current attempt number (0-based)
 * @param maxDelay - Maximum delay cap in ms
 * @param jitter - Optional jitter to add (default: random 0-100ms)
 * @returns Delay in ms, or a Promise that IS the delay
 *
 * @internal
 */
export function calculateDelay(
  config: DelayConfig,
  attempt: number,
  maxDelay: number,
  jitter?: number
): number | Promise<void> {
  if (typeof config !== 'function') {
    // Exponential backoff: baseDelay * 2^attempt
    const delay = config * Math.pow(2, attempt);
    const actualJitter = jitter ?? Math.random() * 100;
    return Math.min(delay, maxDelay) + actualJitter;
  }

  const result = config(attempt);

  // Async delay: the promise IS the wait — no jitter/cap applied
  if (result != null && typeof result === 'object' && 'then' in result) {
    return (result as Promise<unknown>).then((resolved) => {
      if (resolved !== undefined) {
        throw new Error(
          `Async delay function must resolve to void, got: ${typeof resolved}`
        );
      }
    });
  }

  // Sync delay: validate, cap, and jitter
  if (typeof result !== 'number' || result < 0 || !isFinite(result)) {
    throw new Error(
      `Delay function must return a positive number or Promise<void>, got: ${result}`
    );
  }

  const actualJitter = jitter ?? Math.random() * 100;
  return Math.min(result, maxDelay) + actualJitter;
}

/**
 * Normalize timeout configuration.
 * Converts a number or partial config into a full config object.
 *
 * @param timeout - Number (applies to all) or partial config
 * @returns Normalized timeout config
 *
 * @internal
 */
export function normalizeTimeoutConfig<TDefs extends MessageDefs>(
  timeout: number | TimeoutConfig<TDefs> | undefined
): TimeoutConfig<TDefs> {
  if (typeof timeout === 'number') {
    return {
      WORKER_STARTUP: timeout,
      SERVER_CONNECT: timeout,
      WORKER_MESSAGE: timeout,
    } as TimeoutConfig<TDefs>;
  }
  return (timeout ?? {}) as TimeoutConfig<TDefs>;
}

/**
 * Get timeout value for a specific key from config.
 * Falls back to defaults for built-in keys.
 *
 * @param config - Timeout configuration
 * @param key - Key to look up (built-in or message type)
 * @param defaults - Default values for built-in keys
 * @returns Timeout value in ms
 *
 * @internal
 */
export function getTimeoutValue<TDefs extends MessageDefs>(
  config: TimeoutConfig<TDefs>,
  key: BuiltInTimeoutKey | keyof TDefs,
  defaults: {
    WORKER_STARTUP: number;
    SERVER_CONNECT: number;
    WORKER_MESSAGE: number;
  }
): number {
  const value = config[key as keyof typeof config];
  if (value !== undefined) {
    return value;
  }

  // Fall back to defaults for built-in keys
  if (key === 'WORKER_STARTUP') {
    return defaults.WORKER_STARTUP;
  }
  if (key === 'SERVER_CONNECT') {
    return defaults.SERVER_CONNECT;
  }

  // For message types, check WORKER_MESSAGE then default
  return config.WORKER_MESSAGE ?? defaults.WORKER_MESSAGE;
}

/**
 * Apply middleware array sequentially.
 * Messages are sealed to prevent adding new properties.
 * If any middleware throws, the error is wrapped with context and re-thrown.
 *
 * @param message - Message to process
 * @param direction - 'incoming' or 'outgoing'
 * @param middleware - Array of middleware functions
 * @returns Processed message
 *
 * @internal
 */
export async function applyMiddleware<TDefs extends MessageDefs>(
  message: AnyMessage<TDefs>,
  direction: 'incoming' | 'outgoing',
  middleware: Middleware<TDefs>[]
): Promise<AnyMessage<TDefs>> {
  let result = seal(message);

  for (const mw of middleware) {
    try {
      const output = await mw(result, direction);
      if (output) {
        result = seal(output);
      }
    } catch (error) {
      // Middleware error - fail fast with context
      throw new Error(
        `Middleware error (${direction}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return result;
}

/**
 * Parse a timeout value from an environment variable.
 * Returns undefined if the env var is not set or invalid.
 *
 * @param envVar - Environment variable value
 * @param defaultValue - Default value if env var is not set
 * @returns Parsed timeout or default
 *
 * @internal
 */
export function parseEnvTimeout(
  envVar: string | undefined,
  defaultValue: number
): number {
  if (!envVar) {
    return defaultValue;
  }
  const parsed = parseInt(envVar, 10);
  if (isNaN(parsed) || parsed < 0) {
    return defaultValue;
  }
  return parsed;
}
