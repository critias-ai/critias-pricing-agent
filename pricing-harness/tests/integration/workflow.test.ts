import {expect, it} from 'vitest';
import {existsSync, writeFileSync} from 'node:fs';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFlow, type FlowTurn} from '../fixtures/workflow-flow.js';
import {requiredReport} from '../fixtures/lints.js';
import {quarterlyCsv, quarterlyExploration} from '../fixtures/exploration.js';
import {recheckPrompt} from '../../src/agent/workflow/stage-prompt.js';

const presenting = (over: Partial<FlowTurn> = {}): FlowTurn => ({
  printed: 'quarter revenue margin\nq1 10 36.09',
  results: [{name: 'quarters.csv', text: quarterlyCsv}],
  present: quarterlyExploration,
  ...over,
});

it('starts a fresh session with the whole task and delivers the reply', async () => {
  const f = await createFlow({
    profileSources: async () => [{path: 'files/source.csv', sha256: 's', kind: 'csv', profiles: []}],
    findData: async () => ({
      findingsDir: '/c',
      findings: [
        {
          id: 'F-1',
          detector: 'parse',
          source: 'files/source.csv',
          column: 'amount',
          issue: 'x',
          rows: 1,
          valueAtStake: 1,
          valueColumn: 'amount',
          examples: [],
          fix: null,
          exact: true,
        },
      ],
    }),
  });
  const result = await f.run('Review revenue');
  expect(result.outcome).toEqual({kind: 'complete'});
  expect(f.requests).toHaveLength(1);
  const request = f.requests[0]!;
  expect(request.fresh).toBe(true);
  expect(request.stageDir).toBe(f.stageDir);
  expect(request.prompt).toContain('Question: Review revenue');
  expect(request.prompt).toContain('files/source.csv');
  expect(request.prompt).toContain('"findingsDir":"/c"');
  expect(request.prompt).toContain('Pricing triage');
  expect(request.sources?.map(s => s.path)).toEqual(['files/source.csv']);
  expect(request.until).toBeGreaterThan(Date.now());
  const profiles = JSON.parse(await readFile(join(f.paths.metadata, 'source-profiles.json'), 'utf8'));
  expect(profiles[0].path).toBe('files/source.csv');
  expect(f.messages.at(-1)!.text).toBe('Revenue was £10.');
  expect(f.messages.at(-1)!.options.runId).toBe('run1');
  expect(result.checkpoint).toBeUndefined();
});
it('continues the conversation with a follow-up while the sources are unchanged', async () => {
  const f = await createFlow({
    profileSources: async () => [],
    turn: call => (call === 1 ? presenting() : {text: 'Same.'}),
  });
  await f.run('First question');
  await writeFile(join(f.stageDir, 'keep.txt'), 'earlier work');
  const second = await f.run('And the margin?');
  expect(second.outcome).toEqual({kind: 'complete'});
  const request = f.requests[1]!;
  expect(request.fresh).toBe(false);
  expect(request.prompt).toMatch(/^Follow-up question: And the margin\?\n\nDeadline: /);
  expect(request.prompt).not.toContain('Confirmed business context');
  // Result files recorded in the first turn stay presentable in the next one.
  expect(Object.keys(request.recorded ?? {})).toEqual(['quarters.csv']);
  expect(existsSync(join(f.stageDir, 'keep.txt'))).toBe(true);
  expect(f.messages.at(-1)!.text).toBe('Same.');
  expect(second.checkpoint).toBeUndefined();
});
it('starts over when a source changes', async () => {
  const f = await createFlow();
  await f.run('First question');
  await writeFile(join(f.stageDir, 'keep.txt'), 'earlier work');
  await f.changeSource('amount\n11\n');
  await f.run('Again');
  expect(f.requests[1]!.fresh).toBe(true);
  expect(f.requests[1]!.prompt).toContain('Question: Again');
  expect(existsSync(join(f.stageDir, 'keep.txt'))).toBe(false);
});
it('sends one follow-up in the same session for figures no executed output contains', async () => {
  const turns: FlowTurn[] = [
    {text: 'Revenue was £10 and margin £12,345.67.', printed: 'revenue 10'},
    {text: 'Revenue was £10.', printed: ''},
  ];
  const f = await createFlow({turn: call => turns[call - 1]!});
  const result = await f.run();
  expect(f.requests).toHaveLength(2);
  expect(f.requests[1]!.fresh).toBe(false);
  expect(f.requests[1]!.prompt).toBe(recheckPrompt(['12,345.67']));
  expect(result.outcome.kind).toBe('complete');
  const text = f.messages.at(-1)!.text;
  expect(text).toMatch(/^Revenue was £10\./);
  expect(text).not.toContain('Not verified');
});
it('delivers with a notice naming figures still unchecked after the follow-up', async () => {
  const f = await createFlow({turn: () => ({text: 'Margin was £12,345.67.', printed: 'revenue 10'})});
  const result = await f.run();
  expect(f.requests).toHaveLength(2);
  expect(result.outcome.kind).toBe('complete');
  expect(f.messages.at(-1)!.text).toContain('Not verified against an executed script: 12,345.67.');
});
it('accepts a reply figure that a script printed, rounded to the reply precision', async () => {
  const f = await createFlow({turn: () => ({text: 'Revenue was £139,548.15.', printed: '{"revenue": 139548.1458}'})});
  await f.run();
  expect(f.requests).toHaveLength(1);
  expect(f.messages.at(-1)!.text).toBe('Revenue was £139,548.15.');
});
it('asks once for the result when it was computed but only a question is shown', async () => {
  const turns: FlowTurn[] = [
    {text: 'Which basis should I use for rebates?', printed: 'margin 40.71'},
    {text: 'Margin was 40.71%. Which basis should I use for rebates?', printed: ''},
  ];
  const f = await createFlow({turn: call => turns[call - 1]!});
  await f.run();
  expect(f.requests).toHaveLength(2);
  expect(f.requests[1]!.prompt).toMatch(/shows no result/);
  expect(f.messages.at(-1)!.text).toMatch(/^Margin was 40.71%/);
});
it('applies plugin lints to the reply once', async () => {
  const turns: FlowTurn[] = [
    {text: 'The gross margin rate is 0.4071 this quarter.', printed: '0.4071 40.71'},
    {text: 'The gross margin rate is 40.71% this quarter.', printed: ''},
  ];
  const f = await createFlow({
    turn: call => turns[call - 1]!,
    configure: config => {
      (config as {bundledRoot: string}).bundledRoot = join(process.cwd(), 'bundled');
    },
  });
  await f.run();
  expect(f.requests).toHaveLength(2);
  expect(f.requests[1]!.prompt).toMatch(/^<harness-note>\nRevise your reply: Show margins and rates as percentages/);
});
it('delivers the presented tables from the recorded result file', async () => {
  const f = await createFlow({turn: () => presenting()});
  const result = await f.run();
  const message = f.messages.at(-1)!;
  expect(message.options.exploration.tables[0].rows[0].cells.revenue.value).toBe(10);
  expect(message.options.exploration.tables[0].rows[1].cells.margin.status).toBe('held');
  expect(message.text).toBe('Revenue was £10.');
  const checkpoint = JSON.parse(await readFile(join(f.root, result.checkpoint!.path), 'utf8'));
  expect(checkpoint.files.map((x: {name: string}) => x.name)).toEqual(['quarters.csv']);
});
it('delivers the reply with a notice when a presented file no execution produced', async () => {
  const f = await createFlow({turn: () => ({printed: 'x', present: quarterlyExploration})});
  const result = await f.run();
  expect(result.outcome.kind).toBe('complete');
  expect(result.checkpoint).toBeUndefined();
  expect(f.messages.at(-1)!.options.exploration).toBeUndefined();
  expect(f.messages.at(-1)!.text).toMatch(/views could not be delivered: quarters\.csv is not an unchanged output/);
});
it('names the views that could not be shown', async () => {
  const bad = 'quarter,label,revenue\nq1,Q1,10\n';
  const f = await createFlow({turn: () => presenting({results: [{name: 'quarters.csv', text: bad}]})});
  await f.run();
  expect(f.messages.at(-1)!.text).toMatch(/Some views could not be shown: Table quarterly: column margin is not in/);
});
it('ends without an answer when the analyst fails, is cancelled or the source changes', async () => {
  const failing = await createFlow({turn: () => ({fail: 'stage worker exited (1)'})});
  const failed = await failing.run();
  expect(failed.outcome).toEqual({kind: 'no-verified-answer', reason: 'stage worker exited (1)'});
  expect(failing.messages.at(-1)!.text).toBe('Could not produce a checked answer. Retained analysis files are drafts.');
  const budget = await createFlow({turn: () => ({fail: 'model budget exhausted'})});
  await budget.run();
  expect(budget.messages.at(-1)!.text).toMatch(/ran out of its time or call budget/);
  const aborted = new AbortController();
  aborted.abort();
  const cancelled = await (await createFlow()).run('x', aborted.signal);
  expect(cancelled.outcome.reason).toBe('cancelled');
  const changing = await createFlow({
    turn: (_call, request) => {
      writeFileSync(join(request.config.workspaceRoot, 'files/source.csv'), 'amount\n99\n');
      return {};
    },
  });
  expect((await changing.run()).outcome.kind).toBe('no-verified-answer');
});
it('records the run against one per-turn budget', async () => {
  const f = await createFlow();
  const {workflow} = await f.run();
  expect(workflow.budget.limits).toEqual({milliseconds: 900000, model: 100, tool: 150});
  expect(workflow.budget.counters.model).toBe(1);
  expect(workflow.budget.estimatedCostUSD).toBe(0.01);
  const events = await readFile(join(f.paths.analyses, 'run1', 'events.jsonl'), 'utf8');
  expect(events).toContain('"role":"analyst"');
});
it('asks for a required report once per conversation, not on every follow-up', async () => {
  const turns: FlowTurn[] = [
    {text: 'Gross margin fell 7.59 pp.', printed: '7.59'},
    {text: 'Gross margin fell 7.59 pp. No line is priced ten times its median.', printed: ''},
    {text: 'Drill-down: gross margin of the top product moved 7.59 pp.', printed: ''},
  ];
  // A bundle whose plugin requires one report.
  const bundled = await mkdtemp(join(tmpdir(), 'bundled-'));
  await mkdir(join(bundled, 'pricing-plugin/skills/references'), {recursive: true});
  await writeFile(
    join(bundled, 'pricing-plugin/skills/references/lints.json'),
    JSON.stringify({schemaVersion: 1, lints: [requiredReport]}),
  );
  const f = await createFlow({
    turn: call => turns[call - 1]!,
    configure: config => {
      (config as {bundledRoot: string}).bundledRoot = bundled;
    },
  });
  await f.run();
  expect(f.requests[1]!.prompt).toMatch(/does not report the outlier check/);
  await f.run('Drill into it');
  expect(f.requests).toHaveLength(3);
  expect(f.requests[2]!.prompt).toContain('Drill into it');
});
