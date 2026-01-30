/**
 * Shared message definitions for the error-handling example
 *
 * This file is imported by both the host and worker to ensure
 * type safety and avoid duplication.
 */

import { DefineMessages } from 'isolated-workers';

/**
 * Message types for the division example
 */
export type Messages = DefineMessages<{
  divide: {
    payload: { a: number; b: number };
    result: { result: number };
  };
}>;
