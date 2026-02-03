# isolated-workers

Type-safe worker process library for Node.js with full TypeScript inference.

[![npm version](https://img.shields.io/npm/v/isolated-workers.svg)](https://www.npmjs.com/package/isolated-workers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Type-safe messaging** - Full TypeScript inference for payloads and responses
- **Process isolation** - True process boundaries for CPU-intensive tasks
- **Multiple drivers** - Child processes (default) or worker threads
- **Cross-platform** - Unix domain sockets and Windows named pipes
- **Middleware support** - Logging, validation, timing, and custom pipelines
- **Timeout configuration** - Per-message-type and global timeout settings
- **Zero dependencies** - No runtime dependencies

## Installation

```bash
npm install isolated-workers
# or
pnpm add isolated-workers
# or
yarn add isolated-workers
```

**Requirements**: Node.js 20.10+ and TypeScript 5.0+

## Quick Start

### 1. Define Your Message Contract

```typescript
/**
 * Shared message definitions for the basic-ping example
 *
 * This file is imported by both the host and worker to ensure
 * type safety and avoid duplication.
 */

import { DefineMessages } from 'isolated-workers';

/**
 * Message types for the ping-pong example
 */
export type Messages = DefineMessages<{
  ping: {
    payload: { message: string };
    result: { message: string };
  };
}>;

```

### 2. Create the Worker

```typescript
/**
 * Basic Ping-Pong Worker - Worker (Server) Side
 *
 * This script runs as the worker process and responds to ping messages.
 */

import { startWorkerServer, Handlers } from 'isolated-workers';
import type { Messages } from './messages.js';

// Define handlers for incoming messages with proper typing
const handlers: Handlers<Messages> = {
  ping: ({ message }) => {
    console.log(`Worker received: ${message}`);
    return { message: 'pong' };
  },
};

// Start the worker server
async function main() {
  console.log('Worker starting...');

  const server = await startWorkerServer(handlers);

  console.log('Worker ready and waiting for messages');

  // Keep the process alive until explicitly stopped
  process.on('SIGTERM', async () => {
    console.log('Worker received SIGTERM, shutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});

```

### 3. Spawn and Communicate

```typescript
/**
 * Basic Ping-Pong Worker - Host (Client) Side
 *
 * This script spawns a worker process and sends a ping message,
 * then receives and prints the pong response.
 */

import { createWorker } from 'isolated-workers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Messages } from './messages.js';

// Get the directory of this file for spawning the worker
const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Spawning worker process...');

  // Create a worker that runs worker.ts
  const worker = await createWorker<Messages>({
    script: join(__dirname, 'worker.ts'),
    timeout: 10000,
  });

  console.log(`Worker spawned with PID: ${worker.pid}`);

  try {
    // Send a ping message
    console.log('Sending ping message...');
    const result = await worker.send('ping', { message: 'ping' });

    console.log('Received response:', result);
  } catch (err) {
    console.error('Error:', (err as Error).message);
  } finally {
    // Always close the worker
    await worker.close();
    console.log('Worker closed successfully');
  }
}

main();

```

## Advanced Example: Image Processing

For a more complete example with per-operation timeouts and batch processing:

### Message Definitions

```typescript
export type Messages = DefineMessages<{
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
    payload: Record<string, never>;
    result: {
      active: boolean;
      processedCount: number;
    };
  };
}>;
```

### Creating the Worker with Timeouts

```typescript
// Spawn the worker with per-operation timeouts
  const worker = await createWorker<Messages>({
    script: join(__dirname, 'worker.ts'),
    // Configure timeouts for different operations
    timeout: {
      WORKER_STARTUP: 5000, // 5s to start
      processImage: 30000, // 30s per image
      batchProcess: 300000, // 5min for batch
    },
  });
```

### Sending Messages

```typescript
// Process a single image
    const metadata = await worker.send('processImage', {
      imagePath: './photo.jpg',
      options: { grayscale: true, quality: 85 },
    });
    console.log('Image metadata:', metadata);
```

## Drivers

isolated-workers supports two execution strategies:

### Child Process (Default)

True process isolation with separate memory space:

```typescript
const worker = await createWorker<Messages>({
    script: './worker.js',
    // Uses child_process driver by default
  });
```

### Worker Threads

In-process workers with shared memory support:

```typescript
const worker = await createWorker<Messages, typeof WorkerThreadsDriver>({
    script: './worker.js',
    driver: WorkerThreadsDriver,
  });
```

See [Worker Threads Driver](https://craigory.dev/isolated-workers/examples/worker-threads-driver) for a complete example.

## Timeout Configuration

Configure timeouts globally or per-message-type:

```typescript
// Define timeout configuration
  const timeoutConfig: TimeoutConfig<Messages> = {
    // Worker lifecycle timeouts
    WORKER_STARTUP: 5000, // 5 seconds to start
    SERVER_CONNECT: 5000, // 5 seconds for server to accept connection

    // Default message timeout
    WORKER_MESSAGE: 3000, // 3 seconds default for messages

    // Per-message-type timeouts (override WORKER_MESSAGE)
    quickPing: 1000, // 1 second for quick operations
    slowProcess: 10000, // 10 seconds for slow operations
  };
```

```typescript
const worker = await createWorker<Messages>({
    script: join(__dirname, 'worker.ts'),
    timeout: timeoutConfig,
  });
```

See [Timeout Configuration](https://craigory.dev/isolated-workers/examples/timeout-config) for more details.

## Middleware

Add logging, validation, or custom processing:

```typescript
/**
 * Logging middleware - logs all messages with direction
 */
const loggingMiddleware: Middleware<Messages> = (message, direction) => {
  const arrow = direction === 'outgoing' ? '>>>' : '<<<';
  console.log(
    `[${direction.toUpperCase()}] ${arrow} ${message.type}`,
    message.payload
  );
  return message;
};
```

```typescript
// Create worker with middleware pipeline
  // Middleware is applied in order: logging -> timing
  const worker = await createWorker<Messages>({
    script: join(__dirname, 'worker.ts'),
    timeout: 10000,
    middleware: [loggingMiddleware, timingMiddleware],
  });
```

See [Middleware Pipeline](https://craigory.dev/isolated-workers/examples/middleware) for the complete middleware example.

## Error Handling

Errors thrown in workers are automatically propagated to the host:

```typescript
/**
 * Error Handling Example - Worker (Server) Side
 *
 * Demonstrates error throwing and propagation.
 */

import { startWorkerServer, Handlers } from 'isolated-workers';
import type { Messages } from './messages.js';

// Define handlers for incoming messages with proper typing
const handlers: Handlers<Messages> = {
  divide: ({ a, b }) => {
    console.log(`Worker: dividing ${a} / ${b}`);

    if (b === 0) {
      throw new Error('Division by zero');
    }

    return { result: a / b };
  },
};

async function main() {
  console.log('Worker: starting error-handling demo worker');

  await startWorkerServer(handlers);

  console.log('Worker: ready');

  process.on('SIGTERM', () => {
    console.log('Worker: shutting down');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});

```

```typescript
/**
 * Error Handling Example - Host (Client) Side
 *
 * Demonstrates error propagation from worker to host.
 */

import { createWorker } from 'isolated-workers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Messages } from './messages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('=== Error Handling Example ===\n');

  const worker = await createWorker<Messages>({
    script: join(__dirname, 'worker.ts'),
    timeout: 10000,
  });

  console.log(`Worker spawned with PID: ${worker.pid}\n`);

  // Test 1: Successful division
  console.log('Test 1: 10 / 2');
  try {
    const result = await worker.send('divide', { a: 10, b: 2 });
    console.log('Result:', result.result, '\n');
  } catch (err) {
    console.error('Unexpected error:', (err as Error).message, '\n');
  }

  // Test 2: Division by zero (should error)
  console.log('Test 2: 10 / 0 (should error)');
  try {
    await worker.send('divide', { a: 10, b: 0 });
    console.log('ERROR: Should have thrown!\n');
  } catch (err) {
    console.log('Caught expected error:', (err as Error).message, '\n');
  }

  // Test 3: Cleanup
  console.log('Test 3: Cleanup');
  await worker.close();
  console.log('Worker closed successfully\n');

  console.log('=== All tests passed ===');
}

main().catch((err) => {
  console.error('Host error:', err);
  process.exit(1);
});

```

See [Error Handling](https://craigory.dev/isolated-workers/examples/error-handling) for more patterns.

## When to Use isolated-workers

**Good fit:**
- CPU-intensive tasks (image processing, data parsing, crypto)
- Plugin systems requiring isolation
- Sandboxed code execution
- Long-running background jobs

**Better alternatives:**
- Simple async I/O → use Promises directly
- Shared memory requirements → use `worker_threads` directly
- Very high-frequency messaging → consider batching or SharedArrayBuffer

## Documentation

Full documentation and examples at [craigory.dev/isolated-workers](https://craigory.dev/isolated-workers)

- [Getting Started](https://craigory.dev/isolated-workers/docs/getting-started/installation)
- [Core Concepts](https://craigory.dev/isolated-workers/docs/concepts/core-concepts)
- [API Reference](https://craigory.dev/isolated-workers/api)
- [Examples](https://craigory.dev/isolated-workers/examples)

## API Overview

### Host Side

```typescript
// Create a worker
const worker = await createWorker<Messages>(options);

// Send messages
const result = await worker.send('messageType', payload);

// Check status
worker.isActive;     // true if worker can accept messages
worker.isConnected;  // true if connection established

// Graceful shutdown
await worker.close();
```

### Worker Side

```typescript
// Start the server with handlers
const server = await startWorkerServer<Messages>(handlers, options);

// Server automatically handles:
// - Message deserialization
// - Handler dispatch
// - Response serialization
// - Error propagation
// - Graceful shutdown (SIGTERM)
```

### Type Helpers

```typescript
import type {
  DefineMessages, // Define message contracts
  MessageOf, // Extract message type
  PayloadOf, // Extract payload type
  ResultOf, // Extract result type
  Handlers, // Handler map type
} from 'isolated-workers';
```

## Examples

- [Basic Ping-Pong Worker](https://craigory.dev/isolated-workers/examples/basic-ping) - Simple request/response
- [Error Handling](https://craigory.dev/isolated-workers/examples/error-handling) - Error propagation patterns
- [Middleware Pipeline](https://craigory.dev/isolated-workers/examples/middleware) - Message interception and logging
- [Timeout Configuration](https://craigory.dev/isolated-workers/examples/timeout-config) - Per-operation timeouts
- [Worker Lifecycle Management](https://craigory.dev/isolated-workers/examples/worker-lifecycle) - Status checking and state persistence
- [Custom Serializer](https://craigory.dev/isolated-workers/examples/custom-serializer) - Binary format support
- [Image Processing Worker](https://craigory.dev/isolated-workers/examples/image-processing) - Production-ready worker pattern
- [Worker Threads Driver](https://craigory.dev/isolated-workers/examples/worker-threads-driver) - Worker threads with shared memory

## License

MIT © [Craigory Coppola](https://craigory.dev)
