# Step Events (assistant-ui backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream stage, tool and model "step" events from workflow stages to the browser, persist them per run, and carry the active run's steps in the session snapshot, so the new assistant-ui frontend can show a live running view.

**Architecture:** Stage workers (child processes) send compact `tool_start` / `tool_end` / `model_start` / `model_first_token` events to the orchestrator alongside the events they already send. A pure `StepTracker` in the orchestrator process turns those plus stage boundaries into upserted `Step` objects. It redacts each step, appends it to `analyses/<run>/steps.jsonl` and hands it to `EventView`. `EventView` keeps the active run's steps in the snapshot (`activeSteps`) and publishes a `step` SSE event. The legacy `tool` event and the 5-second progress ticker are removed.

**Tech Stack:** TypeScript (NodeNext ESM), Node child processes, Fastify SSE, Vitest.

**Spec:** [`docs/superpowers/specs/2026-10-12-assistant-ui-frontend-design.md`](../specs/2026-10-12-assistant-ui-frontend-design.md), sections "Backend contract", "Trust wording" and "Order of work" step 1. Decision IDs B1–B4, B10, B11, X1, X4 in the [brainstorm guide](../../research/assistant-ui-brainstorm-guide-2026-10-10.md).

**This is plan 1 of 2.** Plan 2 (the new frontend) builds on it. Between the two plans, the old UI keeps working but no longer shows the "analysis: 45s elapsed" activity line. That's accepted: the old UI is being replaced (spec, "Migration").

---

## Before you start

All commands run from `pricing-harness/` (the npm package inside the repo).

- Branch from the current `fix/unix-audit` HEAD, which holds 32 commits not yet on `main` that this work depends on:

  ```bash
  git switch -c feat/assistant-ui-steps
  ```

- Baseline (verified 2026-10-12): `npx vitest run` → 60 files, 291 tests pass; `npx tsc --noEmit` → no output.

Useful commands:

| Command | Purpose |
|---|---|
| `npx vitest run <file>` | Run one test file |
| `npx vitest run` | All unit + integration tests |
| `npx tsc --noEmit` | Typecheck (includes `tests/**`) |
| `npm run format` | Prettier write; run before each commit |
| `npm run test:browser` | Playwright specs against the offline fixture server |

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/contracts.ts` | Modify | `Step` types, `step` event, `activeSteps` in snapshot; remove `tool` event; narrow `status` phases |
| `src/agent/events.ts` | Modify | `EventView.step()`, `activeSteps` lifecycle; remove `progress()` and legacy tool emission |
| `src/agent/workflow/steps.ts` | Create | Pure step logic: `stageOf`, `toolSummary`, `workerStepEvents`, `StepTracker` |
| `src/agent/workflow/worker.ts` | Modify | Send compact step events |
| `src/agent/workflow/orchestrator.ts` | Modify | Own a `StepTracker`, write `steps.jsonl`, `onStep` option; remove `onProgress` and ticker |
| `src/agent/runs.ts` | Modify | Wire `onStep` → `view.step` |
| `src/agent/workflow/delivery.ts` | Modify | "independently verified" wording |
| `src/ui/useSession.ts` | Modify | Drop the removed `tool` event branch (typecheck only) |
| `tests/unit/steps.test.ts` | Create | Unit tests for `steps.ts` |
| `tests/unit/event-view.test.ts` | Modify | Step snapshot and event tests |
| `tests/integration/workflow-steps.test.ts` | Create | Orchestrator publishes and persists steps |
| `tests/fixtures/workflow-flow.ts` | Modify | Capture `steps` from `onStep` |
| `tests/integration/workflow.test.ts`, `tests/integration/workflow-self-check.test.ts` | Modify | Drop `onProgress` |
| `tests/browser/fixture-server.ts` | Modify | Drop `view.progress` call |
| `tests/unit/browser-state.test.ts` | Modify | `activeSteps: []` in snapshot literal |
| `tests/unit/delivery.test.ts`, `tests/integration/checked-figures-delivery.test.ts` | Modify | New wording |
| `tests/fixtures/recorded-steps.jsonl` | Create (Task 8) | Sanitised steps from one real run, for plan 2 |

---

### Task 1: Step contract and `EventView` step state

**Files:**
- Modify: `src/contracts.ts`
- Modify: `src/agent/events.ts`
- Modify: `tests/unit/event-view.test.ts`
- Modify: `tests/unit/browser-state.test.ts:6-14`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/event-view.test.ts`:

