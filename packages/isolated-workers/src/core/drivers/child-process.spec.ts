/**
 * Tests for child process driver
 */
import { describe, test, expect } from 'vitest';
import {
  ChildProcessDriver,
  childProcessDriver,
} from './child-process.js';

describe('ChildProcessDriver', () => {
  describe('driver properties', () => {
    test('has correct name', () => {
      const driver = new ChildProcessDriver();
      expect(driver.name).toBe('child_process');
    });

    test('singleton instance has correct name', () => {
      expect(childProcessDriver.name).toBe('child_process');
    });
  });

  describe('capabilities', () => {
    test('has correct capabilities', () => {
      const driver = new ChildProcessDriver();
      expect(driver.capabilities).toEqual({
        reconnect: true,
        detach: true,
        sharedMemory: false,
      });
    });

    test('reconnect capability is true', () => {
      const driver = new ChildProcessDriver();
      expect(driver.capabilities.reconnect).toBe(true);
    });

    test('detach capability is true', () => {
      const driver = new ChildProcessDriver();
      expect(driver.capabilities.detach).toBe(true);
    });

    test('sharedMemory capability is false', () => {
      const driver = new ChildProcessDriver();
      expect(driver.capabilities.sharedMemory).toBe(false);
    });

    test('capabilities object structure is correct', () => {
      const driver = new ChildProcessDriver();
      const caps = driver.capabilities;

      // Check that all expected keys exist
      expect(caps).toHaveProperty('reconnect');
      expect(caps).toHaveProperty('detach');
      expect(caps).toHaveProperty('sharedMemory');

      // Check types
      expect(typeof caps.reconnect).toBe('boolean');
      expect(typeof caps.detach).toBe('boolean');
      expect(typeof caps.sharedMemory).toBe('boolean');
    });

    test('singleton instance has same capabilities', () => {
      expect(childProcessDriver.capabilities).toEqual({
        reconnect: true,
        detach: true,
        sharedMemory: false,
      });
    });
  });

  describe('implements Driver interface', () => {
    test('has spawn method', () => {
      const driver = new ChildProcessDriver();
      expect(typeof driver.spawn).toBe('function');
    });

    test('has readonly name property', () => {
      const driver = new ChildProcessDriver();
      // TypeScript enforces readonly, but we can verify it exists
      expect(driver.name).toBeDefined();
    });

    test('has readonly capabilities property', () => {
      const driver = new ChildProcessDriver();
      expect(driver.capabilities).toBeDefined();
    });
  });
});

describe('childProcessDriver singleton', () => {
  test('is a ChildProcessDriver instance', () => {
    expect(childProcessDriver).toBeInstanceOf(ChildProcessDriver);
  });

  test('has all required properties', () => {
    expect(childProcessDriver.name).toBe('child_process');
    expect(childProcessDriver.capabilities).toBeDefined();
    expect(typeof childProcessDriver.spawn).toBe('function');
  });
});
