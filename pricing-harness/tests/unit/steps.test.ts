import {expect, it} from 'vitest';
import {StepTracker, STEP_SUMMARY_CHARS, toolSummary, workerStepEvents} from '../../src/agent/workflow/steps.js';
import type {Step} from '../../src/contracts.js';

it('summarises tool calls with fixed per-tool rules', () => {
  expect(toolSummary('execute_analysis', {filePath: '/w/analyses/r/2-analyst/margin_by_quarter.py'})).toBe(
    'Ran margin_by_quarter.py',
  );
  expect(toolSummary('read', {path: 'files/abc/q3_prices.csv'})).toBe('Read q3_prices.csv');
  expect(toolSummary('write', {path: 'margin.py', content: 'print(1)'})).toBe('Wrote margin.py');
  expect(toolSummary('edit', {path: 'sub/margin.py'})).toBe('Edited margin.py');
  expect(toolSummary('grep', {pattern: 'x'})).toBe('grep');
  const bash = toolSummary('bash', {command: 'python3   -c "print(1)"\n' + 'x'.repeat(100)});
  expect(bash.startsWith('Ran command: python3 -c "print(1)" x')).toBe(true);
  expect(bash).toHaveLength('Ran command: '.length + 60);
  expect(bash.endsWith('…')).toBe(true);
  expect(toolSummary('read', {path: 'a'.repeat(300)})).toHaveLength(STEP_SUMMARY_CHARS);
});

it('maps SDK session events to compact worker step events', () => {
  const model = {tokenSeen: false};
  expect(
    workerStepEvents(
      {type: 'tool_execution_start', toolCallId: 'c1', toolName: 'read', args: {path: 'files/x/prices.csv'}},
      model,
    ),
  ).toEqual([{type: 'tool_start', callId: 'c1', tool: 'read', summary: 'Read prices.csv'}]);
  expect(
    workerStepEvents(
      {
        type: 'tool_execution_end',
        toolCallId: 'c1',
        toolName: 'read',
        isError: true,
        result: {content: [{type: 'text', text: 'E'.repeat(2000)}]},
      },
      model,
    ),
  ).toEqual([{type: 'tool_end', callId: 'c1', isError: true, error: `${'E'.repeat(999)}…`}]);
  expect(
    workerStepEvents(
      {type: 'tool_execution_end', toolCallId: 'c2', toolName: 'read', isError: false, result: {content: []}},
      model,
    ),
  ).toEqual([{type: 'tool_end', callId: 'c2', isError: false}]);
  const token = {type: 'message_update', assistantMessageEvent: {type: 'thinking_delta'}};
  expect(workerStepEvents(token, model)).toEqual([{type: 'model_first_token'}]);
  expect(workerStepEvents(token, model)).toEqual([]);
  expect(workerStepEvents({type: 'agent_start'}, model)).toEqual([]);
});

it('tracks stage, model and tool steps for one run', () => {
  const steps: Step[] = [];
  let t = 0;
  const tracker = new StepTracker(
    'r1',
    s => steps.push(s),
    () => `2026-10-12T10:00:0${t++}.000Z`,
  );
  const stage = tracker.stageStart();
  tracker.event({type: 'model_start'});
  tracker.event({type: 'model_first_token'});
  tracker.event({type: 'model_timing', totalMs: 5});
  tracker.event({type: 'tool_start', callId: 'c1', tool: 'execute_analysis', summary: 'Ran margin.py'});
  tracker.event({type: 'tool_end', callId: 'c1', isError: true, error: 'Binder Error'});
  tracker.event({type: 'tool_start', callId: 'c2', tool: 'read', summary: 'Read prices.csv'});
  tracker.stageEnd(stage);
  expect(steps.map(s => [s.stepId, s.kind, s.stage, s.state, s.summary])).toEqual([
    ['stage-1', 'stage', 'analyse', 'running', 'Analysing'],
    ['model-1', 'model', 'analyse', 'waiting', 'Waiting for model'],
    ['model-1', 'model', 'analyse', 'running', 'Thinking'],
    ['model-1', 'model', 'analyse', 'done', 'Thinking'],
    ['tool-1', 'tool', 'analyse', 'running', 'Ran margin.py'],
    ['tool-1', 'tool', 'analyse', 'retried', 'Ran margin.py'],
    ['tool-2', 'tool', 'analyse', 'running', 'Read prices.csv'],
    ['tool-2', 'tool', 'analyse', 'done', 'Read prices.csv'],
    ['stage-1', 'stage', 'analyse', 'done', 'Analysing'],
  ]);
  expect(steps[5]).toMatchObject({detail: 'Binder Error', endedAt: '2026-10-12T10:00:04.000Z'});
  expect(steps.every(s => s.runId === 'r1')).toBe(true);
});

it('ignores tool ends without a start', () => {
  const steps: Step[] = [];
  const tracker = new StepTracker(
    'r1',
    s => steps.push(s),
    () => 'now',
  );
  tracker.event({type: 'tool_end', callId: 'missing', isError: false});
  expect(steps).toEqual([]);
});

it('gives every tool call its own step even when a provider reuses call IDs', () => {
  const steps: Step[] = [];
  const tracker = new StepTracker(
    'r1',
    s => steps.push(s),
    () => 'now',
  );
  const first = tracker.stageStart();
  tracker.event({type: 'tool_start', callId: 'call_0', tool: 'read', summary: 'Read a.csv'});
  tracker.event({type: 'tool_end', callId: 'call_0', isError: false});
  tracker.stageEnd(first);
  const second = tracker.stageStart();
  tracker.event({type: 'tool_start', callId: 'call_0', tool: 'read', summary: 'Read b.csv'});
  tracker.event({type: 'tool_end', callId: 'call_0', isError: false});
  tracker.stageEnd(second);
  expect(steps.filter(s => s.kind === 'tool').map(s => [s.stepId, s.stage, s.state, s.summary])).toEqual([
    ['tool-1', 'analyse', 'running', 'Read a.csv'],
    ['tool-1', 'analyse', 'done', 'Read a.csv'],
    ['tool-2', 'analyse', 'running', 'Read b.csv'],
    ['tool-2', 'analyse', 'done', 'Read b.csv'],
  ]);
});
