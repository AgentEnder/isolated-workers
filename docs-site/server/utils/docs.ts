import matter from 'gray-matter';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface NavigationItem {
  title: string;
  path?: string;
  children?: NavigationItem[];
}

export interface DocMetadata {
  path: string; // URL path
  filePath: string; // Filesystem path
  title: string;
  description?: string;
  nav?: {
    section: string;
    order: number;
  };
}

/**
 * Recursively scan a directory for markdown files.
 */
async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(fullPath)));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Convert a filesystem path to a URL path.
 * - docs/guides/error-handling.md -> /docs/guides/error-handling
 * - docs/guides/index.md -> /docs/guides/
 */
function filePathToUrlPath(filePath: string, docsRoot: string): string {
  // Get relative path from docs root
  const relative = path.relative(docsRoot, filePath);

  // Remove .md extension
  let urlPath = relative.replace(/\.md$/, '');

  // Handle index files (no trailing slash to match Vike routes):
  // - 'index' (root) -> '/docs'
  // - 'guides/index' -> '/docs/guides'
  if (urlPath === 'index') {
    return '/docs';
  }

  // Match 'path/to/index' and remove it
  urlPath = urlPath.replace(/\/index$/, '');

  // Ensure /docs prefix
  return '/docs/' + urlPath;
}

/**
 * Scan the docs directory and return metadata for all markdown files.
 */
export async function scanDocs(
  docsRoot: string
): Promise<Record<string, DocMetadata>> {
  const docs: Record<string, DocMetadata> = {};

  try {
    const files = await walkDir(docsRoot);

    for (const filePath of files) {
      const content = await fs.readFile(filePath, 'utf-8');
      const { data: frontmatter } = matter(content);

      // Determine URL path (frontmatter override or derived)
      const derivedPath = filePathToUrlPath(filePath, docsRoot);
      const urlPath = frontmatter.path || derivedPath;
      console.log('Found docs page:', urlPath);

      docs[urlPath] = {
        path: urlPath,
        filePath,
        title: frontmatter.title || path.basename(filePath, '.md'),
        description: frontmatter.description,
        nav: frontmatter.nav,
      };
    }
  } catch (error) {
    // Only suppress ENOENT (directory doesn't exist)
    const isNotFound =
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT';
    if (!isNotFound) {
      throw error;
    }
  }

  return docs;
}

/**
 * Build navigation structure from docs metadata.
 * Groups by nav.section, sorts by nav.order.
 */
export function buildDocsNavigation(
  docs: Record<string, DocMetadata>
): NavigationItem[] {
  // Group by section
  const sections: Record<
    string,
    Array<{ title: string; path: string; order: number }>
  > = {};

  for (const doc of Object.values(docs)) {
    let { section, order } = doc.nav ?? {};
    section ??= 'Docs';
    order ??= 999;
    if (!sections[section]) {
      sections[section] = [];
    }
    sections[section].push({
      title: doc.title,
      path: doc.path,
      order,
    });
  }

  // Sort items within each section, then build navigation
  const navigation: NavigationItem[] = [];

  for (const [sectionName, items] of Object.entries(sections).sort()) {
    // Create URL-friendly section path (kebab-case)
    const sectionPath =
      '/docs/' + sectionName.toLowerCase().replace(/\s+/g, '-');

    // Filter out items whose path matches the section path (index pages)
    // These are represented by the clickable section header instead
    const children = items
      .filter((item) => item.path !== sectionPath)
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        title: item.title,
        path: item.path,
        order: item.order,
      }));

    navigation.push({
      title: sectionName,
      children,
    });
  }

  return navigation;
}

/**
 * Resolve docs directory from workspace root.
 */
export async function getDocsDir(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), '../docs'),
    path.resolve(process.cwd(), 'docs'),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue
    }
  }

  return candidates[0];
}
