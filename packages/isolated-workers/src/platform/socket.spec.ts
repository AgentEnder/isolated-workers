import {
  isWindows,
  generateSocketPath,
  cleanupSocketPath,
  getSocketAdapter,
  unixSocketAdapter,
  windowsSocketAdapter,
} from './socket.js';
import * as fs from 'fs';
import * as os from 'os';

// Mock fs for cleanup tests
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

describe('socket utilities', () => {
  describe('isWindows', () => {
    test('returns boolean', () => {
      expect(typeof isWindows()).toBe('boolean');
    });

    test('matches process.platform', () => {
      expect(isWindows()).toBe(process.platform === 'win32');
    });
  });

  describe('generateSocketPath', () => {
    test('generates unique paths', () => {
      const path1 = generateSocketPath('test');
      const path2 = generateSocketPath('test');

      expect(path1).not.toBe(path2);
    });

    test('includes prefix in path', () => {
      const socketPath = generateSocketPath('myworker');

      expect(socketPath).toContain('myworker');
    });

    test('generates valid path format for platform', () => {
      const socketPath = generateSocketPath('test');

      if (isWindows()) {
        // Windows named pipe format: \\.\pipe\name
        expect(socketPath).toMatch(/^\\\\\.\pipe\\/);
      } else {
        // Unix socket: /tmp/something.sock or similar
        expect(socketPath).toMatch(/\.sock$/);
      }
    });

    test('uses temp directory on Unix', () => {
      if (!isWindows()) {
        const socketPath = generateSocketPath('test');
        const tmpDir = os.tmpdir();
        expect(
          socketPath.startsWith(tmpDir) || socketPath.startsWith('/tmp')
        ).toBe(true);
      }
    });

    test('handles special characters in prefix', () => {
      // Should not throw for valid prefixes
      expect(() => generateSocketPath('my-worker')).not.toThrow();
      expect(() => generateSocketPath('worker_1')).not.toThrow();
    });
  });

  describe('cleanupSocketPath', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReset();
      vi.mocked(fs.unlinkSync).mockReset();
    });

    test('removes socket file if it exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      cleanupSocketPath('/tmp/test.sock');

      expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/test.sock');
    });

    test('does nothing if socket does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      cleanupSocketPath('/tmp/nonexistent.sock');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    test('handles cleanup errors gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw
      expect(() => cleanupSocketPath('/tmp/test.sock')).not.toThrow();
    });

    test('skips cleanup for Windows named pipes', () => {
      // Named pipes don't need file cleanup
      cleanupSocketPath('\\\\.\\pipe\\test');

      // existsSync might return false for pipes, which is fine
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('getSocketAdapter', () => {
    test('returns adapter with createServer method', () => {
      const adapter = getSocketAdapter();

      expect(adapter).toBeDefined();
      expect(typeof adapter.createServer).toBe('function');
    });

    test('returns correct adapter for platform', () => {
      const adapter = getSocketAdapter();

      if (isWindows()) {
        expect(adapter).toBe(windowsSocketAdapter);
      } else {
        expect(adapter).toBe(unixSocketAdapter);
      }
    });
  });

  describe('unixSocketAdapter', () => {
    test('has createServer method', () => {
      expect(typeof unixSocketAdapter.createServer).toBe('function');
    });

    test('createServer returns Server instance', () => {
      const socketPath = generateSocketPath('test-adapter');
      const server = unixSocketAdapter.createServer(socketPath);

      expect(server).toBeDefined();
      expect(typeof server.listen).toBe('function');
      expect(typeof server.close).toBe('function');

      // Cleanup
      server.close();
      cleanupSocketPath(socketPath);
    });
  });

  describe('windowsSocketAdapter', () => {
    test('has createServer method', () => {
      expect(typeof windowsSocketAdapter.createServer).toBe('function');
    });

    // Note: Full Windows pipe tests would require Windows environment
  });

  describe('integration', () => {
    test('can create and cleanup socket path', () => {
      const socketPath = generateSocketPath('integration-test');

      // Should be a valid path
      expect(socketPath).toBeDefined();
      expect(socketPath.length).toBeGreaterThan(0);

      // Cleanup should not throw even if socket doesn't exist
      expect(() => cleanupSocketPath(socketPath)).not.toThrow();
    });

    test('adapter creates working server', async () => {
      const socketPath = generateSocketPath('server-test');
      const adapter = getSocketAdapter();
      const server = adapter.createServer(socketPath);

      // Server should be usable
      await new Promise<void>((resolve, reject) => {
        server.listen(socketPath, () => {
          server.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        server.on('error', reject);
      });

      cleanupSocketPath(socketPath);
    });
  });
});
