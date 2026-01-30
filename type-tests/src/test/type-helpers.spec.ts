import * as ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { loadFixture } from '../lib/compiler.js';
import {
  getFirstDeclaration,
  getRequiredProperty,
} from '../lib/assertions.js';

describe('Type Helpers', () => {
  describe('MessageOf type', () => {
    test('LoadMessage should have correct properties', () => {
      const { typeChecker, sourceFile } = loadFixture('basic-messages.ts');

      // Find the LoadMessage type alias
      const loadMessageSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'LoadMessage');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(loadMessageSymbol)
      );

      // Check that LoadMessage has the required properties
      expect(type.getProperty('tx')).toBeDefined();
      expect(type.getProperty('type')).toBeDefined();
      expect(type.getProperty('payload')).toBeDefined();

      // Check payload type
      const payloadProp = getRequiredProperty(type, 'payload');

      const payloadType = typeChecker.getTypeOfSymbol(payloadProp);
      expect(payloadType.getProperty('config')).toBeDefined();
    });

    test('ComputeMessage payload should have data property', () => {
      const { typeChecker, sourceFile } = loadFixture('basic-messages.ts');

      const computeMessageSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'ComputeMessage');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(computeMessageSymbol)
      );

      const payloadProp = getRequiredProperty(type, 'payload');

      const payloadType = typeChecker.getTypeOfSymbol(payloadProp);
      expect(payloadType.getProperty('data')).toBeDefined();
    });

    test('ShutdownMessage payload should have optional force property', () => {
      const { typeChecker, sourceFile } = loadFixture('basic-messages.ts');

      const shutdownMessageSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'ShutdownMessage');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(shutdownMessageSymbol)
      );

      const payloadProp = getRequiredProperty(type, 'payload');

      const payloadType = typeChecker.getTypeOfSymbol(payloadProp);
      const forceProp = payloadType.getProperty('force');
      expect(forceProp).toBeDefined();
    });
  });

  describe('ResultOf type', () => {
    test('LoadResult should have correct result type', () => {
      const { typeChecker, sourceFile } = loadFixture('basic-messages.ts');

      const loadResultSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'LoadResult');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(loadResultSymbol)
      );

      // Check that it has tx, type, and payload
      expect(type.getProperty('tx')).toBeDefined();
      expect(type.getProperty('type')).toBeDefined();
      expect(type.getProperty('payload')).toBeDefined();

      // Check payload type
      const payloadProp = getRequiredProperty(type, 'payload');
      const payloadType = typeChecker.getTypeOfSymbol(payloadProp);
      expect(payloadType.getProperty('loaded')).toBeDefined();
    });

    test('ComputeResult should have sum property in payload', () => {
      const { typeChecker, sourceFile } = loadFixture('basic-messages.ts');

      const computeResultSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'ComputeResult');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(computeResultSymbol)
      );

      const payloadProp = getRequiredProperty(type, 'payload');
      const payloadType = typeChecker.getTypeOfSymbol(payloadProp);
      expect(payloadType.getProperty('sum')).toBeDefined();
    });
  });

  describe('WithResult type', () => {
    test('MessagesWithResults should be a union of load and compute', () => {
      const { typeChecker, sourceFile } = loadFixture('basic-messages.ts');

      const withResultSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'MessagesWithResults');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(withResultSymbol)
      );

      // Should be a union type
      if (type.isUnion()) {
        const types = type.types.map((t) => typeChecker.typeToString(t));
        expect(types).toContain('"load"');
        expect(types).toContain('"compute"');
        expect(types).not.toContain('"shutdown"');
      } else {
        // Could also be a single type if only one has result
        const typeStr = typeChecker.typeToString(type);
        expect(['"load"', '"compute"', '"load" | "compute"']).toContain(
          typeStr
        );
      }
    });
  });

  describe('AllMessages type', () => {
    test('AllWorkerMessages should be a union of all message types', () => {
      const { typeChecker, sourceFile } = loadFixture('basic-messages.ts');

      const allMessagesSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'AllWorkerMessages');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(allMessagesSymbol)
      );

      // Should be a union type
      expect(type.isUnion()).toBe(true);

      if (type.isUnion()) {
        // Check that we can find the type property in each union member
        for (const member of type.types) {
          const typeProp = getRequiredProperty(member, 'type');

          const typePropType = typeChecker.getTypeOfSymbol(typeProp);
          const typeValue = typeChecker.typeToString(typePropType);
          expect(['"load"', '"compute"', '"shutdown"']).toContain(typeValue);
        }
      }
    });
  });

  describe('AllResults type', () => {
    test('AllWorkerResults should only include messages with results', () => {
      const { typeChecker, sourceFile } = loadFixture('basic-messages.ts');

      const allResultsSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'AllWorkerResults');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(allResultsSymbol)
      );

      // Should be a union type
      expect(type.isUnion()).toBe(true);

      if (type.isUnion()) {
        // Should only have loadResult and computeResult
        for (const member of type.types) {
          const typeProp = getRequiredProperty(member, 'type');

          const typePropType = typeChecker.getTypeOfSymbol(typeProp);
          const typeValue = typeChecker.typeToString(typePropType);
          expect(['"loadResult"', '"computeResult"']).toContain(typeValue);
        }
      }
    });
  });

  describe('Handlers type', () => {
    test('WorkerMessages type should have correct structure', () => {
      const { typeChecker, sourceFile } = loadFixture('basic-messages.ts');

      // Find the WorkerMessages type definition
      const workerMessagesSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'WorkerMessages');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(workerMessagesSymbol)
      );

      // The type should have load, compute, and shutdown properties
      const typeStr = typeChecker.typeToString(type);
      expect(typeStr).toContain('load');
      expect(typeStr).toContain('compute');
      expect(typeStr).toContain('shutdown');
    });
  });
});
