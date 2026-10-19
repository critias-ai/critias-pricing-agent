import {expect, it} from 'vitest';
import {EventView} from '../../src/agent/events.js';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hashFile} from '../../src/workspace.js';
import {restoreExplorations} from '../../src/agent/workflow/exploration-restore.js';
import {explorationCheckpoint} from '../fixtures/exploration.js';
const handle = (id: string) =>
  ({session: {sessionId: id, messages: [], subscribe: () => () => {}}, manager: {getBranch: () => []}}) as any;
it('keeps one public transcript across hidden stage sessions and restores it on reload', () => {
  const view = new EventView(handle('public'), {runs: [], artifacts: []});
  view.useLogical();
  view.appendLogical('user', 'question');
  view.appendLogical('assistant', 'checked answer');
  const saved = view.snapshot();
  const reload = new EventView(handle('hidden-new-sdk'), {runs: [], artifacts: []});
  reload.useLogical({sessionId: saved.sessionId, messages: saved.messages});
  expect(reload.snapshot().sessionId).toBe('public');
  expect(reload.snapshot().messages.map(m => m.text)).toEqual(['question', 'checked answer']);
});
it('persists rich message metadata under the same event ID and invalidates only affected runs', () => {
  const view = new EventView(handle('public'), {runs: [], artifacts: []});
  view.useLogical();
  const result = {
    schemaVersion: 1 as const,
    runId: 'run-1',
    checkpoint: {path: 'c.json', sha256: 'a'.repeat(64)},
    scope: {population: 'all', period: 'Q1', basis: 'GBP'},
    coverage: [],
    tables: [],
    charts: [],
  };
  const events: any[] = [];
  view.subscribe(event => events.push(event));
  const message = view.appendLogical('assistant', 'Verified', {runId: 'run-1', exploration: result});
  expect(events[0].payload).toEqual(message);
  view.invalidateExplorations('run-1', 'Source changed');
  expect(view.snapshot().messages[0]).toMatchObject({
    id: message.id,
    text: 'Verified',
    explorationNotice: 'Source changed',
  });
  expect(view.snapshot().messages[0]?.exploration).toBeUndefined();
  expect(events[1].payload.id).toBe(message.id);
});
it('rebuilds serialized numeric payloads from the frozen checkpoint and drops invalid references', async () => {
  const root = await mkdtemp(join(tmpdir(), 'restore-exploration-'));
  const checkpoint = await explorationCheckpoint(root);
  const path = 'checkpoint.json';
  await writeFile(join(root, path), JSON.stringify(checkpoint));
  const ref = {path, ...(await hashFile(join(root, path)))};
  const base: any = {
    id: 'assistant-1',
    role: 'assistant',
    text: 'Verified answer',
    complete: true,
    runId: 'delivery-run',
    exploration: {
      schemaVersion: 1,
      runId: 'run-1',
      checkpoint: ref,
      coverage: [],
      tables: [{rows: [{cells: {value: {value: 999}}}]}],
      charts: [],
    },
  };
  const restored = await restoreExplorations(root, 'conversation-1', [base]);
  expect(restored[0]?.exploration?.tables[0]?.rows[0]?.cells.revenue?.value).toBe(10);
  const wrong = await restoreExplorations(root, 'other-conversation', [base]);
  expect(wrong[0]).toMatchObject({text: 'Verified answer', explorationNotice: expect.any(String)});
  expect(wrong[0]?.exploration).toBeUndefined();
});
it('drops wrong-version, wrong-run, missing and changed checkpoint payloads while preserving historical text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'restore-guards-')),
    checkpoint = await explorationCheckpoint(root),
    path = 'checkpoint.json';
  await writeFile(join(root, path), JSON.stringify(checkpoint));
  const ref = {path, ...(await hashFile(join(root, path)))};
  const message: any = {
    id: 'one',
    role: 'assistant',
    text: 'Checked text',
    complete: true,
    exploration: {schemaVersion: 1, runId: checkpoint.runId, checkpoint: ref},
  };
  for (const patch of [
    {schemaVersion: 2},
    {runId: 'wrong'},
    {checkpoint: {...ref, path: 'missing.json'}},
    {checkpoint: {...ref, sha256: '0'.repeat(64)}},
  ]) {
    const result = await restoreExplorations(root, 'conversation-1', [
      {...message, exploration: {...message.exploration, ...patch}},
      {id: 'old', role: 'assistant', text: 'Historical text', complete: true},
    ]);
    expect(result[0]?.exploration).toBeUndefined();
    expect(result[0]?.explorationNotice).toMatch(/rerun/i);
    expect(result[1]).toEqual({id: 'old', role: 'assistant', text: 'Historical text', complete: true});
  }
});
