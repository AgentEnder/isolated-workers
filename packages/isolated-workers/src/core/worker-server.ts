/**
 * Worker server for handling incoming messages
 *
 * This module provides a high-level interface for workers to receive and
 * respond to messages from the host process. The driver parameter determines
 * how the server communicates (child_process sockets or worker_threads ports).
 *
 * @packageDocumentation
 */

import type {
  AnyMessage,
  Handlers,
  MessageDefs,
  Middleware,
  TransactionIdGenerator,
} from '../types/index.js';
import {
  createMetaLogger,
  type Logger,
  type LogLevel,
} from '../utils/index.js';
import {
  defaultSerializer,
  serializeError,
  validateSerializer,
  type Serializer,
} from '../utils/serializer.js';
import type { DriverMessage, ServerChannel, ServerOptions } from './driver.js';
import { ChildProcessDriver } from './drivers/child-process/driver.js';
import { applyMiddleware } from './internals.js';
import { createResponse, TypedMessage } from './messaging.js';

/**
 * Handler function type for worker messages
 */
export type WorkerHandler<TPayload = unknown, TResult = unknown> = (
  payload: TPayload
) => TResult | Promise<TResult>;

/**
 * Collection of handlers for different message types
 */
export type WorkerHandlers = Record<string, WorkerHandler>;

/**
 * Driver interface for server-side usage.
 *
 * This is a minimal interface that drivers must satisfy for use with
 * startWorkerServer. Both ChildProcessDriver and WorkerThreadsDriver
 * satisfy this interface.
 */
export interface ServerDriver {
  /** Driver identifier */
  readonly name: string;
  /** Get startup data (throws if not in correct context) */
  getStartupData(): unknown;
  /** Create server channel */
  createServer(options: ServerOptions): ServerChannel | Promise<ServerChannel>;
}

/**
 * Server configuration options
 */
export interface WorkerServerOptions<TDefs extends MessageDefs = MessageDefs> {
  /**
   * Driver to use for server communication.
   * Defaults to ChildProcessDriver if not specified.
   * Must match the driver used on the host side.
   *
   * @example
   * ```typescript
   * // For child process workers (default)
   * startWorkerServer(handlers);
   *
   * // For worker thread workers
   * import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
   * startWorkerServer(handlers, { driver: WorkerThreadsDriver });
   * ```
   */
  driver?: ServerDriver;

  /** Middleware pipeline for message processing */
  middleware?: Middleware<TDefs>[];

  /** Custom serializer (must match host!) */
  serializer?: Serializer;

  /** Custom transaction ID generator */
  txIdGenerator?: TransactionIdGenerator<TDefs>;

  /** Log level for server operations */
  logLevel?: LogLevel;

  /** Custom logger instance */
  logger?: Logger;
}

/**
 * Active worker server
 */
export interface WorkerServer {
  /** Stop the server and cleanup */
  stop(): Promise<void>;
  /** Whether the server is running */
  isRunning: boolean;
}

/**
 * Start a worker server that listens for messages (type-safe version)
 * @category Core
 * @param handlers - Map of typed message handlers
 * @param options - Server options
 * @returns Promise resolving to WorkerServer
 */
export async function startWorkerServer<TDefs extends MessageDefs>(
  handlers: Handlers<TDefs>,
  options?: WorkerServerOptions<TDefs>
): Promise<WorkerServer>;

/**
 * Start a worker server that listens for messages (legacy version)
 * @param handlers - Map of message handlers
 * @param options - Server options
 * @returns Promise resolving to WorkerServer
 */
export async function startWorkerServer(
  handlers: WorkerHandlers,
  options?: WorkerServerOptions
): Promise<WorkerServer>;

/**
 * Start a worker server that listens for messages.
 *
 * The driver parameter determines how the server communicates with the host:
 * - ChildProcessDriver (default): Uses Unix domain sockets
 * - WorkerThreadsDriver: Uses MessagePort
 *
 * The driver will throw an error if called in the wrong context (e.g.,
 * using WorkerThreadsDriver in a child process or vice versa).
 *
 * @category Core
 * @param handlers - Map of message handlers
 * @param options - Server options
 * @returns Promise resolving to WorkerServer
 *
 * @example
 * ```typescript
 * // Default: child process driver
 * const server = await startWorkerServer({
 *   ping: async () => ({ pong: true }),
 * });
 *
 * // Worker threads driver
 * import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
 * const server = await startWorkerServer(handlers, {
 *   driver: WorkerThreadsDriver,
 * });
 * ```
 */
