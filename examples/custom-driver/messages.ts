/**
 * Shared message definitions for the custom-driver example
 */

import { DefineMessages } from 'isolated-workers';

export type Messages = DefineMessages<{
  echo: {
    payload: { text: string };
    result: { echoed: string };
  };
}>;
