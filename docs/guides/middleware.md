---
title: Middleware
description: Intercept and transform messages with middleware pipelines
nav:
  section: Guides
  order: 2
---

# Middleware

Middleware allows you to intercept, inspect, and transform messages as they flow between host and worker. This is useful for logging, validation, timing, and adding metadata.

## How Middleware Works

Middleware functions receive each message and a direction indicator (`'outgoing'` or `'incoming'`). They can:

- **Inspect** messages for debugging/logging
- **Transform** messages by returning modified versions (or return void to leave unchanged)
- **Validate** message structure before processing
- **Track** timing and performance metrics

Middleware is applied in order, creating a pipeline where each function processes the message before passing it to the next.

### Message Sealing

Messages are sealed (frozen) before being passed to middleware. You can modify existing message properties but cannot add new ones.

## Creating Middleware

A middleware function has the signature:

```typescript
type Middleware<T> = (
  message: AnyMessage<T>,
  direction: 'outgoing' | 'incoming'
) => AnyMessage<T> | void | Promise<AnyMessage<T> | void>;
```

Returning void passes the original message through unchanged.

Here's a logging middleware that tracks all message traffic:

{% example middleware:host.ts#logging-middleware %}

You can also create middleware that tracks timing:

{% example middleware:host.ts#timing-middleware %}

## Using Middleware on the Host

Pass middleware to `createWorker` as an array. Middleware executes in array order:

{% example middleware:host.ts#create-worker-with-middleware %}

## Using Middleware on the Worker

Workers also support middleware pipelines:

{% example middleware:worker.ts#worker-middleware %}

Configure it when starting the worker server:

{% example middleware:worker.ts#start-worker-with-middleware %}

## Middleware Use Cases

### Logging and Debugging

Log all messages for debugging during development:

```typescript
const debugMiddleware: Middleware<Messages> = (message, direction) => {
  console.log(
    `[${direction}] ${message.type}:`,
    JSON.stringify(message.payload)
  );
  return message;
};
```

### Read-Only Middleware

For middleware that only inspects messages without modification, you can return void:

```typescript
const debugMiddleware: Middleware<Messages> = (message, direction) => {
  console.log(
    `[${direction}] ${message.type}:`,
    JSON.stringify(message.payload)
  );
  // Returning void is equivalent to returning the original message
  // No modification needed
};
```

This pattern is useful for logging, monitoring, and debugging without affecting message flow.

### Validation

Validate message structure before processing:

```typescript
const validationMiddleware: Middleware<Messages> = (message, direction) => {
  if (direction === 'outgoing' && !message.payload) {
    throw new Error(`Message ${message.type} missing payload`);
  }
  return message;
};
```

### Adding Metadata

Add tracing IDs or timestamps to messages:

```typescript
const tracingMiddleware: Middleware<Messages> = (message, direction) => {
  if (direction === 'outgoing') {
    return {
      ...message,
      payload: {
        ...message.payload,
        _traceId: crypto.randomUUID(),
      },
    };
  }
  return message;
};
```

## Order of Execution

For **outgoing** messages, middleware executes in array order:

```
[middleware1, middleware2, middleware3]
     ↓           ↓           ↓
  first       second       third
```

For **incoming** messages, the same order applies - no automatic reversal.

## See Also

- {% example-link middleware %} - Complete middleware example
- [Error Handling](/docs/guides/error-handling) - How errors propagate through the system
