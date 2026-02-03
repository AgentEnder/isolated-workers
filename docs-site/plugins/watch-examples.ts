import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * Vite plugin that watches the examples directory and invalidates
 * example-related data modules when files change.
 *
 * This enables hot reloading when editing example files during development.
 */
export function watchExamples(): Plugin {
  const examplesDir = path.resolve(process.cwd(), '../examples');

  return {
    name: 'watch-examples',
    configureServer(server: ViteDevServer) {
      // Watch the examples directory
      server.watcher.add(examplesDir);

      function onExamplesChange(filePath: string) {
        // Only react to changes in the examples directory
        if (!filePath.startsWith(examplesDir)) {
          return;
        }

        console.log(`[watch-examples] Change detected: ${filePath}`);

        // Emit a fake change event on a + file that Vike is watching.
        // This triggers Vike's handleHotUpdate -> onFileModified -> updateUserFiles()
        // which properly re-runs onCreateGlobalContext.
        const triggerFile = path.join(
          process.cwd(),
          'pages/+onCreateGlobalContext.server.ts'
        );
        server.watcher.emit('change', triggerFile);
      }

      server.watcher.on('add', onExamplesChange);
      server.watcher.on('unlink', onExamplesChange);
      server.watcher.on('change', onExamplesChange);
    },
  };
}
