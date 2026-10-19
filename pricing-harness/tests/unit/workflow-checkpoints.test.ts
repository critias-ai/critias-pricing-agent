import {expect, it} from 'vitest';
import {mkdtemp, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hashFile} from '../../src/workspace.js';
import {sealPresentation, loadCheckpoint} from '../../src/agent/workflow/checkpoints.js';
import {bindExploration} from '../../src/agent/workflow/exploration.js';
import {quarterlyCsv, quarterlyExploration} from '../fixtures/exploration.js';

// A stage folder as a query or script leaves it: one result file, and the hash an execution recorded for it.
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'checkpoint-'));
  const stage = join(root, 'stage');
  await mkdir(stage);
  await writeFile(join(root, 'source.csv'), 'amount\n10\n');
  await writeFile(join(stage, 'quarters.csv'), quarterlyCsv);
  const recorded = new Map([['quarters.csv', (await hashFile(join(stage, 'quarters.csv'))).sha256]]);
  const sources = [{path: 'source.csv', ...(await hashFile(join(root, 'source.csv')))}];
  return {root, stage, recorded, sources};
}
const seal = (f: Awaited<ReturnType<typeof fixture>>, conversationId = 'c') =>
  sealPresentation(f.root, f.stage, quarterlyExploration, f.recorded, f.sources, {runId: 'r', conversationId});

it('freezes the presented result files and rebuilds the same values from them', async () => {
  const f = await fixture();
  const {checkpoint, ref} = await seal(f);
  expect(checkpoint.files.map(x => x.name)).toEqual(['quarters.csv']);
  expect(await loadCheckpoint(f.root, ref, 'c')).toBeTruthy();
  expect(await loadCheckpoint(f.root, ref, 'other-chat')).toBeNull();
  const bound = await bindExploration(f.root, checkpoint, ref);
  expect(bound.result?.tables[0]?.rows[0]?.cells.revenue?.value).toBe(10);
  // The delivered values come from the frozen copy: changing the working file afterwards does not matter.
  await writeFile(join(f.stage, 'quarters.csv'), 'quarter,label,revenue,margin\nq1,Q1,999,1\n');
  expect((await bindExploration(f.root, checkpoint, ref)).result?.tables[0]?.rows[0]?.cells.revenue?.value).toBe(10);
});
it('refuses a file that no execution produced or that changed since', async () => {
  const f = await fixture();
  await expect(
    sealPresentation(f.root, f.stage, quarterlyExploration, new Map(), f.sources, {runId: 'r', conversationId: 'c'}),
  ).rejects.toThrow(/not an unchanged output/);
  await writeFile(join(f.stage, 'quarters.csv'), 'quarter,label,revenue,margin\nq1,Q1,1,1\n');
  await expect(seal(f)).rejects.toThrow(/not an unchanged output/);
});
it('invalidates when a frozen file or a source changes', async () => {
  const f = await fixture();
  const {checkpoint, ref} = await seal(f);
  await writeFile(join(f.root, checkpoint.files[0]!.path), 'tampered');
  expect(await loadCheckpoint(f.root, ref, 'c')).toBeNull();
  const g = await fixture();
  const sealed = await seal(g);
  await writeFile(join(g.root, 'source.csv'), 'amount\n11\n');
  expect(await loadCheckpoint(g.root, sealed.ref, 'c')).toBeNull();
});
