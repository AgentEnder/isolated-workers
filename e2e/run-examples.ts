import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';

function lines(...strs: (string | false)[]): string {
  return strs.filter((s) => s).join('\n');
}

const workspaceRoot = join(__dirname, '..');
const examplesRoot = join(workspaceRoot, 'examples');

interface ExampleMeta {
  id: string;
  title: string;
  description: string;
  entryPoint: string;
  commands?: Array<{
    command: string;
    title?: string;
    assertions?: Array<{ contains: string }>;
    exitCode?: number;
  }>;
}

let results = {
  passed: 0,
  failed: 0,
  skipped: 0,
};

// Collect all examples
const examples: { dir: string; meta: ExampleMeta }[] = [];
for (const entry of readdirSync(examplesRoot, {
  withFileTypes: true,
})) {
  const path = entry.name;
  const isDirectory = entry.isDirectory();

  const fullPath = join(examplesRoot, path);
  if (isDirectory) {
    if (path === 'node_modules') {
      continue;
    }
    const metaPath = join(fullPath, 'meta.yml');
    try {
      const metaContent = readFileSync(metaPath, 'utf-8');
      const meta = YAML.parse(metaContent) as ExampleMeta;
      examples.push({ dir: path, meta });
    } catch {
      // No meta.yml, skip
      console.log(`  ⚠️  No meta.yml found in ${path}, skipping`);
      process.exitCode ??= 1;
      results.skipped++;
    }
  }
}

console.log(`Found ${examples.length} examples to run\n`);

// Run each example
for (const { dir, meta } of examples) {
  console.log(`\n▶️\tRunning example: ${meta.title} (${meta.id})`);

  const commands = meta.commands || [];
  if (commands.length === 0) {
    console.log(`  No commands defined for ${meta.id}, skipping`);
    continue;
  }

  for (const cmd of commands) {
    const label = cmd.title || cmd.command;
    const cwd = join(examplesRoot, dir);
    const command = cmd.command.replace('{filename}', meta.entryPoint);

    try {
      const output = execSync(command, {
        cwd,
        encoding: 'utf-8',
        env: process.env,
        timeout: 30000,
      });

      // Check assertions (strip ANSI codes from output first)
      const cleanOutput = output.replace(/\u001b\[\d+m/g, '');
      if (cmd.assertions) {
        for (const assertion of cmd.assertions) {
          if (!cleanOutput.includes(assertion.contains)) {
            console.log(
              `  ❌ Assertion failed: output does not contain "${assertion.contains}"`
            );
            results.failed++;
            continue;
          }
        }
      }

      console.log(`  ✅\t${label}`);
      results.passed++;
    } catch (err) {
      const exitCode = (err as { status?: number }).status ?? 1;
      const expectedExitCode = cmd.exitCode ?? 0;

      if (exitCode === expectedExitCode) {
        // Expected failure
        console.log(`  ✅\t${label} (expected exit code ${exitCode})`);
      } else {
        console.log(
          `  ❌\t${label} (exit code ${exitCode}, expected ${expectedExitCode})`
        );
        const error = err as { stdout?: Buffer; stderr?: Buffer };
        if (error.stdout) console.log(error.stdout.toString());
        if (error.stderr) console.log(error.stderr.toString());
        results.failed++;
      }
    }
  }
}

const { passed, failed, skipped } = results;
const success = failed === 0 && skipped === 0;

// Summary
console.log(
  lines(
    `\n\n=== Test Summary ===`,
    `Passed:\t${passed}`,
    `Failed:\t${failed}`,
    skipped && `Skipped:\t${skipped}`,
    `Overall:\t${success ? 'SUCCESS' : 'FAILURE'}`
  )
);

const exitCode = process.exitCode ?? (success ? 0 : 1);
process.exit(exitCode);
