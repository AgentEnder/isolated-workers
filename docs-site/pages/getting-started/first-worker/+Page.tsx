import { CodeBlock } from '../../../components/CodeBlock';

export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">
        Building Your First Worker
      </h1>
      <p className="text-lg text-gray-400 mb-8">
        A complete guide to building a production-ready worker for CPU-intensive
        tasks.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Use Case: Image Processing Worker
        </h2>
        <p className="text-gray-400 mb-4">
          We&apos;ll build a worker that handles image processing operations.
          This demonstrates the key benefits of isolated-workers: offloading
          CPU-intensive work while maintaining type safety.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Step 1: Define the Message Contract
        </h2>
        <p className="text-gray-400 mb-4">
          Create a shared types file that both host and worker will use:
        </p>

        <CodeBlock
          code={`import type { DefineMessages } from 'isolated-workers';

export type ImageWorkerMessages = DefineMessages<{
  // Process an image and return metadata
  processImage: {
    payload: {
      imagePath: string;
      options: { grayscale: boolean; quality: number };
    };
    result: {
      width: number;
      height: number;
      format: string;
      size: number;
    };
  };

  // Batch process multiple images
  batchProcess: {
    payload: {
      paths: string[];
      options: { grayscale: boolean; quality: number };
    };
    result: {
      successful: number;
      failed: number;
      results: Array<{ path: string; success: boolean }>;
    };
  };

  // Get current worker status
  getStatus: {
    payload: void;
    result: {
      active: boolean;
      processedCount: number;
    };
  };
}>;`}
          filename="types.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Step 2: Implement the Worker
        </h2>
        <p className="text-gray-400 mb-4">
          Create the worker script with handlers for each message type:
        </p>

        <CodeBlock
          code={`import { startWorkerServer } from 'isolated-workers';
import type { ImageWorkerMessages } from './types';

// Track processing statistics
let processedCount = 0;

const server = await startWorkerServer<ImageWorkerMessages>({
  processImage: async ({ imagePath, options }) => {
    // Simulate image processing (replace with real logic)
    console.log(\`Processing: \${imagePath}\`);

    // In a real implementation, you would use sharp, jimp, or similar
    await simulateProcessing();

    processedCount++;

    return {
      width: 1920,
      height: 1080,
      format: 'jpeg',
      size: 256000,
    };
  },

  batchProcess: async ({ paths, options }) => {
    const results = [];

    for (const path of paths) {
      try {
        await simulateProcessing();
        results.push({ path, success: true });
      } catch (error) {
        results.push({ path, success: false });
      }
    }

    return {
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  },

  getStatus: async () => {
    return {
      active: true,
      processedCount,
    };
  },
});

console.log('Image worker started on', process.env.ISOLATED_WORKERS_SOCKET_PATH);

// Helper to simulate work
async function simulateProcessing() {
  return new Promise((resolve) => setTimeout(resolve, 100));
}`}
          filename="image-worker.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Step 3: Create the Host Process
        </h2>
        <p className="text-gray-400 mb-4">
          Create the main process that spawns and communicates with the worker:
        </p>

        <CodeBlock
          code={`import { createWorker } from 'isolated-workers';
import type { ImageWorkerMessages } from './types';

async function main() {
  // Spawn the worker
  const worker = await createWorker<ImageWorkerMessages>({
    script: './image-worker.js',
    // Configure timeouts for different operations
    timeout: {
      WORKER_STARTUP: 5000,      // 5s to start
      processImage: 30000,       // 30s per image
      batchProcess: 300000,      // 5min for batch
    },
  });

  console.log('Worker PID:', worker.pid);

  try {
    // Process a single image
    const metadata = await worker.send('processImage', {
      imagePath: './photo.jpg',
      options: { grayscale: true, quality: 85 },
    });
    console.log('Image metadata:', metadata);

    // Check worker status
    const status = await worker.send('getStatus', {});
    console.log('Worker status:', status);

    // Batch process multiple images
    const batchResult = await worker.send('batchProcess', {
      paths: ['./a.jpg', './b.jpg', './c.jpg'],
      options: { grayscale: false, quality: 90 },
    });
    console.log('Batch result:', batchResult);

  } finally {
    // Always clean up
    await worker.close();
    console.log('Worker shut down gracefully');
  }
}

main().catch(console.error);`}
          filename="index.ts"
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Key Features Demonstrated
        </h2>
        <ul className="list-disc list-inside text-gray-400 space-y-2">
          <li>
            <strong className="text-gray-200">Type Safety:</strong> Payload and
            result types are fully checked
          </li>
          <li>
            <strong className="text-gray-200">Timeouts:</strong>{' '}
            Per-message-type timeout configuration
          </li>
          <li>
            <strong className="text-gray-200">Error Handling:</strong>{' '}
            Try/finally ensures proper cleanup
          </li>
          <li>
            <strong className="text-gray-200">Worker State:</strong> Worker
            maintains internal state between messages
          </li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Running the Example
        </h2>
        <CodeBlock
          code={`# Compile TypeScript
npx tsc

# Run the host process
node index.js`}
          language="bash"
          filename="Terminal"
        />
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-100 mb-4">
          Next Steps
        </h2>
        <p className="text-gray-400 mb-4">
          Explore the{' '}
          <a
            href="/guides/type-safety"
            className="text-neon-cyan hover:underline"
          >
            Type Safety guide
          </a>{' '}
          to learn more about advanced typing patterns, or check out the{' '}
          <a href="/examples" className="text-neon-cyan hover:underline">
            Examples
          </a>{' '}
          for more complete implementations.
        </p>
      </section>
    </div>
  );
}
