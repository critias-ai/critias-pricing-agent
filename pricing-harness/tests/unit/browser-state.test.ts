import {expect, it} from 'vitest';
import type {HarnessEvent, SessionSnapshot} from '../../src/contracts.js';
import {reduceEvent} from '../../src/ui/state.js';
it('ignores duplicate events and refuses stale or changed-instance deltas until a snapshot', async () => {
  const {reduceEvent} = await import('../../src/ui/state.js');
  const state: SessionSnapshot = {
    serverInstanceId: 'a',
    sequence: 3,
    sessionId: 's',
    busy: false,
    activeRun: null,
    runs: [],
    messages: [],
    artifacts: [],
    activeSteps: [],
  };
  const event = {
    serverInstanceId: 'a',
    sequence: 4,
    sessionId: 's',
    runId: null,
    type: 'message',
    payload: {id: 'm', role: 'assistant', text: 'full message', complete: false},
  } as HarnessEvent;
  const next = reduceEvent(state, event);
  expect(next.messages).toHaveLength(1);
  expect(reduceEvent(next, event)).toBe(next);
  expect(reduceEvent(next, {...event, serverInstanceId: 'b'})).toBe(next);
});

it('keeps unchanged message objects across a settled snapshot', () => {
  const kept = {id: 'a', role: 'assistant', text: 'same', complete: true} as const;
  const state = {serverInstanceId: 'i', sessionId: 's', sequence: 1, messages: [kept]} as unknown as SessionSnapshot;
  const snapshot = {...state, sequence: 2, messages: [{...kept}, {...kept, id: 'b'}]};
  const next = reduceEvent(state, {...state, runId: null, type: 'settled', payload: {snapshot}} as HarnessEvent);
  expect(next.messages[0]).toBe(kept);
  expect(next.messages[1]).toBe(snapshot.messages[1]);
});

it('replaces an updated message in place by id', () => {
  const base: any = {
    serverInstanceId: 'i',
    sessionId: 's',
    sequence: 1,
    busy: true,
    activeRun: null,
    runs: [],
    artifacts: [],
    messages: [
      {id: 'm', role: 'assistant', text: 'Verifying', complete: true, assurance: 'verifying'},
      {id: 'u', role: 'user', text: 'next', complete: true},
    ],
  };
  const next = reduceEvent(base, {
    serverInstanceId: 'i',
    sessionId: 's',
    sequence: 2,
    runId: null,
    type: 'message',
    payload: {id: 'm', role: 'assistant', text: 'Done', complete: true, assurance: 'mixed'},
  } as any);
  expect(next.messages.map(m => m.id)).toEqual(['m', 'u']);
  expect(next.messages[0]).toMatchObject({text: 'Done', assurance: 'mixed'});
});

it('advances the sequence on step events without touching messages', () => {
  const state: SessionSnapshot = {
    serverInstanceId: 'i',
    sequence: 1,
    sessionId: 's',
    busy: true,
    activeRun: null,
    runs: [],
    messages: [{id: 'm', role: 'assistant', text: 'x', complete: true}],
    artifacts: [],
    activeSteps: [],
  };
  const event: HarnessEvent = {
    serverInstanceId: 'i',
    sequence: 2,
    sessionId: 's',
    runId: 'r1',
    type: 'step',
    payload: {
      runId: 'r1',
      stepId: 'c1',
      stage: 'analyse',
      kind: 'tool',
      name: 'read',
      state: 'running',
      startedAt: '2026-10-12T10:00:00.000Z',
      summary: 'Read a.csv',
    },
  };
  const next = reduceEvent(state, event);
  expect(next.sequence).toBe(2);
  expect(next.messages).toBe(state.messages);
  // useSession applies a step to the steps store only when the reducer accepts the event.
  expect(reduceEvent(next, event)).toBe(next);
});
