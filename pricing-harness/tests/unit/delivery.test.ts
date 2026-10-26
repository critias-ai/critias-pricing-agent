import {expect, it} from 'vitest';
import {failureMessage} from '../../src/agent/workflow/delivery.js';

it("shows the provider's own error text when the provider fails", () => {
  const reason = 'Provider error: 404 model not found: anthropic/claude-haiku-5.5:batch';
  expect(failureMessage(reason)).toContain('model provider returned an error');
  expect(failureMessage(reason)).toContain('404 model not found');
  expect(failureMessage('something else')).toBe(
    'Could not produce a checked answer. Retained analysis files are drafts.',
  );
});
