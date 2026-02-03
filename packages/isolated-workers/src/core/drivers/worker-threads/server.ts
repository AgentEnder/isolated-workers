/**
 * Worker threads driver server module
 *
 * Contains server logic for the worker_threads driver. This module is imported
 * only on the worker side (inside the worker thread).
 *
 * @packageDocumentation
 */

import { createMetaLogger, type Logger } from '../../../utils/logger.js';
import type { Serializer } from '../../../utils/serializer.js';
import { defaultSerializer } from '../../../utils/serializer.js';
import type {
  DriverMessage,
  ServerChannel,
  ServerOptions,
} from '../../driver.js';
import type { WorkerThreadsStartupData } from './host.js';

/**
 * Function to send a response back to the host
 */
export type ResponseFunction = (response: DriverMessage) => Promise<void>;

/**
 * Worker threads server channel implementation.
 *
 * Wraps parentPort and provides the ServerChannel interface.
 */
export class WorkerThreadsServerChannel implements ServerChannel {
  private _isRunning = false;
  private messageHandlers: Array<
    (message: DriverMessage, respond: ResponseFunction) => void
  > = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private readonly logger: Logger;
  private readonly serializer: Serializer;
  private readonly parentPort: import('worker_threads').MessagePort;

  constructor(
    parentPort: import('worker_threads').MessagePort,
    options: { serializer: Serializer; logger: Logger }
  ) {
    this.parentPort = parentPort;
    this.serializer = options.serializer;
    this.logger = options.logger;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Worker threads don't use socket paths.
   * Returns empty string for interface compatibility.
   */
  get socketPath(): string {
    return '';
  }

  onMessage(
    handler: (message: DriverMessage, respond: ResponseFunction) => void
  ): void {
    this.messageHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Start listening for messages from the host
   */
  start(): void {
    if (this._isRunning) {
      this.logger.warn('Server is already running');
      return;
    }

    this._isRunning = true;
    this.logger.info('Worker threads server starting');

    // Set up message handling
    this.parentPort.on('message', (data: unknown) => {
      try {
        // Messages are sent as serialized strings
        const message =
          typeof data === 'string'
            ? this.serializer.deserialize<DriverMessage>(data)
            : (data as DriverMessage);

        this.logger.debug('Received message', {
          type: message.type,
          tx: message.tx,
        });

        // Create response function for this message
        const respond: ResponseFunction = async (response: DriverMessage) => {
          await this.sendMessage(response);
        };

        // Notify handlers
        this.messageHandlers.forEach((handler) => {
          try {
            handler(message, respond);
          } catch (err) {
            this.logger.error('Message handler error', {
              error: (err as Error).message,
            });
          }
        });
      } catch (err) {
        this.logger.error('Failed to process message', {
          error: (err as Error).message,
        });
      }
    });

    // Set up error handling
    this.parentPort.on('messageerror', (err: Error) => {
      this.logger.error('Message error', { error: err.message });
      this.errorHandlers.forEach((handler) => {
        try {
          handler(err);
        } catch (handlerErr) {
          this.logger.error('Error handler error', {
            error: (handlerErr as Error).message,
          });
        }
      });
    });

    this.logger.info('Worker threads server started');
  }

  /**
   * Send a message to the host
   */
  private async sendMessage(message: DriverMessage): Promise<void> {
    this.logger.debug('Sending message', {
      tx: message.tx,
      type: message.type,
    });

    // Serialize the message for consistent handling
    const serialized = this.serializer.serialize(message);
    this.parentPort.postMessage(serialized);
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping worker threads server');
    this._isRunning = false;

    // Close the port to signal we're done
    // Note: This will cause the worker to exit if it's the only thing keeping it alive
    this.parentPort.close();

    this.logger.info('Worker threads server stopped');
  }
}

/**
 * Create a worker threads server for worker-side communication.
 *
 * This function uses parentPort from worker_threads to establish
 * communication with the host process.
 *
 * @param startupData - Startup data from the host process
 * @param options - Server options
 * @returns WorkerThreadsServerChannel
 * @throws Error if not running inside a worker thread
 *
 * @example
 * ```typescript
 * import { WorkerThreadsDriver } from 'isolated-workers/drivers/worker-threads';
 *
 * const startupData = WorkerThreadsDriver.getStartupData();
 * const server = createServer(startupData);
 *
 * server.onMessage(async (message, respond) => {
 *   console.log('Received:', message);
 *   await respond({
 *     tx: message.tx,
 *     type: message.type,
 *     payload: { result: 'ok' },
 *   });
 * });
 *
 * server.start();
 * ```
 */
export async function createServer(
  startupData: WorkerThreadsStartupData,
  options: ServerOptions = {}
): Promise<WorkerThreadsServerChannel> {
  const {
    serializer = defaultSerializer,
    logLevel = 'error',
    logger: customLogger,
  } = options;

  const logger = customLogger ?? createMetaLogger(undefined, logLevel);

  // Validate startup data driver
  if (startupData.driver !== 'worker_threads') {
    throw new Error(
      `createServer() called with startup data for driver "${startupData.driver}", ` +
        'but this is the worker_threads server module. Use the matching driver.'
    );
  }

  // Use require for synchronous access to parentPort
  let workerThreadsModule: typeof import('worker_threads');
  try {
    workerThreadsModule = await import('worker_threads');
  } catch {
    throw new Error(
      'Cannot create WorkerThreadsServerChannel: worker_threads module is not available. ' +
        'Ensure you are running in a Node.js environment that supports worker threads.'
    );
  }

  if (!workerThreadsModule.parentPort) {
    throw new Error(
      'Cannot create WorkerThreadsServerChannel: not running inside a worker thread. ' +
        'Ensure this code is executed inside a worker spawned by WorkerThreadsDriver.'
    );
  }

  logger.info('Creating worker threads server');

  const server = new WorkerThreadsServerChannel(
    workerThreadsModule.parentPort,
    {
      serializer,
      logger,
    }
  );

  // Start the server immediately (unlike child_process which needs to listen)
  server.start();

  return server;
}
