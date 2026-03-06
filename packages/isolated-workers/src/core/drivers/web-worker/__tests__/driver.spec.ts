/**
 * Unit tests for WebWorkerDriver definition
 *
 * Tests the driver metadata, capabilities, and startup data.
 */
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

  test('getStartupData() returns driver identifier', () => {
    const data = WebWorkerDriver.getStartupData();
    expect(data).toEqual({ driver: 'web_worker' });
  });

  test('capabilities match WebWorkerCapabilities type', () => {
    expectTypeOf(WebWorkerDriver.capabilities).toMatchTypeOf<WebWorkerCapabilities>();
  });

  test('capabilities.reconnect is false', () => {
    expectTypeOf(WebWorkerDriver.capabilities.reconnect).toEqualTypeOf<false>();
  });

  test('capabilities.detach is false', () => {
    expectTypeOf(WebWorkerDriver.capabilities.detach).toEqualTypeOf<false>();
  });

  test('capabilities.sharedMemory is true', () => {
    expectTypeOf(WebWorkerDriver.capabilities.sharedMemory).toEqualTypeOf<true>();
  });

  test('has spawn method', () => {
    expect(typeof WebWorkerDriver.spawn).toBe('function');
  });

  test('has createServer method', () => {
    expect(typeof WebWorkerDriver.createServer).toBe('function');
  });
});
