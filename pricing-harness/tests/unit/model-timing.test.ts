import {expect, it} from 'vitest';
import {ModelTiming} from '../../src/agent/workflow/model-timing.js';
it('separates gate wait, first-token latency and generation', () => {
  const t = new ModelTiming();
  t.start(1000, 15);
  t.token(3000);
  t.token(3500);
  expect(t.end(7000, 400)).toEqual({
    requestIndex: 1,
    gateWaitMs: 15,
    timeToFirstTokenMs: 2000,
    generationMs: 4000,
    totalMs: 6000,
    outputTokens: 400,
    outputTokensPerSecond: 100,
  });
});
it('reports null first-token values when no token streamed', () => {
  const t = new ModelTiming();
  t.start(0, 0);
  expect(t.end(500, undefined)).toMatchObject({
    requestIndex: 1,
    timeToFirstTokenMs: null,
    generationMs: null,
    outputTokens: null,
    outputTokensPerSecond: null,
    totalMs: 500,
  });
  expect(t.end(600, 1)).toBeUndefined();
});
