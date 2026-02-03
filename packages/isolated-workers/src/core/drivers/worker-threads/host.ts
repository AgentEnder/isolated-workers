/**
 * Worker threads driver host module
 *
 * Contains spawn logic for the worker_threads driver. This module is imported
 * only on the host side (the process that spawns workers).
 *
 * @packageDocumentation
 */

import {
  createMetaLogger,
  type Logger,
  type LogLevel,
} from '../../../utils/logger.js';
import type { Serializer } from '../../../utils/serializer.js';
import { defaultSerializer } from '../../../utils/serializer.js';
import type {
  DriverChannel,
  DriverMessage,
  StartupData,
} from '../../driver.js';

/**
 * workerData key for startup data
 */
export const STARTUP_DATA_WORKER_KEY = '__isolatedWorkers';

/**
 * Startup data specific to worker_threads driver.
 *
 * Extends the base StartupData with worker_threads-specific fields.
 */
export interface WorkerThreadsStartupData extends StartupData {
  /** Driver identifier - always 'worker_threads' for this driver */
  driver: 'worker_threads';
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

  /**
   * List of node CLI options passed to the worker.
   * Useful for loading TypeScript files via tsx:
   * @example ['--import', 'tsx']
   */
  execArgv?: string[];

  /** Custom serializer (must match worker side) */
  serializer?: Serializer;

  /** Log level for driver operations */
  logLevel?: LogLevel;

  /** Custom logger instance */
  logger?: Logger;

  /** Arguments to pass to the worker script */
  argv?: string[];
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
    private readonly worker: InstanceType<
      typeof import('worker_threads').Worker
    >,
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

    this._logger.debug('Sending message', {
      type: message.type,
      tx: message.tx,
    });

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
 * Flags that should not be inherited by worker threads.
 * These are typically single-use flags that don't apply to worker scripts.
 */
const NON_INHERITABLE_FLAGS = new Set([
  '-e',
  '--eval',
  '-p',
  '--print',
  '-c',
  '--check',
  '-i',
  '--interactive',
]);

/**
 * Filter execArgv to remove flags that shouldn't be inherited by workers.
 * Handles both standalone flags and flag=value pairs.
 */
function filterExecArgv(argv: string[]): string[] {
  const result: string[] = [];
  let skipNext = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (skipNext) {
      skipNext = false;
      continue;
    }

    // Check if this is a non-inheritable flag
    const flagName = arg.includes('=') ? arg.split('=')[0] : arg;
    if (NON_INHERITABLE_FLAGS.has(flagName)) {
      // If the flag doesn't contain '=' and isn't a boolean flag, skip the next arg too
      if (
        !arg.includes('=') &&
        (arg === '-e' || arg === '-p' || arg === '-c')
      ) {
        skipNext = true;
      }
      continue;
    }

    result.push(arg);
  }

  return result;
}

/**
 * Spawn a worker thread and establish communication channel.
 *
 * @param script - Path to the worker script (or code if eval is true)
 * @param options - Spawn options
 * @returns Promise resolving to a WorkerThreadsChannel
 */
export async function spawnWorker(
  script: string,
  options: WorkerThreadsDriverOptions = {}
): Promise<WorkerThreadsChannel> {
  const {
    workerData: userWorkerData,
    resourceLimits,
    transferList,
    eval: evalCode = false,
    execArgv: userExecArgv,
    serializer = defaultSerializer,
    logLevel = 'error',
    logger: customLogger,
  } = options;

  // Inherit host's execArgv by default, filtering out non-inheritable flags
  const execArgv = userExecArgv ?? filterExecArgv(process.execArgv);

  const logger = customLogger ?? createMetaLogger(undefined, logLevel);

  const argv = options.argv ?? [];

  // Determine if we need to bootstrap tsx for TypeScript files
  // ESM loaders don't work properly in worker_threads via execArgv,
  // so we use eval to register tsx programmatically before importing the script
  let scriptOrCodeToRun: string;
  let useEval = evalCode;

  if (!evalCode && script.endsWith('.ts')) {
    // Convert file path to URL for dynamic import
    const { pathToFileURL } = await import('node:url');
    const scriptUrl = pathToFileURL(script).href;

    // Bootstrap code that registers tsx and imports the worker script
    scriptOrCodeToRun = `
      import('tsx/esm/api').then(({ register }) => {
        register();
        return import('${scriptUrl}');
      }).catch(err => {
        console.error('[Worker] Failed to bootstrap tsx:', err);
        process.exit(1);
      });
    `;
    useEval = true;
  } else {
    scriptOrCodeToRun = script;
  }

  logger.info('Spawning worker thread', {
    script: evalCode ? '<code>' : script,
  });
  logger.info('Worker thread spawn options', {
    resourceLimits,
    execArgv,
    argv,
  });

  // Dynamically import worker_threads to handle environments where it's unavailable
  let workerThreadsModule: typeof import('worker_threads');
  try {
    workerThreadsModule = await import('worker_threads');
  } catch {
    throw new Error(
      'worker_threads module is not available. ' +
        'This may be because you are running in an environment that does not support worker threads, ' +
        'or you are using an older version of Node.js.'
    );
  }

  // Create startup data for the worker
  const startupData: WorkerThreadsStartupData = {
    driver: 'worker_threads',
    serializer: serializer.constructor.name,
  };

  // Combine user workerData with startup data
  const combinedWorkerData = {
    ...((userWorkerData as Record<string, unknown>) ?? {}),
    [STARTUP_DATA_WORKER_KEY]: startupData,
  };

  logger.debug('Combined worker data:', combinedWorkerData);

  // Create the worker
  const Worker = workerThreadsModule.Worker;
  const worker = new Worker(scriptOrCodeToRun, {
    workerData: combinedWorkerData,
    resourceLimits,
    transferList,
    eval: useEval,
    execArgv,
    argv,
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