```ts
import type {Step} from '../../src/contracts.js';
const run = (id: string): any => ({id, state: 'running'});
const step = (over: Partial<Step> = {}): Step => ({
  runId: 'r1',
  stepId: 'call_1',
  stage: 'analyse',
  kind: 'tool',
  name: 'read',
  state: 'running',
  startedAt: '2026-10-12T10:00:00.000Z',
  summary: 'Read prices.csv',
  ...over,
});
it('keeps the active run steps in the snapshot and emits step events', () => {
  const view = new EventView(handle, {runs: [], artifacts: []});
  const events: any[] = [];
  view.subscribe(e => events.push(e));
  view.setRun(run('r1'));
  view.step(step());
  view.step(step({state: 'done', endedAt: '2026-10-12T10:00:01.000Z'}));
  expect(view.snapshot().activeSteps).toEqual([step({state: 'done', endedAt: '2026-10-12T10:00:01.000Z'})]);
  expect(events.at(-1)).toMatchObject({type: 'step', runId: 'r1', payload: {stepId: 'call_1', state: 'done'}});
});
it('ignores steps for other runs and clears steps when the run settles or a new run starts', () => {
  const view = new EventView(handle, {runs: [], artifacts: []});
  view.setRun(run('r1'));
  view.step(step({runId: 'other'}));
  expect(view.snapshot().activeSteps).toEqual([]);
  view.step(step());
  view.setRun(run('r1'));
  expect(view.snapshot().activeSteps).toHaveLength(1);
  view.settleRun(run('r1'), []);
  expect(view.snapshot().activeSteps).toEqual([]);
  view.setRun(run('r2'));
  view.step(step({runId: 'r1'}));
  expect(view.snapshot().activeSteps).toEqual([]);
});
```

Move the `import type {Step}` line up next to the existing imports at the top of the file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/event-view.test.ts`
Expected: FAIL with `view.step is not a function`.

- [ ] **Step 3: Add the step types to `src/contracts.ts`**

Insert directly after the `AssistantMessageOptions` type (ends at about line 68):

```ts
export type StepStage = 'plan' | 'analyse' | 'verify';
export type StepKind = 'stage' | 'tool' | 'model';
export type StepState = 'waiting' | 'running' | 'done' | 'retried' | 'skipped';
// One unit of visible work in a run; later events with the same stepId replace earlier ones.
export type Step = {
  runId: string;
  stepId: string;
  stage: StepStage;
  kind: StepKind;
  name: string;
  state: StepState;
  startedAt: string;
  endedAt?: string;
  summary: string;
  detail?: string;
};
```

In `SessionSnapshot`, replace:

```ts
  messages: ChatMessage[];
  artifacts: Artifact[];
};
```

with:

```ts
  messages: ChatMessage[];
  artifacts: Artifact[];
  activeSteps: Step[];
};
```

In the `HarnessEvent` union, add a new member directly after the `message` member:

```ts
  | {type: 'step'; payload: Step}
```

(Leave the `tool` member in place for now; Task 5 removes it.)

- [ ] **Step 4: Implement step state in `src/agent/events.ts`**

Add `Step` to the type import from `'../contracts.js'`.

In the constructor's initial state, replace:

```ts
      messages: [],
      ...initial,
```

with:

```ts
      messages: [],
      activeSteps: [],
      ...initial,
```

Replace `setRun`:

```ts
  setRun(run: RunRecord) {
    if (this.state.activeRun?.id !== run.id) this.state.activeSteps = [];
    this.state.busy = true;
    this.state.activeRun = structuredClone(run);
    this.upsertRun(run);
    this.emit({
      type: 'status',
      payload: {phase: run.state === 'cancelling' ? 'cancelling' : 'running', detail: run.state},
    });
  }
```

In `settleRun`, add `this.state.activeSteps = [];` as the first line of the method body.

Add a new method directly after `setRun`:

```ts
  step(step: Step) {
    if (step.runId !== this.state.activeRun?.id) return;
    const index = this.state.activeSteps.findIndex(s => s.stepId === step.stepId);
    if (index < 0) this.state.activeSteps.push(structuredClone(step));
    else this.state.activeSteps[index] = structuredClone(step);
    this.emit({type: 'step', payload: step});
  }
```

- [ ] **Step 5: Fix the typed snapshot literal in `tests/unit/browser-state.test.ts`**

In the first test's `const state: SessionSnapshot = {...}` literal, replace:

```ts
    messages: [],
    artifacts: [],
  };
```

with:

```ts
    messages: [],
    artifacts: [],
    activeSteps: [],
  };
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx vitest run tests/unit/event-view.test.ts tests/unit/browser-state.test.ts && npx tsc --noEmit`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/contracts.ts src/agent/events.ts tests/unit/event-view.test.ts tests/unit/browser-state.test.ts
git commit -m "feat: add step event contract and active-run steps to the session snapshot"
```

---

### Task 2: Pure step logic (`steps.ts`)

**Files:**
- Create: `src/agent/workflow/steps.ts`
- Test: `tests/unit/steps.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/steps.test.ts`:

