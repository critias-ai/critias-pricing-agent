import type {RunRecord, Step, StepStage} from '../contracts.js';
const STAGES: StepStage[] = ['analyse'];
export const STAGE_LABEL: Record<StepStage, string> = {analyse: 'Analyse'};
export type StageView = {
  stage: StepStage;
  label: string;
  state: 'pending' | 'running' | 'done' | 'skipped';
  ms?: number;
};
export const stepMs = (step: Step, now: number) =>
  Math.max(0, (step.endedAt ? Date.parse(step.endedAt) : now) - Date.parse(step.startedAt));
export function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
// Analyse shows as running from the moment the run is active, before the analyst's first step arrives.
export function stageViews(steps: readonly Step[], now: number): StageView[] {
  const anyStage = steps.some(s => s.kind === 'stage');
  return STAGES.map(stage => {
    const own = steps.filter(s => s.kind === 'stage' && s.stage === stage);
    const latest = own.at(-1);
    const label = STAGE_LABEL[stage];
    if (!latest) return {stage, label, state: !anyStage ? 'running' : 'pending'};
    const timed = own.filter(s => s.state !== 'skipped');
    const state = latest.state === 'running' ? 'running' : latest.state === 'skipped' ? 'skipped' : 'done';
    return {stage, label, state, ...(timed.length ? {ms: timed.reduce((sum, s) => sum + stepMs(s, now), 0)} : {})};
  });
}
export type LiveLine = {label: string; waiting: boolean; last?: Step};
export function liveLine(steps: readonly Step[]): LiveLine {
  const open = steps.filter(s => s.state === 'waiting' || s.state === 'running');
  const model = open.filter(s => s.kind === 'model').at(-1);
  const tool = open.filter(s => s.kind === 'tool').at(-1);
  const last = steps.filter(s => s.kind === 'tool' && (s.state === 'done' || s.state === 'retried')).at(-1);
  const label = model
    ? model.state === 'waiting'
      ? 'Waiting for model…'
      : 'Thinking…'
    : tool
      ? `${tool.summary}…`
      : 'Working…';
  return {label, waiting: model?.state === 'waiting', ...(last ? {last} : {})};
}
export function toolGroups(steps: readonly Step[]) {
  const groups: {stage: StepStage; steps: Step[]}[] = [];
  for (const step of steps) {
    if (step.kind !== 'tool') continue;
    const group = groups.at(-1);
    if (group && group.stage === step.stage) group.steps.push(step);
    else groups.push({stage: step.stage, steps: [step]});
  }
  return groups;
}
export function runSummary(steps: readonly Step[], run: Pick<RunRecord, 'startedAt' | 'endedAt'>) {
  const duration = formatDuration(Date.parse(run.endedAt ?? run.startedAt) - Date.parse(run.startedAt));
  const count = steps.filter(s => s.kind === 'tool').length;
  return count ? `${count} steps · ${duration}` : `Took ${duration}`;
}
