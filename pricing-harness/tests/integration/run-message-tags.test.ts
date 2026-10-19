import {expect, it} from 'vitest';
import {createFlow} from '../fixtures/workflow-flow.js';
it('tags the delivered reply, a question to the user included, with the run ID', async () => {
  const f = await createFlow({turn: () => ({text: 'Which margin basis should I use?', printed: ''})});
  const result = await f.run();
  expect(result.outcome.kind).toBe('complete');
  expect(f.messages.map(m => [m.text, m.options?.runId])).toEqual([['Which margin basis should I use?', 'run1']]);
});
