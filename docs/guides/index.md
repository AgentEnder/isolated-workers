---
title: Guides
description: In-depth guides for isolated-workers
nav:
  section: Guides
  order: 0
---

# Guides

These guides provide in-depth coverage of specific isolated-workers topics.

## Core Concepts

### [Error Handling](/docs/guides/error-handling)

Learn how errors thrown in worker processes propagate back to the host, including error serialization across process boundaries, proper try/catch patterns, and error message preservation.

### [Worker Lifecycle](/docs/guides/worker-lifecycle)

Managing worker state, status checks, and graceful shutdown. Learn about state persistence across messages, health checks, and proper cleanup patterns.

## Configuration

### [Timeout Configuration](/docs/guides/timeout-configuration)

Configure timeouts for worker startup, connection, and per-message-type operations. Essential for long-running tasks and responsive health checks.

### [Shutdown Handling](/docs/guides/shutdown-handling)

Configure how workers handle unexpected crashes (OOM, SIGKILL, hard crashes). Learn about crash detection, reject/retry strategies, and per-message-type overrides for handling pending operations.

### [Custom Serializers](/docs/guides/custom-serializers)

Use custom serialization for binary formats like MessagePack, add compression, or implement encryption for sensitive data crossing process boundaries.

## Advanced Patterns

### [Middleware](/docs/guides/middleware)

Intercept and transform messages with middleware pipelines. Useful for logging, validation, timing, and adding metadata to messages.

### [Testing Workers](/docs/guides/testing)

Strategies for testing worker-based code. Covers unit testing handlers in isolation, integration testing with real workers, mocking workers for host-side tests, and CI considerations.

### [Security Considerations](/docs/guides/security)

Security best practices for worker-based applications. Understand what isolation process separation provides, socket security, message validation, and when additional sandboxing is needed.
