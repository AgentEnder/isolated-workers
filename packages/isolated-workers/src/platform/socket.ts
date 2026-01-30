/**
 * Socket adapter interface for cross-platform IPC
 *
 * @packageDocumentation
 */

import { Server, Socket, createServer, createConnection } from 'net';
import { unlinkSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

/**
 * Platform-specific socket adapter interface
 */
export interface SocketAdapter {
  /**
   * Create a socket server
   * @param path - Socket path (Unix) or pipe name (Windows)
   * @returns Server instance
   */
  createServer(path: string): Server;

  /**
   * Create a socket client connection
   * @param path - Socket path (Unix) or pipe name (Windows)
   * @returns Socket instance
   */
  createClient(path: string): Socket;

  /**
   * Cleanup socket resources
   * @param path - Socket path or pipe name to cleanup
   */
  cleanup(path: string): void;

  /**
   * Generate a unique socket path/pipe name
   * @param prefix - Optional prefix for the socket name
   * @returns Unique socket path or pipe name
   */
  generateSocketPath(prefix?: string): string;
}

/**
 * Check if running on Windows
 * @returns True if Windows platform
 */
export function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Get the appropriate socket adapter for the current platform
 * @returns SocketAdapter for current platform
 */
export function getSocketAdapter(): SocketAdapter {
  if (isWindows()) {
    return windowsSocketAdapter;
  }
  return unixSocketAdapter;
}

/**
 * Generate a socket path for the current platform
 * @param prefix - Optional prefix for the socket name
 * @returns Platform-appropriate socket path
 */
export function generateSocketPath(prefix?: string): string {
  return getSocketAdapter().generateSocketPath(prefix);
}

/**
 * Cleanup a socket path/pipe
 * @param path - Socket path or pipe name to cleanup
 */
export function cleanupSocketPath(path: string): void {
  getSocketAdapter().cleanup(path);
}

// ============================================================================
// Unix Domain Socket Implementation
// ============================================================================

/**
 * Unix domain socket adapter
 */
export const unixSocketAdapter: SocketAdapter = {
  createServer(path: string): Server {
    this.cleanup(path);
    return createServer();
  },

  createClient(path: string): Socket {
    return createConnection(path);
  },

  cleanup(path: string): void {
    try {
      if (existsSync(path)) {
        unlinkSync(path);
      }
    } catch {
      // Ignore cleanup errors
    }
  },

  generateSocketPath(prefix?: string): string {
    const tmpDir = process.env.TMPDIR || process.env.TMP || '/tmp';
    const name = `${prefix || 'worker'}-${randomUUID()}.sock`;
    return `${tmpDir}/${name}`;
  },
};

// ============================================================================
// Windows Named Pipe Implementation
// ============================================================================

/**
 * Windows named pipe adapter
 */
export const windowsSocketAdapter: SocketAdapter = {
  createServer(_path: string): Server {
    // Windows named pipes are automatically cleaned up when closed
    return createServer();
  },

  createClient(path: string): Socket {
    return createConnection(path);
  },

  cleanup(): void {
    // Windows named pipes are cleaned up automatically when the process exits
    // No manual cleanup needed
  },

  generateSocketPath(prefix?: string): string {
    const name = `${prefix || 'worker'}-${randomUUID()}`;
    return `\\\\.\\pipe\\${name}`;
  },
};
