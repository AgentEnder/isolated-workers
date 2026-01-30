/**
 * Shared message definitions for the timeout configuration example
 */

import { DefineMessages } from 'isolated-workers';

/**
 * Message types demonstrating different timeout requirements
 */
export type Messages = DefineMessages<{
  // Fast operation - should complete quickly
  quickPing: {
    payload: { timestamp: number };
    result: { latency: number };
  };
  // Simulated slow operation
  slowProcess: {
    payload: { durationMs: number };
    result: { completed: boolean; actualDuration: number };
  };
}>;