export async function startWorkerServer<TDefs extends MessageDefs>(
  handlers: WorkerHandlers | Handlers<TDefs>,
  options: WorkerServerOptions<TDefs> = {}
): Promise<WorkerServer> {
  const {
    driver = ChildProcessDriver,
    middleware = [],
    serializer = defaultSerializer,
    logLevel = 'error',
    logger: customLogger,
  } = options;

  const serverLogger = createMetaLogger(customLogger, logLevel);

  validateSerializer(serializer);

  serverLogger.info('Starting worker server', { driver: driver.name });

  // Driver validates startup data and creates server
  // Will throw if called in wrong context (e.g., wrong driver for this worker type)
  const serverChannel = await driver.createServer({
    serializer,
    logLevel,
    logger: serverLogger,
  });

  let isRunning = serverChannel.isRunning;

  // Set up message handling via the server channel
  serverChannel.onMessage(
    async (message: DriverMessage, respond: (msg: DriverMessage) => Promise<void>) => {
      const typedMessage = message as TypedMessage;

      try {
        // Apply incoming middleware if any
        const processedMessage =
          middleware.length > 0
            ? await applyMiddleware(
                typedMessage as AnyMessage<TDefs>,
                'incoming',
                middleware
              )
            : typedMessage;

        serverLogger.debug('Received message', {
          type: processedMessage.type,
          tx: processedMessage.tx,
        });

        // Find and execute handler
        const handler = (handlers as WorkerHandlers)[processedMessage.type];
        if (!handler) {
          serverLogger.warn('No handler for message type', {
            type: processedMessage.type,
          });
          const errorResponse = {
            tx: processedMessage.tx,
            type: `${processedMessage.type}Error`,
            payload: serializeError(
              new Error(`Unknown message type: ${processedMessage.type}`)
            ),
          };
          await respond(errorResponse);
          return;
        }

        try {
          const result = await handler(processedMessage.payload);

          // Send success response
          let response = createResponse(
            processedMessage.tx,
            processedMessage.type,
            result
          );

          // Apply outgoing middleware if any
          if (middleware.length > 0) {
            response = await applyMiddleware(
              response as AnyMessage<TDefs>,
              'outgoing',
              middleware
            );
          }

          await respond(response as DriverMessage);
        } catch (err) {
          serverLogger.error('Handler error', {
            type: processedMessage.type,
            tx: processedMessage.tx,
            error: (err as Error).message,
          });

          let errorResponse: DriverMessage = {
            tx: processedMessage.tx,
            type: `${processedMessage.type}Error`,
            payload: serializeError(err as Error),
          };

          // Apply outgoing middleware if any
          if (middleware.length > 0) {
            errorResponse = (await applyMiddleware(
              errorResponse as AnyMessage<TDefs>,
              'outgoing',
              middleware
            )) as DriverMessage;
          }

          await respond(errorResponse);
        }
      } catch (err) {
        serverLogger.error('Failed to process message', {
          error: (err as Error).message,
        });
      }
    }
  );

  // Set up error handling
  serverChannel.onError((err: Error) => {
    serverLogger.error('Server channel error', { error: err.message });
  });

  // Shutdown function
  const stopServer = async () => {
    serverLogger.info('Shutting down worker server');
    isRunning = false;
    await serverChannel.stop();
    serverLogger.info('Worker server stopped');
  };

  // Handle process signals for graceful shutdown
  const signalHandler = () => {
    void stopServer();
  };
  process.on('SIGTERM', signalHandler);
  process.on('SIGINT', signalHandler);

  return {
    get isRunning() {
      return isRunning && serverChannel.isRunning;
    },

    async stop(): Promise<void> {
      return stopServer();
    },
  };
}
