/**
 * Worker threads server implementation for worker side
 *
 * Uses parentPort from worker_threads to communicate with the host process.
 * Used by workers spawned via the WorkerThreadsDriver.
 *
 * @packageDocumentation
 */

import type { Serializer } from '../../utils/serializer.js';
import { defaultSerializer } from '../../utils/serializer.js';
import { createMetaLogger, type Logger, type LogLevel } from '../../utils/logger.js';
import type { DriverMessage } from '../driver.js';
import { getStartupData, STARTUP_DATA_WORKER_KEY } from './startup.js';
import type { ServerChannel, ResponseFunction } from './child-process-server.js';

// Dynamically import worker_threads to handle environments where it's unavailable
let workerThreadsModule: typeof import('worker_threads') | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  workerThreadsModule = require('worker_threads');
} catch {
  // worker_threads not available
  workerThreadsModule = null;
}

/**
 * Check if the current context is inside a worker thread.
 *
 * @returns True if running inside a worker_threads Worker
 *
 * @example
 * ```typescript
 * if (isWorkerThreadsWorker()) {
 *   const server = await createWorkerThreadsServer();
 *   // ...
 * }
 * ```
 */
export function isWorkerThreadsWorker(): boolean {
  if (!workerThreadsModule) {
    return false;
  }

  // Check if parentPort is available (only in worker threads)
  if (workerThreadsModule.parentPort === null) {
    return false;
  }

  // Optionally check for startup data to confirm it was spawned by our driver
  const startupData = getStartupData();
  if (startupData && startupData.driver === 'worker_threads') {
    return true;
  }

  // Check if startup data is in workerData
  const workerData = workerThreadsModule.workerData;
  if (workerData && workerData[STARTUP_DATA_WORKER_KEY]) {
    return true;
  }

  // parentPort exists, so we're in a worker thread even without our startup data
  return true;
}

/**
 * Options for creating a worker threads server
 */
export interface WorkerThreadsServerOptions {
  /** Custom serializer (must match host!) */
  serializer?: Serializer;

  /** Log level for server operations */
  logLevel?: LogLevel;

  /** Custom logger instance */
  logger?: Logger;
}

/**
 * Worker threads server implementation.
 *
 * Wraps parentPort and provides the ServerChannel interface.
 */
export class WorkerThreadsServer implements ServerChannel {
  private _isRunning = false;
  private messageHandlers: Array<(message: DriverMessage, respond: ResponseFunction) => void> = [];
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

  onMessage(handler: (message: DriverMessage, respond: ResponseFunction) => void): void {
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
    this.logger.debug('Sending message', { tx: message.tx, type: message.type });

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
 * @param options - Server options
 * @returns WorkerThreadsServer
 * @throws Error if not running inside a worker thread
 *
 * @example
 * ```typescript
 * const server = createWorkerThreadsServer();
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
export function createWorkerThreadsServer(
  options: WorkerThreadsServerOptions = {}
): WorkerThreadsServer {
  const {
    serializer = defaultSerializer,
    logLevel = 'error',
    logger: customLogger,
  } = options;

  const logger = customLogger ?? createMetaLogger(undefined, logLevel);

  // Check if we're in a worker thread
  if (!workerThreadsModule || !workerThreadsModule.parentPort) {
    throw new Error(
      'Cannot create WorkerThreadsServer: not running inside a worker thread. ' +
      'Ensure this code is executed inside a worker spawned by WorkerThreadsDriver.'
    );
  }

  // Validate startup data driver if present
  const startupData = getStartupData();
  if (startupData && startupData.driver !== 'worker_threads') {
    logger.warn('Startup data indicates different driver', {
      expected: 'worker_threads',
      actual: startupData.driver,
    });
  }

  logger.info('Creating worker threads server');

  const server = new WorkerThreadsServer(workerThreadsModule.parentPort, {
    serializer,
    logger,
  });

  return server;
}

/**
 * Get workerData passed from the host.
 *
 * @returns The workerData object, or undefined if not in a worker thread
 *
 * @example
 * ```typescript
 * const data = getWorkerData<{ config: MyConfig }>();
 * if (data?.config) {
 *   // Use the config
 * }
 * ```
 */
export function getWorkerData<T = unknown>(): T | undefined {
  if (!workerThreadsModule) {
    return undefined;
  }

  const workerData = workerThreadsModule.workerData;
  if (!workerData) {
    return undefined;
  }

  // Return workerData without our internal startup data key
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [STARTUP_DATA_WORKER_KEY]: _startupData, ...userData } = workerData as Record<string, unknown>;
  return userData as T;
}
