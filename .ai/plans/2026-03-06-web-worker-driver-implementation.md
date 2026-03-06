# Web Worker Driver Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `WebWorkerDriver` to isolated-workers so the library works in browser environments via Web Workers + MessageChannel.

**Architecture:** New driver at `src/core/drivers/web-worker/` following the existing driver pattern (defineWorkerDriver + host/server modules). The `script` type widens from `string` to `string | URL` across all drivers. A new package export `./drivers/web-worker` is added.

**Tech Stack:** TypeScript, Web Worker API, MessageChannel/MessagePort, Vitest for unit tests

---

### Task 1: Add WebWorkerCapabilities type to driver.ts

**Files:**
- Modify: `packages/isolated-workers/src/core/driver.ts` (after line 141, where HttpCapabilities is defined)

**Step 1: Add the capability interface**

Add after the `HttpCapabilities` interface (line 141):

```typescript
/**
 * Capability type for web_worker driver.
 *
 * Web Workers support SharedArrayBuffer (with COOP/COEP headers)
 * but cannot be reconnected or detached from the page.
 *
 * @category Drivers
 */
export interface WebWorkerCapabilities extends DriverCapabilities {
  reconnect: false;
  detach: false;
  sharedMemory: true;
}
```

**Step 2: Verify build**

Run: `cd packages/isolated-workers && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/isolated-workers/src/core/driver.ts
git commit -m "feat: add WebWorkerCapabilities type"
```

---

### Task 2: Widen script parameter to `string | URL`

This is the core type change that enables URL-based worker scripts.

**Files:**
- Modify: `packages/isolated-workers/src/core/driver.ts` (lines 98, 246)
- Modify: `packages/isolated-workers/src/core/worker.ts` (line 116)

**Step 1: Write a type test for string | URL**

Create file: `packages/isolated-workers/src/core/__tests__/script-url.spec.ts`

```typescript
import { describe, test, expect, expectTypeOf } from 'vitest';
import type { DriverConfig } from '../driver.js';

describe('script parameter accepts string | URL', () => {
  test('DriverConfig.spawn accepts string', () => {
    // Type-level: DriverConfig.spawn should accept string | URL
    type SpawnParam = Parameters<DriverConfig['spawn']>[0];
    expectTypeOf<string>().toMatchTypeOf<SpawnParam>();
  });

  test('DriverConfig.spawn accepts URL', () => {
    type SpawnParam = Parameters<DriverConfig['spawn']>[0];
    expectTypeOf<URL>().toMatchTypeOf<SpawnParam>();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/isolated-workers && npx vitest run src/core/__tests__/script-url.spec.ts`
Expected: FAIL — URL does not match string

**Step 3: Update Driver interface**

In `packages/isolated-workers/src/core/driver.ts`, change line 98:

```typescript
// Before:
  spawn(script: string, options: TOptions): Promise<DriverChannel>;
// After:
  spawn(script: string | URL, options: TOptions): Promise<DriverChannel>;
```

Also change `DriverConfig.spawn` at line 246:

```typescript
// Before:
  spawn(script: string, options: TOptions): Promise<DriverChannel>;
// After:
  spawn(script: string | URL, options: TOptions): Promise<DriverChannel>;
```

**Step 4: Update WorkerOptions.script**

In `packages/isolated-workers/src/core/worker.ts`, change line 116:

```typescript
// Before:
  /** Path to worker script */
  script: string;
// After:
  /** Path or URL to worker script */
  script: string | URL;
```

**Step 5: Run test to verify it passes**

Run: `cd packages/isolated-workers && npx vitest run src/core/__tests__/script-url.spec.ts`
Expected: PASS

**Step 6: Run full build to find any breakage**

Run: `cd packages/isolated-workers && npx tsc --noEmit`
Expected: There may be errors in existing drivers where `spawn(script: string, ...)` no longer matches the interface. Fix each by changing their `script` param to `string | URL`, then converting to string internally via a helper.

