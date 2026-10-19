import {expect, it} from 'vitest';
import {readFile, mkdtemp, mkdir, writeFile, readdir} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
it('records newly delivered rich results while retaining compatibility with text-only historical messages', async () => {
  const {collectExplorations} = await import('../../scripts/eval-focused-workflow.mjs');
  const result = {schemaVersion: 1, runId: 'producing-run', tables: [], charts: []};
  expect(
    collectExplorations([
      {role: 'assistant', text: 'checked', exploration: result},
      {role: 'user', text: 'question'},
      {role: 'assistant', text: 'historical'},
    ]),
  ).toEqual([result]);
  expect(collectExplorations()).toEqual([]);
});
it('validates exactly nine manifest messages grouped in three fresh workspaces and obeys all batch stops', async () => {
  const {validateManifest, stopReason, redact} = await import('../../scripts/eval-focused-workflow.mjs');
  const manifest = JSON.parse(
    await readFile(resolve('docs/superpowers/plans/2026-10-08-bounded-agent-workflow/focused-evaluation.json'), 'utf8'),
  );
  expect(validateManifest(manifest).length).toBe(9);
  expect(new Set(validateManifest(manifest).map((x: any) => x.workspaceGroup)).size).toBe(3);
  expect(() => validateManifest({...manifest, plannedMessages: 10})).toThrow(/nine/);
  expect(stopReason({elapsedSeconds: 3600, cost: 1, usageComplete: true})).toMatch(/time/);
  expect(stopReason({elapsedSeconds: 10, cost: 5, usageComplete: true})).toMatch(/cost/);
  expect(stopReason({elapsedSeconds: 10, cost: 0, usageComplete: false})).toMatch(/usage/);
  expect(stopReason({elapsedSeconds: 10, cost: 0, usageComplete: true})).toBeNull();
  expect(redact({text: 'key abcdefghijk'}, ['abcdefghijk'])).not.toContain('abcdefghijk');
});
it('copies only declared raw sources and company files, without seeding old code or evaluator answers', async () => {
  const {prepareWorkspace} = await import('../../scripts/eval-focused-workflow.mjs');
  const root = await mkdtemp(join(tmpdir(), 'eval-fixture-'));
  const pack = join(root, 'pack');
  for (const dir of ['data', 'company', 'prompts']) await mkdir(join(pack, dir), {recursive: true});
  await writeFile(join(pack, 'data/raw.csv'), 'x\n1');
  await writeFile(join(pack, 'company/context.md'), 'company');
  await writeFile(join(pack, 'data_dictionary.md'), 'dictionary');
  await writeFile(join(pack, 'prompts/evaluator-controls.json'), 'private');
  const workspace = join(root, 'workspace');
  await prepareWorkspace(pack, workspace, 'confirmed fixture');
  expect(await readdir(join(workspace, 'files'))).toEqual(['company', 'data', 'data_dictionary.md']);
  await expect(readFile(join(workspace, 'files/prompts/evaluator-controls.json'))).rejects.toThrow();
  await expect(readFile(join(workspace, '.pricing/workflow/analysis-index.json'))).rejects.toThrow();
});
it('prepares a configurable single-prompt experiment without altering the historical manifest', async () => {
  const {prepareConfiguredEvaluation} = await import('../../scripts/eval-configured.mjs');
  const settingsPath = resolve('harness.config.json');
  const before = await readFile(
    resolve('docs/superpowers/plans/2026-10-08-luna-high-ten-minutes-evaluation.json'),
    'utf8',
  );
  const experiment = await prepareConfiguredEvaluation(settingsPath, {});
  expect(experiment.turns).toHaveLength(1);
  expect(experiment.turns[0].prompt).toBe(
    'Review how Lighting & Candles performed over the last five complete quarters.',
  );
  expect(experiment.manifest.model).toBe('openai/gpt-6-luna');
  expect(experiment.manifest.thinkingLevel).toBe('high');
  expect(experiment.config.workflowLimits).toEqual({milliseconds: 900000, model: 100, tool: 150});
  expect(experiment.limits).toEqual({seconds: 1800, estimatedUSD: 1});
  expect(
    await readFile(resolve('docs/superpowers/plans/2026-10-08-luna-high-ten-minutes-evaluation.json'), 'utf8'),
  ).toBe(before);
});

it('runs any manifest given with --manifest instead of the configured one', async () => {
  const {prepareConfiguredEvaluation} = await import('../../scripts/eval-configured.mjs');
  const manifest = resolve('docs/superpowers/plans/2026-10-08-luna-medium-single-evaluation.json');
  const experiment = await prepareConfiguredEvaluation(resolve('harness.config.json'), {}, manifest);
  const original = JSON.parse(await readFile(manifest, 'utf8'));
  expect(experiment.manifest.id).toBe(`configured-${original.id}`);
  expect(experiment.turns.length).toBe(original.plannedMessages);
});
