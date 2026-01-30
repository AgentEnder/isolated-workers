/**
 * Type-safe messaging layer with middleware and transaction support
 *
 * @packageDocumentation
 */

import { Socket } from 'net';
import { randomUUID } from 'crypto';
import {
  serializeError,
  type SerializedError,
  type Serializer,
  defaultSerializer,
} from '../utils/serializer.js';
import { createMetaLogger } from '../utils/index.js';
import type {
  BaseMessage,
  MessageDefs,
  AnyMessage,
  Middleware,
  TransactionIdGenerator,
} from '../types/index.js';
import { applyMiddleware } from './internals.js';

const logger = createMetaLogger();

/**
 * Direction for middleware context
 * @deprecated Use 'incoming' | 'outgoing' directly
 */
export type MiddlewareDirection = 'send' | 'receive';

/**
 * Context passed to middleware functions
 * @deprecated Use Middleware<TDefs> from types instead
 */
export interface MiddlewareContext {
  /** Direction of message flow */
  direction: MiddlewareDirection;
  /** The message being sent or received */
  message: unknown;
}

/**
 * Message with type discriminator
 */
export interface TypedMessage<T = unknown> extends BaseMessage {
  type: string;
  payload: T;
}

/**
 * Result message with type discriminator
 */
export interface TypedResult<T = unknown> extends BaseMessage {
  type: string;
  payload: T;
}

/**
 * Handler function type for message processing
 */
export type MessageHandler = (payload: unknown) => unknown | Promise<unknown>;

/**
 * Default transaction ID generator using crypto.randomUUID()
 */
export const defaultTxIdGenerator: TransactionIdGenerator = (_message) => {
  return randomUUID();
};

/**
 * Send a message through a socket with per-instance middleware
 */
export async function sendMessage<TDefs extends MessageDefs>(
  socket: Socket,
  message: AnyMessage<TDefs>,
  serializer: Serializer = defaultSerializer,
  middleware: Middleware<TDefs>[] = []
): Promise<void> {
  logger.debug('Sending message', {
    type: message.type,
    tx: message.tx,
  });

  // Apply outgoing middleware (message is sealed inside applyMiddleware)
  const processedMessage =
    middleware.length > 0
      ? await applyMiddleware(message, 'outgoing', middleware)
      : message;

  const serialized = serializer.serialize(processedMessage);
  const terminatorStr =
    typeof serializer.terminator === 'string'
      ? serializer.terminator
      : serializer.terminator.toString();

  // Convert to string for sending (handles both string and Buffer serialization)
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
        resolve();
      }
    });
  });
}

/**
 * Send an error response
 * @param socket - Socket to send through
 * @param tx - Transaction ID
 * @param type - Message type
 * @param error - Error to send
 */
export async function sendError(
  socket: Socket,
  tx: string,
  type: string,
  error: Error,
  serializer: Serializer = defaultSerializer
): Promise<void> {
  const errorMessage = {
    tx,
    type: `${type}Error`,
    payload: serializeError(error),
  };

  logger.debug('Sending error', { type: errorMessage.type, tx });

  const serialized = serializer.serialize(errorMessage);
  const terminatorStr =
    typeof serializer.terminator === 'string'
      ? serializer.terminator
      : serializer.terminator.toString();

  const dataStr =
    typeof serialized === 'string'
      ? serialized + terminatorStr
      : serialized.toString() + terminatorStr;

  await new Promise<void>((resolve, reject) => {
    socket.write(dataStr, (err) => {
      if (err) {
        logger.error('Failed to send error', { error: err.message, tx });
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Create a message handler that processes incoming messages
 * @deprecated Use per-instance middleware instead
 */
export function createMessageHandler(
  handlers: Record<string, MessageHandler>
): (data: Buffer) => Promise<void> {
  return async (data: Buffer) => {
    try {
      // Parse message
      const message = JSON.parse(data.toString()) as TypedMessage;

      logger.debug('Received message', { type: message.type, tx: message.tx });

      // Find handler
      const handler = handlers[message.type];
      if (!handler) {
        logger.warn('No handler for message type', { type: message.type });
        return;
      }

      // Execute handler
      try {
        await handler(message.payload);
        logger.debug('Handler completed', {
          type: message.type,
          tx: message.tx,
        });
      } catch (err) {
        logger.error('Handler error', {
          type: message.type,
          tx: message.tx,
          error: (err as Error).message,
        });
        throw err;
      }
    } catch (err) {
      logger.error('Message processing error', {
        error: (err as Error).message,
      });
      throw err;
    }
  };
}

/**
 * Create a request message with transaction ID
 */
export function createRequest<T = unknown>(
  type: string,
  payload: T,
  txIdGenerator: (message: TypedMessage<T>) => string = defaultTxIdGenerator
): TypedMessage<T> {
  const message: TypedMessage<T> = {
    type,
    payload,
    tx: '', // Will be set below
  };

  // Generate TX ID from the message
  message.tx = txIdGenerator(message);

  return message;
}

/**
 * Create a response message
 * @param tx - Transaction ID from request
 * @param type - Message type
 * @param payload - Response payload
 * @returns Typed result with transaction ID
 */
export function createResponse<T>(
  tx: string,
  type: string,
  payload: T
): TypedResult<T> {
  return {
    tx,
    type: `${type}Result`,
    payload,
  };
}

/**
 * Type guard for result messages
 * @param message - Message to check
 * @param type - Expected result type
 * @returns True if message is a result of the expected type
 */
export function isResultMessage(
  message: unknown,
  type: string
): message is TypedResult {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const msg = message as Record<string, unknown>;
  return msg.type === `${type}Result` && typeof msg.tx === 'string';
}

/**
 * Type guard for error messages
 * @param message - Message to check
 * @returns True if message is an error result
 */
export function isErrorMessage(
  message: unknown
): message is TypedResult<SerializedError> {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const msg = message as Record<string, unknown>;
  return (
    typeof msg.type === 'string' &&
    msg.type.endsWith('Error') &&
    typeof msg.tx === 'string'
  );
}