**Step 7: Add resolveScript utility**

Create file: `packages/isolated-workers/src/utils/resolve-script.ts`

```typescript
/**
 * Resolve a script parameter to a file path string for Node.js drivers.
 *
 * Accepts both string paths and file:// URLs.
 * Throws for non-file:// URL protocols.
 */
export function resolveScriptToPath(script: string | URL): string {
  if (typeof script === 'string') {
    return script;
  }

  if (script.protocol === 'file:') {
    // Dynamic import to keep this compatible — only Node environments
    // will actually call this function.
    const { fileURLToPath } = require('node:url') as typeof import('node:url');
    return fileURLToPath(script);
  }

  throw new Error(
    `Unsupported script URL protocol "${script.protocol}". ` +
      'Node.js drivers only support file:// URLs or string paths.'
  );
}
```

**Step 8: Update Node driver spawn functions to use resolveScriptToPath**

In `packages/isolated-workers/src/core/drivers/worker-threads/host.ts`, change the `spawnWorker` function signature (line 278):

```typescript
// Before:
export async function spawnWorker(
  script: string,
  options: WorkerThreadsDriverOptions = {}
): Promise<WorkerThreadsChannel> {
// After:
export async function spawnWorker(
  script: string | URL,
  options: WorkerThreadsDriverOptions = {}
): Promise<WorkerThreadsChannel> {
```

Then at the top of the function body, resolve it:

```typescript
  const resolvedScript = typeof script === 'string' ? script : (() => {
    const { fileURLToPath } = require('node:url') as typeof import('node:url');
    if (script.protocol !== 'file:') {
      throw new Error(
        `WorkerThreadsDriver only supports file:// URLs or string paths, got "${script.protocol}"`
      );
    }
    return fileURLToPath(script);
  })();
