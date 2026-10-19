import {expect, it} from 'vitest';
import {EventView} from '../../src/agent/events.js';
import type {Step} from '../../src/contracts.js';
const handle: any = {
  session: {sessionId: 's', subscribe: () => () => {}, messages: []},
  manager: {getBranch: () => []},
  bundle: {},
};
const run = (id: string): any => ({id, state: 'running'});
const step = (over: Partial<Step> = {}): Step => ({
  runId: 'r1',
  stepId: 'call_1',
  stage: 'analyse',
  kind: 'tool',
  name: 'read',
  state: 'running',
  startedAt: '2026-10-12T10:00:00.000Z',
  summary: 'Read prices.csv',
  ...over,
});
it('keeps the active run steps in the snapshot and emits step events', () => {
  const view = new EventView(handle, {runs: [], artifacts: []});
  const events: any[] = [];
  view.subscribe(e => events.push(e));
  view.setRun(run('r1'));
  view.step(step());
  view.step(step({state: 'done', endedAt: '2026-10-12T10:00:01.000Z'}));
  expect(view.snapshot().activeSteps).toEqual([step({state: 'done', endedAt: '2026-10-12T10:00:01.000Z'})]);
  expect(events.at(-1)).toMatchObject({type: 'step', runId: 'r1', payload: {stepId: 'call_1', state: 'done'}});
});

it('ignores steps for other runs and clears steps when the run settles or a new run starts', () => {
  const view = new EventView(handle, {runs: [], artifacts: []});
  view.setRun(run('r1'));
  view.step(step({runId: 'other'}));
  expect(view.snapshot().activeSteps).toEqual([]);
  view.step(step());
  view.setRun(run('r1'));
  expect(view.snapshot().activeSteps).toHaveLength(1);
  view.settleRun(run('r1'), []);
  expect(view.snapshot().activeSteps).toEqual([]);
  view.setRun(run('r2'));
  view.step(step({runId: 'r1'}));
  expect(view.snapshot().activeSteps).toEqual([]);
});

it('does not publish tool, retry or compaction events from the bound main session', () => {
  let listener: (event: any) => void = () => {};
  const live: any = {
    session: {
      sessionId: 's',
      subscribe: (l: (event: any) => void) => {
        listener = l;
        return () => {};
      },
      messages: [],
    },
    manager: {getBranch: () => []},
    bundle: {},
  };
  const view = new EventView(live, {runs: [], artifacts: []});
  const events: any[] = [];
  view.subscribe(e => events.push(e));
  listener({type: 'tool_execution_start', toolCallId: 'c', toolName: 'read', args: {}});
  listener({type: 'auto_retry_start', attempt: 1, maxAttempts: 3});
  listener({type: 'compaction_start'});
  expect(events).toEqual([]);
});

it('announces the run start time with the running status', () => {
  const view = new EventView(handle, {runs: [], artifacts: []});
  const events: any[] = [];
  view.subscribe(e => events.push(e));
  view.setRun({id: 'r1', state: 'running', startedAt: '2026-10-12T10:00:00.000Z'} as any);
  expect(events.at(-1)).toMatchObject({
    type: 'status',
    runId: 'r1',
    payload: {phase: 'running', startedAt: '2026-10-12T10:00:00.000Z'},
  });
});
