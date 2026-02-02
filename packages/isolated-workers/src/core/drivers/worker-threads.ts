/**
 * Worker threads driver implementation
 *
 * Uses worker_threads module with MessagePort for IPC communication.
 * Provides shared memory support via SharedArrayBuffer.
 *
 * @packageDocumentation
 */

import type { Serializer } from '../../utils/serializer.js';
import { defaultSerializer } from '../../utils/serializer.js';
import { createMetaLogger, type Logger, type LogLevel } from '../../utils/logger.js';
import type {
  Driver,
  DriverChannel,
  DriverMessage,
  WorkerThreadsCapabilities,
} from '../driver.js';
import {
  STARTUP_DATA_WORKER_KEY,
  type StartupData,
} from './startup.js';

// Dynamically import worker_threads to handle environments where it's unavailable
let workerThreadsModule: typeof import('worker_threads') | null = null;
let workerThreadsAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  workerThreadsModule = require('worker_threads');
  workerThreadsAvailable = true;
} catch {
  // worker_threads not available (older Node.js or browser environment)
  workerThreadsAvailable = false;
}

/**
 * Check if worker_threads is available in the current environment.
 *
 * @returns True if worker_threads module can be used
 *
 * @example
 * ```typescript
 * if (isWorkerThreadsDriverAvailable()) {
 *   const driver = new WorkerThreadsDriver();
 *   // ...
 * }
 * ```
 */
export function isWorkerThreadsDriverAvailable(): boolean {
  return workerThreadsAvailable;
}

/**
 * Resource limits for worker threads
 */
export interface WorkerThreadsResourceLimits {
  /** Maximum size of the young generation heap in MB */
  maxYoungGenerationSizeMb?: number;
  /** Maximum size of the old generation heap in MB */
  maxOldGenerationSizeMb?: number;
  /** Size of the pre-allocated code range in MB */
  codeRangeSizeMb?: number;
  /** Default stack size for the worker thread in KB */
  stackSizeMb?: number;
}

/**
 * Options for worker threads driver spawn
 */
export interface WorkerThreadsDriverOptions {
  /** Additional data to pass to worker via workerData */
  workerData?: unknown;

  /** Resource limits for the worker thread */
  resourceLimits?: WorkerThreadsResourceLimits;

  /** List of transferable objects to transfer to worker */
  transferList?: ArrayBuffer[];

  /** If true, script is treated as JavaScript code instead of a path */
  eval?: boolean;

  /** Custom serializer (must match worker side) */
  serializer?: Serializer;

  /** Log level for driver operations */
  logLevel?: LogLevel;

  /** Custom logger instance */
  logger?: Logger;
}

/**
 * Channel implementation for worker threads driver.
 *
 * Wraps a Worker and provides the DriverChannel interface
 * using MessagePort-based communication.
 */
export class WorkerThreadsChannel implements DriverChannel {
  private _isConnected: boolean;
  private readonly _logger: Logger;
  private messageHandlers: Array<(message: DriverMessage) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private readonly serializer: Serializer;

  constructor(
    private readonly worker: InstanceType<typeof import('worker_threads').Worker>,
    options: { serializer: Serializer; logger: Logger }
  ) {
    this._isConnected = true;
    this._logger = options.logger;
    this.serializer = options.serializer;

    // Set up message handling
    this.worker.on('message', (data: unknown) => {
      try {
        // Messages are sent as serialized strings
        const message =
          typeof data === 'string'
            ? this.serializer.deserialize<DriverMessage>(data)
            : (data as DriverMessage);

        this._logger.debug('Received message', {
          type: message.type,
          tx: message.tx,
        });

        this.messageHandlers.forEach((handler) => {
          try {
            handler(message);
          } catch (err) {
            this._logger.error('Message handler error', {
              error: (err as Error).message,
            });
          }
        });
      } catch (err) {
        this._logger.error('Failed to process message', {
          error: (err as Error).message,
        });
      }
    });

    // Set up error handling
    this.worker.on('error', (err: Error) => {
      this._logger.error('Worker error', { error: err.message });
      this.errorHandlers.forEach((handler) => {
        try {
          handler(err);
        } catch (handlerErr) {
          this._logger.error('Error handler error', {
            error: (handlerErr as Error).message,
          });
        }
      });
    });

    // Set up exit handling
    this.worker.on('exit', (code: number) => {
      this._logger.debug('Worker exited', { code });
      this._isConnected = false;
      this.closeHandlers.forEach((handler) => {
        try {
          handler();
        } catch (err) {
          this._logger.error('Close handler error', {
            error: (err as Error).message,
          });
        }
      });
    });
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Worker threads don't have PIDs - they run in the same process.
   * Returns undefined as per the driver interface.
   */
  get pid(): number | undefined {
    return undefined;
  }

  async send(message: DriverMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Channel is not connected');
    }

    this._logger.debug('Sending message', { type: message.type, tx: message.tx });

    // Serialize the message for consistent handling
    const serialized = this.serializer.serialize(message);
    this.worker.postMessage(serialized);
  }

