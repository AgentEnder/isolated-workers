# Phase 15: Cross-Environment Web Worker Driver

## Overview

Make isolated-workers work cross-execution-environment in the web/Node sense. The library currently supports Node.js only with three drivers (child-process, worker-threads, HTTP). This plan adds a Web Worker driver for browser environments and reorganizes the package entry points so consumers can write environment-agnostic worker code.

## Dependencies

- Plan 9 (Driver Abstraction) - Completed
- Plan 10 (Driver Server Symmetry) - Completed

## Key Requirements

### Functional Requirements

- A new `WebWorkerDriver` that uses the browser's `Worker` API + `MessageChannel` for communication
- The `script` parameter accepts `string | URL` across all drivers
- Node drivers accept `file://` URLs (converted via `fileURLToPath`)
- The Web Worker driver requires `URL` objects (for bundler static analysis compatibility)
- Communication uses a dedicated `MessagePort` (not the global `postMessage` channel)
- The host transfers a port to the worker via the global channel during initialization, then all library messaging goes through the dedicated port
- Structured clone for serialization (no JSON serializer needed, matching worker-threads approach)

### Non-Functional Requirements

- No changes to the core `createWorker()` / `startWorkerServer()` APIs
- Existing Node drivers remain unchanged in behavior (non-breaking)
- The type system (DefineMessages, helpers, middleware) stays fully agnostic
- Package exports are organized by environment: agnostic core, Node-only drivers, browser-only driver

## Architecture

### Entry Points

```
isolated-workers              -> Agnostic core (types, createWorker, startWorkerServer, messaging)
isolated-workers/drivers/child-process   -> Node-only
isolated-workers/drivers/worker-threads  -> Node-only
isolated-workers/drivers/http            -> Node-only
isolated-workers/drivers/web-worker      -> Browser-only (NEW)
```

### Web Worker Driver — Host Side

1. `new Worker(url, { type: 'module' })` creates the worker
2. `new MessageChannel()` creates a port pair (port1, port2)
3. Host sends port2 to the worker via global `postMessage` with transfer list
4. All subsequent messaging goes through port1 (host) <-> port2 (worker)
5. `DriverChannel` wraps port1

### Web Worker Driver — Server Side

1. Worker listens on `self.onmessage` for the init handshake (`__iw_init`)
2. Receives port2 from the init message
3. Calls `port.start()` and routes messages through the port
4. Clears `self.onmessage` to free the global channel
5. `ServerChannel` wraps port2

### Capabilities

```ts
{ reconnect: false, detach: false, sharedMemory: true }
```

- `reconnect: false` — MessagePort cannot disconnect/reconnect
- `detach: false` — Web Workers cannot outlive the page
- `sharedMemory: true` — SharedArrayBuffer supported (with COOP/COEP headers)

### Script Parameter Changes

- Core type changes from `string` to `string | URL`
- Node drivers: `string` used as-is; `URL` with `file://` converted via `fileURLToPath`; other protocols throw
- Web Worker driver: `URL` passed to `new Worker(url)`; `string` rejected with clear error pointing to `new URL()` pattern

## Success Criteria

- [ ] `WebWorkerDriver` follows the `defineWorkerDriver` pattern with host + server modules
- [ ] Communication uses `MessageChannel` / `MessagePort` (not global postMessage)
- [ ] Structured clone used for serialization (no JSON serializer)
- [ ] `script` parameter accepts `string | URL` across all drivers
- [ ] Node drivers handle `file://` URLs correctly
- [ ] Package exports include `./drivers/web-worker` entry point
- [ ] Existing Node driver tests continue to pass (non-breaking)
- [ ] Type tests validate the Web Worker driver's capability narrowing
- [ ] E2E test runs in a real browser environment (Playwright)
- [ ] Example demonstrating browser usage exists

## Edge Cases

- What happens if the worker script URL is invalid or 404s? The `Worker` constructor throws — map to `onError`
- What if the init handshake message is never received? Server-side timeout needed
- What about `SharedArrayBuffer` requiring COOP/COEP headers? Document this requirement; not a library concern
- What about bundler compatibility (Vite, webpack, esbuild)? The `new URL('./worker.ts', import.meta.url)` pattern is widely supported — document recommended usage
- What if `self.onmessage` is already set by user code before `startWorkerServer`? The init listener overwrites it temporarily, then clears itself — document this

## Open Questions

1. Should there be an example that works with a specific bundler (Vite?) to validate the full workflow?
2. Should the E2E test infrastructure use Playwright, or is there a lighter option?
