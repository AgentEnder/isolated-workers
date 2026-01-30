/**
 * Connection manager with retry logic and timeout handling
 *
 * @packageDocumentation
 */

import { Socket, createConnection as createNetConnection } from 'net';
import { createMetaLogger, type Logger } from '../utils/index.js';
import { defaultSerializer, type Serializer } from '../utils/serializer.js';
import { TypedMessage, TypedResult } from './messaging.js';
import type { MessageDefs, Middleware, AnyMessage } from '../types/index.js';
import { calculateDelay, applyMiddleware } from './internals.js';

/**
 * Connection options
 */
export interface ConnectionOptions<TDefs extends MessageDefs = MessageDefs> {
  /** Socket path to connect to */
  socketPath: string;
  /** Whether to enable reconnection (default: false) */
  reconnect?: boolean;
  /** Maximum number of retry attempts (default: 5) */
  maxRetries?: number;
  /** Base delay in ms between retries, or custom delay function (default: 100) */
  retryDelay?: number | ((attempt: number) => number);
  /** Maximum delay cap in ms (default: 5000) */
  maxDelay?: number;
  /** Connection timeout in ms (default: 10000) */
  timeout?: number;
  /** Custom serializer */
  serializer?: Serializer;
  /** Per-instance middleware pipeline */
  middleware?: Middleware<TDefs>[];
  /** Custom logger */
  logger?: Logger;
}

/**
 * Active connection interface
 */
export interface Connection {
  /** Underlying socket */
  socket: Socket;
  /** Send a message through the connection */
  send<T>(message: TypedMessage<T>): Promise<void>;
  /** Register a message handler */
  onMessage(handler: (message: TypedResult) => void): void;
  /** Register an error handler */
  onError(handler: (error: Error) => void): void;
  /** Register a close handler */
  onClose(handler: () => void): void;
  /** Close the connection */
  close(): Promise<void>;
  /** Whether the connection is active */
  isConnected: boolean;
}

/**
 * Create a connection with retry logic
 * @param options - Connection options
 * @returns Promise resolving to Connection
 */
