import {expect, it, vi} from 'vitest';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openWorkspace} from '../../src/workspace.js';
import {openFileStore} from '../../src/files.js';
import {loadConfig} from '../../src/runtime.js';
import type {AgentHandle} from '../../src/agent/session.js';
it('deduplicates before hashing, holds busy through early agent_end, cancels once, and recovers preflight failure', async () => {
  const {RunController} = await import('../../src/agent/runs.js');
  const {EventView} = await import('../../src/agent/events.js');
  const root = await mkdtemp(join(tmpdir(), 'runs ')),
    paths = await openWorkspace(root),
    files = await openFileStore(paths, {maxUploadBytes: 1000});
  let finish!: () => void,
    called = 0;
  const listeners = new Set<(event: unknown) => void>();
  const session = {
    sessionId: randomUUID(),
    messages: [],
    subscribe: (fn: (event: unknown) => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    prompt: async () => {
      called++;
      for (const fn of listeners) fn({type: 'agent_end', messages: [], willRetry: true});
      await new Promise<void>(r => (finish = r));
    },
    abort: async () => finish(),
    dispose: () => {},
  };
  const handle = {
    session,
    manager: {},
    bundle: {
      fingerprint: 'f',
      pricingVersion: '0.2',
      pricingCommit: 'c',
      visualizationVersion: '0.1',
      skillPaths: [],
      skillNames: [],
    },
  } as unknown as AgentHandle;
  const health = Object.fromEntries(
    ['agent', 'python', 'reports', 'preview', 'vision'].map(k => [k, {ready: true, detail: 'test'}]),
  ) as any;
  const config = loadConfig({
    PRICING_WORKSPACE: root,
    PRICING_PROVIDER: 'openrouter',
    PRICING_MODEL: 'test/model',
    PRICING_PYTHON: '/usr/bin/python3',
  });
  const view = new EventView(handle, {runs: [], artifacts: []});
  view.useLogical();
  const controller = new RunController({
    config,
    paths,
    files,
    handle,
    view,
    health,
    createSession: async () => handle,
    workflowRunner: {
      activeCount: 0,
      execute: async (_request, _budget, signal) => {
        called++;
        await new Promise<void>(resolve => {
          finish = resolve;
          signal.addEventListener('abort', () => resolve(), {once: true});
        });
        throw Error('cancelled');
      },
    },
  });
  await expect(controller.submit({requestId: randomUUID(), text: 'q', fileIds: ['missing']})).rejects.toThrow(/source/);
  expect(controller.snapshot().busy).toBe(false);
  const request = {requestId: randomUUID(), text: 'question', fileIds: []};
  const [a, b] = await Promise.all([controller.submit(request), controller.submit(request)]);
  expect(a).toEqual(b);
  await vi.waitFor(() => expect(called).toBe(1), {timeout: 5000, interval: 10});
  expect(controller.snapshot().busy).toBe(true);
  expect(controller.snapshot().messages.find(m => m.role === 'user')).toMatchObject({text: 'question', runId: a.runId});
  await expect(controller.submit({...request, requestId: randomUUID()})).rejects.toThrow(/busy/i);
  const snapshot = await controller.cancel();
  expect(snapshot.busy).toBe(false);
  expect((await controller.waitForRun(a.runId)).state).toBe('cancelled');
  await controller.close();
});
