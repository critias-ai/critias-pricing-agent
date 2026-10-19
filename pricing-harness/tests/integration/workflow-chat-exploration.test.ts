import {writeFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {mkdtemp, readFile, writeFile, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {Readable} from 'node:stream';
import {openWorkspace} from '../../src/workspace.js';
import {openFileStore} from '../../src/files.js';
import {loadConfig} from '../../src/runtime.js';
import {RunController} from '../../src/agent/runs.js';
import {EventView} from '../../src/agent/events.js';
import {restoreExplorations} from '../../src/agent/workflow/exploration-restore.js';
import {createChatFixtureRunner, fixtureCsv} from '../fixtures/chat-workflow.js';
import {venvPython} from '../fixtures/venv-python.js';
async function setup(
  options: {
    explorationEnabled?: boolean;
    mutateAfterApproval?: boolean;
    mutateCheckpointAfterApproval?: boolean;
  } = {},
) {
  const paths = await openWorkspace(await mkdtemp(join(tmpdir(), 'chat-exploration-'))),
    files = await openFileStore(paths, {maxUploadBytes: 100000});
  const source = await files.saveUpload(Readable.from([fixtureCsv]), 'fixture.csv');
  const config = loadConfig({
    PRICING_WORKSPACE: paths.root,
    PRICING_PROVIDER: 'openrouter',
    PRICING_MODEL: 'offline-synthetic',
    PRICING_PYTHON: venvPython,
  });
  const handle: any = {
    session: {sessionId: 'public', messages: [], subscribe: () => () => {}, dispose: () => {}},
    manager: {},
    bundle: {fingerprint: 'fixture', pricingVersion: '', visualizationVersion: '', skillNames: [], skillPaths: []},
  };
  const view = new EventView(handle, {runs: [], artifacts: []});
  view.useLogical();
  const events: any[] = [];
  view.subscribe(event => events.push(event));
  let mutation: Promise<void> | undefined;
  view.subscribe(event => {
    if (options.mutateCheckpointAfterApproval && event.type === 'message' && event.payload.exploration)
      writeFileSync(join(paths.root, event.payload.exploration.checkpoint.path), '{}');
    if (options.mutateAfterApproval && event.type === 'message' && event.payload.exploration)
      mutation = writeFile(join(paths.root, source.relativePath), 'changed');
  });
  const runner = createChatFixtureRunner();
  const health: any = {agent: {ready: true}, python: {ready: true}};
  const controller = new RunController({
    config,
    paths,
    files,
    handle,
    view,
    health,
    createSession: async () => handle,
    workflowRunner: runner,
    explorationEnabled: options.explorationEnabled,
  });
  return {paths, files, source, view, events, controller, runner, waitMutation: () => mutation};
}
it('delivers executed facts inside one persisted assistant message without report publication', async () => {
  const f = await setup();
  const accepted = await f.controller.submit({requestId: 'one', text: 'Explore synthetic', fileIds: []});
  const run = await f.controller.waitForRun(accepted.runId);
  expect(run.outcome?.kind).toBe('complete');
  expect(run.workflow?.budget.counters.model).toBe(1);
  const message = f.view.snapshot().messages.find(message => message.exploration)!;
  expect(message.text).toContain('Synthetic checked values');
  expect(message.exploration?.tables[0]?.rows.map(row => [row.cells.revenue?.value, row.cells.margin?.value])).toEqual([
    [10, 36.09],
    [20, null],
  ]);
  expect(message.exploration?.tables[0]?.rows[1]?.cells.margin?.reason).toBe('blank in the result file');
  const saved = JSON.parse(
    await readFile(join(f.paths.metadata, 'workflow', f.view.snapshot().sessionId, 'conversation.json'), 'utf8'),
  );
  expect(saved.messages.find((item: any) => item.id === message.id)).toEqual(message);
  expect(await readdir(f.paths.outputs)).toEqual([]);
  await f.controller.close();
});
it('rebuilds tampered conversation values on restart and withholds rich data for changed frozen evidence', async () => {
  const f = await setup();
  const accepted = await f.controller.submit({requestId: 'one', text: 'Explore synthetic', fileIds: []});
  await f.controller.waitForRun(accepted.runId);
  const messages = f.view.snapshot().messages;
  const rich = messages.find(message => message.exploration)!;
  rich.exploration!.tables[0]!.rows[0]!.cells.revenue!.value = 999;
  const restored = await restoreExplorations(f.paths.root, 'public', messages);
  expect(restored.find(message => message.exploration)?.exploration?.tables[0]?.rows[0]?.cells.revenue?.value).toBe(10);
  await writeFile(join(f.paths.root, f.source.relativePath), 'changed');
  const invalid = await restoreExplorations(f.paths.root, 'public', messages);
  expect(invalid.find(message => message.id === rich.id)?.exploration).toBeUndefined();
  expect(invalid.find(message => message.id === rich.id)?.explorationNotice).toMatch(/rerun/i);
  await f.controller.close();
});
it('preserves complete text when optional descriptors are malformed or exploration is disabled', async () => {
  for (const [question, explorationEnabled] of [
    ['malformed views', true],
    ['Explore synthetic', false],
  ] as const) {
    const f = await setup({explorationEnabled});
    const accepted = await f.controller.submit({requestId: 'one', text: question, fileIds: []});
    const run = await f.controller.waitForRun(accepted.runId);
    expect(run.outcome?.kind).toBe('complete');
    expect(f.view.snapshot().messages.some(message => message.exploration)).toBe(false);
    expect(f.view.snapshot().messages.at(-1)?.text).toContain('Synthetic checked values');
    await f.controller.close();
  }
});
it('delivers a reply with a notice when its figures are not in any executed output', async () => {
  const f = await setup();
  const accepted = await f.controller.submit({requestId: 'one', text: 'wrong number', fileIds: []});
  const run = await f.controller.waitForRun(accepted.runId);
  expect(run.outcome?.kind).toBe('complete');
  expect(run.checkpoint).toBeUndefined();
  expect(f.view.snapshot().messages.at(-1)?.text).toMatch(/Not verified against an executed script: 12,345.67/);
  await f.controller.close();
});
it('retracts delivered rich results if sources change before settlement', async () => {
  const g = await setup({mutateAfterApproval: true});
  const next = await g.controller.submit({requestId: 'one', text: 'Explore synthetic', fileIds: []});
  const run = await g.controller.waitForRun(next.runId);
  await g.waitMutation();
  expect(run.outcome?.kind).toBe('no-verified-answer');
  const richEvents = g.events.filter(
    event => event.type === 'message' && event.payload.runId === run.id && event.payload.role === 'assistant',
  );
  expect(richEvents[0].payload.exploration).toBeTruthy();
  // The run's failure message carries the run ID too; only the rich message itself must be retracted.
  const richUpdates = richEvents.filter(event => event.payload.id === richEvents[0].payload.id);
  expect(richUpdates.at(-1).payload.exploration).toBeUndefined();
  await g.controller.close();
});
it('withholds numbers when cancelled and retracts a checkpoint changed after delivery', async () => {
  const f = await setup();
  const accepted = await f.controller.submit({requestId: 'one', text: 'slow synthetic', fileIds: []});
  await new Promise(r => setTimeout(r, 200));
  await f.controller.cancel();
  const cancelled = await f.controller.waitForRun(accepted.runId);
  expect(cancelled.outcome?.kind).toBe('no-verified-answer');
  expect(f.view.snapshot().messages.some(m => m.exploration)).toBe(false);
  await f.controller.close();
  const g = await setup({mutateCheckpointAfterApproval: true});
  const next = await g.controller.submit({requestId: 'two', text: 'Explore synthetic', fileIds: []});
  const invalid = await g.controller.waitForRun(next.runId);
  expect(invalid.outcome?.kind).toBe('no-verified-answer');
  expect(g.view.snapshot().messages.some(m => m.exploration)).toBe(false);
  const delivered = g.events.find(e => e.type === 'message' && e.payload.exploration);
  expect(g.view.snapshot().messages.find(m => m.id === delivered.payload.id)?.explorationNotice).toMatch(/rerun/i);
  const saved = JSON.parse(
    await readFile(join(g.paths.metadata, 'workflow', g.view.snapshot().sessionId, 'conversation.json'), 'utf8'),
  );
  expect(saved.messages.some((m: any) => m.exploration)).toBe(false);
  await g.controller.close();
});
it('continues one analyst session across questions of the same conversation', async () => {
  const f = await setup();
  const fresh: boolean[] = [];
  const execute = f.runner.execute;
  f.runner.execute = async (request, ...rest) => {
    fresh.push(request.fresh);
    return execute(request, ...rest);
  };
  for (const [i, text] of ['Explore synthetic', 'Next fixture question'].entries()) {
    const accepted = await f.controller.submit({requestId: String(i), text, fileIds: []});
    expect((await f.controller.waitForRun(accepted.runId)).outcome?.kind).toBe('complete');
  }
  expect(fresh).toEqual([true, false]);
  await f.controller.close();
});
