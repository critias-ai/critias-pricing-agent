import {expect, it} from 'vitest';
import {announcement, messageOutcome} from '../../src/ui/outcome.js';
import type {ChatMessage, RunRecord} from '../../src/contracts.js';
const runs = [
  {id: 'r1', outcome: {kind: 'no-verified-answer'}},
  {id: 'r2', outcome: {kind: 'complete'}},
] as RunRecord[];
const messages: ChatMessage[] = [
  {id: 'u1', role: 'user', text: 'Margins by quarter', complete: true, runId: 'r1'},
  {id: 'a1', role: 'assistant', text: 'Stopped', complete: true, runId: 'r1'},
  {id: 'u2', role: 'user', text: 'Next', complete: true, runId: 'r2'},
  {id: 'a2', role: 'assistant', text: 'Which metric?', complete: true, runId: 'r2'},
];
it('attaches B9 outcomes to the last assistant message of a run', () => {
  expect(messageOutcome(messages, runs, 1)).toEqual({status: 'no-checked-answer', retryQuestion: 'Margins by quarter'});
  expect(messageOutcome(messages, runs, 3)).toEqual({});
  expect(messageOutcome(messages, runs, 0)).toEqual({});
  const twoAnswers = [...messages.slice(0, 2), {...messages[1]!, id: 'a1b'}];
  expect(messageOutcome(twoAnswers, runs, 1)).toEqual({});
  expect(messageOutcome([], runs, -1)).toEqual({});
});
it('announces outcomes', () => {
  expect(announcement({status: 'no-checked-answer'})).toBe('No checked answer');
  expect(announcement({})).toBe('Answer ready');
});
