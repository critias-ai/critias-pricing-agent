import {expect, it} from 'vitest';
import {isTransientFailure, retryTransient, resumePrompt} from '../../src/agent/workflow/transient-error.js';
it('classifies observed SDK connection failures for the shared retry and leaves permanent failures alone', () => {
  for (const error of [
    'Connection error.',
    'ECONNRESET',
    'fetch failed',
    'Request timeout',
    'Request timed out.',
    'HTTP 503 overloaded',
    'OpenAI Responses stream ended before a terminal response event',
  ])
    expect(isTransientFailure(error), error).toBe(true);
  for (const error of ['401 unauthorized', 'Invalid model ID', '400 unsupported argument', 'Insufficient credits'])
    expect(isTransientFailure(error), error).toBe(false);
});
it('resumes a transient failure with a short continuation instead of re-sending the stage prompt', async () => {
  const messages: any[] = [{role: 'assistant', stopReason: 'error', errorMessage: 'Connection error.'}];
  const prompts: string[] = [];
  const gates: string[] = [];
  const session = {
    messages,
    prompt: async (text: string) => {
      prompts.push(text);
      messages.push({role: 'assistant', stopReason: 'stop', content: []});
    },
  };
  const last = await retryTransient(session, async kind => void gates.push(kind));
  expect(prompts).toEqual([resumePrompt]);
  expect(resumePrompt.length).toBeLessThan(200);
  expect(gates).toEqual(['retry']);
  expect(last?.stopReason).toBe('stop');
});
it('leaves permanent failures for the caller without retrying', async () => {
  const session = {
    messages: [{role: 'assistant', stopReason: 'error', errorMessage: '401 unauthorized'}],
    prompt: async () => {
      throw new Error('must not prompt');
    },
  };
  expect((await retryTransient(session, async () => {}))?.errorMessage).toBe('401 unauthorized');
});
