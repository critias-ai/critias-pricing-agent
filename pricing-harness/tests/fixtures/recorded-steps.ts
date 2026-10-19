import {readFileSync} from 'node:fs';
import type {Step, StepStage} from '../../src/contracts.js';
const base = Date.parse('2026-10-12T10:00:00.000Z');
const at = (seconds: number) => new Date(base + seconds * 1000).toISOString();
type Draft = Omit<Step, 'startedAt' | 'endedAt'>;
const tool = (stage: StepStage, n: number, summary: string, retried = false): Draft => ({
  runId: 'synthetic',
  stepId: `${stage}-${n}`,
  stage,
  kind: 'tool',
  name: summary.startsWith('Read') ? 'read' : 'execute_analysis',
  state: retried ? 'retried' : 'done',
  summary,
  ...(retried ? {detail: 'Binder Error: column "q" not found'} : {}),
});
const model = (stage: StepStage, n: number): Draft => ({
  runId: 'synthetic',
  stepId: `${stage}-model-${n}`,
  stage,
  kind: 'model',
  name: 'model',
  state: 'done',
  summary: 'Thinking',
});
// Final states only, four seconds apart (about 100 ms per replayed event); replay derives the start events.
export const syntheticSteps: Step[] = [
  model('analyse', 0),
  tool('analyse', 0, 'Read context.md'),
  tool('analyse', 100, 'Read fixture.csv'),
  ...Array.from({length: 12}, (_, i) => [
    model('analyse', i + 1),
    tool('analyse', i + 1, i === 2 ? 'Ran margin.py' : `Ran step_${i + 1}.py`, i === 2),
  ]).flat(),
].map((step, i) => ({...step, startedAt: at(i * 4), endedAt: at(i * 4 + 2)}));
// Sanitised steps from one real run (plan 1 Task 8).
export const recordedSteps = (): Step[] =>
  readFileSync(new URL('./recorded-steps.jsonl', import.meta.url), 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as Step);
export type ReplayEvent = {delayMs: number; event: Record<string, unknown>};
// Worker-shaped events for one stage, in recorded order, with recorded gaps scaled down.
export function replayEvents(steps: readonly Step[], stage: StepStage, speed = 20): ReplayEvent[] {
  const out: ReplayEvent[] = [];
  const seen = new Set<string>();
  let last: number | undefined;
  const push = (time: string | undefined, event: Record<string, unknown>) => {
    const t = time ? Date.parse(time) : (last ?? 0);
    const delayMs = last === undefined ? 0 : Math.round(Math.min(1500, Math.max(50, (t - last) / speed)));
    out.push({delayMs, event});
    last = Math.max(last ?? t, t);
  };
  for (const step of steps) {
    if (step.stage !== stage || step.kind === 'stage') continue;
    const first = !seen.has(step.stepId);
    seen.add(step.stepId);
    if (step.kind === 'model') {
      if (first) push(step.startedAt, {type: 'model_start'});
      // Steps don't record the first-token time, so it follows the previous transition.
      if (step.state === 'running' || (first && step.state === 'done')) push(undefined, {type: 'model_first_token'});
      if (step.state === 'done')
        push(step.endedAt, {
          type: 'model_timing',
          totalMs: Date.parse(step.endedAt ?? step.startedAt) - Date.parse(step.startedAt),
        });
    } else {
      if (first)
        push(step.startedAt, {type: 'tool_start', callId: step.stepId, tool: step.name, summary: step.summary});
      if (step.state === 'done' || step.state === 'retried')
        push(step.endedAt, {
          type: 'tool_end',
          callId: step.stepId,
          isError: step.state === 'retried',
          ...(step.detail ? {error: step.detail} : {}),
        });
    }
  }
  return out;
}
