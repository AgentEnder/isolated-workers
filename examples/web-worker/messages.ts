/**
 * Shared message definitions for the web-worker example
 */

import type { DefineMessages } from 'isolated-workers';

/**
 * Message types for the compute example
 */
export type Messages = DefineMessages<{
  compute: {
    payload: { value: number };
    result: { doubled: number };
  };
}>;
