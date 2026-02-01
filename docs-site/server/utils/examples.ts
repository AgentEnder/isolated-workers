import fs from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Example metadata parsed from meta.yml
 */
export interface ExampleMetadata {
  id: string;
  path: string;
  title: string;
  description: string;
  entryPoint?: string;
  fileMap?: Record<string, string>;
  commands?: Array<{
    command: string;
    title: string;
    assertions: Array<{ contains: string }>;
  }>;
}

/**
 * Resolve examples directory from workspace root
 */
async function getExamplesDir(): Promise<string> {
  // Try multiple resolution strategies for build-time vs runtime
  const candidates = [
    // From docs-site/server/utils -> workspace root
    path.resolve(__dirname, '../../../examples'),
    // From docs-site during build
    path.resolve(process.cwd(), '../examples'),
    // From workspace root (when running from root)
    path.resolve(process.cwd(), 'examples'),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue to next candidate
    }
  }

  // Fallback - return first candidate even if it doesn't exist
  return candidates[0];
}

/**
 * Scan the examples directory and return metadata for all valid examples.
 * A valid example must have a meta.yml file with id, title, and description.
 */
export async function scanExamples(): Promise<ExampleMetadata[]> {
  const examplesDir = await getExamplesDir();

  try {
    const entries = await fs.readdir(examplesDir, { withFileTypes: true });
    const exampleDirs = entries.filter((entry) => entry.isDirectory());

    const examples: ExampleMetadata[] = [];

    for (const dir of exampleDirs) {
      const metaPath = path.join(examplesDir, dir.name, 'meta.yml');

      try {
        const content = await fs.readFile(metaPath, 'utf-8');
        const parsed = YAML.parse(content) as Partial<ExampleMetadata>;

        // Validate required fields and add id
        if (parsed.title && parsed.description) {
          examples.push({
            id: dir.name,
            path: dirname(metaPath),
            title: parsed.title,
            description: parsed.description,
            entryPoint: parsed.entryPoint,
            fileMap: parsed.fileMap,
            commands: parsed.commands,
          });
        }
      } catch {
        // No meta.yml or invalid, skip this directory
      }
    }

    return examples;
  } catch {
    return [];
  }
}

/**
 * Get all example IDs (useful for generating URLs)
 */
export async function getExampleIds(): Promise<string[]> {
  const examples = await scanExamples();
  return examples.map((ex) => ex.id);
}

/**
 * Get a single example by ID
 */
export async function getExample(id: string): Promise<ExampleMetadata | null> {
  const examples = await scanExamples();
  return examples.find((ex) => ex.id === id) ?? null;
}
