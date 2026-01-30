import { describe, test, expect } from 'vitest';
import { loadFixture } from '../lib/compiler.js';
import * as ts from 'typescript';
import {
  getFirstDeclaration,
  getRequiredProperty,
} from '../lib/assertions.js';

describe('Union Narrowing', () => {
  describe('ProcessEvent discriminated union', () => {
    test('ProcessEventMessage payload should be a union type', () => {
      const { typeChecker, sourceFile } = loadFixture('union-narrowing.ts');

      const processEventSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'ProcessEventMessage');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(processEventSymbol)
      );

      const payloadProp = getRequiredProperty(type, 'payload');

      const payloadType = typeChecker.getTypeOfSymbol(payloadProp);

      // Payload should be a union
      expect(payloadType.isUnion()).toBe(true);

      if (payloadType.isUnion()) {
        // Should have 3 members (user, system, error)
        expect(payloadType.types.length).toBe(3);

        // Each member should have a 'type' discriminator
        for (const member of payloadType.types) {
          expect(member.getProperty('type')).toBeDefined();
        }
      }
    });

    test('Payload union members should have correct discriminator values', () => {
      const { typeChecker, sourceFile } = loadFixture('union-narrowing.ts');

      const processEventSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'ProcessEventMessage');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(processEventSymbol)
      );

      const payloadProp = getRequiredProperty(type, 'payload');
      const payloadType = typeChecker.getTypeOfSymbol(payloadProp);

      if (payloadType.isUnion()) {
        const discriminatorValues = payloadType.types.map((t) => {
          const typeProp = t.getProperty('type');
          if (typeProp) {
            const typePropType = typeChecker.getTypeOfSymbol(typeProp);
            return typeChecker.typeToString(typePropType);
          }
          return null;
        });

        expect(discriminatorValues).toContain('"user"');
        expect(discriminatorValues).toContain('"system"');
        expect(discriminatorValues).toContain('"error"');
      }
    });

    test('User payload should have userId and action properties', () => {
      const { typeChecker, sourceFile } = loadFixture('union-narrowing.ts');

      const processEventSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'ProcessEventMessage');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(processEventSymbol)
      );

      const payloadProp = getRequiredProperty(type, 'payload');
      const payloadType = typeChecker.getTypeOfSymbol(payloadProp);

      if (payloadType.isUnion()) {
        // Find the user type member
        const userType = payloadType.types.find((t) => {
          const typeProp = t.getProperty('type');
          if (typeProp) {
            const typePropType = typeChecker.getTypeOfSymbol(typeProp);
            return typeChecker.typeToString(typePropType) === '"user"';
          }
          return false;
        });

        expect(userType).toBeDefined();
        if (userType) {
          expect(userType.getProperty('userId')).toBeDefined();
          expect(userType.getProperty('action')).toBeDefined();
        }
      }
    });

    test('Error payload should have code and message properties', () => {
      const { typeChecker, sourceFile } = loadFixture('union-narrowing.ts');

      const processEventSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'ProcessEventMessage');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(processEventSymbol)
      );

      const payloadProp = getRequiredProperty(type, 'payload');
      const payloadType = typeChecker.getTypeOfSymbol(payloadProp);

      if (payloadType.isUnion()) {
        // Find the error type member
        const errorType = payloadType.types.find((t) => {
          const typeProp = t.getProperty('type');
          if (typeProp) {
            const typePropType = typeChecker.getTypeOfSymbol(typeProp);
            return typeChecker.typeToString(typePropType) === '"error"';
          }
          return false;
        });

        expect(errorType).toBeDefined();
        if (errorType) {
          expect(errorType.getProperty('code')).toBeDefined();
          expect(errorType.getProperty('message')).toBeDefined();
        }
      }
    });
  });

  describe('FetchData result union', () => {
    test('FetchDataResult payload should have status discriminator', () => {
      const { typeChecker, sourceFile } = loadFixture('union-narrowing.ts');

      const fetchDataResultSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'FetchDataResult');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(fetchDataResultSymbol)
      );

      const payloadProp = getRequiredProperty(type, 'payload');

      const payloadType = typeChecker.getTypeOfSymbol(payloadProp);

      // Should be a union
      expect(payloadType.isUnion()).toBe(true);

      if (payloadType.isUnion()) {
        // Each member should have status property
        for (const member of payloadType.types) {
          expect(member.getProperty('status')).toBeDefined();
        }
      }
    });

    test('Success result should have data property', () => {
      const { typeChecker, sourceFile } = loadFixture('union-narrowing.ts');

      const fetchDataResultSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'FetchDataResult');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(fetchDataResultSymbol)
      );

      const payloadProp = getRequiredProperty(type, 'payload');
      const payloadType = typeChecker.getTypeOfSymbol(payloadProp);

      if (payloadType.isUnion()) {
        const successType = payloadType.types.find((t) => {
          const statusProp = t.getProperty('status');
          if (statusProp) {
            const statusType = typeChecker.getTypeOfSymbol(statusProp);
            return typeChecker.typeToString(statusType) === '"success"';
          }
          return false;
        });

        expect(successType).toBeDefined();
        if (successType) {
          expect(successType.getProperty('data')).toBeDefined();
        }
      }
    });

    test('Error result should have error property', () => {
      const { typeChecker, sourceFile } = loadFixture('union-narrowing.ts');

      const fetchDataResultSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'FetchDataResult');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(fetchDataResultSymbol)
      );

      const payloadProp = getRequiredProperty(type, 'payload');
      const payloadType = typeChecker.getTypeOfSymbol(payloadProp);

      if (payloadType.isUnion()) {
        const errorType = payloadType.types.find((t) => {
          const statusProp = t.getProperty('status');
          if (statusProp) {
            const statusType = typeChecker.getTypeOfSymbol(statusProp);
            return typeChecker.typeToString(statusType) === '"error"';
          }
          return false;
        });

        expect(errorType).toBeDefined();
        if (errorType) {
          expect(errorType.getProperty('error')).toBeDefined();
        }
      }
    });
  });

  describe('AllMessages union', () => {
    test('AllServiceMessages should be a discriminated union', () => {
      const { typeChecker, sourceFile } = loadFixture('union-narrowing.ts');

      const allMessagesSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'AllServiceMessages');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(allMessagesSymbol)
      );

      // Should be a union
      expect(type.isUnion()).toBe(true);

      if (type.isUnion()) {
        // Each member should have a type discriminator
        for (const member of type.types) {
          expect(member.getProperty('type')).toBeDefined();
        }

        // Check that we have all three message types
        const typeValues = type.types.map((t) => {
          const typeProp = t.getProperty('type');
          if (typeProp) {
            return typeChecker.typeToString(
              typeChecker.getTypeOfSymbol(typeProp)
            );
          }
          return null;
        });

        expect(typeValues).toContain('"processEvent"');
        expect(typeValues).toContain('"fetchData"');
        expect(typeValues).toContain('"ping"');
      }
    });
  });

  describe('Handler implementations', () => {
    test('ServiceMessages type should have processEvent with discriminated payload', () => {
      const { typeChecker, sourceFile } = loadFixture('union-narrowing.ts');

      const serviceMessagesSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'ServiceMessages');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(serviceMessagesSymbol)
      );

      // Should have processEvent property
      const typeStr = typeChecker.typeToString(type);
      expect(typeStr).toContain('processEvent');
      expect(typeStr).toContain('fetchData');
      expect(typeStr).toContain('ping');
    });
  });

  describe('Type narrowing verification', () => {
    test('After checking type field, other properties should be accessible', () => {
      const { typeChecker, sourceFile } = loadFixture('union-narrowing.ts');

      const processEventSymbol = typeChecker
        .getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
        .find((s) => s.name === 'ProcessEventMessage');

      const type = typeChecker.getTypeAtLocation(
        getFirstDeclaration(processEventSymbol)
      );

      const payloadProp = getRequiredProperty(type, 'payload');
      const payloadType = typeChecker.getTypeOfSymbol(payloadProp);

      // The payload should be a union where each member has a discriminant
      expect(payloadType.isUnion()).toBe(true);

      if (payloadType.isUnion()) {
        // Each union member should have unique properties that are not on other members
        const userType = payloadType.types.find((t) => {
          const typeProp = t.getProperty('type');
          if (typeProp) {
            return (
              typeChecker.typeToString(
                typeChecker.getTypeOfSymbol(typeProp)
              ) === '"user"'
            );
          }
          return false;
        });

        const systemType = payloadType.types.find((t) => {
          const typeProp = t.getProperty('type');
          if (typeProp) {
            return (
              typeChecker.typeToString(
                typeChecker.getTypeOfSymbol(typeProp)
              ) === '"system"'
            );
          }
          return false;
        });

        // userType has userId, systemType does not
        if (userType) {
          expect(userType.getProperty('userId')).toBeDefined();
        }
        if (systemType) {
          expect(systemType.getProperty('userId')).toBeUndefined();
        }

        // systemType has event, userType does not
        if (systemType) {
          expect(systemType.getProperty('event')).toBeDefined();
        }
        if (userType) {
          expect(userType.getProperty('event')).toBeUndefined();
        }
      }
    });
  });
});
