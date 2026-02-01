import { CodeBlock } from '../../../components/CodeBlock';

export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">Best Practices</h1>
      <p className="text-lg text-gray-400 mb-8">
        Production-ready patterns for building robust worker systems.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Worker Lifecycle Management
        </h2>
        <p className="text-gray-400 mb-4">
          Always properly manage worker lifecycle from creation to shutdown:
        </p>

        <CodeBlock
          code={`class WorkerManager<TMessages extends Record<string, any>> {
  private worker: WorkerClient<TMessages> | null = null;
  private shutdownPromise: Promise<void> | null = null;

  async start(): Promise<void> {
    if (this.worker) {
      throw new Error('Worker already started');
    }

    this.worker = await createWorker<TMessages>({
      script: './worker.js',
      timeout: {
        WORKER_STARTUP: 10000,
        WORKER_MESSAGE: 30000,
      },
    });

    console.log('Worker started:', this.worker.pid);
  }

  async stop(): Promise<void> {
    if (!this.worker) {
      return;
    }

    // Ensure we only shutdown once
    if (!this.shutdownPromise) {
      this.shutdownPromise = this.doShutdown();
    }

    await this.shutdownPromise;
  }

  private async doShutdown(): Promise<void> {
    if (!this.worker) return;

    try {
      await this.worker.close();
      console.log('Worker stopped');
    } finally {
      this.worker = null;
    }
  }

  getWorker(): WorkerClient<TMessages> {
    if (!this.worker) {
      throw new Error('Worker not started');
    }
    return this.worker;
  }
}

// Usage
const manager = new WorkerManager<MyMessages>();

// Graceful shutdown
process.on('SIGTERM', () => manager.stop());`}
          filename="worker-manager.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Message Design
        </h2>
        <p className="text-gray-400 mb-4">
          Design messages that are coarse-grained and minimize serialization
          overhead:
        </p>

        <CodeBlock
          code={`// Good: Coarse-grained, batched operations
type GoodMessages = DefineMessages<{
  batchProcess: {
    payload: { items: Array<{ id: string; data: any }> };
    result: { results: Array<{ id: string; success: boolean }> };
  };
}>;

// Avoid: Fine-grained, chatty operations
type BadMessages = DefineMessages<{
  processItem: {
    payload: { id: string; data: any };
    result: { success: boolean };
  };
};

// Batch on host, send once
const items = [{ id: '1', data: {} }, { id: '2', data: {} }];
const results = await worker.send('batchProcess', { items });`}
          filename="message-design.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Connection Resilience
        </h2>
        <p className="text-gray-400 mb-4">
          Configure reconnection attempts for reliable worker communication:
        </p>

        <CodeBlock
          code={`const worker = await createWorker<MyMessages>({
  script: './worker.js',
  connection: {
    attempts: 5,           // Max reconnection attempts
    delay: 100,            // Initial delay in ms
    maxDelay: 5000,        // Maximum delay cap
  },
});

// The worker will automatically retry connection on transient failures`}
          filename="connection-resilience.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Monitoring and Observability
        </h2>
        <p className="text-gray-400 mb-4">
          Use middleware for monitoring all message traffic:
        </p>

        <CodeBlock
          code={`import type { Middleware } from 'isolated-workers';

const loggingMiddleware: Middleware<MyMessages> = (message, direction) => {
  const timestamp = new Date().toISOString();
  const prefix = direction === 'incoming' ? 'RECV' : 'SEND';
  console.log(\`[\${timestamp}] \${prefix} \${message.type}\`);
  return message;
};

const metricsMiddleware: Middleware<MyMessages> = (message, direction) => {
  // Track metrics
  metrics.counter(\`worker.message.\${direction}\`).inc();
  metrics.counter(\`worker.message.\${message.type}\`).inc();
  return message;
};

// Apply to worker
const worker = await createWorker<MyMessages>({
  script: './worker.js',
  middleware: [loggingMiddleware, metricsMiddleware],
});`}
          filename="monitoring.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Logging Strategy
        </h2>
        <p className="text-gray-400 mb-4">
          Configure appropriate log levels for production:
        </p>

        <CodeBlock
          code={`// Development: verbose logging
const worker = await createWorker<MyMessages>({
  script: './worker.js',
  logLevel: 'debug',
});

// Production: errors only
const worker = await createWorker<MyMessages>({
  script: './worker.js',
  logLevel: 'error',
});

// Custom logger (e.g., pino, winston)
const worker = await createWorker<MyMessages>({
  script: './worker.js',
  logger: {
    debug: (msg, meta) => customLogger.debug({ msg, ...meta }),
    info: (msg, meta) => customLogger.info({ msg, ...meta }),
    warn: (msg, meta) => customLogger.warn({ msg, ...meta }),
    error: (msg, meta) => customLogger.error({ msg, ...meta }),
  },
});`}
          filename="logging.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Environment Configuration
        </h2>
        <p className="text-gray-400 mb-4">
          Pass configuration through environment variables:
        </p>

        <CodeBlock
          code={`// Host
const worker = await createWorker<MyMessages>({
  script: './worker.js',
  env: {
    NODE_ENV: process.env.NODE_ENV,
    API_KEY: process.env.API_KEY,
    WORKER_ID: 'worker-1',
  },
});

// Worker can access these
console.log('Worker ID:', process.env.WORKER_ID);
console.log('API Key:', process.env.API_KEY);`}
          filename="environment.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Timeout Configuration
        </h2>
        <p className="text-gray-400 mb-4">
          Set appropriate timeouts for your use case:
        </p>

        <CodeBlock
          code={`// For CPU-bound operations (longer timeouts)
const worker = await createWorker<MyMessages>({
  script: './cpu-worker.js',
  timeout: {
    WORKER_STARTUP: 30000,     // 30s to start
    WORKER_MESSAGE: 300000,    // 5min default
    heavyComputation: 600000,  // 10min for heavy tasks
  },
});

// For I/O-bound operations (shorter timeouts)
const worker = await createWorker<MyMessages>({
  script: './io-worker.js',
  timeout: {
    WORKER_STARTUP: 5000,      // 5s to start
    WORKER_MESSAGE: 5000,      // 5s default
    quickQuery: 1000,          // 1s for fast queries
  },
});`}
          filename="timeouts.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Worker Pool Pattern
        </h2>
        <p className="text-gray-400 mb-4">
          Use multiple workers for parallel processing:
        </p>

        <CodeBlock
          code={`class WorkerPool<TMessages extends Record<string, any>> {
  private workers: WorkerClient<TMessages>[] = [];
  private index = 0;

  async initialize(size: number, script: string): Promise<void> {
    for (let i = 0; i < size; i++) {
      const worker = await createWorker<TMessages>({
        script,
        env: { WORKER_ID: \`worker-\${i}\` },
      });
      this.workers.push(worker);
    }
  }

  async send<K extends keyof TMessages>(
    type: K,
    payload: any
  ): Promise<any> {
    // Round-robin selection
    const worker = this.workers[this.index];
    this.index = (this.index + 1) % this.workers.length;
    return worker.send(type, payload);
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.workers.map(w => w.close()));
    this.workers = [];
  }
}

// Usage
const pool = new WorkerPool<MyMessages>();
await pool.initialize(4, './worker.js');

// Distribute work across workers
const results = await Promise.all(
  tasks.map(task => pool.send('process', task))
);

await pool.shutdown();`}
          filename="worker-pool.ts"
        />
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Testing Workers
        </h2>
        <p className="text-gray-400 mb-4">
          Test workers in isolation and integration:
        </p>

        <CodeBlock
          code={`// Unit test for handler logic
import { startWorkerServer } from 'isolated-workers';

describe('Worker handlers', () => {
  it('should process data correctly', async () => {
    const server = await startWorkerServer<MyMessages>({
      processData: async ({ input }) => {
        return { output: input.toUpperCase() };
      },
    });

    // Test handler directly (mock the messaging layer)
    // Or send actual messages to the server
  });
});

// Integration test
describe('Worker integration', () => {
  it('should communicate with host', async () => {
    const worker = await createWorker<MyMessages>({
      script: './worker.js',
    });

    const result = await worker.send('ping', {});
    expect(result.pong).toBe(true);

    await worker.close();
  });
});`}
          filename="testing.ts"
        />
      </section>
    </div>
  );
}
