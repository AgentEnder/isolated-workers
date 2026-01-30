/**
 * Shared message definitions for the worker lifecycle example
 */

import { DefineMessages } from 'isolated-workers';

/**
 * Message types for lifecycle demonstration
 */
export type Messages = DefineMessages<{
  getStatus: {
    payload: Record<string, never>;
    result: { uptime: number; requestCount: number };
  };
  incrementCounter: {
    payload: { amount: number };
    result: { newValue: number };
  };
}>;
