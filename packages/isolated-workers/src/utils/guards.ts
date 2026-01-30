import type { AnyMessage, AllResults, MessageDefs } from '../types/index.js';

export function isWorkerMessage<TDefs extends MessageDefs = MessageDefs>(
  message: unknown
): message is AnyMessage<TDefs> {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    'payload' in message
  );
}

export function isWorkerResult<TDefs extends MessageDefs = MessageDefs>(
  result: unknown
): result is AllResults<TDefs> {
  return (
    typeof result === 'object' &&
    result !== null &&
    'type' in result &&
    'payload' in result
  );
}
