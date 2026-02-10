/**
 * Module Pollution Worker Fixture
 *
 * This fixture tests whether multiple worker processes share the same
 * instance of a required module. Each worker tries to modify the shared
 * module's state independently.
 *
 * Expected behavior: Each worker should have its own isolated copy of
 * module-level state. Modifications in one worker should NOT affect
 * another worker's instance of the module.
 */

import { startWorkerServer, Handlers } from 'isolated-workers';
import type { DefineMessages } from 'isolated-workers';
import { state, incrementCounter, setData, getState } from './shared-module.js';
import { resolveDriver } from './resolve-driver.js';

export type Messages = DefineMessages<{
  modifyModule: {
    payload: {
      action: 'increment' | 'set';
      key?: string;
      value?: any;
      workerId: string;
    };
    result: { success: boolean; newState: typeof state };
  };

  getModuleState: {
    payload: { workerId: string };
    result: { state: typeof state; workerId: string };
  };

  resetModuleState: {
    payload: { workerId: string };
    result: { success: boolean };
  };
}>;

const handlers: Handlers<Messages> = {
  modifyModule: ({ action, key, value, workerId }) => {
    console.log(`Worker ${workerId}: Modifying module with action ${action}`);

    if (action === 'increment') {
      const newValue = incrementCounter(workerId);
      console.log(`Worker ${workerId}: Incremented counter to ${newValue}`);
    } else if (action === 'set' && key !== undefined && value !== undefined) {
      setData(key, value, workerId);
      console.log(`Worker ${workerId}: Set ${key} = ${JSON.stringify(value)}`);
    }

    return { success: true, newState: getState() };
  },

  getModuleState: ({ workerId }) => {
    const currentState = getState();
    console.log(
      `Worker ${workerId}: Module state - counter: ${currentState.counter}, lastModifiedBy: ${currentState.lastModifiedBy}`
    );
    return { state: currentState, workerId };
  },

  resetModuleState: ({ workerId }) => {
    state.counter = 0;
    state.data = {};
    state.lastModifiedBy = null;
    console.log(`Worker ${workerId}: Reset module state`);
    return { success: true };
  },
};

export async function startModulePollutionWorker() {
  const server = await startWorkerServer(handlers, { driver: resolveDriver() });
  console.log('Module pollution worker ready');
  return server;
}

startModulePollutionWorker().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