  onMessage(handler: (message: DriverMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  async close(): Promise<void> {
    this._logger.info('Closing worker thread channel');

    if (!this._isConnected) {
      return;
    }

    // Attempt graceful termination
    const terminationPromise = this.worker.terminate();

    this._isConnected = false;

    // Wait for termination to complete
    await terminationPromise;

    this._logger.info('Worker thread channel closed');
  }
}

/**
 * Worker threads driver implementation.
 *
 * Spawns workers using worker_threads.Worker and communicates via
 * MessagePort (postMessage/onmessage pattern).
 */
export class WorkerThreadsDriver
  implements Driver<WorkerThreadsCapabilities, WorkerThreadsDriverOptions>
{
  readonly name = 'worker_threads';

  readonly capabilities: WorkerThreadsCapabilities = {
    reconnect: false,
    detach: false,
    sharedMemory: true,
  };

  constructor() {
    if (!workerThreadsAvailable || !workerThreadsModule) {
      throw new Error(
        'worker_threads module is not available. ' +
        'This may be because you are running in an environment that does not support worker threads, ' +
        'or you are using an older version of Node.js.'
      );
    }
  }

  /**
   * Spawn a worker thread and establish communication channel.
   *
   * @param script - Path to the worker script (or code if eval is true)
   * @param options - Spawn options
   * @returns Promise resolving to a DriverChannel
   */
  async spawn(
    script: string,
    options: WorkerThreadsDriverOptions = {}
  ): Promise<WorkerThreadsChannel> {
    const {
      workerData: userWorkerData,
      resourceLimits,
      transferList,
      eval: evalCode = false,
      serializer = defaultSerializer,
      logLevel = 'error',
      logger: customLogger,
    } = options;

    const logger = customLogger ?? createMetaLogger(undefined, logLevel);

    logger.info('Spawning worker thread', { script: evalCode ? '<code>' : script });

    // Create startup data for the worker
    const startupData: StartupData = {
      driver: this.name,
      serializer: serializer.constructor.name,
    };

    // Combine user workerData with startup data
    const combinedWorkerData = {
      ...((userWorkerData as Record<string, unknown>) ?? {}),
      [STARTUP_DATA_WORKER_KEY]: startupData,
    };

    // Create the worker - module is guaranteed to be available (validated in constructor)
    if (!workerThreadsModule) {
      throw new Error('worker_threads module is not available');
    }
    const Worker = workerThreadsModule.Worker;
    const worker = new Worker(script, {
      workerData: combinedWorkerData,
      resourceLimits,
      transferList,
      eval: evalCode,
    });

    logger.debug('Worker thread spawned', { threadId: worker.threadId });

    // Wait for the worker to be ready (online event)
    await new Promise<void>((resolve, reject) => {
      const onlineHandler = () => {
        worker.removeListener('error', errorHandler);
        logger.debug('Worker thread online', { threadId: worker.threadId });
        resolve();
      };

      const errorHandler = (err: Error) => {
        worker.removeListener('online', onlineHandler);
        logger.error('Worker thread failed to start', { error: err.message });
        reject(err);
      };

      worker.once('online', onlineHandler);
      worker.once('error', errorHandler);
    });

    logger.info('Worker thread ready', { threadId: worker.threadId });

    // Create and return the channel
    return new WorkerThreadsChannel(worker, { serializer, logger });
  }
}

/**
 * Default worker threads driver instance.
 *
 * Note: This will be null if worker_threads is not available.
 * Always check isWorkerThreadsDriverAvailable() before using.
 */
export const workerThreadsDriver: WorkerThreadsDriver | null =
  workerThreadsAvailable && workerThreadsModule ? new WorkerThreadsDriver() : null;
