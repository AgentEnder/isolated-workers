import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * Vite plugin that watches the docs directory and invalidates
 * docs-related data modules when files change.
 *
 * This enables hot reloading when editing documentation during development.
 */
export function watchDocs(): Plugin {
  const docsDir = path.resolve(process.cwd(), '../docs');

  return {
    name: 'watch-docs',
    configureServer(server: ViteDevServer) {
      // Watch the docs directory
      server.watcher.add(docsDir);

      function onDocsChange(filePath: string) {
        console.log(`[watch-docs] Event received: ${filePath}`);
        console.log(`[watch-docs] docsDir: ${docsDir}`);
        console.log(`[watch-docs] check: ${filePath.includes(`${docsDir}/`)}`);

        // Only react to changes in the docs directory
        if (!filePath.includes(`${docsDir}/`)) {
          console.log(`[watch-docs] Skipping (not in docs dir)`);
          return;
        }

        console.log(`[watch-docs] Change detected: ${filePath}`);

        // Emit a fake change event on a + file that Vike is watching.
        // This triggers Vike's handleHotUpdate -> onFileModified -> updateUserFiles()
        // which properly re-runs onCreateGlobalContext.
        const triggerFile = path.join(
          process.cwd(),
          'pages/+onCreateGlobalContext.server.ts'
        );
        server.watcher.emit('change', triggerFile);
      }

      server.watcher.on('add', onDocsChange);
      server.watcher.on('unlink', onDocsChange);
      server.watcher.on('change', onDocsChange);
    },
  };
}
