import {expect, it} from 'vitest';
import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {openWorkspace} from '../../src/workspace.js';
import {openFileStore, loadRuns} from '../../src/files.js';
import {loadConfig} from '../../src/runtime.js';
import {RunController} from '../../src/agent/runs.js';
import {EventView} from '../../src/agent/events.js';
import {StageRunner} from '../../src/agent/workflow/stage-runner.js';
it('settles cancellation once, ignores late worker output, deduplicates and permits the next question', async () => {
  const paths = await openWorkspace(await mkdtemp(join(tmpdir(), 'workflow-controller-'))),
    files = await openFileStore(paths, {maxUploadBytes: 1000});
  const config = loadConfig({
    PRICING_WORKSPACE: paths.root,
    PRICING_PROVIDER: 'openrouter',
    PRICING_MODEL: 'fixture',
    PRICING_PYTHON: '/usr/bin/python3',
  });
  const handle = {
    session: {sessionId: 'public', messages: [], subscribe: () => () => {}, dispose: () => {}},
    manager: {},
    bundle: {fingerprint: 'fixture', pricingVersion: '', visualizationVersion: '', skillPaths: [], skillNames: []},
  } as any;
  const view = new EventView(handle, {runs: [], artifacts: []});
  view.useLogical();
  let settle = 0;
  view.subscribe(e => {
    if (e.type === 'settled' && !e.payload.snapshot.busy) settle++;
  });
  const stall = new StageRunner({workerPath: resolve('tests/fixtures/workflow-stall.ts'), graceMs: 30});
  let first = true;
  let failure: string | undefined;
  const runner = {
    activeCount: 0,
    execute: async (...args: Parameters<StageRunner['execute']>) => {
      if (failure) throw Error(failure);
      if (first) return stall.execute(...args);
      const b = args[1];
      b.debit('model');
      b.usage({input: 1, output: 1, cost: {total: 0}});
      return {schemaVersion: 1 as const, sessionId: 'hidden', text: 'Which metric should I use?', executions: []};
    },
  };
  const health = Object.fromEntries(
    ['agent', 'python', 'reports', 'preview', 'vision'].map(k => [k, {ready: true, detail: 'fixture'}]),
  ) as any;
  const controller = new RunController({
    config,
    paths,
    files,
    handle,
    view,
    health,
    createSession: async () => handle,
    workflowRunner: runner,
  });
  const input = {requestId: 'one', text: 'Review this', fileIds: []};
  const [a, b] = await Promise.all([controller.submit(input), controller.submit(input)]);
  expect(a).toEqual(b);
  await new Promise(r => setTimeout(r, 350));
  await Promise.all([controller.cancel(), controller.cancel()]);
  expect((await controller.waitForRun(a.runId)).state).toBe('cancelled');
  expect(controller.snapshot().busy).toBe(false);
  expect(settle).toBe(1);
  first = false;
  const next = await controller.submit({...input, requestId: 'two', text: 'Next question'});
  expect((await controller.waitForRun(next.runId)).outcome?.kind).toBe('complete');
  expect(controller.snapshot().sessionId).toBe('public');
  expect(controller.snapshot().messages.some(m => m.text === 'Which metric should I use?')).toBe(true);
  expect(
    JSON.parse(await readFile(join(paths.metadata, 'workflow/public/conversation.json'), 'utf8')).messages.length,
  ).toBe(4);
  expect((await loadRuns(paths)).length).toBe(2);
  failure = 'stage handoffRepair budget exhausted: ' + paths.root + '/bad-result-123.45';
  const failed = await controller.submit({...input, requestId: 'three'});
  const final = await controller.waitForRun(failed.runId);
  expect(final.outcome?.reason).toContain(paths.root);
  expect(final.error?.message).not.toContain(paths.root);
  expect(final.error?.message).not.toContain('123.45');
  await controller.close();
}, 5000);
