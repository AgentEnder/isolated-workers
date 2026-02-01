import { CodeBlock } from '../../../components/CodeBlock';

export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">Error Handling</h1>
      <p className="text-lg text-gray-400 mb-8">
        Best practices for handling errors across process boundaries.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Worker Errors are Propagated
        </h2>
        <p className="text-gray-400 mb-4">
          When a handler throws an error, it&apos;s automatically serialized and
          thrown on the host side:
        </p>

        <CodeBlock
          code={`// Worker
const server = await startWorkerServer<MyMessages>({
  riskyOperation: async (payload) => {
    if (payload.invalid) {
      throw new Error('Invalid input data');
    }
    return { success: true };
  },
});

// Host
try {
  await worker.send('riskyOperation', { invalid: true });
} catch (error) {
  console.error(error.message); // "Invalid input data"
}`}
          filename="error-handling.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Timeout Errors
        </h2>
        <p className="text-gray-400 mb-4">
          Configure timeouts to prevent hanging on unresponsive workers:
        </p>

        <CodeBlock
          code={`const worker = await createWorker<MyMessages>({
  script: './worker.js',
  timeout: {
    WORKER_MESSAGE: 5000,      // Default 5s timeout
    longRunningTask: 60000,    // 1min for specific task
  },
});

try {
  await worker.send('longRunningTask', { data: largeData });
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error('Worker took too long to respond');
  }
}`}
          filename="timeouts.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Connection Errors
        </h2>
        <p className="text-gray-400 mb-4">
          Handle worker startup failures gracefully:
        </p>

        <CodeBlock
          code={`let worker: WorkerClient<MyMessages> | null = null;

try {
  worker = await createWorker<MyMessages>({
    script: './worker.js',
    timeout: {
      WORKER_STARTUP: 5000,  // Fail fast if worker doesn't start
    },
  });
} catch (error) {
  console.error('Failed to start worker:', error.message);
  // Fallback behavior or retry logic
  process.exit(1);
}

// Check connection status
if (!worker.isConnected) {
  console.error('Worker is not connected');
}`}
          filename="connection-errors.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Worker Exit Handling
        </h2>
        <p className="text-gray-400 mb-4">
          Detect when a worker process exits unexpectedly:
        </p>

        <CodeBlock
          code={`const worker = await createWorker<MyMessages>({
  script: './worker.js',
});

// Check if worker is still active
if (!worker.isActive) {
  console.error('Worker process has exited');
  // Attempt respawn or fallback behavior
}

// The host will reject pending requests when the worker exits
try {
  await worker.send('someTask', {});
} catch (error) {
  if (error.message.includes('exited')) {
    console.error('Worker exited during request');
  }
}`}
          filename="worker-exit.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Custom Error Types
        </h2>
        <p className="text-gray-400 mb-4">
          Define custom error types for better error handling:
        </p>

        <CodeBlock
          code={`// Shared error types
class WorkerError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

// Worker
const server = await startWorkerServer<MyMessages>({
  process: async (payload) => {
    if (!payload.data) {
      throw new WorkerError('No data provided', 'NO_DATA');
    }
    return { result: 'ok' };
  },
});

// Host
try {
  await worker.send('process', { data: null });
} catch (error) {
  if (error instanceof WorkerError) {
    console.error('Error code:', error.code);
  }
}`}
          filename="custom-errors.ts"
        />
        <p className="text-gray-400 mt-4 text-sm">
          Note: For custom error classes to work properly, ensure the error
          class is defined in a shared file that both host and worker import.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Retry Strategies
        </h2>
        <p className="text-gray-400 mb-4">
          Implement retry logic for transient failures:
        </p>

        <CodeBlock
          code={`async function sendWithRetry<T>(
  worker: WorkerClient<MyMessages>,
  messageType: keyof MyMessages,
  payload: any,
  maxRetries = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await worker.send(messageType, payload) as T;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on validation errors
      if (error.message.includes('Unknown message type')) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 100));
      }
    }
  }

  throw lastError!;
}

// Usage
const result = await sendWithRetry(worker, 'process', { data }, 3);`}
          filename="retry.ts"
        />
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Graceful Shutdown
        </h2>
        <p className="text-gray-400 mb-4">Always clean up workers properly:</p>

        <CodeBlock
          code={`const worker = await createWorker<MyMessages>({
  script: './worker.js',
});

// Handle process signals
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await worker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await worker.close();
});

// Or use try/finally in async functions
async function main() {
  const worker = await createWorker<MyMessages>({ script: './worker.js' });

  try {
    // Do work
    await worker.send('task', {});
  } finally {
    // Always cleanup, even on error
    await worker.close();
  }
}`}
          filename="shutdown.ts"
        />
      </section>
    </div>
  );
}
