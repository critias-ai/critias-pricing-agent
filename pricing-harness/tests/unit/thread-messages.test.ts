import {expect, it} from 'vitest';
import {appendText, firstAssistantIdByRun, toThreadMessage} from '../../src/ui/thread-messages.js';
import type {ChatMessage} from '../../src/contracts.js';
it('converts each chat message object once and marks assistant messages complete', () => {
  const m: ChatMessage = {id: 'a', role: 'assistant', text: 'Hi', complete: true};
  expect(toThreadMessage(m)).toBe(toThreadMessage(m));
  expect(toThreadMessage(m)).toEqual({
    id: 'a',
    role: 'assistant',
    content: [{type: 'text', text: 'Hi'}],
    status: {type: 'complete', reason: 'stop'},
  });
  expect(toThreadMessage({...m})).not.toBe(toThreadMessage(m));
  expect(toThreadMessage({id: 'u', role: 'user', text: 'Q', complete: true})).not.toHaveProperty('status');
});
it('extracts the sent text and finds the first answer of each run', () => {
  expect(appendText({content: [{type: 'text', text: ' Margins? '}]} as any)).toBe('Margins?');
  const messages: ChatMessage[] = [
    {id: 'u', role: 'user', text: 'q', complete: true, runId: 'r1'},
    {id: 'a', role: 'assistant', text: 'early', complete: true, runId: 'r1'},
    {id: 'b', role: 'assistant', text: 'more', complete: true, runId: 'r1'},
  ];
  expect(firstAssistantIdByRun(messages)).toEqual(new Map([['r1', 'a']]));
});
