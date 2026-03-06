# ADR 012: Cross-Environment Web Worker Driver

## Status

Accepted

## Context

The isolated-workers library currently supports only Node.js environments with three drivers: child-process (Unix sockets), worker-threads (MessagePort), and HTTP. Users want to run CPU-intensive tasks off the main thread in browser applications and write environment-agnostic worker code.

The existing Driver abstraction (`Driver<TCapabilities, TOptions>` + `DriverChannel` + `ServerChannel`) is the extension point. The core (`createWorker`, `startWorkerServer`, `DefineMessages`, middleware, transaction IDs) is already transport-agnostic.

## Decision

### 1. Add a Web Worker driver as a new entry point

Add `isolated-workers/drivers/web-worker` following the same pattern as existing drivers. Same package, new export path — no separate package.

**Why not a separate package?** The driver is a single-file implementation following the existing pattern. A separate package adds publishing and versioning overhead for minimal benefit.

**Why not auto-detection?** An auto-detect driver that picks based on `typeof window` adds ambiguity (SSR? Deno? Bun?) and complexity. Explicit driver imports are the established pattern and work well with tree-shaking.

### 2. Use MessageChannel for communication (not global postMessage)

The host creates a `MessageChannel`, transfers one port to the worker via the global `postMessage`, then all library messaging goes through the dedicated port.

**Why not global postMessage?** Keeps the global channel free for other uses (logging, metrics, debugging). Consistent with the worker-threads driver which also uses MessagePort. More future-proof for multi-channel scenarios.

### 3. Use structured clone (no JSON serializer)

The Web Worker driver uses `postMessage`'s built-in structured clone algorithm, matching the worker-threads driver approach.

**Why not JSON serializer?** MessagePort.postMessage already handles serialization. JSON adds unnecessary overhead and loses support for transferable objects (ArrayBuffer, ImageBitmap, etc.) which are valuable for the CPU-intensive browser use case.

### 4. Script parameter becomes `string | URL`

All drivers accept `string | URL` for the script parameter. Node drivers convert `file://` URLs to paths via `fileURLToPath`. The Web Worker driver requires `URL` and rejects strings with a clear error.

**Why require URL for Web Workers?** Bundlers (Vite, webpack, esbuild) rely on the `new URL('./worker.ts', import.meta.url)` pattern for static analysis and worker bundling. Accepting strings would bypass this and lead to runtime failures.

### 5. Capabilities: `{ reconnect: false, detach: false, sharedMemory: true }`

- `reconnect: false` — MessagePort cannot disconnect/reconnect like sockets
- `detach: false` — Web Workers cannot outlive the page
- `sharedMemory: true` — SharedArrayBuffer is supported (requires COOP/COEP headers)

Transferable support (`ArrayBuffer`, etc.) is available via `postMessage`'s transfer list but is not exposed as a capability flag. It can be added later if needed.

## Consequences

- The package needs multiple entry points with environment-aware exports in `package.json`
- No changes to the core API surface — `createWorker` and `startWorkerServer` remain unchanged
- Existing Node driver behavior is fully preserved (non-breaking)
- E2E testing for the Web Worker driver requires a real browser environment (Playwright or similar)
- Documentation must cover bundler integration patterns and COOP/COEP requirements for SharedArrayBuffer
