/**
 * Shared message definitions for the basic-ping example
 *
 * This file is imported by both the host and worker to ensure
 * type safety and avoid duplication.
 */

import { DefineMessages } from 'isolated-workers';

/**
 * Message types for the ping-pong example
 */
export type Messages = DefineMessages<{
  ping: {
    payload: { message: string };
    result: { message: string };
  };
}>;
