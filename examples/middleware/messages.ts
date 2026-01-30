/**
 * Shared message definitions for the middleware example
 */

import { DefineMessages } from 'isolated-workers';

/**
 * Message types for the middleware example
 */
export type Messages = DefineMessages<{
  greet: {
    payload: { name: string };
    result: { greeting: string };
  };
  compute: {
    payload: { values: number[] };
    result: { sum: number; count: number };
  };
}>;
