#!/usr/bin/env npx tsx
/**
 * Hydrates README.md.tmpl by replacing liquid tags with actual content.
 *
 * Supported tags:
 * - {% example name:path %} or {% example name:path#region %} - Include example file/region as code block
 * - {% example-link name %} - Link to example in documentation
 *
 * Usage: npx tsx scripts/hydrate-readme.ts
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');
const repoRoot = join(packageRoot, '../..');
const examplesDir = join(repoRoot, 'examples');

interface ExampleMeta {
  id: string;
  title: string;
  description: string;
}

/**
 * Load example metadata from meta.yml files
 */
function loadExamplesMeta(): Map<string, ExampleMeta> {
  const examples = new Map<string, ExampleMeta>();

  if (!existsSync(examplesDir)) {
    console.warn('Examples directory not found:', examplesDir);
    return examples;
  }

  for (const dir of readdirSync(examplesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;

    const metaPath = join(examplesDir, dir.name, 'meta.yml');
    if (existsSync(metaPath)) {
      const content = readFileSync(metaPath, 'utf-8');
      // Simple YAML parsing for title and description
      const titleMatch = content.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
      const descMatch = content.match(/^description:\s*['"]?(.+?)['"]?\s*$/m);

      examples.set(dir.name, {
        id: dir.name,
        title: titleMatch?.[1] || dir.name,
        description: descMatch?.[1] || '',
      });
    } else {
      // Default metadata if no meta.yml
      examples.set(dir.name, {
        id: dir.name,
        title: dir.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        description: '',
      });
    }
  }

  return examples;
}

/**
 * Extract a region from file content
 */
function extractRegion(content: string, regionName: string): string | null {
  const startPattern = new RegExp(`^\\s*//\\s*#region\\s+${regionName}\\s*$`, 'm');
  const endPattern = new RegExp(`^\\s*//\\s*#endregion\\s+${regionName}\\s*$`, 'm');

  const startMatch = startPattern.exec(content);
  if (!startMatch) return null;

  const startIndex = startMatch.index + startMatch[0].length;
  const afterStart = content.slice(startIndex);
  const endMatch = endPattern.exec(afterStart);

  if (!endMatch) return null;

  const regionContent = afterStart.slice(0, endMatch.index);
  return regionContent.trim();
}

/**
 * Get language from file extension
 */
function getLanguage(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.md': 'markdown',
  };
  return langMap[ext] || 'text';
}

/**
 * Read example file content
 */
function readExampleFile(
  exampleId: string,
  filePath: string,
  region?: string
): { content: string; language: string } | null {
  const fullPath = join(examplesDir, exampleId, filePath);

  if (!existsSync(fullPath)) {
    console.warn(`Example file not found: ${fullPath}`);
    return null;
  }

  let content = readFileSync(fullPath, 'utf-8');
  const language = getLanguage(filePath);

  if (region) {
    const regionContent = extractRegion(content, region);
    if (!regionContent) {
      console.warn(`Region "${region}" not found in ${fullPath}`);
      return null;
    }
    content = regionContent;
  }

  return { content, language };
}

/**
 * Process liquid tags in the template
 */
function processTemplate(template: string, examples: Map<string, ExampleMeta>): string {
  // Pattern to match liquid tags
  const tagPattern = /\{%\s+(\w+(?:-\w+)*)\s+([^\s%]+)\s*%\}/g;

  return template.replace(tagPattern, (match, command, args) => {
    if (command === 'example') {
      // {% example name:path#region %} or {% example name:path %}
      if (args.includes(':')) {
        const colonIndex = args.indexOf(':');
        const exampleId = args.slice(0, colonIndex);
        const rest = args.slice(colonIndex + 1);
        const [filePath, region] = rest.split('#');

        const file = readExampleFile(exampleId, filePath, region);
        if (!file) {
          return `<!-- ERROR: Could not load ${args} -->`;
        }

        return '```' + file.language + '\n' + file.content + '\n```';
      } else {
        // {% example name %} - just a link
        const meta = examples.get(args);
        if (!meta) {
          return `[${args}](https://craigory.dev/isolated-workers/examples/${args})`;
        }
        return `[${meta.title}](https://craigory.dev/isolated-workers/examples/${args})`;
      }
    }

    if (command === 'example-link') {
      // {% example-link name %} - link with title
      const meta = examples.get(args);
      if (!meta) {
        return `[${args}](https://craigory.dev/isolated-workers/examples/${args})`;
      }
      return `[${meta.title}](https://craigory.dev/isolated-workers/examples/${args})`;
    }

    // Unknown tag - leave as-is
    console.warn(`Unknown liquid tag: ${match}`);
    return match;
  });
}

function main() {
  const templatePath = join(packageRoot, 'README.md.tmpl');
  const outputPath = join(packageRoot, 'README.md');

  if (!existsSync(templatePath)) {
    console.error('Template not found:', templatePath);
    process.exit(1);
  }

  console.log('Loading examples metadata...');
  const examples = loadExamplesMeta();
  console.log(`Found ${examples.size} examples`);

  console.log('Processing template...');
  const template = readFileSync(templatePath, 'utf-8');
  const output = processTemplate(template, examples);

  writeFileSync(outputPath, output);
  console.log('Generated:', outputPath);
}

main();