export async function createConnection<TDefs extends MessageDefs = MessageDefs>(
  options: ConnectionOptions<TDefs>
): Promise<Connection> {
  const {
    socketPath,
    reconnect = false,
    maxRetries = 5,
    retryDelay = 100,
    maxDelay = 5000,
    timeout = 10000,
    serializer = defaultSerializer,
    middleware = [],
    logger: customLogger,
  } = options;

  const logger = customLogger ?? createMetaLogger();

  logger.debug('Creating connection', { socketPath, maxRetries, timeout });

  let socket: Socket | null = null;
  let lastError: Error | undefined;

  // Attempt connection with retries
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      socket = await attemptConnection(socketPath, timeout);
      logger.info('Connection established', { socketPath, attempt });
      break;
    } catch (err) {
      lastError = err as Error;
      logger.warn('Connection attempt failed', {
        attempt: attempt + 1,
        maxRetries,
        error: lastError.message,
      });

      if (attempt < maxRetries - 1) {
        const delay = calculateDelay(retryDelay, attempt, maxDelay);
        logger.debug('Retrying after delay', { delay: delay.toFixed(0) });
        await sleep(delay);
      }
    }
  }

  if (!socket) {
    const error = new Error(
      `Failed to connect after ${maxRetries} attempts: ${lastError?.message}`
    );
    logger.error('Connection failed', { error: error.message });
    throw error;
  }

  // Set up connection state
  let isConnected = true;
  const messageHandlers: Array<(message: TypedResult) => void> = [];
  const errorHandlers: Array<(error: Error) => void> = [];
  const closeHandlers: Array<() => void> = [];
  let buffer = '';

  // Get terminator for message framing
  const terminatorStr =
    typeof serializer.terminator === 'string'
      ? serializer.terminator
      : serializer.terminator.toString();

  // Handle incoming data with terminator-delimited messages
  socket.on('data', async (data: Buffer) => {
    buffer += data.toString('utf-8');

    // Process complete messages (terminator-delimited)
    let delimiterIndex: number;
    while ((delimiterIndex = buffer.indexOf(terminatorStr)) !== -1) {
      const line = buffer.slice(0, delimiterIndex);
      buffer = buffer.slice(delimiterIndex + terminatorStr.length);

      if (line.trim()) {
        try {
          const raw = serializer.deserialize<TypedResult>(line);

          // Apply incoming middleware if any
          const message =
            middleware.length > 0
              ? await applyMiddleware(
                  raw as AnyMessage<TDefs>,
                  'incoming',
                  middleware
                )
              : raw;

          logger.debug('Received message', {
            type: (message as TypedResult).type,
            tx: (message as TypedResult).tx,
          });

          messageHandlers.forEach((handler) => {
            try {
              handler(message as TypedResult);
            } catch (err) {
              logger.error('Message handler error', {
                error: (err as Error).message,
              });
            }
          });
        } catch (err) {
          logger.error('Failed to parse message', {
            line: line.slice(0, 100),
            error: (err as Error).message,
          });
        }
      }
    }
  });

  // Handle errors
  socket.on('error', (err: Error) => {
    logger.error('Socket error', { error: err.message });
    errorHandlers.forEach((handler) => {
      try {
        handler(err);
      } catch (handlerErr) {
        logger.error('Error handler error', {
          error: (handlerErr as Error).message,
        });
      }
    });
  });

  // Handle close
  socket.on('close', () => {
    logger.info('Connection closed');
    isConnected = false;
    closeHandlers.forEach((handler) => {
      try {
        handler();
      } catch (err) {
        logger.error('Close handler error', { error: (err as Error).message });
      }
    });

    if (reconnect && !isConnected) {
      logger.info('Reconnection enabled, but not implemented in this version');
    }
  });

  // Create connection interface
  const connection: Connection = {
    socket,

    get isConnected() {
      return isConnected;
    },

    async send<T>(message: TypedMessage<T>): Promise<void> {
      if (!isConnected || !socket) {
        throw new Error('Connection is not active');
      }

      // Apply outgoing middleware if any
      const processedMessage =
        middleware.length > 0
          ? await applyMiddleware(
              message as AnyMessage<TDefs>,
              'outgoing',
              middleware
            )
          : message;

      const serialized = serializer.serialize(processedMessage);
      const dataStr =
        typeof serialized === 'string'
          ? serialized + terminatorStr
          : serialized.toString() + terminatorStr;

      await new Promise<void>((resolve, reject) => {
        socket.write(dataStr, (err) => {
          if (err) {
            logger.error('Failed to send message', {
              error: err.message,
              tx: message.tx,
            });
            reject(err);
          } else {
            logger.debug('Message sent', { tx: message.tx });
            resolve();
          }
        });
      });
    },

    onMessage(handler: (message: TypedResult) => void): void {
      messageHandlers.push(handler);
    },

    onError(handler: (error: Error) => void): void {
      errorHandlers.push(handler);
    },

    onClose(handler: () => void): void {
      closeHandlers.push(handler);
    },

    async close(): Promise<void> {
      if (!isConnected || !socket) {
        return;
      }

      const activeSocket = socket;
      logger.debug('Closing connection');
      isConnected = false;

      return new Promise((resolve) => {
        activeSocket.end(() => {
          logger.info('Connection closed gracefully');
          resolve();
        });

        // Force close after timeout
        setTimeout(() => {
          if (!activeSocket.destroyed) {
            activeSocket.destroy();
            resolve();
          }
        }, 5000);
      });
    },
  };

  return connection;
}

/**
 * Attempt a single connection
 */
function attemptConnection(
  socketPath: string,
  timeout: number
): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createNetConnection(socketPath);

    const timeoutId = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Connection timeout after ${timeout}ms`));
    }, timeout);

    socket.once('connect', () => {
      clearTimeout(timeoutId);
      resolve(socket);
    });

    socket.once('error', (err: Error) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