```ts
import {expect, it} from 'vitest';
import {
  StepTracker,
  STEP_SUMMARY_CHARS,
  toolSummary,
  workerStepEvents,
} from '../../src/agent/workflow/steps.js';
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
  const tracker = new StepTracker('r1', s => steps.push(s), () => `2026-10-12T10:00:0${t++}.000Z`);
  const stage = tracker.stageStart('analyst');
  tracker.event('analyst', {type: 'model_start'});
  tracker.event('analyst', {type: 'model_first_token'});
  tracker.event('analyst', {type: 'model_timing', totalMs: 5});
  tracker.event('analyst', {type: 'tool_start', callId: 'c1', tool: 'execute_analysis', summary: 'Ran margin.py'});
  tracker.event('analyst', {type: 'tool_end', callId: 'c1', isError: true, error: 'Binder Error'});
  tracker.event('analyst', {type: 'tool_start', callId: 'c2', tool: 'read', summary: 'Read prices.csv'});
  tracker.stageEnd(stage);
  expect(steps.map(s => [s.stepId, s.kind, s.stage, s.state, s.summary])).toEqual([
    ['stage-1', 'stage', 'analyse', 'running', 'Analysing'],
    ['model-1', 'model', 'analyse', 'waiting', 'Waiting for model'],
    ['model-1', 'model', 'analyse', 'running', 'Thinking'],
    ['model-1', 'model', 'analyse', 'done', 'Thinking'],
    ['c1', 'tool', 'analyse', 'running', 'Ran margin.py'],
    ['c1', 'tool', 'analyse', 'retried', 'Ran margin.py'],
    ['c2', 'tool', 'analyse', 'running', 'Read prices.csv'],
    ['c2', 'tool', 'analyse', 'done', 'Read prices.csv'],
    ['stage-1', 'stage', 'analyse', 'done', 'Analysing'],
  ]);
  expect(steps[5]).toMatchObject({detail: 'Binder Error', endedAt: '2026-10-12T10:00:04.000Z'});
  expect(steps.every(s => s.runId === 'r1')).toBe(true);
});

it('records a skipped verification and ignores tool ends without a start', () => {
  const steps: Step[] = [];
  const tracker = new StepTracker('r1', s => steps.push(s), () => 'now');
  tracker.event('verifier', {type: 'tool_end', callId: 'missing', isError: false});
  tracker.verifySkipped();
  expect(steps).toEqual([
    {
      runId: 'r1',
      stepId: 'verify-skipped',
      stage: 'verify',
      kind: 'stage',
      name: 'verify',
      state: 'skipped',
      startedAt: 'now',
      endedAt: 'now',
      summary: 'Not needed',
    },
  ]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/steps.test.ts`
Expected: FAIL with `Failed to load url ../../src/agent/workflow/steps.js` (module does not exist).

- [ ] **Step 3: Create `src/agent/workflow/steps.ts`**

