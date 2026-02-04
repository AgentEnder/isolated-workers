import type { ShutdownReason } from './config.js';

export class WorkerCrashedError extends Error {
  name = 'WorkerCrashedError';

  constructor(
    message: string,
    public readonly reason: ShutdownReason,
    public readonly messageType: string,
    public readonly attempt: number,
    public readonly maxAttempts: number
  ) {
    super(message);
  }
}
