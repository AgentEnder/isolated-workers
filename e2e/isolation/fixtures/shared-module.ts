/**
 * Shared Mutable Module
 *
 * This module exports a simple mutable state object that can be modified.
 * Used to test whether multiple worker processes truly share the same
 * module instance or have isolated copies.
 *
 * Expected behavior: Each worker process should have its own isolated
 * copy of module-level state - modifications in one worker should NOT
 * affect another worker's instance.
 */

export const state: {
  counter: number;
  data: Record<string, unknown>;
  lastModifiedBy: string | null;
} = {
  counter: 0,
  data: {},
  lastModifiedBy: null,
};

export function incrementCounter(workerId: string): number {
  state.counter++;
  state.lastModifiedBy = workerId;
  return state.counter;
}

export function setData(key: string, value: unknown, workerId: string): void {
  state.data[key] = value;
  state.lastModifiedBy = workerId;
}

export function getState() {
  return { ...state };
}
