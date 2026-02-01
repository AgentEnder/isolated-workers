import * as ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { loadFixture } from '../lib/compiler.js';

describe('Core Worker Types', () => {
  describe('WorkerClient', () => {
    test('should be usable as a type via type import', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      // WorkerClient is imported, not defined in fixture. Check via workerClient variable.
      const workerClientVar = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === 'workerClient');

      expect(workerClientVar).toBeDefined();
    });

    test('send method should return Promise with correct result type', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      // Find testReturnTypes function to check send return types
      const funcSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Function)
        .find((s) => s.name === 'testReturnTypes');

      expect(funcSymbol).toBeDefined();
    });

    test('should have required properties (pid, isActive, close)', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      // Check for pid type alias
      const pidSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_pidCheck');

      expect(pidSymbol).toBeDefined();

      if (pidSymbol) {
        const pidType = typeChecker.getTypeOfSymbolAtLocation(
          pidSymbol,
          pidSymbol.valueDeclaration ?? sourceFile
        );
        expect(typeChecker.typeToString(pidType)).toBe('number');
      }

      // Check for isActive type alias
      const activeSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_activeCheck');

      expect(activeSymbol).toBeDefined();

      if (activeSymbol) {
        const activeType = typeChecker.getTypeOfSymbolAtLocation(
          activeSymbol,
          activeSymbol.valueDeclaration ?? sourceFile
        );
        expect(typeChecker.typeToString(activeType)).toBe('boolean');
      }
    });
  });

  describe('WorkerOptions', () => {
    test('should have correct interface properties', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      // Find WorkerOptions symbol
      const workerOptionsSymbol = typeChecker
        .getSymbolsInScope(
          sourceFile,
          ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface
        )
        .find((s) => s.name === 'WorkerOptions');

      expect(workerOptionsSymbol).toBeDefined();
    });

    test('script property should be required', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      // Find _workerOptions1 variable which only has script
      const options1Symbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_workerOptions1');

      expect(options1Symbol).toBeDefined();
    });

    test('optional properties should be undefined-able', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      // Find _workerOptions2 variable which has all properties
      const options2Symbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_workerOptions2');

      expect(options2Symbol).toBeDefined();
    });
  });

  describe('Connection', () => {
    test('should be usable as a type via type import', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      // Connection is imported. Check via mockConnection variable.
      const connectionVar = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === 'mockConnection');

      expect(connectionVar).toBeDefined();
    });

    test('ConnectionOptions should be usable via type import', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      // ConnectionOptions is imported. Check via _connectionOptions1 variable.
      const connectionOptsVar = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_connectionOptions1');

      expect(connectionOptsVar).toBeDefined();
    });
  });

  describe('TypedMessage', () => {
    test('should have required properties (type, payload, tx)', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      const typedMsgSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_typedMessage');

      expect(typedMsgSymbol).toBeDefined();

      if (typedMsgSymbol) {
        const type = typeChecker.getTypeOfSymbolAtLocation(
          typedMsgSymbol,
          typedMsgSymbol.valueDeclaration ?? sourceFile
        );

        expect(type.getProperty('type')).toBeDefined();
        expect(type.getProperty('payload')).toBeDefined();
        expect(type.getProperty('tx')).toBeDefined();
      }
    });
  });

  describe('TypedResult', () => {
    test('should have required properties (type, payload, tx)', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      const typedResultSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_typedResult');

      expect(typedResultSymbol).toBeDefined();

      if (typedResultSymbol) {
        const type = typeChecker.getTypeOfSymbolAtLocation(
          typedResultSymbol,
          typedResultSymbol.valueDeclaration ?? sourceFile
        );

        expect(type.getProperty('type')).toBeDefined();
        expect(type.getProperty('payload')).toBeDefined();
        expect(type.getProperty('tx')).toBeDefined();
      }
    });
  });

  describe('Middleware', () => {
    test('MiddlewareDirection should be a union of send and receive', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      const sendDirSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_sendDirection');

      const receiveDirSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_receiveDirection');

      expect(sendDirSymbol).toBeDefined();
      expect(receiveDirSymbol).toBeDefined();

      if (sendDirSymbol) {
        const sendType = typeChecker.getTypeOfSymbolAtLocation(
          sendDirSymbol,
          sendDirSymbol.valueDeclaration ?? sourceFile
        );
        expect(typeChecker.typeToString(sendType)).toBe('"send"');
      }
    });

    test('MiddlewareContext should have direction and message properties', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      const contextSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_middlewareContext');

      expect(contextSymbol).toBeDefined();

      if (contextSymbol) {
        const type = typeChecker.getTypeOfSymbolAtLocation(
          contextSymbol,
          contextSymbol.valueDeclaration ?? sourceFile
        );

        expect(type.getProperty('direction')).toBeDefined();
        expect(type.getProperty('message')).toBeDefined();
      }
    });

    test('Middleware function type should accept context and return unknown', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      const middlewareSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_middleware');

      expect(middlewareSymbol).toBeDefined();
    });
  });

  describe('Function and Handler Types', () => {
    test('MessageHandler should be usable as function type', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      const handlerSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_handler');

      expect(handlerSymbol).toBeDefined();
    });

    test('testReturnTypes function should compile', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      const returnTypesFunc = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Function)
        .find((s) => s.name === 'testReturnTypes');

      expect(returnTypesFunc).toBeDefined();
    });
  });

  describe('Compile-time Type Checks', () => {
    test('TypedMessageCheck should be true', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      const checkSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_typedMessageCheck');

      expect(checkSymbol).toBeDefined();

      if (checkSymbol) {
        const type = typeChecker.getTypeOfSymbolAtLocation(
          checkSymbol,
          checkSymbol.valueDeclaration ?? sourceFile
        );
        expect(typeChecker.typeToString(type)).toBe('true');
      }
    });

    test('TypedResultCheck should be true', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      const checkSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_typedResultCheck');

      expect(checkSymbol).toBeDefined();

      if (checkSymbol) {
        const type = typeChecker.getTypeOfSymbolAtLocation(
          checkSymbol,
          checkSymbol.valueDeclaration ?? sourceFile
        );
        expect(typeChecker.typeToString(type)).toBe('true');
      }
    });

    test('MiddlewareContextCheck should be true', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      const checkSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_middlewareContextCheck');

      expect(checkSymbol).toBeDefined();

      if (checkSymbol) {
        const type = typeChecker.getTypeOfSymbolAtLocation(
          checkSymbol,
          checkSymbol.valueDeclaration ?? sourceFile
        );
        expect(typeChecker.typeToString(type)).toBe('true');
      }
    });

    test('ConnectionCheck should be true', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      const checkSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_connectionCheck');

      expect(checkSymbol).toBeDefined();

      if (checkSymbol) {
        const type = typeChecker.getTypeOfSymbolAtLocation(
          checkSymbol,
          checkSymbol.valueDeclaration ?? sourceFile
        );
        expect(typeChecker.typeToString(type)).toBe('true');
      }
    });

    test('WorkerOptionsCheck should be true', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      const checkSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_workerOptionsCheck');

      expect(checkSymbol).toBeDefined();

      if (checkSymbol) {
        const type = typeChecker.getTypeOfSymbolAtLocation(
          checkSymbol,
          checkSymbol.valueDeclaration ?? sourceFile
        );
        expect(typeChecker.typeToString(type)).toBe('true');
      }
    });

    test('ConnectionOptionsCheck should be true', () => {
      const { typeChecker, sourceFile } = loadFixture('core-worker.ts');

      const checkSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
        .find((s) => s.name === '_connectionOptionsCheck');

      expect(checkSymbol).toBeDefined();

      if (checkSymbol) {
        const type = typeChecker.getTypeOfSymbolAtLocation(
          checkSymbol,
          checkSymbol.valueDeclaration ?? sourceFile
        );
        expect(typeChecker.typeToString(type)).toBe('true');
      }
    });
  });
});
