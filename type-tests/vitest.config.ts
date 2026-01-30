import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      'isolated-workers': path.resolve(
        __dirname,
        '../packages/isolated-workers/dist'
      ),
    },
  },
});
