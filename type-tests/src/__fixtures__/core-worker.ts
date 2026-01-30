/**
 * Fixture: Core Worker Type Safety
 *
 * This file validates that the core worker implementation maintains
 * type safety throughout the worker lifecycle.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type {
  DefineMessages,
  WorkerClient,
  WorkerOptions,
  TimeoutConfig,
  Connection,
  ConnectionOptions,
  Middleware,
  MiddlewareContext,
  MiddlewareDirection,
  TypedMessage,
  TypedResult,
  MessageHandler,
} from 'isolated-workers';

// ============================================================================
// Message Definitions for Worker Testing
// ============================================================================

type ComputeMessages = DefineMessages<{
  add: {
    payload: { a: number; b: number };
    result: { sum: number };
  };
  multiply: {
    payload: { a: number; b: number };
    result: { product: number };
  };
  notify: {
    payload: { message: string };
    // No result - fire and forget
  };
}>;

// ============================================================================
// WorkerClient Type Safety Tests
// ============================================================================

// Test: WorkerClient type should enforce correct payload types
declare const workerClient: WorkerClient<ComputeMessages>;

// Valid: Send with correct payload type
const _validAdd = workerClient.send('add', { a: 1, b: 2 });
const _validMultiply = workerClient.send('multiply', { a: 3, b: 4 });
const _validNotify = workerClient.send('notify', { message: 'hello' });

// Test: Return types should be inferred correctly
async function testReturnTypes() {
  // add returns { sum: number }
  const addResult = await workerClient.send('add', { a: 1, b: 2 });
  const _sumCheck: number = addResult.sum;

  // multiply returns { product: number }
  const multiplyResult = await workerClient.send('multiply', { a: 3, b: 4 });
  const _productCheck: number = multiplyResult.product;

  // notify returns void (no result)
  const notifyResult = await workerClient.send('notify', { message: 'test' });
  const _voidCheck: void = notifyResult;
}

// Test: WorkerClient properties
const _pidCheck: number = workerClient.pid;
const _activeCheck: boolean = workerClient.isActive;
const _workerCloseCheck: Promise<void> = workerClient.close();

// ============================================================================
// WorkerOptions Type Tests
// ============================================================================

// Test: WorkerOptions interface structure
const _workerOptions1: WorkerOptions = {
  script: './worker.js',
};

const _workerOptions2: WorkerOptions = {
  script: './worker.js',
  env: { NODE_ENV: 'production' },
  timeout: 30000,
  socketPath: '/tmp/test.sock',
  debug: true,
};

// ============================================================================
// Connection and ConnectionOptions Type Tests
// ============================================================================

// Test: ConnectionOptions interface structure
const _connectionOptions1: ConnectionOptions = {
  socketPath: '/tmp/test.sock',
};

const _connectionOptions2: ConnectionOptions = {
  socketPath: '/tmp/test.sock',
  reconnect: true,
  maxRetries: 10,
  retryDelay: 500,
  maxDelay: 5000,
  timeout: 60000,
};

// Test: ConnectionOptions with custom delay function
const _connectionOptions3: ConnectionOptions = {
  socketPath: '/tmp/test.sock',
  retryDelay: (attempt) => attempt * 100,
};

// Test: Connection interface structure (using a mock)
declare const mockConnection: Connection;
const _socketCheck = mockConnection.socket;
const _isConnectedCheck: boolean = mockConnection.isConnected;
const _sendCheck: Promise<void> = mockConnection.send({} as TypedMessage);
const _connCloseCheck: Promise<void> = mockConnection.close();

// ============================================================================
// Messaging Types Tests
// ============================================================================

// Test: TypedMessage structure
const _typedMessage: TypedMessage<{ data: string }> = {
  type: 'test',
  payload: { data: 'value' },
  tx: 'transaction-id',
};

// Test: TypedResult structure
const _typedResult: TypedResult<{ result: number }> = {
  type: 'testResult',
  payload: { result: 42 },
  tx: 'transaction-id',
};

// Test: MessageHandler type
const _handler: MessageHandler = async (payload) => {
  return { processed: true };
};

// ============================================================================
// Middleware Type Tests
// ============================================================================

// Test: MiddlewareDirection type - using const assertion to get literal types
const _incomingDirection = 'incoming' as const;
const _outgoingDirection = 'outgoing' as const;

// Legacy MiddlewareDirection (deprecated but still exported)
const _sendDirection = 'send' as const;
const _receiveDirection = 'receive' as const;

// Test: MiddlewareContext interface (deprecated legacy API)
const _middlewareContext: MiddlewareContext = {
  direction: 'send',
  message: { type: 'test', payload: {} },
};

// Test: New Middleware function type with (message, direction) signature
const _middleware: Middleware<ComputeMessages> = (message, direction) => {
  if (direction === 'incoming') {
    return message;
  }
  return message;
};

const _asyncMiddleware: Middleware<ComputeMessages> = async (
  message,
  direction
) => {
  return message;
};

const _asyncNewMiddleware: Middleware<ComputeMessages> = async (
  message,
  direction
) => {
  return message;
};

// ============================================================================
// Compile-time Type Checks
// ============================================================================

// Verify WorkerClient send returns Promise with correct result type
type _AddResultPromise = ReturnType<
  WorkerClient<ComputeMessages>['send']
> extends Promise<{ sum: number }>
  ? true
  : never;
const _addResultCheck: _AddResultPromise = true;

// Verify notify (no result) returns Promise<void>
type _NotifyResultPromise = ReturnType<
  WorkerClient<ComputeMessages>['send']
> extends Promise<void>
  ? true
  : never;
// This should be true for the 'notify' message specifically
type _NotifySpecificResult = Awaited<
  ReturnType<WorkerClient<ComputeMessages>['send']>
> extends void
  ? true
  : never;

// Verify TypedMessage has required properties
type _TypedMessageCheck = TypedMessage<{ data: string }> extends {
  type: string;
  payload: { data: string };
  tx: string;
}
  ? true
  : never;
const _typedMessageCheck: _TypedMessageCheck = true;

// Verify TypedResult has required properties
type _TypedResultCheck = TypedResult<{ result: number }> extends {
  type: string;
  payload: { result: number };
  tx: string;
}
  ? true
  : never;
const _typedResultCheck: _TypedResultCheck = true;

// Verify MiddlewareContext structure
type _MiddlewareContextCheck = MiddlewareContext extends {
  direction: MiddlewareDirection;
  message: unknown;
}
  ? true
  : never;
const _middlewareContextCheck: _MiddlewareContextCheck = true;

// Verify Connection interface has required methods
type _ConnectionCheck = Connection extends {
  send: (message: TypedMessage) => Promise<void>;
  onMessage: (handler: (message: TypedResult) => void) => void;
  onError: (handler: (error: Error) => void) => void;
  onClose: (handler: () => void) => void;
  close: () => Promise<void>;
  isConnected: boolean;
}
  ? true
  : never;
const _connectionCheck: _ConnectionCheck = true;

// Verify WorkerOptions has required properties
// Note: timeout can be number | TimeoutConfig<TDefs>
type _WorkerOptionsCheck = WorkerOptions extends {
  script: string;
  env?: Record<string, string>;
  timeout?: number | TimeoutConfig;
  socketPath?: string;
  debug?: boolean;
}
  ? true
  : never;
const _workerOptionsCheck: _WorkerOptionsCheck = true;

// Verify ConnectionOptions has required properties
// Note: retryDelay can be number | ((attempt: number) => number)
type _ConnectionOptionsCheck = Required<ConnectionOptions> extends {
  socketPath: string;
  reconnect: boolean;
  maxRetries: number;
  retryDelay: number | ((attempt: number) => number);
  maxDelay: number;
  timeout: number;
}
  ? true
  : never;
const _connectionOptionsCheck: _ConnectionOptionsCheck = true;
