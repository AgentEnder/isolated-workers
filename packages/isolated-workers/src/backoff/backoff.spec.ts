import { describe, it, expect } from 'vitest';
import {
  stepped,
  exponential,
  linear,
  constant,
  aggressive,
  gentle,
  patient,
} from './index.js';

describe('backoff curves', () => {
  describe('stepped', () => {
    it('creates correct delay boundaries', () => {
      const curve = stepped([10, 3], [100, 2], [1000, 1]);

      // First step: 10ms
      expect(curve.delay(0)).toBe(10);
      expect(curve.delay(1)).toBe(10);
      expect(curve.delay(2)).toBe(10);
      // Second step: 100ms
      expect(curve.delay(3)).toBe(100);
      expect(curve.delay(4)).toBe(100);
      // Third step: 1000ms
      expect(curve.delay(5)).toBe(1000);
    });

    it('sums attempts from all steps', () => {
      const curve = stepped([10, 10], [100, 10], [1000, 10]);
      expect(curve.attempts).toBe(30);
    });

    it('uses last delay for attempts past all steps', () => {
      const curve = stepped([10, 2], [100, 2]);
      expect(curve.delay(99)).toBe(100);
    });

    it('throws on empty steps', () => {
      expect(() => stepped()).toThrow('at least one');
    });
  });

  describe('exponential', () => {
    it('applies base * factor^attempt', () => {
      const curve = exponential(100, 2, 5);

      expect(curve.delay(0)).toBe(100);
      expect(curve.delay(1)).toBe(200);
      expect(curve.delay(2)).toBe(400);
      expect(curve.delay(3)).toBe(800);
      expect(curve.attempts).toBe(5);
    });

    it('uses defaults when called with no args', () => {
      const curve = exponential();
      expect(curve.delay(0)).toBe(100);
      expect(curve.delay(1)).toBe(200);
      expect(curve.attempts).toBe(10);
    });
  });

  describe('linear', () => {
    it('applies initial + increment * attempt', () => {
      const curve = linear(50, 50, 5);

      expect(curve.delay(0)).toBe(50);
      expect(curve.delay(1)).toBe(100);
      expect(curve.delay(2)).toBe(150);
      expect(curve.attempts).toBe(5);
    });

    it('uses defaults when called with no args', () => {
      const curve = linear();
      expect(curve.delay(0)).toBe(100);
      expect(curve.delay(1)).toBe(200);
      expect(curve.attempts).toBe(10);
    });
  });

  describe('constant', () => {
    it('returns the same delay every time', () => {
      const curve = constant(500, 3);

      expect(curve.delay(0)).toBe(500);
      expect(curve.delay(1)).toBe(500);
      expect(curve.delay(2)).toBe(500);
      expect(curve.attempts).toBe(3);
    });
  });

  describe('presets', () => {
    it('aggressive: 30 attempts across 3 steps', () => {
      expect(aggressive.attempts).toBe(30);
      expect(aggressive.delay(0)).toBe(10);
      expect(aggressive.delay(9)).toBe(10);
      expect(aggressive.delay(10)).toBe(100);
      expect(aggressive.delay(19)).toBe(100);
      expect(aggressive.delay(20)).toBe(1000);
      expect(aggressive.delay(29)).toBe(1000);
    });

    it('gentle: 15 attempts across 3 steps', () => {
      expect(gentle.attempts).toBe(15);
      expect(gentle.delay(0)).toBe(100);
      expect(gentle.delay(5)).toBe(500);
      expect(gentle.delay(10)).toBe(2000);
    });

    it('patient: 25 attempts across 3 steps', () => {
      expect(patient.attempts).toBe(25);
      expect(patient.delay(0)).toBe(1000);
      expect(patient.delay(5)).toBe(5000);
      expect(patient.delay(15)).toBe(10_000);
    });

    it('presets are spreadable into connection config', () => {
      const connection = { ...aggressive };
      expect(connection).toHaveProperty('delay');
      expect(connection).toHaveProperty('attempts');
      expect(typeof connection.delay).toBe('function');
      expect(typeof connection.attempts).toBe('number');
    });
  });
});
