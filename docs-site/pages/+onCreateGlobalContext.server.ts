import { GlobalContextServer } from 'vike/types';
import {
  buildDocsNavigation,
  getDocsDir,
  scanDocs,
} from '../server/utils/docs';
import { scanExamples } from '../server/utils/examples';
import { loadApiDocs, buildApiNavigation } from '../server/utils/typedoc';
import { NavigationItem } from '../vike-types';

function sortNavigationItems(items: NavigationItem[]): NavigationItem[] {
  for (const item of items) {
    if (item.children) {
      item.children = sortNavigationItems(item.children);
    }
  }
  return items.sort((a, b) => {
    const orderA = a.order ?? 999;
    const orderB = b.order ?? 999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.title.localeCompare(b.title);
  });
}

function combineNavigationItems(items: NavigationItem[]): NavigationItem[] {
  const combinedMap = new Map<string, NavigationItem>();

  for (const item of items) {
    if (!item.title) {
      throw new Error('Navigation item is missing a title');
    }
    if (combinedMap.has(item.title)) {
      const existingItem = combinedMap.get(item.title)!;
      if (item.children) {
        existingItem.children = existingItem.children || [];
        existingItem.children.push(...item.children);
        existingItem.children = combineNavigationItems(existingItem.children);
      }

      if (
        existingItem.order &&
        item.order &&
        existingItem.order !== item.order
      ) {
        throw new Error(
          `Conflicting order values for navigation item "${item.title}": ${existingItem.order} vs ${item.order}`
        );
      }

      if (existingItem.path && item.path && existingItem.path !== item.path) {
        throw new Error(
          `Conflicting path values for navigation item "${item.title}": ${existingItem.path} vs ${item.path}`
        );
      }

      existingItem.order ??= item.order;
      existingItem.path ??= item.path;
    } else {
      combinedMap.set(item.title, { ...item });
    }
  }

  return Array.from(combinedMap.values());
}

export async function onCreateGlobalContext(
  context: Partial<GlobalContextServer>
): Promise<void> {
  const examples = await scanExamples();
  const docsDir = await getDocsDir();
  const docs = await scanDocs(docsDir);
  const docsNavigation = buildDocsNavigation(docs);
  const api = await loadApiDocs();

  const navigation: NavigationItem[] = combineNavigationItems([
    // Dynamic docs navigation (from frontmatter)
    ...docsNavigation,
    // Static sections
    {
      title: 'Getting Started',
      children: [],
      path: '/docs/getting-started',
      order: 0,
    },
    {
      title: 'Concepts',
      children: [],
      path: '/docs/concepts',
      order: 10,
    },
    {
      title: 'Guides',
      children: [],
      path: '/docs/guides',
      order: 20,
    },
    {
      title: 'Examples',
      path: '/examples',
      // Only show non-hidden examples in navigation
      children: examples
        .filter((ex) => !ex.hidden)
        .map((ex) => ({
          title: ex.title,
          path: `/examples/${ex.id}`,
        })),
      order: 100,
    },
    // Dynamic API navigation from TypeDoc
    buildApiNavigation(api),
  ]);

  context.examples = Object.fromEntries(examples.map((ex) => [ex.id, ex]));
  context.docs = docs;
  context.api = api;
  context.navigation = sortNavigationItems(navigation);
}
