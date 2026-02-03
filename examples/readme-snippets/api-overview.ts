/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * API overview examples for README - these snippets are type-checked
 */

// #region type-helpers
import type {
  DefineMessages, // Extract result type
  Handlers, // Define message contracts
  MessageOf, // Extract message type
  PayloadOf, // Extract payload type
  ResultOf, // Extract result type
} from 'isolated-workers';
// #endregion type-helpers

// Verify the imports work by using them
type TestMessages = DefineMessages<{
  test: { payload: { x: number }; result: { y: number } };
}>;

type TestPayload = PayloadOf<TestMessages, 'test'>;
type TestResult = ResultOf<TestMessages, 'test'>;
type TestMessage = MessageOf<TestMessages, 'test'>;
type TestHandlers = Handlers<TestMessages>;
