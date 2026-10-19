import {expect, it} from 'vitest';
import {createStepsStore} from '../../src/ui/steps-store.js';
import type {Step} from '../../src/contracts.js';
const step = (over: Partial<Step> = {}): Step => ({
  runId: 'r1',
  stepId: 'c1',
  stage: 'analyse',
  kind: 'tool',
  name: 'read',
  state: 'running',
  startedAt: '2026-10-12T10:00:00.000Z',
  summary: 'Read a.csv',
  ...over,
});
it('upserts steps per run, seeds from a snapshot and keeps references stable', () => {
  const store = createStepsStore();
  let calls = 0;
  const off = store.subscribe(() => calls++);
  store.seed([step()]);
  const first = store.get('r1');
  expect(first).toEqual([step()]);
  expect(store.get('r1')).toBe(first);
  store.apply(step({state: 'done'}));
  expect(store.get('r1')).toEqual([step({state: 'done'})]);
  expect(store.get('r1')).not.toBe(first);
  expect(store.get('r2')).toBe(store.get(null));
  expect(calls).toBe(2);
  off();
  store.apply(step());
  expect(calls).toBe(2);
});
