import {expect, it} from 'vitest';
import {formatDuration, liveLine, runSummary, stageViews, toolGroups} from '../../src/ui/run-view.js';
import type {Step} from '../../src/contracts.js';
const s = (over: Partial<Step>): Step => ({
  runId: 'r',
  stepId: 'x',
  stage: 'analyse',
  kind: 'tool',
  name: 'read',
  state: 'done',
  startedAt: '2026-10-12T10:00:00.000Z',
  endedAt: '2026-10-12T10:00:04.000Z',
  summary: 'Read a.csv',
  ...over,
});
const now = Date.parse('2026-10-12T10:01:00.000Z');
it('shows Analyse as running before any stage step arrives', () => {
  expect(stageViews([], now).map(v => v.state)).toEqual(['running']);
});
it('derives the stage from its stage steps', () => {
  const steps = [s({stepId: 'stage-1', kind: 'stage', state: 'running', endedAt: undefined, summary: 'Analysing'})];
  expect(stageViews(steps, now)).toEqual([{stage: 'analyse', label: 'Analyse', state: 'running', ms: 60000}]);
  expect(stageViews([s({stepId: 'stage-1', kind: 'stage'})], now)).toEqual([
    {stage: 'analyse', label: 'Analyse', state: 'done', ms: 4000},
  ]);
});
it('labels the live line from the open model or tool step', () => {
  expect(liveLine([s({stepId: 'm', kind: 'model', state: 'waiting', summary: 'Waiting for model'})])).toMatchObject({
    label: 'Waiting for model…',
    waiting: true,
  });
  expect(liveLine([s({stepId: 'm', kind: 'model', state: 'running'})])).toMatchObject({
    label: 'Thinking…',
    waiting: false,
  });
  expect(liveLine([s({stepId: 't1'}), s({stepId: 't2', state: 'running', summary: 'Ran margin.py'})])).toMatchObject({
    label: 'Ran margin.py…',
    last: {stepId: 't1'},
  });
  expect(liveLine([]).label).toBe('Working…');
});
it('groups tool steps and summarises a finished run', () => {
  const steps = [s({stepId: 'm', kind: 'model'}), s({stepId: 'a1'}), s({stepId: 'a2', state: 'retried'})];
  expect(toolGroups(steps).map(g => [g.stage, g.steps.map(x => x.stepId)])).toEqual([['analyse', ['a1', 'a2']]]);
  const run = {startedAt: '2026-10-12T10:00:00.000Z', endedAt: '2026-10-12T10:03:10.000Z'};
  expect(runSummary(steps, run)).toBe('2 steps · 3:10');
  expect(runSummary([], run)).toBe('Took 3:10');
  expect(formatDuration(-5)).toBe('0:00');
  expect(formatDuration(65_000)).toBe('1:05');
});
