/**
 * Shared message definitions for the shutdown-handling example
 *
 * This file is imported by both the host and worker to ensure
 * type safety and avoid duplication.
 */

import { DefineMessages } from 'isolated-workers';

/**
 * Message types demonstrating different shutdown scenarios
 */
export type Messages = DefineMessages<{
  // Idempotent operation - safe to retry
  compute: {
    payload: { value: number; shouldCrash?: boolean };
    result: { result: number };
  };

  // Non-idempotent operation - should reject on crash
  processPayment: {
    payload: { paymentId: string; amount: number; shouldCrash?: boolean };
    result: { success: boolean };
  };

  // Operation that may fail - demonstrate retry limits
  processBatch: {
    payload: { items: number[]; crashAfterItems?: number };
    result: { processed: number };
  };
}>;
