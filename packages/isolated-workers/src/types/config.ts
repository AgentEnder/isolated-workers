import type { MessageDefs } from './messages.js';

export type MessageType<TDefs extends MessageDefs> = keyof TDefs & string;

export type ShutdownReason =
  | { type: 'exit'; code: number | null; signal: string | null }
  | { type: 'error'; error: Error }
  | { type: 'close' };

export type UnexpectedShutdownStrategy =
  | { strategy: 'reject' }
  | { strategy: 'retry'; attempts?: number };

export type UnexpectedShutdownConfig<TDefs extends MessageDefs> =
  UnexpectedShutdownStrategy & {
    [K in MessageType<TDefs>]?: UnexpectedShutdownStrategy;
  };