```ts
import type {Step, StepStage, StepState} from '../../contracts.js';
import type {ActiveRole} from './contracts.js';
export const STEP_SUMMARY_CHARS = 200;
export const STEP_DETAIL_CHARS = 1000;
const TOKEN_EVENTS = ['text_delta', 'thinking_delta', 'toolcall_start', 'toolcall_delta'];
const STAGE_SUMMARY: Record<StepStage, string> = {plan: 'Planning', analyse: 'Analysing', verify: 'Verifying'};
const clip = (text: string, limit: number) => (text.length > limit ? `${text.slice(0, limit - 1)}…` : text);
const fileName = (path: unknown) =>
  String(path ?? '')
    .split(/[\\/]/)
    .filter(Boolean)
    .at(-1) ?? '';
export const stageOf = (role: ActiveRole): StepStage =>
  role === 'coordinator' ? 'plan' : role === 'analyst' ? 'analyse' : 'verify';
// Fixed per-tool wording from the call's arguments; never model-written.
export function toolSummary(tool: string, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  const summary =
    tool === 'execute_analysis'
      ? `Ran ${fileName(a.filePath)}`
      : tool === 'read'
        ? `Read ${fileName(a.path)}`
        : tool === 'write'
          ? `Wrote ${fileName(a.path)}`
          : tool === 'edit'
            ? `Edited ${fileName(a.path)}`
            : tool === 'bash'
              ? `Ran command: ${clip(
                  String(a.command ?? '')
                    .replace(/\s+/g, ' ')
                    .trim(),
                  60,
                )}`
              : tool;
  return clip(summary, STEP_SUMMARY_CHARS);
}
const resultText = (result: unknown) =>
  ((result as {content?: {type: string; text?: string}[]})?.content ?? [])
    .filter(c => c.type === 'text')
    .map(c => c.text ?? '')
    .join('\n');
// Compact step events a stage worker sends to the controller for one SDK session event.
export function workerStepEvents(raw: unknown, model: {tokenSeen: boolean}): Record<string, unknown>[] {
  const event = raw as {type: string; [key: string]: any};
  if (event.type === 'tool_execution_start')
    return [
      {
        type: 'tool_start',
        callId: event.toolCallId,
        tool: event.toolName,
        summary: toolSummary(event.toolName, event.args),
      },
    ];
  if (event.type === 'tool_execution_end')
    return [
      {
        type: 'tool_end',
        callId: event.toolCallId,
        isError: event.isError === true,
        ...(event.isError ? {error: clip(resultText(event.result), STEP_DETAIL_CHARS)} : {}),
      },
    ];
  if (
    event.type === 'message_update' &&
    !model.tokenSeen &&
    TOKEN_EVENTS.includes(event.assistantMessageEvent?.type)
  ) {
    model.tokenSeen = true;
    return [{type: 'model_first_token'}];
  }
  return [];
}
// Turns stage boundaries and worker step events into upserted UI steps for one run.
export class StepTracker {
  private stages = 0;
  private models = 0;
  private open = new Map<string, Step>();
  private model?: Step;
  constructor(
    private runId: string,
    private publish: (step: Step) => void,
    private now: () => string = () => new Date().toISOString(),
  ) {}
  stageStart(role: ActiveRole): string {
    const stage = stageOf(role);
    const step: Step = {
      runId: this.runId,
      stepId: `stage-${++this.stages}`,
      stage,
      kind: 'stage',
      name: stage,
      state: 'running',
      startedAt: this.now(),
      summary: STAGE_SUMMARY[stage],
    };
    this.open.set(step.stepId, step);
    this.emit(step);
    return step.stepId;
  }
  // Closes the stage and anything its worker left open.
  stageEnd(stageId: string) {
    const endedAt = this.now();
    for (const step of [...this.open.values()]) if (step.kind !== 'stage') this.close(step, 'done', endedAt);
    const stage = this.open.get(stageId);
    if (stage) this.close(stage, 'done', endedAt);
  }
  verifySkipped() {
    const at = this.now();
    this.emit({
      runId: this.runId,
      stepId: 'verify-skipped',
      stage: 'verify',
      kind: 'stage',
      name: 'verify',
      state: 'skipped',
      startedAt: at,
      endedAt: at,
      summary: 'Not needed',
    });
  }
  event(role: ActiveRole, event: Record<string, any>) {
    const stage = stageOf(role);
    if (event.type === 'tool_start') {
      const step: Step = {
        runId: this.runId,
        stepId: String(event.callId),
        stage,
        kind: 'tool',
        name: String(event.tool),
        state: 'running',
        startedAt: this.now(),
        summary: clip(String(event.summary ?? event.tool), STEP_SUMMARY_CHARS),
      };
      this.open.set(step.stepId, step);
      this.emit(step);
    }
    if (event.type === 'tool_end') {
      const step = this.open.get(String(event.callId));
      if (step)
        this.close(
          step,
          event.isError ? 'retried' : 'done',
          this.now(),
          event.isError ? clip(String(event.error ?? ''), STEP_DETAIL_CHARS) : undefined,
        );
    }
    if (event.type === 'model_start') {
      this.model = {
        runId: this.runId,
        stepId: `model-${++this.models}`,
        stage,
        kind: 'model',
        name: 'model',
        state: 'waiting',
        startedAt: this.now(),
        summary: 'Waiting for model',
      };
      this.open.set(this.model.stepId, this.model);
      this.emit(this.model);
    }
    if (event.type === 'model_first_token' && this.model) {
      this.model = {...this.model, state: 'running', summary: 'Thinking'};
      this.open.set(this.model.stepId, this.model);
      this.emit(this.model);
    }
    if (event.type === 'model_timing' && this.model) this.close(this.model, 'done', this.now());
  }
  private close(step: Step, state: StepState, endedAt: string, detail?: string) {
    this.open.delete(step.stepId);
    if (this.model?.stepId === step.stepId) this.model = undefined;
    this.emit({...step, state, endedAt, ...(detail ? {detail} : {})});
  }
  private emit(step: Step) {
    this.publish({...step});
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/steps.test.ts && npx tsc --noEmit`
Expected: 4 tests PASS; typecheck prints nothing.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/agent/workflow/steps.ts tests/unit/steps.test.ts
git commit -m "feat: add step tracker and per-tool step summaries"
```

---

### Task 3: Stage workers send step events

The worker runs in a child process and has no direct unit test. Its mapping logic is `workerStepEvents` (tested in Task 2). Task 8's real run checks the worker end to end.

**Files:**
- Modify: `src/agent/workflow/worker.ts:21` (imports), `:187-194` (stream wrapper), `:212-213` (subscribe)

- [ ] **Step 1: Import the mapper**

After the line `import {detectHandoff} from './recorded-output.js';` add:

```ts
import {workerStepEvents} from './steps.js';
```

- [ ] **Step 2: Announce each model request**

Replace:

```ts
  const timing = new ModelTiming();
  session.agent.streamFunction = async (...args) => {
    const waitStarted = Date.now();
    await gate('model');
    timing.start(Date.now(), Date.now() - waitStarted);
    return stream(...args);
  };
