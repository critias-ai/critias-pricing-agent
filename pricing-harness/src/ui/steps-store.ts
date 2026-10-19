import {useSyncExternalStore} from 'react';
import type {Step} from '../contracts.js';
export const EMPTY_STEPS: readonly Step[] = [];
const upsert = (list: readonly Step[], step: Step) => {
  const index = list.findIndex(s => s.stepId === step.stepId);
  return index < 0 ? [...list, step] : list.map((s, i) => (i === index ? step : s));
};
// Steps per run, kept outside React state so step events never re-render the message list.
export function createStepsStore() {
  const runs = new Map<string, readonly Step[]>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get(runId: string | null | undefined): readonly Step[] {
      return (runId && runs.get(runId)) || EMPTY_STEPS;
    },
    apply(step: Step) {
      runs.set(step.runId, upsert(runs.get(step.runId) ?? EMPTY_STEPS, step));
      notify();
    },
    seed(steps: readonly Step[]) {
      for (const step of steps) runs.set(step.runId, upsert(runs.get(step.runId) ?? EMPTY_STEPS, step));
      if (steps.length) notify();
    },
  };
}
export const stepsStore = createStepsStore();
export const useRunSteps = (runId: string | null | undefined) =>
  useSyncExternalStore(
    stepsStore.subscribe,
    () => stepsStore.get(runId),
    () => EMPTY_STEPS,
  );
