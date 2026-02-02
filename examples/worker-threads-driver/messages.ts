/**
 * Shared message definitions for the worker-threads-driver example
 */

import { DefineMessages } from 'isolated-workers';

/**
 * Message types for the compute example
 */
export type Messages = DefineMessages<{
  compute: {
    payload: { value: number };
    result: { result: number };
  };
}>;
