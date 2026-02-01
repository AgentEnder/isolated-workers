# Basic Ping-Pong Worker

This example demonstrates the fundamental request/response pattern with isolated-workers.

## Overview

The ping-pong example shows:

- How to define message types using `DefineMessages`
- How to spawn a worker process
- How to send messages and receive responses
- Proper cleanup and shutdown

## Files

### Shared Message Definitions

First, define the message types in a shared file that both host and worker import:

{% file messages.ts %}

### Host (Client)

The host imports the message types and uses them with `createWorker<Messages>()`:

{% file host.ts %}

### Worker

The worker imports the same message types and uses `Handlers<Messages>` for type-safe handlers:

{% file worker.ts %}

## Running the Example

```bash
pnpm nx run examples:run-example --example=basic-ping
```

## Key Concepts

1. **Message Definitions**: Type-safe messages using `DefineMessages<T>`
2. **Worker Spawning**: Creating a worker with `createWorker()`
3. **Message Exchange**: Sending and receiving with automatic correlation
4. **Cleanup**: Graceful shutdown with `worker.close()`
