import {expect, it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {StepRow, Stepper} from '../../src/ui/RunningView.js';
import type {Step} from '../../src/contracts.js';
const now = Date.parse('2026-10-12T10:01:00.000Z');
const step: Step = {
  runId: 'r',
  stepId: 'c1',
  stage: 'analyse',
  kind: 'tool',
  name: 'execute_analysis',
  state: 'retried',
  startedAt: '2026-10-12T10:00:00.000Z',
  endedAt: '2026-10-12T10:00:04.000Z',
  summary: 'Ran margin.py',
  detail: 'Binder Error',
};
it('renders a retried step with its detail and duration', () => {
  const html = renderToStaticMarkup(createElement(StepRow, {step, now}));
  expect(html).toContain('class="step retried"');
  expect(html).toContain('Ran margin.py · retried');
  expect(html).toContain('<pre>Binder Error</pre>');
  expect(html).toContain('0:04');
});
it('renders a running step with a live dot and no detail', () => {
  const html = renderToStaticMarkup(
    createElement(StepRow, {step: {...step, state: 'running', endedAt: undefined, detail: undefined}, now}),
  );
  expect(html).toContain('class="dot"');
  expect(html).toContain('1:00');
  expect(html).not.toContain('<details');
});
it('renders the stepper with the current stage and its duration', () => {
  const html = renderToStaticMarkup(
    createElement(Stepper, {stages: [{stage: 'analyse', label: 'Analyse', state: 'running', ms: 4000}]}),
  );
  expect(html).toContain('aria-current="step"');
  expect(html).toContain('0:04');
});
