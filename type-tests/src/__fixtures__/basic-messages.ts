/**
 * Fixture: Basic message definitions
 *
 * This file demonstrates the basic usage of DefineMessages and type helpers.
 * It serves as a compile-time validation that the types work correctly.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type {
  DefineMessages,
  Handlers,
  MessageOf,
  ResultOf,
  WithResult,
  AllMessages,
  AllResults,
} from 'isolated-workers';

// ============================================================================
// Message Definitions
// ============================================================================

export type WorkerMessages = DefineMessages<{
  load: {
    payload: {
      config: string;
    };
    result: {
      loaded: true;
    };
  };
  compute: {
    payload: {
      data: number[];
    };
    result: {
      sum: number;
    };
  };
  shutdown: {
    payload: {
      force?: boolean;
    };
  };
}>;

// ============================================================================
// Type Extractions (for testing)
// ============================================================================

export type LoadMessage = MessageOf<WorkerMessages, 'load'>;
export type ComputeMessage = MessageOf<WorkerMessages, 'compute'>;
export type ShutdownMessage = MessageOf<WorkerMessages, 'shutdown'>;

export type LoadResult = ResultOf<WorkerMessages, 'load'>;
export type ComputeResult = ResultOf<WorkerMessages, 'compute'>;

export type MessagesWithResults = WithResult<WorkerMessages>;

export type AllWorkerMessages = AllMessages<WorkerMessages>;
export type AllWorkerResults = AllResults<WorkerMessages>;

// ============================================================================
// Handlers Implementation
// ============================================================================

export const handlers: Handlers<WorkerMessages> = {
  load: async (payload) => {
    // payload should be typed as { config: string }
    const config: string = payload.config;
    return { loaded: true };
  },

  compute: async (payload) => {
    // payload should be typed as { data: number[] }
    const sum = payload.data.reduce((a, b) => a + b, 0);
    return { sum };
  },

  shutdown: async (payload) => {
    // payload should be typed as { force?: boolean }
    const _force = payload.force;
    return;
  },
};

// ============================================================================
// Compile-time type checks
// ============================================================================

// Verify LoadMessage has correct properties
type _LoadMessageCheck = LoadMessage extends {
  tx: string;
  type: 'load';
  payload: { config: string };
}
  ? true
  : never;
const _loadMessageCheck: _LoadMessageCheck = true;

// Verify LoadResult has correct properties
type _LoadResultCheck = LoadResult extends {
  tx: string;
  type: 'loadResult';
  payload: { loaded: true };
}
  ? true
  : never;
const _loadResultCheck: _LoadResultCheck = true;

// Verify WithResult only includes messages with results
type _WithResultCheck = MessagesWithResults extends 'load' | 'compute'
  ? 'load' | 'compute' extends MessagesWithResults
    ? true
    : never
  : never;
const _withResultCheck: _WithResultCheck = true;

// Verify shutdown has no result (should not be in WithResult)
type _ShutdownNotInResults = 'shutdown' extends MessagesWithResults
  ? never
  : true;
const _shutdownNotInResults: _ShutdownNotInResults = true;
