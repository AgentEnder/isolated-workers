import { describe, it, expect } from 'vitest';
import { formatSignature } from './format-signature';

describe('formatSignature', () => {
  describe('short signatures (no formatting needed)', () => {
    it('returns short signatures unchanged', () => {
      const sig = 'function foo(): void';
      expect(formatSignature(sig)).toBe(sig);
    });

    it('returns class declarations unchanged when short', () => {
      const sig = 'class MyClass';
      expect(formatSignature(sig)).toBe(sig);
    });
  });

  describe('function signatures with parameters', () => {
    it('breaks long parameter lists onto separate lines', () => {
      const sig =
        'function createWorker<TDefs extends MessageDefs>(options: WorkerOptions<TDefs>): Worker<TDefs>';

      const result = formatSignature(sig);

      expect(result).toContain('function createWorker');
      expect(result).toContain('options: WorkerOptions<TDefs>');
      expect(result).toContain('): Worker<TDefs>');
      // Should have newlines
      expect(result.split('\n').length).toBeGreaterThan(1);
    });

    it('handles multiple parameters', () => {
      const sig =
        'function startWorkerServer<TDefs extends MessageDefs>(handlers: Handlers<TDefs>, middleware?: Middleware): Promise<void>';

      const result = formatSignature(sig);

      expect(result).toContain('handlers: Handlers<TDefs>');
      expect(result).toContain('middleware?: Middleware');
    });
  });

  describe('class and interface signatures', () => {
    it('handles class with extends', () => {
      const sig = 'class JsonSerializer extends Serializer';

      // This is short enough to not need formatting
      expect(formatSignature(sig)).toBe(sig);
    });

    it('handles interface with type parameters', () => {
      const sig = 'interface WorkerOptions<TDefs extends MessageDefs>';

      // Short enough to not need formatting
      expect(formatSignature(sig)).toBe(sig);
    });
  });

  describe('type aliases', () => {
    it('handles type alias declarations', () => {
      const sig =
        'type DefineMessages<T extends Record<string, MessageDefinition>> = T';

      // Should return unchanged if no function-style params
      const result = formatSignature(sig);
      expect(result).toContain('type DefineMessages');
    });
  });

  describe('edge cases', () => {
    it('preserves nested generics in parameters', () => {
      const sig =
        'function process<T>(data: Map<string, Array<T>>): Promise<T>';

      const result = formatSignature(sig);

      // Should not split inside nested generics
      expect(result).toContain('Map<string, Array<T>>');
    });

    it('handles empty parameter lists', () => {
      const sig = 'function noParams(): string';
      expect(formatSignature(sig)).toBe(sig);
    });

    it('returns non-matching signatures unchanged', () => {
      const sig = 'const x = 42';
      expect(formatSignature(sig)).toBe(sig);
    });
  });

  describe('maxWidth parameter', () => {
    it('respects custom maxWidth', () => {
      const sig = 'function foo(a: string, b: number): void';

      // With default maxWidth (60), this might not wrap
      const defaultResult = formatSignature(sig);

      // With very small maxWidth, should wrap
      const smallResult = formatSignature(sig, 20);

      expect(smallResult.split('\n').length).toBeGreaterThanOrEqual(
        defaultResult.split('\n').length
      );
    });
  });
});
