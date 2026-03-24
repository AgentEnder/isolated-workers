import type { DefineMessages } from 'isolated-workers';

export type Messages = DefineMessages<{
  ping: {
    payload: { message: string };
    result: { message: string; attempt: number };
  };
}>;
