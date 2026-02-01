import { GlobalContextServer } from 'vike/types';
import { scanExamples } from '../server/utils/examples';
import { NavigationItem } from '../vike-types';

export async function onCreateGlobalContext(
  context: Partial<GlobalContextServer>
): Promise<void> {
  const examples = await scanExamples();

  const navigation: NavigationItem[] = [
    {
      title: 'Getting Started',
      path: '/getting-started',
      children: [
        { title: 'Installation', path: '/getting-started/installation' },
        { title: 'Quick Start', path: '/getting-started/quick-start' },
        { title: 'First Worker', path: '/getting-started/first-worker' },
      ],
    },
    {
      title: 'Guides',
      path: '/guides',
      children: [
        { title: 'Type Safety', path: '/guides/type-safety' },
        { title: 'Error Handling', path: '/guides/error-handling' },
        { title: 'Best Practices', path: '/guides/best-practices' },
      ],
    },
    {
      title: 'Examples',
      path: '/examples',
      children: examples.map((ex) => ({
        title: ex.title,
        path: `/examples/${ex.id}`,
      })),
    },
    {
      title: 'API Reference',
      path: '/api',
      children: [
        { title: 'createWorker', path: '/api/create-worker' },
        { title: 'startWorkerServer', path: '/api/start-worker-server' },
        { title: 'Handlers Type', path: '/api/handlers' },
        { title: 'DefineMessages', path: '/api/define-messages' },
      ],
    },
  ];

  context.examples = Object.fromEntries(examples.map((ex) => [ex.id, ex]));
  context.navigation = navigation;
}