```

Then use `resolvedScript` instead of `script` for the rest of the function. Apply the same pattern to child-process and HTTP drivers' `spawnWorker` functions.

Also update the `WorkerThreadsDriver.spawn` signature in `driver.ts`:

```typescript
// Before:
  async spawn(script: string, options: WorkerThreadsDriverOptions = {}) {
// After:
  async spawn(script: string | URL, options: WorkerThreadsDriverOptions = {}) {
```

Apply the same to `ChildProcessDriver` and `HttpDriver` driver.ts files.

**Step 9: Run full test suite**

Run: `cd packages/isolated-workers && npx vitest run`
Expected: All existing tests pass

**Step 10: Commit**

```bash
git add -A
git commit -m "feat: widen script parameter to string | URL across all drivers"
```

---

### Task 3: Create WebWorkerDriver host module

This is the host-side code that spawns a Web Worker and establishes a MessageChannel.

**Files:**
- Create: `packages/isolated-workers/src/core/drivers/web-worker/host.ts`

**Step 1: Write the host channel and spawn function**

Create file: `packages/isolated-workers/src/core/drivers/web-worker/host.ts`

```typescript
/**
 * Web Worker driver host module
 *
 * Contains spawn logic for the web worker driver. This module is imported
 * only on the host side (the page/main thread that spawns workers).
 *
 * @packageDocumentation
 */

import type { ShutdownReason } from '../../../types/config.js';
import type {
  DriverChannel,
  DriverMessage,
  StartupData,
} from '../../driver.js';

/** Init message type sent from host to worker via global postMessage */
const INIT_MESSAGE_TYPE = '__iw_init';

/**
 * Startup data specific to web_worker driver.
 */
export interface WebWorkerStartupData extends StartupData {
  /** Driver identifier - always 'web_worker' for this driver */
  driver: 'web_worker';
}

/**
 * Options for web worker driver spawn
 */
export interface WebWorkerDriverOptions {
  /**
   * Options passed to the Worker constructor.
   * `type` defaults to 'module' if not specified.
   */
  workerOptions?: Omit<WorkerOptions, 'type'> & { type?: WorkerOptions['type'] };
}

/**
 * Channel implementation for web worker driver.
 *
 * Wraps a Worker and a MessagePort to provide the DriverChannel interface.
 * Communication happens through a dedicated MessagePort, not the global
 * postMessage channel.
 */
export class WebWorkerChannel implements DriverChannel {
  private _isConnected: boolean;
  private messageHandlers: Array<(message: DriverMessage) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private shutdownHandlers: Array<(reason: ShutdownReason) => void> = [];

  constructor(
    private readonly worker: Worker,
    private readonly port: MessagePort
  ) {
    this._isConnected = true;

    // Route messages from the dedicated port
    this.port.onmessage = (event: MessageEvent<DriverMessage>) => {
      const message = event.data;
      this.messageHandlers.forEach((handler) => {
        try {
          handler(message);
        } catch {
          // Handler errors are swallowed to prevent breaking the message loop
        }
      });
    };

    this.port.onmessageerror = () => {
      const error = new Error('Failed to deserialize message from worker');
      this.errorHandlers.forEach((handler) => {
        try {
          handler(error);
        } catch {
          // Swallow handler errors
        }
      });
    };

    // Worker error and termination handling
    this.worker.onerror = (event: ErrorEvent) => {
      const error = new Error(event.message);
      this.errorHandlers.forEach((handler) => {
        try {
          handler(error);
        } catch {
          // Swallow handler errors
        }
      });

      const reason: ShutdownReason = { type: 'error', error };
      this.shutdownHandlers.forEach((handler) => {
        try {
          handler(reason);
        } catch {
          // Swallow handler errors
        }
      });
    };
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  /** Web Workers don't have PIDs. Returns undefined. */
  get pid(): number | undefined {
    return undefined;
  }

  async send(message: DriverMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Channel is not connected');
    }
    this.port.postMessage(message);
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

  onShutdown(handler: (reason: ShutdownReason) => void): void {
    this.shutdownHandlers.push(handler);
  }

  async close(): Promise<void> {
    if (!this._isConnected) {
      return;
    }

    this._isConnected = false;
    this.port.close();
    this.worker.terminate();

    this.closeHandlers.forEach((handler) => {
      try {
        handler();
      } catch {
        // Swallow handler errors
      }
    });
  }
}

/**
 * Spawn a web worker and establish a MessageChannel for communication.
 *
 * @param script - URL to the worker script
 * @param options - Spawn options
 * @returns Promise resolving to a WebWorkerChannel
 */
export function spawnWorker(
  script: string | URL,
  options: WebWorkerDriverOptions = {}
): Promise<WebWorkerChannel> {
  if (typeof script === 'string') {
    throw new Error(
      'WebWorkerDriver requires a URL object for the script parameter. ' +
        'Use: new URL("./worker.ts", import.meta.url)'
    );
  }

  const workerOptions = {
    type: 'module' as const,
    ...options.workerOptions,
  };

  const worker = new Worker(script, workerOptions);

  // Create a dedicated MessageChannel for library communication
  const { port1, port2 } = new MessageChannel();

  // Transfer port2 to the worker via the global postMessage
  const initMessage = { type: INIT_MESSAGE_TYPE, port: port2 };
  worker.postMessage(initMessage, [port2]);

  // port1 stays on the host side
  port1.start();

  return Promise.resolve(new WebWorkerChannel(worker, port1));
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd packages/isolated-workers && npx tsc --noEmit`
Expected: PASS (may need to check that DOM types are available — see Task 6)

**Step 3: Commit**

```bash
git add packages/isolated-workers/src/core/drivers/web-worker/host.ts
git commit -m "feat: add WebWorkerDriver host module"
```

---

### Task 4: Create WebWorkerDriver server module

This runs inside the Web Worker. It receives the port from the init handshake and uses it for messaging.

**Files:**
- Create: `packages/isolated-workers/src/core/drivers/web-worker/server.ts`

**Step 1: Write the server channel**

Create file: `packages/isolated-workers/src/core/drivers/web-worker/server.ts`

```typescript
/**
 * Web Worker driver server module
 *
 * Contains server logic for the web worker driver. This module is imported
 * only on the worker side (inside the Web Worker).
 *
 * @packageDocumentation
 */

import type {
  DriverMessage,
  ServerChannel,
} from '../../driver.js';

/** Init message type — must match host.ts */
const INIT_MESSAGE_TYPE = '__iw_init';

/**
 * Function to send a response back to the host
 */
export type ResponseFunction = (response: DriverMessage) => Promise<void>;

/**
 * Web Worker server channel implementation.
 *
 * Wraps a MessagePort received from the host and provides the ServerChannel interface.
 */
export class WebWorkerServerChannel implements ServerChannel {
  private _isRunning = false;
  private messageHandlers: Array<
    (message: DriverMessage, respond: ResponseFunction) => void
  > = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private readonly port: MessagePort;

  constructor(port: MessagePort) {
    this.port = port;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  /** Web Workers don't use socket paths. Returns empty string. */
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
   * Start listening for messages from the host via the dedicated port
   */
  start(): void {
    if (this._isRunning) {
      return;
    }

    this._isRunning = true;

    this.port.onmessage = (event: MessageEvent<DriverMessage>) => {
      const message = event.data;

      const respond: ResponseFunction = async (response: DriverMessage) => {
        this.port.postMessage(response);
      };

      this.messageHandlers.forEach((handler) => {
        try {
          handler(message, respond);
        } catch (err) {
          this.errorHandlers.forEach((errHandler) => {
            try {
              errHandler(err instanceof Error ? err : new Error(String(err)));
            } catch {
              // Swallow handler errors
            }
          });
        }
      });
    };

    this.port.onmessageerror = () => {
      const error = new Error('Failed to deserialize message from host');
      this.errorHandlers.forEach((handler) => {
        try {
          handler(error);
        } catch {
          // Swallow handler errors
        }
      });
    };

    this.port.start();
  }

  async stop(): Promise<void> {
    this._isRunning = false;
    this.port.close();
    // Optionally close the worker itself
    // self.close();
  }
}

/**
 * Wait for the init handshake from the host and create the server channel.
 *
 * The host sends a message via the global `postMessage` channel containing
 * a MessagePort. This function listens for that init message, extracts the
 * port, and returns a WebWorkerServerChannel.
 *
 * @param options - Server options (unused for web worker, reserved for future)
 * @returns Promise resolving to a WebWorkerServerChannel
 */
export function createServer(): Promise<WebWorkerServerChannel> {
  return new Promise<WebWorkerServerChannel>((resolve, reject) => {
    // TypeScript: `self` in a Web Worker context is DedicatedWorkerGlobalScope
    const workerSelf = self as DedicatedWorkerGlobalScope;

    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          'WebWorkerDriver: Timed out waiting for init handshake from host. ' +
            'Ensure the host is using WebWorkerDriver to spawn this worker.'
        )
      );
    }, 30_000);

    workerSelf.onmessage = (event: MessageEvent) => {
      if (event.data?.type === INIT_MESSAGE_TYPE && event.data?.port instanceof MessagePort) {
        clearTimeout(timeoutId);

        const port = event.data.port as MessagePort;

        // Clear the global listener — the library now uses the dedicated port
        workerSelf.onmessage = null;

        const server = new WebWorkerServerChannel(port);
        server.start();
        resolve(server);
      }
    };
  });
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd packages/isolated-workers && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/isolated-workers/src/core/drivers/web-worker/server.ts
git commit -m "feat: add WebWorkerDriver server module"
```

---

### Task 5: Create WebWorkerDriver definition and index

Wire up the driver using `defineWorkerDriver` and create the barrel export.

**Files:**
- Create: `packages/isolated-workers/src/core/drivers/web-worker/driver.ts`
- Create: `packages/isolated-workers/src/core/drivers/web-worker/index.ts`

**Step 1: Write the driver definition**

Create file: `packages/isolated-workers/src/core/drivers/web-worker/driver.ts`

```typescript
/**
 * Web Worker driver - unified driver definition
 *
 * Thin wrapper that uses dynamic imports to load host/server code on demand.
 *
 * @packageDocumentation
 */

import {
  defineWorkerDriver,
  type ServerChannel,
  type ServerOptions,
} from '../../driver.js';
import type { WebWorkerDriverOptions, WebWorkerStartupData } from './host.js';

/**
 * Web Worker driver.
 *
 * Uses the browser's Web Worker API with a dedicated MessageChannel/MessagePort
 * for IPC. Supports SharedArrayBuffer (requires COOP/COEP headers).
 *
 * @example
 * ```typescript
 * import { WebWorkerDriver } from 'isolated-workers/drivers/web-worker';
 *
 * // Host side: spawn a worker
 * const worker = await createWorker<MyMessages>({
 *   script: new URL('./worker.ts', import.meta.url),
 *   driver: WebWorkerDriver,
 * });
 *
 * // Worker side: start server
 * startWorkerServer<MyMessages>(handlers, { driver: WebWorkerDriver });
 * ```
 */
export const WebWorkerDriver = defineWorkerDriver({
  name: 'web_worker' as const,

  /**
   * Spawn a Web Worker (host side)
   *
   * @param script - URL to the worker script (must be a URL object)
   * @param options - Spawn options
   * @returns Promise resolving to a DriverChannel
   */
  async spawn(script: string | URL, options: WebWorkerDriverOptions = {}) {
    const { spawnWorker } = await import('./host.js');
    return spawnWorker(script, options);
  },

  /**
   * Get startup data (server side)
   *
   * For Web Workers, startup data is minimal since there's no env var
   * or workerData mechanism. The driver name is returned.
   *
   * @returns The startup data
   */
  getStartupData(): WebWorkerStartupData {
    return {
      driver: 'web_worker',
    };
  },

  /**
   * Create server channel (server side)
   *
   * Waits for the init handshake from the host, which transfers a
   * MessagePort for dedicated communication.
   *
   * @param _options - Server options (reserved for future use)
   * @returns Promise resolving to a ServerChannel
   */
  async createServer(_options: ServerOptions = {}): Promise<ServerChannel> {
    const { createServer } = await import('./server.js');
    return createServer();
  },

  // Capability method - enables sharedMemory: true
  transferSharedMemory(_buffer: SharedArrayBuffer): void {
    throw new Error(
      'transferSharedMemory() is not yet implemented. ' +
        'SharedArrayBuffer can be passed directly via postMessage with transfer list.'
    );
  },
});

/** Type of the WebWorkerDriver */
export type WebWorkerDriverType = typeof WebWorkerDriver;
```

**Step 2: Write the barrel export**

Create file: `packages/isolated-workers/src/core/drivers/web-worker/index.ts`

```typescript
/**
 * Web Worker driver
 *
 * @packageDocumentation
 */

// Main driver export
export { WebWorkerDriver, type WebWorkerDriverType } from './driver.js';

// Host-side exports (for advanced usage)
export {
  spawnWorker,
  WebWorkerChannel,
  type WebWorkerDriverOptions,
  type WebWorkerStartupData,
} from './host.js';

// Server-side exports (for advanced usage)
export {
  createServer,
  WebWorkerServerChannel,
  type ResponseFunction,
} from './server.js';
```

**Step 3: Verify TypeScript compiles**

Run: `cd packages/isolated-workers && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/isolated-workers/src/core/drivers/web-worker/
git commit -m "feat: add WebWorkerDriver definition and barrel export"
```

---

### Task 6: Update package exports and drivers index

Wire the new driver into the package's export map and the drivers barrel.

**Files:**
- Modify: `packages/isolated-workers/package.json` (exports section)
- Modify: `packages/isolated-workers/src/core/drivers/index.ts`
- Modify: `packages/isolated-workers/src/core/driver.ts` (re-export WebWorkerCapabilities)

**Step 1: Add export to package.json**

In `packages/isolated-workers/package.json`, add after the `./drivers/http` export (line 44):

```json
    "./drivers/web-worker": {
      "import": "./dist/core/drivers/web-worker/index.js",
      "types": "./dist/core/drivers/web-worker/index.d.ts",
      "default": "./dist/core/drivers/web-worker/index.js"
    }
```

**Step 2: Add to drivers index**

In `packages/isolated-workers/src/core/drivers/index.ts`, add after the HTTP driver exports (after line 68):

```typescript
// Web Worker driver
export {
  WebWorkerChannel,
  WebWorkerDriver,
  WebWorkerServerChannel,
  type WebWorkerDriverOptions,
  type WebWorkerDriverType,
  type ResponseFunction as WebWorkerResponseFunction,
  type WebWorkerStartupData,
} from './web-worker/index.js';
```

**Step 3: Export WebWorkerCapabilities from driver.ts**

Verify that `WebWorkerCapabilities` is already exported (it will be since it's at module level). Then ensure it's re-exported from the drivers barrel in `packages/isolated-workers/src/core/drivers/index.ts` — add `WebWorkerCapabilities` to the re-export list from `../driver.js`.

**Step 4: Update DriverOptionsFor type**

In `packages/isolated-workers/src/core/worker.ts`, update the `DriverOptionsFor` type (around line 98) to include WebWorkerCapabilities:

```typescript
import type { WebWorkerCapabilities } from './driver.js';
import type { WebWorkerDriverOptions } from './drivers/web-worker/index.js';

export type DriverOptionsFor<TDriver extends Driver> =
  TDriver extends Driver<ChildProcessCapabilities>
    ? ChildProcessDriverOptions
    : TDriver extends Driver<WorkerThreadsCapabilities>
    ? WorkerThreadsDriverOptions
    : TDriver extends Driver<WebWorkerCapabilities>
    ? WebWorkerDriverOptions
    : Record<string, unknown>;
```

**Step 5: Verify build**

Run: `cd packages/isolated-workers && npx tsc --noEmit`
Expected: PASS

**Step 6: Run full test suite**

Run: `cd packages/isolated-workers && npx vitest run`
Expected: All existing tests still pass

**Step 7: Commit**

```bash
git add packages/isolated-workers/package.json packages/isolated-workers/src/core/drivers/index.ts packages/isolated-workers/src/core/driver.ts packages/isolated-workers/src/core/worker.ts
git commit -m "feat: wire WebWorkerDriver into package exports and driver index"
```

---

### Task 7: TypeScript environment configuration for DOM types

The Web Worker driver uses browser APIs (Worker, MessageChannel, MessagePort, DedicatedWorkerGlobalScope). The existing tsconfig targets Node. We need to ensure these types are available without breaking Node-only code.

**Files:**
- Modify: `packages/isolated-workers/tsconfig.lib.json` (or tsconfig.json)

**Step 1: Check current tsconfig**

Read `packages/isolated-workers/tsconfig.lib.json` and check the `lib` and `types` configuration.

**Step 2: Add WebWorker lib**

In the tsconfig that builds the library, add `"WebWorker"` to the `lib` array. This provides `Worker`, `MessageChannel`, `MessagePort`, `DedicatedWorkerGlobalScope`, etc. If `lib` isn't set, add:

```json
{
  "compilerOptions": {
    "lib": ["ES2022", "WebWorker"]
  }
}
```

Note: `"WebWorker"` includes types for `self`, `MessagePort`, `MessageChannel`, `Worker`, etc. It does NOT include DOM types, so it won't pollute Node code with `document` or `window`. If there are conflicts with `@types/node`, you may need to use triple-slash directives in the web-worker files instead:

```typescript
/// <reference lib="webworker" />
```

This is the safer approach — add the reference only in the web-worker driver files that need it, rather than globally.

**Step 3: Verify build**

Run: `cd packages/isolated-workers && npx tsc --noEmit`
Expected: PASS — no type errors in web-worker files or existing Node files

**Step 4: Commit**

```bash
git add packages/isolated-workers/tsconfig.lib.json
git commit -m "chore: add WebWorker lib types for browser driver"
```

---

### Task 8: Unit tests for WebWorkerDriver

Since Web Worker APIs aren't available in Node, these tests mock the browser APIs to verify channel behavior.

**Files:**
- Create: `packages/isolated-workers/src/core/drivers/web-worker/__tests__/host.spec.ts`
- Create: `packages/isolated-workers/src/core/drivers/web-worker/__tests__/server.spec.ts`
- Create: `packages/isolated-workers/src/core/drivers/web-worker/__tests__/driver.spec.ts`

**Step 1: Write host channel tests**

Create file: `packages/isolated-workers/src/core/drivers/web-worker/__tests__/host.spec.ts`

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { DriverMessage } from '../../../driver.js';
import { WebWorkerChannel } from '../host.js';

// Mock Worker and MessagePort
function createMockPort(): MessagePort {
  const port = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    onmessageerror: null as ((event: MessageEvent) => void) | null,
    postMessage: vi.fn(),
    close: vi.fn(),
    start: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  };
  return port as unknown as MessagePort;
}

function createMockWorker(): Worker {
  const worker = {
    onerror: null as ((event: ErrorEvent) => void) | null,
    onmessage: null as ((event: MessageEvent) => void) | null,
    onmessageerror: null as ((event: MessageEvent) => void) | null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  };
  return worker as unknown as Worker;
}

describe('WebWorkerChannel', () => {
  let mockWorker: Worker;
  let mockPort: MessagePort;
  let channel: WebWorkerChannel;

  beforeEach(() => {
    mockWorker = createMockWorker();
    mockPort = createMockPort();
    channel = new WebWorkerChannel(mockWorker, mockPort);
  });

  test('starts connected', () => {
    expect(channel.isConnected).toBe(true);
  });

  test('pid is undefined', () => {
    expect(channel.pid).toBeUndefined();
  });

  test('send posts message to port', async () => {
    const message: DriverMessage = { type: 'ping', payload: {}, tx: '1' };
    await channel.send(message);
    expect(mockPort.postMessage).toHaveBeenCalledWith(message);
  });

  test('send throws when disconnected', async () => {
    await channel.close();
    const message: DriverMessage = { type: 'ping', payload: {}, tx: '1' };
    await expect(channel.send(message)).rejects.toThrow('not connected');
  });

  test('routes incoming port messages to handlers', () => {
    const handler = vi.fn();
    channel.onMessage(handler);

    const message: DriverMessage = { type: 'pong', payload: {}, tx: '1' };
    // Simulate port receiving a message
    (mockPort.onmessage as (event: MessageEvent) => void)?.({
      data: message,
    } as MessageEvent);

    expect(handler).toHaveBeenCalledWith(message);
  });

  test('close terminates worker and closes port', async () => {
    const closeHandler = vi.fn();
    channel.onClose(closeHandler);

    await channel.close();

    expect(mockPort.close).toHaveBeenCalled();
    expect(mockWorker.terminate).toHaveBeenCalled();
    expect(channel.isConnected).toBe(false);
    expect(closeHandler).toHaveBeenCalled();
  });

  test('close is idempotent', async () => {
    await channel.close();
    await channel.close();
    expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run tests**

Run: `cd packages/isolated-workers && npx vitest run src/core/drivers/web-worker/__tests__/host.spec.ts`
Expected: PASS

**Step 3: Write driver definition tests**

Create file: `packages/isolated-workers/src/core/drivers/web-worker/__tests__/driver.spec.ts`

```typescript
import { describe, test, expect, expectTypeOf } from 'vitest';
import { WebWorkerDriver } from '../driver.js';
import type { WebWorkerCapabilities } from '../../../driver.js';

describe('WebWorkerDriver', () => {
  test('has correct name', () => {
    expect(WebWorkerDriver.name).toBe('web_worker');
  });

  test('has correct capabilities', () => {
    expect(WebWorkerDriver.capabilities).toEqual({
      reconnect: false,
      detach: false,
      sharedMemory: true,
    });
  });

  test('capabilities type matches WebWorkerCapabilities', () => {
    expectTypeOf(WebWorkerDriver.capabilities).toMatchTypeOf<WebWorkerCapabilities>();
  });

  test('getStartupData returns web_worker driver identifier', () => {
    const data = WebWorkerDriver.getStartupData();
    expect(data.driver).toBe('web_worker');
  });
});
```

**Step 4: Run tests**

Run: `cd packages/isolated-workers && npx vitest run src/core/drivers/web-worker/__tests__/driver.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/isolated-workers/src/core/drivers/web-worker/__tests__/
git commit -m "test: add unit tests for WebWorkerDriver"
```

---

### Task 9: Add web-worker example

Create a minimal example showing browser usage.

**Files:**
- Create: `examples/web-worker/messages.ts`
- Create: `examples/web-worker/host.ts`
- Create: `examples/web-worker/worker.ts`
- Create: `examples/web-worker/meta.yml`

**Step 1: Create message definitions**

Create file: `examples/web-worker/messages.ts`

```typescript
import type { DefineMessages } from 'isolated-workers';

export type Messages = DefineMessages<{
  compute: {
    payload: { value: number };
    result: { doubled: number };
  };
}>;
```

**Step 2: Create host file**

Create file: `examples/web-worker/host.ts`

```typescript
import { createWorker } from 'isolated-workers';
import { WebWorkerDriver } from 'isolated-workers/drivers/web-worker';
import type { Messages } from './messages.js';

async function main() {
  const worker = await createWorker<Messages>({
    script: new URL('./worker.ts', import.meta.url),
    driver: WebWorkerDriver,
  });

  try {
    const result = await worker.send('compute', { value: 21 });
    console.log('Result:', result.doubled); // 42
  } finally {
    await worker.close();
  }
}

main().catch(console.error);
```

**Step 3: Create worker file**

Create file: `examples/web-worker/worker.ts`

```typescript
import { startWorkerServer, type Handlers } from 'isolated-workers';
import { WebWorkerDriver } from 'isolated-workers/drivers/web-worker';
import type { Messages } from './messages.js';

const handlers: Handlers<Messages> = {
  compute: ({ value }) => {
    return { doubled: value * 2 };
  },
};

startWorkerServer<Messages>(handlers, {
  driver: WebWorkerDriver,
});
```

**Step 4: Create meta.yml**

Create file: `examples/web-worker/meta.yml`

```yaml
title: Web Worker Driver
description: |
  Demonstrates using isolated-workers in a browser environment with Web Workers.
  The host page spawns a Web Worker and communicates via a dedicated MessagePort.
include:
  - messages.ts
  - host.ts
  - worker.ts
```

**Step 5: Commit**

```bash
git add examples/web-worker/
git commit -m "docs: add web-worker example"
```

---

### Task 10: Verify full build and test suite

Final verification that everything works together.

**Files:** None (verification only)

**Step 1: Run full build**

Run: `pnpm nx run-many -t lint,build`
Expected: PASS

**Step 2: Run full test suite**

Run: `pnpm nx run-many -t test`
Expected: All tests pass, including new web-worker driver tests

**Step 3: Run e2e tests**

Run: `pnpm nx run-many -t e2e`
Expected: Existing e2e tests still pass. The web-worker example won't have an e2e test yet (requires browser environment / Playwright).

**Step 4: Commit any fixups**

If any issues were found and fixed during verification, commit them:

```bash
git add -A
git commit -m "fix: address issues found during full verification"
```
