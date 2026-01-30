import { AnyMessage, AnyResult } from './types.js';

export function isWorkerMessage(message: unknown): message is AnyMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    'payload' in message
  );
}

export function isWorkerResult(result: unknown): result is AnyResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'type' in result &&
    'payload' in result
  );
}
