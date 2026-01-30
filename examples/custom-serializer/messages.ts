/**
 * Shared message definitions for the custom serializer example
 */

import { DefineMessages } from 'isolated-workers';

/**
 * Message types for the serializer example
 */
export type Messages = DefineMessages<{
  echo: {
    payload: { data: string };
    result: { echoed: string; serializer: string };
  };
}>;
