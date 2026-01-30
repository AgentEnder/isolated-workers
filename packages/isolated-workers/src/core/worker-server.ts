/**
 * Worker server for handling incoming messages
 *
 * @packageDocumentation
 */

import { Socket, Server } from 'net';
import {
  createMetaLogger,
  type Logger,
  type LogLevel,
} from '../utils/index.js';
import {
  serializeError,
  defaultSerializer,
  validateSerializer,
  type Serializer,
} from '../utils/serializer.js';
import { TypedMessage, TypedResult, createResponse } from './messaging.js';
import { getSocketAdapter, cleanupSocketPath } from '../platform/socket.js';
import type {
  MessageDefs,
  Handlers,
  Middleware,
  TransactionIdGenerator,
  AnyMessage,
} from '../types/index.js';
import {
  applyMiddleware,
  parseEnvTimeout,
  DEFAULT_SERVER_CONNECT_TIMEOUT,
} from './internals.js';

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
 * Server configuration options
 */
export interface WorkerServerOptions<TDefs extends MessageDefs = MessageDefs> {
  /** Socket path (from env var if not provided) */
  socketPath?: string;

  /** Lifecycle options */
  /**
   * Time to wait for host to connect (default: from env or 30s, 0 = forever).
   * When spawned via createWorker(), this is set via ISOLATED_WORKERS_SERVER_CONNECT_TIMEOUT env var.
   */
  hostConnectTimeout?: number;
  disconnectBehavior?: 'shutdown' | 'keep-alive'; // Behavior on disconnect (default: 'shutdown')

  /** Messaging options */
  middleware?: Middleware<TDefs>[]; // Per-instance middleware pipeline
  serializer?: Serializer; // Custom serializer (must match client!)
  txIdGenerator?: TransactionIdGenerator<TDefs>; // Custom TX ID generator

  /** Logging options */
  logLevel?: LogLevel; // Log level (default: 'error')
  logger?: Logger; // Custom logger instance

  /** @deprecated Use logLevel instead */
  debug?: boolean;
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
 * Start a worker server that listens for messages
 * @param handlers - Map of message handlers
 * @param options - Server options
 * @returns Promise resolving to WorkerServer
 */
export async function startWorkerServer<TDefs extends MessageDefs>(
  handlers: WorkerHandlers | Handlers<TDefs>,
  options: WorkerServerOptions<TDefs> = {}
): Promise<WorkerServer> {
  const {
    socketPath: customSocketPath,
    hostConnectTimeout: customHostConnectTimeout,
    disconnectBehavior = 'shutdown',
    middleware = [],
    serializer = defaultSerializer,
    logLevel = 'error',
    logger: customLogger,
    debug = false,
  } = options;

  // Resolve host connect timeout: option > env var > default
  const hostConnectTimeout =
    customHostConnectTimeout ??
    parseEnvTimeout(
      process.env.ISOLATED_WORKERS_SERVER_CONNECT_TIMEOUT,
      DEFAULT_SERVER_CONNECT_TIMEOUT
    );

  const socketPath =
    customSocketPath || process.env.ISOLATED_WORKERS_SOCKET_PATH;

  if (!socketPath) {
    throw new Error(
      'No socket path provided. Set ISOLATED_WORKERS_SOCKET_PATH env var or pass socketPath option.'
    );
  }

  // Create logger - if debug is true, use 'debug' level
  const effectiveLogLevel = debug ? 'debug' : logLevel;
  const serverLogger = createMetaLogger(customLogger, effectiveLogLevel);

  // Validate serializer matches host
  validateSerializer(serializer);

  serverLogger.info('Starting worker server', { socketPath });

  const adapter = getSocketAdapter();
  const server: Server = adapter.createServer(socketPath);
  let isRunning = true;
  let activeSocket: Socket | null = null;

  // Host connection timeout
  let connectTimeoutHandle: NodeJS.Timeout | null = null;
  if (hostConnectTimeout > 0) {
    connectTimeoutHandle = setTimeout(() => {
      if (!activeSocket && isRunning) {
        serverLogger.error(
          `Host did not connect within ${hostConnectTimeout}ms, shutting down`
        );
        stopServer();
      }
    }, hostConnectTimeout);
  }

  // Get terminator for message framing
  const terminatorStr =
    typeof serializer.terminator === 'string'
      ? serializer.terminator
      : serializer.terminator.toString();

  // Handle incoming connections
  server.on('connection', (socket: Socket) => {
    // Clear connection timeout - host connected
    if (connectTimeoutHandle) {
      clearTimeout(connectTimeoutHandle);
      connectTimeoutHandle = null;
    }

    serverLogger.debug('Client connected');
    activeSocket = socket;
    let buffer = '';

    socket.on('data', async (data: Buffer) => {
      buffer += data.toString('utf-8');

      // Process complete messages (terminator-delimited)
      let delimiterIndex: number;
      while ((delimiterIndex = buffer.indexOf(terminatorStr)) !== -1) {
        const line = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + terminatorStr.length);

        if (line.trim()) {
          try {
            const raw = serializer.deserialize<TypedMessage>(line);

            // Apply incoming middleware if any
            const message =
              middleware.length > 0
                ? await applyMiddleware(
                    raw as AnyMessage<TDefs>,
                    'incoming',
                    middleware
                  )
                : raw;

            serverLogger.debug('Received message', {
              type: (message as TypedMessage).type,
              tx: (message as TypedMessage).tx,
            });

            // Find and execute handler
            const handler = (handlers as WorkerHandlers)[
              (message as TypedMessage).type
            ];
            if (!handler) {
              serverLogger.warn('No handler for message type', {
                type: (message as TypedMessage).type,
              });
              await sendErrorResponse(
                socket,
                (message as TypedMessage).tx,
                (message as TypedMessage).type,
                new Error(
                  `Unknown message type: ${(message as TypedMessage).type}`
                ),
                serializer,
                middleware,
                serverLogger,
                terminatorStr
              );
              continue;
            }

            try {
              const result = await handler((message as TypedMessage).payload);

              // Send success response
              const response = createResponse(
                (message as TypedMessage).tx,
                (message as TypedMessage).type,
                result
              );
              await sendResponse(
                socket,
                response,
                serializer,
                middleware,
                serverLogger,
                terminatorStr
              );
            } catch (err) {
              serverLogger.error('Handler error', {
                type: (message as TypedMessage).type,
                tx: (message as TypedMessage).tx,
                error: (err as Error).message,
              });
              await sendErrorResponse(
                socket,
                (message as TypedMessage).tx,
                (message as TypedMessage).type,
                err as Error,
                serializer,
                middleware,
                serverLogger,
                terminatorStr
              );
            }
          } catch (err) {
            serverLogger.error('Failed to process message', {
              error: (err as Error).message,
              line: line.slice(0, 100),
            });
          }
        }
      }
    });

    socket.on('close', () => {
      serverLogger.debug('Client disconnected');
      if (activeSocket === socket) {
        activeSocket = null;
      }

      if (disconnectBehavior === 'shutdown') {
        serverLogger.info(
          'Shutting down server (disconnectBehavior: shutdown)'
        );
        stopServer();
      } else {
        serverLogger.info(
          'Keeping server alive (disconnectBehavior: keep-alive)'
        );
      }
    });

    socket.on('error', (err: Error) => {
      serverLogger.error('Socket error', { error: err.message });
    });
  });

