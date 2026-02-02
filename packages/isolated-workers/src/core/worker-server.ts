/**
 * Worker server for handling incoming messages
 *
 * This module provides a high-level interface for workers to receive and
 * respond to messages from the host process. It automatically detects which
 * driver spawned the worker and routes to the appropriate server implementation.
 *
 * @packageDocumentation
 */

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
import { TypedMessage, createResponse } from './messaging.js';
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
import { getStartupData } from './drivers/startup.js';
import {
  createChildProcessServer,
  isChildProcessWorker,
  type ServerChannel,
  type ResponseFunction,
} from './drivers/child-process-server.js';
import {
  createWorkerThreadsServer,
  isWorkerThreadsWorker,
} from './drivers/worker-threads-server.js';
import type { DriverMessage } from './driver.js';

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
 * Detect which driver spawned this worker and return the driver name.
 *
 * @returns The driver name ('child_process' or 'worker_threads') or null if detection fails
 */
function detectDriver(): 'child_process' | 'worker_threads' | null {
  // Check startup data first (most reliable)
  const startupData = getStartupData();
  if (startupData?.driver === 'child_process') {
    return 'child_process';
  }
  if (startupData?.driver === 'worker_threads') {
    return 'worker_threads';
  }

  // Fallback to environment detection
  if (isWorkerThreadsWorker()) {
    return 'worker_threads';
  }
  if (isChildProcessWorker()) {
    return 'child_process';
  }

  return null;
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
 * Start a worker server that listens for messages.
 *
 * This function automatically detects which driver spawned the worker and
 * routes to the appropriate server implementation:
 * - child_process: Uses Unix domain sockets for IPC
 * - worker_threads: Uses MessagePort for IPC
 *
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
    disconnectBehavior: _disconnectBehavior = 'shutdown', // TODO: Implement disconnect behavior at channel level
    middleware = [],
    serializer = defaultSerializer,
    logLevel = 'error',
    logger: customLogger,
    debug = false,
  } = options;
  void _disconnectBehavior; // Suppress unused warning - will be used when disconnect behavior is implemented

  // Create logger - if debug is true, use 'debug' level
  const effectiveLogLevel = debug ? 'debug' : logLevel;
  const serverLogger = createMetaLogger(customLogger, effectiveLogLevel);

  // Validate serializer matches host
  validateSerializer(serializer);

  // Detect which driver spawned this worker
  const driverType = detectDriver();

  if (!driverType) {
    throw new Error(
      'Could not detect driver type. Ensure worker was spawned via createWorker() ' +
      'or set ISOLATED_WORKERS_SOCKET_PATH env var for child_process compatibility.'
    );
  }

  serverLogger.info('Starting worker server', { driver: driverType });

  // Create the appropriate server based on driver type
  let serverChannel: ServerChannel;

  if (driverType === 'worker_threads') {
    // Worker threads server
    serverChannel = createWorkerThreadsServer({
      serializer,
      logLevel: effectiveLogLevel,
      logger: serverLogger,
    });
    // Worker threads server uses start() not async creation
    (serverChannel as ReturnType<typeof createWorkerThreadsServer>).start();
  } else {
    // Child process server (default)
    const hostConnectTimeout =
      customHostConnectTimeout ??
      parseEnvTimeout(
        process.env.ISOLATED_WORKERS_SERVER_CONNECT_TIMEOUT,
        DEFAULT_SERVER_CONNECT_TIMEOUT
      );

    serverChannel = await createChildProcessServer({
      socketPath: customSocketPath,
      hostConnectTimeout,
      serializer,
      logLevel: effectiveLogLevel,
      logger: serverLogger,
    });
  }

  let isRunning = serverChannel.isRunning;

  // Set up message handling via the server channel
  serverChannel.onMessage(async (message: DriverMessage, respond: ResponseFunction) => {
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
          payload: serializeError(new Error(`Unknown message type: ${processedMessage.type}`)),
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
  });

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
