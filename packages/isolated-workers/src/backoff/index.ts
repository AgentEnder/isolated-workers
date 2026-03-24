/**
 * Backoff curve utilities for connection retry strategies.
 *
 * Provides factory functions for creating delay curves and pre-built presets
 * that can be spread directly into `connection` options.
 *
 * @example
 * ```typescript
 * import { backoff } from 'isolated-workers/backoff-curves';
 *
 * const worker = await createWorker<Messages>({
 *   script: './worker.js',
 *   connection: { ...backoff.aggressive },
 * });
 * ```
 *
 * @packageDocumentation
 */

/**
 * A function that computes the delay for a given attempt number (0-based).
 *
 * Can return either:
 * - **`number`** — delay in milliseconds (will be slept)
 * - **`Promise<void>`** — the promise itself IS the delay; when it resolves,
 *   the next attempt fires immediately. This enables event-driven waits
 *   like polling a health check or watching for a file.
 *
 * If the promise resolves to a non-void value, an error is thrown.
 *
 * @category Types
 */
export type DelayFunction = (attempt: number) => number | Promise<void>;

/**
 * A complete backoff configuration that can be spread into `connection` options.
 *
 * @example
 * ```typescript
 * const worker = await createWorker<Messages>({
 *   script: './worker.js',
 *   connection: { ...backoff.aggressive },
 * });
 * ```
 *
 * @category Types
 */
export interface BackoffCurve {
  /** Delay function that returns ms to wait for a given attempt */
  delay: DelayFunction;
  /** Total number of attempts before giving up */
  attempts: number;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Create a stepped backoff curve from a list of `[delayMs, count]` pairs.
 *
 * Each pair defines a delay and how many consecutive attempts use that delay.
 * The total attempt count is the sum of all counts.
 *
 * @category Factory
 *
 * @example
 * ```typescript
 * // 10 tries @ 10ms, then 10 tries @ 100ms, then 10 tries @ 1s
 * const curve = stepped([10, 10], [100, 10], [1000, 10]);
 * // curve.attempts === 30
 * ```
 */
export function stepped(...steps: [delay: number, count: number][]): BackoffCurve {
  if (steps.length === 0) {
    throw new Error('stepped() requires at least one [delay, count] pair');
  }

  // Pre-compute boundaries for O(1) lookup
  const boundaries: Array<{ threshold: number; delay: number }> = [];
  let total = 0;
  for (const [delay, count] of steps) {
    total += count;
    boundaries.push({ threshold: total, delay });
  }

  return {
    attempts: total,
    delay(attempt: number): number {
      for (const { threshold, delay } of boundaries) {
        if (attempt < threshold) return delay;
      }
      // Past all steps — use the last delay
      return boundaries[boundaries.length - 1].delay;
    },
  };
}

/**
 * Create an exponential backoff curve: `base * factor^attempt`.
 *
 * @param base - Initial delay in ms (default: 100)
 * @param factor - Multiplier per attempt (default: 2)
 * @param attempts - Total attempts (default: 10)
 *
 * @category Factory
 *
 * @example
 * ```typescript
 * // 100ms, 200ms, 400ms, 800ms, 1600ms, ...
 * const curve = exponential(100, 2, 10);
 * ```
 */
export function exponential(
  base = 100,
  factor = 2,
  attempts = 10
): BackoffCurve {
  return {
    attempts,
    delay(attempt: number): number {
      return base * Math.pow(factor, attempt);
    },
  };
}

/**
 * Create a linear backoff curve: `initial + increment * attempt`.
 *
 * @param initial - Starting delay in ms (default: 100)
 * @param increment - Additional ms per attempt (default: 100)
 * @param attempts - Total attempts (default: 10)
 *
 * @category Factory
 *
 * @example
 * ```typescript
 * // 100ms, 200ms, 300ms, 400ms, ...
 * const curve = linear(100, 100, 10);
 * ```
 */
export function linear(
  initial = 100,
  increment = 100,
  attempts = 10
): BackoffCurve {
  return {
    attempts,
    delay(attempt: number): number {
      return initial + increment * attempt;
    },
  };
}

/**
 * Create a constant backoff curve: same delay every attempt.
 *
 * @param delay - Delay in ms
 * @param attempts - Total attempts (default: 5)
 *
 * @category Factory
 *
 * @example
 * ```typescript
 * // 500ms, 500ms, 500ms, ...
 * const curve = constant(500, 5);
 * ```
 */
export function constant(delay: number, attempts = 5): BackoffCurve {
  return {
    attempts,
    delay: () => delay,
  };
}

// ---------------------------------------------------------------------------
// Pre-built presets
// ---------------------------------------------------------------------------

/**
 * Aggressive backoff: fast initial probing, escalates quickly.
 *
 * 10 tries @ 10ms → 10 tries @ 100ms → 10 tries @ 1s (30 total)
 *
 * Best for: local workers that should be ready almost immediately.
 *
 * @category Preset
 */
export const aggressive: BackoffCurve = stepped(
  [10, 10],
  [100, 10],
  [1000, 10]
);

/**
 * Gentle backoff: moderate initial delay, slower escalation.
 *
 * 5 tries @ 100ms → 5 tries @ 500ms → 5 tries @ 2s (15 total)
 *
 * Best for: workers with moderate startup time.
 *
 * @category Preset
 */
export const gentle: BackoffCurve = stepped(
  [100, 5],
  [500, 5],
  [2000, 5]
);

/**
 * Patient backoff: for workers that need significant startup time.
 *
 * 5 tries @ 1s → 10 tries @ 5s → 10 tries @ 10s (25 total)
 *
 * Best for: workers that compile, download, or perform heavy initialization.
 *
 * @category Preset
 */
export const patient: BackoffCurve = stepped(
  [1000, 5],
  [5000, 10],
  [10_000, 10]
);
