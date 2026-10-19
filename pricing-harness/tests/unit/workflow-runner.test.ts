import {expect, it} from 'vitest';
import {mkdtemp, access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {WorkflowBudget} from '../../src/agent/workflow/budget.js';
import {StageRunner} from '../../src/agent/workflow/stage-runner.js';
const limits = {milliseconds: 60000, model: 100, tool: 60};
it('force stops an abort-ignoring stage and its children and rejects late publication', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workflow-stall-'));
  const runner = new StageRunner({workerPath: resolve('tests/fixtures/workflow-stall.ts'), graceMs: 30});
  const abort = new AbortController();
  const task = runner.execute({stageDir: dir} as any, new WorkflowBudget(limits), abort.signal, () => {});
  setTimeout(() => abort.abort(), 350);
  await expect(task).rejects.toThrow(/cancel/);
  await new Promise(r => setTimeout(r, 800));
  await expect(access(join(dir, 'late.txt'))).rejects.toThrow();
  expect(runner.activeCount).toBe(0);
}, 5000);
it('records terminal SDK usage during abort grace without accepting late results', async () => {
  const runner = new StageRunner({workerPath: resolve('tests/fixtures/workflow-abort-usage.ts'), graceMs: 100});
  const abort = new AbortController(),
    budget = new WorkflowBudget(limits);
  const events: any[] = [];
  const task = runner.execute({} as any, budget, abort.signal, event => {
    events.push(event);
    if (event.type === 'started') abort.abort();
  });
  await expect(task).rejects.toThrow(/cancel/);
  expect(events.filter(e => e.type === 'usage')).toHaveLength(1);
  expect(budget.metrics().usageComplete).toBe(true);
  expect(budget.metrics().estimatedCostUSD).toBe(0);
  expect(runner.activeCount).toBe(0);
}, 5000);