  // Start listening
  await new Promise<void>((resolve, reject) => {
    server.listen(socketPath, () => {
      serverLogger.info('Worker server listening', { socketPath });
      resolve();
    });

    server.on('error', (err: Error) => {
      serverLogger.error('Server error', { error: err.message });
      reject(err);
    });
  });

  // Shutdown function
  const stopServer = async () => {
    serverLogger.info('Shutting down worker server');
    isRunning = false;

    if (connectTimeoutHandle) {
      clearTimeout(connectTimeoutHandle);
    }

    if (activeSocket) {
      activeSocket.end();
    }

    server.close(() => {
      serverLogger.info('Worker server stopped');
      cleanupSocketPath(socketPath);
    });
  };

  // Handle process signals for graceful shutdown
  process.on('SIGTERM', stopServer);
  process.on('SIGINT', stopServer);

  return {
    get isRunning() {
      return isRunning;
    },

    async stop(): Promise<void> {
      return stopServer();
    },
  };
}

/**
 * Send a response message
 */
async function sendResponse<TDefs extends MessageDefs>(
  socket: Socket,
  response: TypedResult,
  serializer: Serializer,
  middleware: Middleware<TDefs>[],
  logger: Logger,
  terminatorStr: string
): Promise<void> {
  logger.debug('Sending response', { tx: response.tx });

  // Apply outgoing middleware if any
  const processed =
    middleware.length > 0
      ? await applyMiddleware(
          response as AnyMessage<TDefs>,
          'outgoing',
          middleware
        )
      : response;

  const serialized = serializer.serialize(processed);
  const dataStr =
    typeof serialized === 'string'
      ? serialized + terminatorStr
      : serialized.toString() + terminatorStr;

  await new Promise<void>((resolve, reject) => {
    socket.write(dataStr, (err) => {
      if (err) {
        logger.error('Failed to send response', { error: err.message });
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Send an error response
 */
async function sendErrorResponse<TDefs extends MessageDefs>(
  socket: Socket,
  tx: string,
  type: string,
  error: Error,
  serializer: Serializer,
  middleware: Middleware<TDefs>[],
  logger: Logger,
  terminatorStr: string
): Promise<void> {
  const errorMessage = {
    tx,
    type: `${type}Error`,
    payload: serializeError(error),
  };

  logger.debug('Sending error response', { tx, error: error.message });

  // Apply outgoing middleware if any
  const processed =
    middleware.length > 0
      ? await applyMiddleware(
          errorMessage as AnyMessage<TDefs>,
          'outgoing',
          middleware
        )
      : errorMessage;

  const serialized = serializer.serialize(processed);
  const dataStr =
    typeof serialized === 'string'
      ? serialized + terminatorStr
      : serialized.toString() + terminatorStr;

  await new Promise<void>((resolve, reject) => {
    socket.write(dataStr, (err) => {
      if (err) {
        logger.error('Failed to send error response', { error: err.message });
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
