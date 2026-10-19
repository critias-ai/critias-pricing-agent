import {expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createFlow} from '../fixtures/workflow-flow.js';

const stageEvents = () => [
  {type: 'model_start'},
  {type: 'model_first_token'},
  {type: 'tool_start', callId: 'analyst-1', tool: 'read', summary: 'Read source.csv'},
  {type: 'tool_end', callId: 'analyst-1', isError: false},
  {
    type: 'model_timing',
    requestIndex: 1,
    gateWaitMs: 0,
    timeToFirstTokenMs: 1,
    generationMs: 1,
    totalMs: 2,
    outputTokens: 1,
    outputTokensPerSecond: 1,
  },
];

const readSteps = async (path: string) =>
  (await readFile(path, 'utf8'))
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));

it('publishes stage, model and tool steps and writes them to steps.jsonl', async () => {
  const f = await createFlow({turn: () => ({events: stageEvents()})});
  const result = await f.run();
  expect(result.outcome.kind, JSON.stringify(result.outcome)).toBe('complete');
  expect(f.requests).toHaveLength(1);
  const final = new Map(f.steps.map(step => [step.stepId, step]));
  expect([...final.values()].filter(step => step.kind === 'stage').map(step => [step.stage, step.state])).toEqual([
    ['analyse', 'done'],
  ]);
  expect([...final.values()].find(step => step.kind === 'tool')).toMatchObject({
    state: 'done',
    summary: 'Read source.csv',
  });
  const models = [...final.values()].filter(step => step.kind === 'model');
  expect(models).toHaveLength(1);
  expect(models.every(step => step.state === 'done')).toBe(true);
  const lines = await readSteps(join(f.paths.analyses, 'run1', 'steps.jsonl'));
  expect(lines).toEqual(f.steps);
});

it('redacts and caps steps before publishing and persisting them', async () => {
  const key = 'WORKFLOW_STEP_TEST_API_KEY';
  const secret = '123456789';
  const previous = process.env[key];
  process.env[key] = secret;
  try {
    const repeatedSecretField = (limit: number, fill: string) =>
      secret.repeat(Math.floor(limit / secret.length)) + fill.repeat(limit % secret.length);
    const summary = repeatedSecretField(200, 's');
    const detail = repeatedSecretField(1000, 'd');
    const f = await createFlow({
      turn: () => ({
        events: [
          {type: 'tool_start', callId: 'analyst-secret', tool: 'read', summary},
          {type: 'tool_end', callId: 'analyst-secret', isError: true, error: detail},
        ],
      }),
    });
    await f.run();
    const published = f.steps.filter(step => step.kind === 'tool' && step.stage === 'analyse').at(-1);
    expect(published?.summary).toMatch(/^\[REDACTED\]/);
    expect(published?.summary).toHaveLength(200);
    expect(published?.detail).toMatch(/^\[REDACTED\]/);
    expect(published?.detail).toHaveLength(1000);
    expect(f.steps.some(step => JSON.stringify(step).includes(secret))).toBe(false);

    const lines = await readSteps(join(f.paths.analyses, 'run1', 'steps.jsonl'));
    expect(lines).toEqual(f.steps);
    expect(lines.some(step => JSON.stringify(step).includes(secret))).toBe(false);
    expect(lines.filter(step => step.kind === 'tool' && step.stage === 'analyse').at(-1)).toMatchObject({
      summary: published?.summary,
      detail: published?.detail,
    });
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});
