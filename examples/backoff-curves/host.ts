/**
 * Backoff Curves Example
 *
 * Demonstrates using backoff curve utilities to configure connection retry
 * strategies when spawning workers. Shows both pre-built presets and custom
 * stepped backoff curves.
 */

import { createWorker } from 'isolated-workers';
import {
  aggressive,
  gentle,
  stepped,
  exponential,
} from 'isolated-workers/backoff-curves';
import type { Messages } from './messages.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerScript = join(__dirname, 'worker.ts');

// --- Pre-built presets ---------------------------------------------------
// Presets bundle { delay, attempts } and spread directly into connection config.

console.log('=== Pre-built Presets ===\n');

console.log('Using aggressive backoff (10ms×10, 100ms×10, 1s×10):');
const w1 = await createWorker<Messages>({
  script: workerScript,
  connection: { ...aggressive },
});
const r1 = await w1.send('ping', { message: 'aggressive' });
console.log(`  Result: ${r1.message}`);
await w1.close();

console.log('Using gentle backoff (100ms×5, 500ms×5, 2s×5):');
const w2 = await createWorker<Messages>({
  script: workerScript,
  connection: { ...gentle },
});
const r2 = await w2.send('ping', { message: 'gentle' });
console.log(`  Result: ${r2.message}`);
await w2.close();

// --- Custom curves -------------------------------------------------------

console.log('\n=== Custom Curves ===\n');

// Stepped: fast probing that escalates
const custom = stepped([5, 5], [50, 5], [500, 5]);
console.log(`Using custom stepped (5ms×5, 50ms×5, 500ms×5) — ${custom.attempts} attempts:`);
const w3 = await createWorker<Messages>({
  script: workerScript,
  connection: { ...custom },
});
const r3 = await w3.send('ping', { message: 'custom-stepped' });
console.log(`  Result: ${r3.message}`);
await w3.close();

// Exponential: classic doubling
const expo = exponential(50, 2, 8);
console.log(`Using exponential (50ms base, 2x factor, 8 attempts):`);
console.log(`  Delay sequence: ${Array.from({ length: 8 }, (_, i) => `${expo.delay(i)}ms`).join(', ')}`);
const w4 = await createWorker<Messages>({
  script: workerScript,
  connection: { ...expo },
});
const r4 = await w4.send('ping', { message: 'exponential' });
console.log(`  Result: ${r4.message}`);
await w4.close();

console.log('\nAll backoff examples completed successfully.');