```

with:

```ts
  const timing = new ModelTiming();
  const model = {tokenSeen: false};
  session.agent.streamFunction = async (...args) => {
    const waitStarted = Date.now();
    await gate('model');
    timing.start(Date.now(), Date.now() - waitStarted);
    model.tokenSeen = false;
    emit({type: 'model_start'});
    return stream(...args);
  };
```

- [ ] **Step 3: Forward tool and first-token step events**

Replace:

```ts
  session.subscribe(event => {
    if (event.type === 'tool_execution_start') operations.set(event.toolCallId, event.args);
```

with:

```ts
  session.subscribe(event => {
    for (const step of workerStepEvents(event, model)) emit(step);
    if (event.type === 'tool_execution_start') operations.set(event.toolCallId, event.args);
```

The existing `model_timing` event at `message_end` closes the model step, so no extra end event is needed.

- [ ] **Step 4: Typecheck and run the runner tests**

Run: `npx tsc --noEmit && npx vitest run tests/unit/workflow-runner.test.ts tests/unit/model-timing.test.ts`
Expected: typecheck prints nothing; tests PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/agent/workflow/worker.ts
git commit -m "feat: send tool and model step events from stage workers"
```

---

### Task 4: Orchestrator publishes and persists steps

**Files:**
- Modify: `src/agent/workflow/orchestrator.ts`
- Modify: `src/agent/runs.ts:125`
- Modify: `tests/fixtures/workflow-flow.ts`
- Modify: `tests/integration/workflow.test.ts:264`, `tests/integration/workflow-self-check.test.ts:145`
- Test: `tests/integration/workflow-steps.test.ts`

- [ ] **Step 1: Let the flow fixture capture steps**

In `tests/fixtures/workflow-flow.ts`:

1. Add to the imports: `import type {Step} from '../../src/contracts.js';`
2. Replace `    envelopes: any[] = [];` with:

   ```ts
       envelopes: any[] = [],
       steps: Step[] = [];
   ```

3. Replace `    onProgress: () => {},` with `    onStep: step => steps.push(step),`
4. Replace `  return {root, paths, run, calls, messages, updates, inputs, envelopes, config};` with:

   ```ts
     return {root, paths, run, calls, messages, updates, inputs, envelopes, config, steps};
   ```

- [ ] **Step 2: Write the failing integration test**

Create `tests/integration/workflow-steps.test.ts`:

```ts
import {expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createFlow} from '../fixtures/workflow-flow.js';
const stageEvents = (role: string) => [
  {type: 'model_start'},
  {type: 'model_first_token'},
  {type: 'tool_start', callId: `${role}-1`, tool: 'read', summary: 'Read source.csv'},
  {type: 'tool_end', callId: `${role}-1`, isError: false},
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
it('publishes stage, model and tool steps and writes them to steps.jsonl', async () => {
  const f = await createFlow({extraEvents: stageEvents});
  const result = await f.run();
  expect(result.outcome.kind).toBe('complete');
  expect(f.calls).toEqual(['coordinator', 'analyst']);
  const final = new Map(f.steps.map(s => [s.stepId, s]));
  expect([...final.values()].filter(s => s.kind === 'stage').map(s => [s.stage, s.state])).toEqual([
    ['plan', 'done'],
    ['analyse', 'done'],
    ['verify', 'skipped'],
  ]);
  expect(final.get('analyst-1')).toMatchObject({stage: 'analyse', kind: 'tool', state: 'done', summary: 'Read source.csv'});
  expect([...final.values()].filter(s => s.kind === 'model').every(s => s.state === 'done')).toBe(true);
  const lines = (await readFile(join(f.paths.analyses, 'run1', 'steps.jsonl'), 'utf8'))
    .trim()
    .split('\n')
    .map(l => JSON.parse(l));
  expect(lines).toEqual(f.steps);
});
it('shows a live verify stage, not a skipped one, when independent review runs', async () => {
  const f = await createFlow({
    coordinatorData: data => {
      data.independentReview = true;
    },
  });
  await f.run('Please double-check revenue');
  const stages = f.steps.filter(s => s.kind === 'stage');
  expect(stages.some(s => s.stage === 'verify' && s.state === 'done')).toBe(true);
  expect(stages.some(s => s.state === 'skipped')).toBe(false);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/integration/workflow-steps.test.ts`
Expected: FAIL. `f.steps` is empty because `onStep` is never called (`expected [] to deeply equal [...]`).

- [ ] **Step 4: Wire the tracker into `src/agent/workflow/orchestrator.ts`**

4a. Imports. Replace:

```ts
import type {AssistantMessageOptions, ChatMessage, RunRecord, SourceFile} from '../../contracts.js';
```

with:

```ts
import type {AssistantMessageOptions, ChatMessage, RunRecord, SourceFile, Step} from '../../contracts.js';
import {StepTracker} from './steps.js';
```

4b. Options. Replace:

```ts
      onProgress: (
        phase: 'planning' | 'analysis' | 'verification' | 'visualization' | 'finalization',
        detail: string,
      ) => void;
```

with:

```ts
      onStep?: (step: Step) => void;
```

4c. `execute()`. Replace the whole method:

```ts
  async execute(run: RunRecord, question: string, sources: SourceFile[], signal: AbortSignal) {
    const log = new EventLog(join(this.options.paths.analyses, run.id, 'events.jsonl'), redactSecrets);
    const stepLog = new EventLog(join(this.options.paths.analyses, run.id, 'steps.jsonl'), redactSecrets);
    const steps = new StepTracker(run.id, step => {
      const safe = JSON.parse(redactSecrets(step)) as Step;
      void stepLog.append(safe);
      this.options.onStep?.(safe);
    });
    try {
      return await this.executeWithLog(run, question, sources, signal, log, steps);
    } finally {
      await log.flush();
      await stepLog.flush();
    }
  }
```

4d. `executeWithLog` signature. Replace:

```ts
    signal: AbortSignal,
    log: EventLog,
  ): Promise<{
```

with:

```ts
    signal: AbortSignal,
    log: EventLog,
    steps: StepTracker,
  ): Promise<{
```

4e. Remove the progress ticker inside `stage()`. Delete these lines:

```ts
      const phase = role === 'coordinator' ? 'planning' : role === 'analyst' ? 'analysis' : 'verification';
      const progress = () =>
        this.options.onProgress(
          phase,
          `${phase}: ${Math.round(budget.metrics().elapsedMs / 1000)}s elapsed; ${Math.ceil(budget.remaining().milliseconds / 1000)}s remaining`,
        );
      progress();
      const timer = setInterval(progress, 5000);
```

4f. Start the stage step right before the runner call. Replace:

```ts
      try {
        const result = await runner.execute(
```

with:

```ts
      const stageStep = steps.stageStart(role);
      try {
        const result = await runner.execute(
```

4g. Feed worker events to the tracker. Replace:

```ts
          event => {
            void log.append({at: new Date().toISOString(), role, operation, ...event});
            recordStageEvent(metrics, event);
```

with:

```ts
          event => {
            void log.append({at: new Date().toISOString(), role, operation, ...event});
            steps.event(role, event);
            recordStageEvent(metrics, event);
```

4h. End the stage step. In the `finally` of `stage()`, replace `        clearInterval(timer);` with `        steps.stageEnd(stageStep);`

4i. Mark verification as not needed when the self-check seals the answer. Replace:

```ts
        if (route.outcome === 'none' || route.outcome === 'note') {
```

with:

```ts
        if (route.outcome === 'none' || route.outcome === 'note') {
          steps.verifySkipped();
```

4j. Delete the three remaining `onProgress` calls:

```ts
        this.options.onProgress('planning', 'Profiling data sources');
```

```ts
                    this.options.onProgress('verification', `Independently checking ${labels.join(', ')}`);
```

```ts
      this.options.onProgress('finalization', 'Saving checked evidence');
```

- [ ] **Step 5: Wire `onStep` in `src/agent/runs.ts`**

Replace `        onProgress: (phase, detail) => view.progress(phase, detail),` with:

```ts
        onStep: step => view.step(step),
```

- [ ] **Step 6: Remove `onProgress` from the two integration tests that build an orchestrator directly**

In `tests/integration/workflow.test.ts` (about line 264) and `tests/integration/workflow-self-check.test.ts` (about line 145), delete the line:

```ts
    onProgress: () => {},
```

- [ ] **Step 7: Run the tests and typecheck**

Run: `npx vitest run tests/integration && npx tsc --noEmit`
Expected: all integration tests PASS, including both `workflow-steps` tests; typecheck prints nothing. (`EventView.progress` still exists until Task 5, so the fixture server still compiles.)

- [ ] **Step 8: Commit**

```bash
npm run format
git add src/agent/workflow/orchestrator.ts src/agent/runs.ts tests/fixtures/workflow-flow.ts tests/integration/workflow-steps.test.ts tests/integration/workflow.test.ts tests/integration/workflow-self-check.test.ts
git commit -m "feat: publish workflow steps to the session and persist them per run"
```

---

### Task 5: Remove the legacy `tool` event and progress status

**Files:**
- Modify: `src/contracts.ts` (`HarnessEvent`)
- Modify: `src/agent/events.ts` (`progress`, `onEvent`)
- Modify: `src/ui/useSession.ts:21`
- Modify: `tests/browser/fixture-server.ts:107-111`
- Modify: `tests/unit/event-view.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/event-view.test.ts`:

```ts
it('does not publish tool events from the bound main session', () => {
  let listener: (event: any) => void = () => {};
  const live: any = {
    session: {
      sessionId: 's',
      subscribe: (l: (event: any) => void) => {
        listener = l;
        return () => {};
      },
      messages: [],
    },
    manager: {getBranch: () => []},
    bundle: {},
  };
  const view = new EventView(live, {runs: [], artifacts: []});
  const events: any[] = [];
  view.subscribe(e => events.push(e));
  listener({type: 'tool_execution_start', toolCallId: 'c', toolName: 'read', args: {}});
  expect(events).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/event-view.test.ts`
Expected: FAIL. `events` contains a `{type: 'tool', ...}` event.

- [ ] **Step 3: Remove the tool emission and `progress()` from `src/agent/events.ts`**

Delete the `progress` method:

```ts
  progress(phase: Extract<HarnessEvent, {type: 'status'}>['payload']['phase'], detail: string) {
    this.emit({type: 'status', payload: {phase, detail}});
  }
```

In `onEvent`, delete the whole tool branch, from `if (` with `event.type === 'tool_execution_start' ||` through the closing `}` after the `this.emit({type: 'tool', ...})` call. Keep the `message_*`, `auto_retry_start` and `compaction_start` branches.

- [ ] **Step 4: Narrow the contract in `src/contracts.ts`**

Delete the `tool` member of `HarnessEvent`:

```ts
  | {type: 'tool'; payload: {callId: string; name: string; state: 'running' | 'completed' | 'error'; summary: string}}
```

Replace the `status` member's `phase` union:

```ts
        phase:
          | 'running'
          | 'retrying'
          | 'compacting'
          | 'cancelling'
          | 'planning'
          | 'analysis'
          | 'verification'
          | 'visualization'
          | 'finalization';
```

with:

```ts
        phase: 'running' | 'retrying' | 'compacting' | 'cancelling';
```

- [ ] **Step 5: Update the two remaining callers**

In `src/ui/useSession.ts`, delete the line:

```ts
      if (event.type === 'tool') setActivity(`${event.payload.name}: ${event.payload.state}`);
```

In `tests/browser/fixture-server.ts`, in the `/test/activity` route, delete the line:

```ts
  app.view.progress('analysis', 'Synthetic activity update');
```

(The route keeps its delayed `settle()`, which is what the scroll-stability browser test needs.)

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/contracts.ts src/agent/events.ts src/ui/useSession.ts tests/browser/fixture-server.ts tests/unit/event-view.test.ts
git commit -m "refactor: remove legacy tool events and the progress status ticker"
```

---

### Task 6: "Independently verified" wording

**Files:**
- Modify: `src/agent/workflow/delivery.ts:10`
- Modify: `tests/unit/delivery.test.ts:22`
- Modify: `tests/integration/checked-figures-delivery.test.ts:50`

- [ ] **Step 1: Update the tests to the new wording**

In `tests/unit/delivery.test.ts`, replace:

```ts
  expect(assuranceNote('mixed')).toBe('\n\nIncludes self-checked and independently reviewed results.');
```

with:

```ts
  expect(assuranceNote('mixed')).toBe('\n\nIncludes self-checked and independently verified results.');
```

In `tests/integration/checked-figures-delivery.test.ts`, replace:

```ts
  expect(text).toContain('Includes self-checked and independently reviewed results.');
```

with:

```ts
  expect(text).toContain('Includes self-checked and independently verified results.');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/delivery.test.ts tests/integration/checked-figures-delivery.test.ts`
Expected: FAIL. Received `...independently reviewed results.`

- [ ] **Step 3: Change the wording**

In `src/agent/workflow/delivery.ts`, replace:

```ts
  if (assurance === 'mixed') return '\n\nIncludes self-checked and independently reviewed results.';
```

with:

```ts
  if (assurance === 'mixed') return '\n\nIncludes self-checked and independently verified results.';
```

Then check that no user-facing "independently reviewed" text remains:

Run: `grep -rn "independently reviewed" src`
Expected: no output. The enum value `'independently-reviewed'` (with a hyphen) stays everywhere.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/delivery.test.ts tests/integration/checked-figures-delivery.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/agent/workflow/delivery.ts tests/unit/delivery.test.ts tests/integration/checked-figures-delivery.test.ts
git commit -m "fix: say independently verified in user-facing assurance notes"
```

---

### Task 7: Full verification

- [ ] **Step 1: Run every check**

```bash
npx vitest run && npx tsc --noEmit && npm run format:check && npm run build && npm run test:browser
```

Expected:
- vitest: all files pass (61+ files).
- tsc: no output.
- prettier: "All matched files use Prettier code style!"
- build: completes (the existing >500 kB chunk warning is fine).
- Playwright: all specs pass. The old UI still renders messages, charts and Stop. Only the activity line text changed (it now shows "running").

- [ ] **Step 2: Check the SSE contract by hand against the fixture server**

Terminal 1: `node node_modules/tsx/dist/cli.mjs tests/browser/fixture-server.ts`

Terminal 2:

```bash
curl -s http://127.0.0.1:4318/api/session | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(Object.keys(JSON.parse(s))))"
```

Expected: the key list includes `activeSteps`.

Stop the fixture server with Ctrl+C.

- [ ] **Step 3: Commit any formatting fixes**

Commit only if Step 1 changed files:

```bash
git add -A src tests
git commit -m "chore: format"
```

---

### Task 8: Record a real run's steps for the frontend fixture (needs approval)

This task makes **one real, paid model run**. Ask the user before running it. It checks the worker end to end (Task 3) and produces the recorded fixture that plan 2's running-view tests replay (spec X3).

**Files:**
- Create: `tests/fixtures/recorded-steps.jsonl`
- Create: `scripts/sanitise-steps.mjs`

- [ ] **Step 1: Ask the user to approve one paid run** and to name the question and workspace to use. Their configured workspace (`PRICING_WORKSPACE` in `.env`) must hold at least one source file.

- [ ] **Step 2: Build and run headless**

```bash
npm run build
node --env-file-if-exists=.env dist/headless.js --question "<approved question>" > ../.scratch/headless-run.jsonl
```

Expected: the output ends with a `turn_end` line. While it runs, `{"type":"event","event":{"type":"step",...}}` lines appear.

- [ ] **Step 3: Confirm the steps file exists and looks right**

```bash
RUN=$(node -e "const l=require('fs').readFileSync('../.scratch/headless-run.jsonl','utf8').trim().split('\n').map(JSON.parse).find(x=>x.type==='accepted');console.log(l.runId)")
WS=$(node --env-file-if-exists=.env -e "console.log(process.env.PRICING_WORKSPACE)")
wc -l "$WS/analyses/$RUN/steps.jsonl"
grep -c '"kind":"tool"' "$WS/analyses/$RUN/steps.jsonl"
```

Expected: dozens of lines; a non-zero tool count; at least one `"kind":"model"` line moving `waiting` → `running` → `done`.

- [ ] **Step 4: Create the sanitiser `scripts/sanitise-steps.mjs`**

```js
// Usage: node scripts/sanitise-steps.mjs <steps.jsonl> > tests/fixtures/recorded-steps.jsonl
// Replaces the home directory and the run ID so the fixture holds no machine-specific data.
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
const lines = readFileSync(process.argv[2], 'utf8').trim().split('\n').map(line => JSON.parse(line));
const runId = lines[0]?.runId;
for (const step of lines) {
  const text = JSON.stringify({...step, runId: 'recorded-run'}).replaceAll(homedir(), '~');
  process.stdout.write((runId ? text.replaceAll(runId, 'recorded-run') : text) + '\n');
}
```

- [ ] **Step 5: Produce and review the fixture**

```bash
node scripts/sanitise-steps.mjs "$WS/analyses/$RUN/steps.jsonl" > tests/fixtures/recorded-steps.jsonl
grep -c "$HOME" tests/fixtures/recorded-steps.jsonl
```

Expected: `0`. Read the file and check that no client names or confidential figures appear in `summary` or `detail`. If any do, edit those strings to neutral text by hand.

- [ ] **Step 6: Commit**

```bash
npm run format
git add scripts/sanitise-steps.mjs tests/fixtures/recorded-steps.jsonl
git commit -m "test: record sanitised step events from one real run for the running-view fixture"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| `Step` type, `step` event, states per kind, stage mapping | 1, 2 |
| Rule-derived summaries ≤ 200, detail ≤ 1,000 | 2 |
| Worker step events; model waiting → thinking → done | 2, 3 |
| `steps.jsonl` per run, append-only, redacted | 4 |
| `activeSteps` in snapshot, cleared on settle, active-run only | 1 |
| Verify "Not needed" when self-check seals the answer | 4 |
| Remove `tool` event and 5 s ticker; `status` only for run state | 4, 5 |
| No throttling (B11) | none needed |
| Contract test per new event (X1) | 1 (EventView step event + snapshot) |
| "Independently verified" wording (X4) | 6 |
| Recorded fixture after backend work (X3) | 8 |
| Frontend, browser reducer, steps store, browser specs | Plan 2 |
