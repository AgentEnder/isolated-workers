import { startWorkerServer, Handlers } from 'isolated-workers';
import type { Messages } from './messages.js';

let requestCount = 0;

const handlers: Handlers<Messages> = {
  ping: ({ message }) => {
    requestCount++;
    return { message: `pong: ${message}`, attempt: requestCount };
  },
};

const server = await startWorkerServer(handlers);
console.log('Backoff curves worker ready');
