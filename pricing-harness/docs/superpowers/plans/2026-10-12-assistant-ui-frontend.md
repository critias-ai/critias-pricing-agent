# assistant-ui Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chat UI with an assistant-ui interface, styled with the Critias Aegean design system, in which a multi-minute analysis shows a live stage stepper, a waiting/thinking indicator and a collapsible step list. Answers render as markdown (with mermaid diagrams) with compact inline chart cards.

**Architecture:** The server stays the source of truth. `useSession` keeps the snapshot (messages, runs) and sends `step` events to a separate steps store, so step updates never re-render messages or charts. assistant-ui's `useExternalStoreRuntime` drives the thread, viewport, markdown parts and composer from that snapshot. Everything run-specific (running view, badges, outcomes, Sources) is a small custom component reading from plain-function view models that are unit-tested. Styling is hand-written CSS on a vendored copy of the Critias tokens, with self-hosted fonts.

**Tech Stack:** React 19, Vite 7, `@assistant-ui/react@0.15.22`, `@assistant-ui/react-markdown@0.14.17`, `remark-gfm@4.0.1`, `mermaid@12.0.0`, `@fontsource/*@5.3.0`, Plotly (existing), Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-12-assistant-ui-frontend-design.md`](../specs/2026-10-12-assistant-ui-frontend-design.md). Decision IDs (B*, F*, X*) refer to the [brainstorm guide](../../research/assistant-ui-brainstorm-guide-2026-10-10.md) decision log.

**This is plan 2 of 2.** It builds on [plan 1](2026-10-12-assistant-ui-step-events.md), implemented on `feat/assistant-ui-steps` (head `675b44e`). This plan was reconciled against that code on 2026-10-12: the `Step` contract, `activeSteps`, the `step` event and the narrowed `status` event match plan 1, and `tests/fixtures/recorded-steps.jsonl` exists (110 sanitised events from one real run: 19 model and 24 tool lifecycles, Plan and Analyse stages, a skipped Verify, no retried tool). The plan 1 review's fixes are folded in as Task 2b and in Tasks 4 and 12.

**What the plan 1 code actually does (rely on this, not the spec example):**

- Stage step IDs are `stage-1`, `stage-2`, … in run order, model step IDs `model-1`, … and a skipped Verify is `verify-skipped`. Tool step IDs are the provider's tool-call IDs until Task 2b changes them to `tool-1`, …. The recorded fixture's sanitiser renamed every ID to `step-N`, so nothing in the UI may depend on ID prefixes.
- A run can contain several stage steps for the same stage. The offline fixture runs Plan → Analyse → Analyse (self-check repair) → Verify, and a multi-group run goes back to Analyse after Verify.
- A stage ends `done` even when it failed or was cancelled; there is no failed state. The run's outcome carries failure.
- `EventView.setRun` emits `status` (`running` or `cancelling`) at run start, on every checkpoint (same run, steps kept) and on cancel. Its payload is `{phase, detail}`; Task 2 adds `startedAt`. The type also lists `retrying` and `compacting`, but they are never emitted in workflow mode, because `useLogical()` unbinds the main session; Task 2 removes them.
- A failed or cancelled stage, and a tool cut off mid-call, are written to `steps.jsonl` as `done`. This is accepted for now (decided 2026-10-12); revisit if the record looks wrong in practice.
- `EventView.step` drops steps for any run other than the active one. `settleRun` clears `activeSteps`, and the settled snapshot carries `activeSteps: []`.
- Every `step` event increments the session `sequence`, like any other event.

---

## Before you start

All commands run from `pricing-harness/`.

- Continue on the plan 1 branch, or branch from it: `git switch -c feat/assistant-ui-frontend`.
- Confirm plan 1 landed:

  ```bash
  grep -n "activeSteps" src/contracts.ts && grep -n "type: 'step'" src/contracts.ts && ! grep -n "type: 'tool'" src/contracts.ts
  ```

  Expected: two matching lines, and no `tool` line.
- Baseline (verified 2026-10-12 at `675b44e`): `npx vitest run` → 63 files, 302 tests pass; `npx tsc --noEmit` → no output; `npm run test:browser` → 6 tests pass.

### Decisions this plan makes inside the spec (flag in review if you disagree)

1. **Running view placement.** The spec (F1) describes a "synthetic assistant message". This plan renders the running view as a component after the thread's messages, not as a fake message fed to assistant-ui. The user sees the same thing; it avoids conversion edge cases and keeps the message list free of step-driven updates.
2. **File drop.** The spec lists the assistant-ui attachment adapter. This plan uses a native `dragover`/`drop` handler plus `<input type="file" multiple>`, because the adapter models per-message attachments, which this app doesn't have (B7). Same behaviour: drag-and-drop and multi-file upload into the workspace.
3. **Run messages carry `runId`.** Today the needs-input question, failure messages and the user's own message have no `runId`, so the UI couldn't attach B9 outcomes to them. Task 2 tags every run message with its run ID. This is a small backend change.
4. **"First step within 1 s".** Source profiling runs before the planner stage starts. The stepper therefore shows Plan as running as soon as the run is active, before the first stage step arrives.
5. **Past-run summary.** After a reload, past runs have no steps in memory (B3), so their summary line shows only the duration ("Took 3:10").
6. **How the browser learns the active run.** Today the browser only learns `activeRun` from full snapshots, which arrive when a run ends. Task 2 adds `startedAt` to the run-start `status` event, and `useSession` tracks the live run (`{id, startedAt}`) from it. Full snapshots are not sent mid-run, because they would redraw every chart.
7. **States the offline workflow can't reach.** The offline chat fixture always runs the full verifier, so it never produces a skipped Verify or an early answer under background verification. Plan 1's integration tests cover how the backend emits those. For the browser, Task 12 adds a fixture-server route that injects a Verify stage step (and, for background verification, an early `verifying` answer) into a running `slow synthetic` run.

### Pinned API (checked against the installed 0.15.22 / 0.14.17 type definitions on 2026-10-12)

| Use | API |
|---|---|
| Runtime | `useExternalStoreRuntime<ChatMessage>({messages, isRunning, isDisabled, convertMessage, onNew, onCancel})`, `AssistantRuntimeProvider` |
| Thread | `ThreadPrimitive.Root`, `.Viewport`, `.Empty`, `.Messages` with **children render function** `({message}) => ReactNode` (`components` is deprecated) |
| Message | `MessagePrimitive.Root`, `MessagePrimitive.Parts components={{Text}}` |
| Composer | `ComposerPrimitive.Root`, `.Input` (props: `cancelOnEscape`, `submitMode: 'enter'`, `minRows`), `.Send`, `.Cancel` |
| Conditional | `AuiIf condition={s => s.thread.isRunning}` |
| Composer text | `useAui().composer().setText(text)`. Task 1 checks this; if it doesn't compile, use `useAui().thread().composer().setText(text)` everywhere |
| Markdown | `MarkdownTextPrimitive` props `smooth`, `remarkPlugins`, `components`, `componentsByLanguage={{mermaid: {SyntaxHighlighter, CodeHeader}}}`; `SyntaxHighlighterProps = {code, language, components: {Pre, Code}}` |
| Message status | `{type: 'complete', reason: 'stop'}` |
| `ComposerPrimitive.Input` default | **Esc cancels the run unless `cancelOnEscape={false}`.** F8 forbids Esc-to-stop |

## File map

| File | Change | Responsibility |
|---|---|---|
| `package.json` | Modify | New pinned dependencies |
| `src/agent/workflow/orchestrator.ts`, `src/agent/runs.ts` | Modify | Tag run messages with `runId` (Task 2) |
| `src/agent/workflow/steps.ts`, `src/agent/workflow/orchestrator.ts` | Modify | Run-unique tool step IDs, "Not needed" only after sealing, one `clip` helper (Task 2b) |
| `src/ui/critias-aegean.css` | Create (vendored) | Critias tokens |
| `src/ui/theme.ts` | Create | `data-theme` from system preference, `useTheme`, token reader |
| `src/ui/main.tsx`, `index.html` | Modify | Fonts, tokens, theme |
| `src/ui/steps-store.ts` | Create | Steps per run, `useSyncExternalStore` hook |
| `src/ui/useSession.ts` | Modify | Send steps to the store; no snapshot re-render on steps |
| `src/ui/run-view.ts` | Create | Stepper, live line, step groups, durations, run summary |
| `src/ui/outcome.ts` | Create | B9 outcomes, badge labels, announcements |
| `src/ui/thread-messages.ts` | Create | `convertMessage`, sent text, first answer per run |
| `src/ui/numbers.ts` | Create | Numeric-cell detection, React children to text |
| `src/ui/AssuranceBadge.tsx` | Modify | Outcome badges, pulsing verifying dot |
| `src/ui/RunningView.tsx` | Create | `RunningView`, `Stepper`, `StepRow`, `RunSummary` |
| `src/ui/Mermaid.tsx`, `src/ui/MarkdownText.tsx` | Create | Markdown with mermaid and numeric cells |
| `src/ui/exploration/views.ts` | Create | Chart cards and plain tables from a result |
| `src/ui/exploration/ChartCard.tsx` | Create | Chart / Table toggle card |
| `src/ui/exploration/Exploration.tsx` | Rewrite | Scope box, first view, "Show N more views" |
| `src/ui/exploration/PlotlyChart.tsx`, `plotly-adapter.ts` | Modify | Theme palette, 280 px, no help text or Reset button |
| `src/ui/exploration/ResultTable.tsx` | Modify | Optional title, numeric cells |
| `src/ui/Composer.tsx` | Rewrite | assistant-ui composer, uploads, drop zone, needs-input |
| `src/ui/Sources.tsx` | Create | Collapsed Sources list |
| `src/ui/Thread.tsx`, `src/ui/Message.tsx` | Create | Thread, empty state, message, `ThreadContext` |
| `src/ui/Announcer.tsx` | Create | Polite status announcements |
| `src/ui/App.tsx` | Rewrite | Runtime, shell, bottom bar |
| `src/ui/Chat.tsx` | Delete | Replaced by `Thread.tsx` / `Message.tsx` |
| `src/ui/styles.css` | Rewrite | All styles on Critias tokens |
| `tests/unit/*` | Create/modify | View models, components (static render) |
| `tests/fixtures/recorded-steps.ts`, `tests/fixtures/chat-workflow.ts` | Create/modify | Step replay for the running view; diagram reply |
| `tests/browser/fixture-server.ts` | Modify | `/test/verify-state` route for a skipped Verify and background verification |
| `tests/browser/*.spec.ts` | Modify/create | New selectors, running view, outcomes, theme, motion |

---

### Task 1: Dependencies and API check

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create then delete: `src/ui/api-check.tsx`

- [ ] **Step 1: Install pinned versions** (all published at least two weeks before 2026-10-12)

```bash
npm install --save-exact @assistant-ui/react@0.15.22 @assistant-ui/react-markdown@0.14.17 remark-gfm@4.0.1 mermaid@12.0.0 @fontsource/spectral@5.3.0 @fontsource/instrument-serif@5.3.0 @fontsource/spline-sans-mono@5.3.0
```

- [ ] **Step 2: Confirm the font files this plan imports exist**

```bash
ls node_modules/@fontsource/spectral/{400,600}.css node_modules/@fontsource/instrument-serif/400.css node_modules/@fontsource/spline-sans-mono/{400,500}.css
```

Expected: five paths listed, no "No such file".

- [ ] **Step 3: Write a throwaway API check `src/ui/api-check.tsx`**

```tsx
import {
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useExternalStoreRuntime,
  type ExternalStoreAdapter,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import {MarkdownTextPrimitive, type SyntaxHighlighterProps} from '@assistant-ui/react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
type M = {id: string; text: string};
type Append = Parameters<ExternalStoreAdapter<M>['onNew']>[0];
const convert = (m: M): ThreadMessageLike => ({
  id: m.id,
  role: 'assistant',
  content: [{type: 'text', text: m.text}],
  status: {type: 'complete', reason: 'stop'},
});
const Highlight = (_props: SyntaxHighlighterProps) => null;
export function ApiCheck() {
  const runtime = useExternalStoreRuntime<M>({
    messages: [],
    isRunning: false,
    isDisabled: false,
    convertMessage: convert,
    onNew: async (message: Append) => void message.content,
    onCancel: async () => {},
  });
  const aui = useAui();
  const fill = () => aui.composer().setText('x');
  void mermaid.render;
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root>
        <ThreadPrimitive.Viewport>
          <ThreadPrimitive.Empty>
            <button onClick={fill}>fill</button>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages>
            {({message}) => (
              <MessagePrimitive.Root data-id={message.id}>
                <MessagePrimitive.Parts
                  components={{
                    Text: () => (
                      <MarkdownTextPrimitive
                        smooth={false}
                        remarkPlugins={[remarkGfm]}
                        componentsByLanguage={{mermaid: {SyntaxHighlighter: Highlight, CodeHeader: () => null}}}
                      />
                    ),
                  }}
                />
              </MessagePrimitive.Root>
            )}
          </ThreadPrimitive.Messages>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
      <ComposerPrimitive.Root>
        <ComposerPrimitive.Input cancelOnEscape={false} submitMode="enter" minRows={2} />
        <AuiIf condition={s => s.thread.isRunning}>
          <ComposerPrimitive.Cancel>Stop</ComposerPrimitive.Cancel>
        </AuiIf>
        <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output. If something fails to compile, find the correct name in `node_modules/@assistant-ui/*/dist/**/*.d.ts`. Write the correction into this plan's "Pinned API" table and use the corrected name in every later task. The known alternative is `aui.thread().composer().setText`.

- [ ] **Step 5: Delete the check file and commit**

```bash
rm src/ui/api-check.tsx
git add package.json package-lock.json
git commit -m "chore: add assistant-ui, markdown, mermaid and Critias font dependencies"
```

---

### Task 2: Tag run messages with their run ID and announce the run start time

This task also narrows `status` to run state only (B11): phases `running` and `cancelling`. The `retrying` and `compacting` phases come from the main session's `auto_retry_start` and `compaction_start` events. Every app path calls `useLogical()`, which unbinds that session, so they are never sent. This task removes them.

**Files:**
- Modify: `src/agent/workflow/orchestrator.ts` (`say`)
- Modify: `src/agent/runs.ts:104`
- Modify: `src/contracts.ts` (`status` payload), `src/agent/events.ts` (`setRun`, `onEvent`)
- Modify: `tests/unit/runs.test.ts`, `tests/unit/event-view.test.ts`
- Test: `tests/integration/run-message-tags.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/integration/run-message-tags.test.ts`:

```ts
import {expect, it} from 'vitest';
import {createFlow} from '../fixtures/workflow-flow.js';
it('tags a needs-input question with the run ID', async () => {
  const f = await createFlow({
    coordinatorData: data => {
      data.blockingInput = 'Which margin basis should I use?';
    },
  });
  const result = await f.run();
  expect(result.outcome.kind).toBe('needs-input');
  expect(f.messages.map(m => [m.text, m.options?.runId])).toEqual([['Which margin basis should I use?', 'run1']]);
});
```

In `tests/unit/runs.test.ts`, directly after the line `  expect(controller.snapshot().busy).toBe(true);`, add:

```ts
  expect(controller.snapshot().messages.find(m => m.role === 'user')).toMatchObject({text: 'question', runId: a.runId});
```

Append to `tests/unit/event-view.test.ts`:

```ts
it('announces the run start time with the running status', () => {
  const view = new EventView(handle, {runs: [], artifacts: []});
  const events: any[] = [];
  view.subscribe(e => events.push(e));
  view.setRun({id: 'r1', state: 'running', startedAt: '2026-10-12T10:00:00.000Z'} as any);
  expect(events.at(-1)).toMatchObject({
    type: 'status',
    runId: 'r1',
    payload: {phase: 'running', startedAt: '2026-10-12T10:00:00.000Z'},
  });
});
```

In the existing test `does not publish tool events from the bound main session` in the same file, rename it to `does not publish tool, retry or compaction events from the bound main session`. Then replace:

```ts
  listener({type: 'tool_execution_start', toolCallId: 'c', toolName: 'read', args: {}});
  expect(events).toEqual([]);
```

with:

```ts
  listener({type: 'tool_execution_start', toolCallId: 'c', toolName: 'read', args: {}});
  listener({type: 'auto_retry_start', attempt: 1, maxAttempts: 3});
  listener({type: 'compaction_start'});
  expect(events).toEqual([]);
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/integration/run-message-tags.test.ts tests/unit/runs.test.ts tests/unit/event-view.test.ts`
Expected: FAIL. `runId` is `undefined` in the first two; `startedAt` is missing in the third; the main-session test receives `retrying` and `compacting` status events.

- [ ] **Step 3: Implement**

In `src/agent/workflow/orchestrator.ts`, inside `say`, replace:

```ts
      const id = await this.options.onMessage(text, options);
```

with:

```ts
      const id = await this.options.onMessage(text, {runId: run.id, ...options});
```

In `src/agent/runs.ts`, replace:

```ts
      view.appendLogical('user', input.text);
```

with:

```ts
      view.appendLogical('user', input.text, {runId: id});
```

In `src/contracts.ts`, in the `status` member of `HarnessEvent`, replace:

```ts
        phase: 'running' | 'retrying' | 'compacting' | 'cancelling';
        detail: string;
```

with:

```ts
        phase: 'running' | 'cancelling';
        detail: string;
        startedAt?: string;
```

In `src/agent/events.ts` `onEvent`, delete the two status branches, leaving only the `message_*` branch:

```ts
    if (event.type === 'auto_retry_start')
      this.emit({
        type: 'status',
        payload: {phase: 'retrying', detail: `Provider retry ${event.attempt}/${event.maxAttempts}`},
      });
    if (event.type === 'compaction_start')
      this.emit({type: 'status', payload: {phase: 'compacting', detail: 'Condensing conversation context'}});
```

In `src/agent/events.ts` `setRun`, replace:

```ts
      payload: {phase: run.state === 'cancelling' ? 'cancelling' : 'running', detail: run.state},
```

with:

```ts
      payload: {
        phase: run.state === 'cancelling' ? 'cancelling' : 'running',
        detail: run.state,
        startedAt: run.startedAt,
      },
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run && npx tsc --noEmit && ! grep -rn "retrying\|compacting" src`
Expected: PASS; typecheck and grep print nothing.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/agent/workflow/orchestrator.ts src/agent/runs.ts src/contracts.ts src/agent/events.ts tests/integration/run-message-tags.test.ts tests/unit/runs.test.ts tests/unit/event-view.test.ts
git commit -m "feat: tag run messages with their run ID, announce the run start time and keep status to run state"
```

---

### Task 2b: Step backend fixes from the plan 1 review

Three small fixes to plan 1's step code. They don't change the `Step` contract.

1. Tool step IDs are the provider's tool-call IDs today. Those are unique only per provider response or session, not per run: OpenAI-compatible responses without an ID get `""` (`pi-ai` `openai-completions.js:310`), and some models number calls per response. Two calls with the same ID in one run collapse into one row, because both `EventView.step` and the browser store upsert by `stepId`. The tracker now assigns `tool-1`, `tool-2`, … and maps call IDs to them.
2. `verifySkipped()` runs before `sealCheckpoint`. If sealing throws or the run is cancelled at that point, the UI has already shown Verify as "Not needed". It now runs after sealing succeeds.
3. `orchestrator.ts` has its own `capStepText`, which duplicates `clip` in `steps.ts`. It now uses `clip`.

**Files:**
- Modify: `src/agent/workflow/steps.ts`, `src/agent/workflow/orchestrator.ts`
- Modify: `tests/unit/steps.test.ts`, `tests/integration/workflow-steps.test.ts`

- [ ] **Step 1: Write the failing test and update the ID expectations**

Append to `tests/unit/steps.test.ts`:

```ts
it('gives every tool call its own step even when a provider reuses call IDs', () => {
  const steps: Step[] = [];
  const tracker = new StepTracker('r1', s => steps.push(s), () => 'now');
  const first = tracker.stageStart('analyst');
  tracker.event('analyst', {type: 'tool_start', callId: 'call_0', tool: 'read', summary: 'Read a.csv'});
  tracker.event('analyst', {type: 'tool_end', callId: 'call_0', isError: false});
  tracker.stageEnd(first);
  const second = tracker.stageStart('verifier');
  tracker.event('verifier', {type: 'tool_start', callId: 'call_0', tool: 'read', summary: 'Read b.csv'});
  tracker.event('verifier', {type: 'tool_end', callId: 'call_0', isError: false});
  tracker.stageEnd(second);
  expect(steps.filter(s => s.kind === 'tool').map(s => [s.stepId, s.stage, s.state, s.summary])).toEqual([
    ['tool-1', 'analyse', 'running', 'Read a.csv'],
    ['tool-1', 'analyse', 'done', 'Read a.csv'],
    ['tool-2', 'verify', 'running', 'Read b.csv'],
    ['tool-2', 'verify', 'done', 'Read b.csv'],
  ]);
});
```

In the test `tracks stage, model and tool steps for one run`, replace the four tool rows:

```ts
    ['c1', 'tool', 'analyse', 'running', 'Ran margin.py'],
    ['c1', 'tool', 'analyse', 'retried', 'Ran margin.py'],
    ['c2', 'tool', 'analyse', 'running', 'Read prices.csv'],
    ['c2', 'tool', 'analyse', 'done', 'Read prices.csv'],
```

with:

```ts
    ['tool-1', 'tool', 'analyse', 'running', 'Ran margin.py'],
    ['tool-1', 'tool', 'analyse', 'retried', 'Ran margin.py'],
    ['tool-2', 'tool', 'analyse', 'running', 'Read prices.csv'],
    ['tool-2', 'tool', 'analyse', 'done', 'Read prices.csv'],
```

In `tests/integration/workflow-steps.test.ts`, replace:

```ts
  expect(final.get('analyst-1')).toMatchObject({
    stage: 'analyse',
    kind: 'tool',
    state: 'done',
    summary: 'Read source.csv',
  });
```

with:

```ts
  expect([...final.values()].find(step => step.kind === 'tool' && step.stage === 'analyse')).toMatchObject({
    state: 'done',
    summary: 'Read source.csv',
  });
```

In the same file, replace `step.stepId === 'analyst-secret'` with `step.kind === 'tool' && step.stage === 'analyse'` in both places (replace-all).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/steps.test.ts tests/integration/workflow-steps.test.ts`
Expected: FAIL. The new unit test and the updated row expectations still see `call_0` / `c1` / `c2` step IDs.

- [ ] **Step 3: Assign tool step IDs in `src/agent/workflow/steps.ts`**

1. Replace `const clip = (text: string, limit: number) =>` with `export const clip = (text: string, limit: number) =>`.
2. Replace:

   ```ts
     private open = new Map<string, Step>();
     private model?: Step;
   ```

   with:

   ```ts
     private tools = 0;
     // Provider call IDs are not unique per run; each call gets its own tool-N step.
     private calls = new Map<string, string>();
     private open = new Map<string, Step>();
     private model?: Step;
   ```

3. In `stageEnd`, replace:

   ```ts
       const endedAt = this.now();
   ```

   with:

   ```ts
       const endedAt = this.now();
       this.calls.clear();
   ```

4. In `event`, in the `tool_start` branch, replace `        stepId: String(event.callId),` with:

   ```ts
           stepId: `tool-${++this.tools}`,
   ```

   and replace the branch's closing lines:

   ```ts
         this.open.set(step.stepId, step);
         this.emit(step);
       }
       if (event.type === 'tool_end') {
         const step = this.open.get(String(event.callId));
   ```

   with:

   ```ts
         this.calls.set(String(event.callId), step.stepId);
         this.open.set(step.stepId, step);
         this.emit(step);
       }
       if (event.type === 'tool_end') {
         const stepId = this.calls.get(String(event.callId));
         this.calls.delete(String(event.callId));
         const step = stepId ? this.open.get(stepId) : undefined;
   ```

- [ ] **Step 4: Seal before "Not needed" and reuse `clip` in `src/agent/workflow/orchestrator.ts`**

1. Replace `import {STEP_DETAIL_CHARS, STEP_SUMMARY_CHARS, StepTracker} from './steps.js';` with:

   ```ts
   import {clip, STEP_DETAIL_CHARS, STEP_SUMMARY_CHARS, StepTracker} from './steps.js';
   ```

2. Delete the line:

   ```ts
   const capStepText = (text: string, limit: number) => (text.length > limit ? `${text.slice(0, limit - 1)}…` : text);
   ```

3. Replace `capStepText(` with `clip(` (two places, in `execute()`).
4. Replace:

   ```ts
           if (route.outcome === 'none' || route.outcome === 'note') {
             steps.verifySkipped();
             if (route.outcome === 'note')
               packet.coverage = [...new Set([...packet.coverage, ...route.triggers.map(t => t.detail)])];
             if (signal.aborted) throw new Error('cancelled');
             sealed = await sealCheckpoint(selfCheck(packet, {noteKinds}));
           }
   ```

   with:

   ```ts
           if (route.outcome === 'none' || route.outcome === 'note') {
             if (route.outcome === 'note')
               packet.coverage = [...new Set([...packet.coverage, ...route.triggers.map(t => t.detail)])];
             if (signal.aborted) throw new Error('cancelled');
             sealed = await sealCheckpoint(selfCheck(packet, {noteKinds}));
             steps.verifySkipped();
           }
   ```

   The existing integration test `publishes stage, model and tool steps…` still expects `['verify', 'skipped']` and covers the moved call.

- [ ] **Step 5: Run the tests and typecheck**

Run: `npx vitest run && npx tsc --noEmit && ! grep -n capStepText src/agent/workflow/orchestrator.ts`
Expected: all tests PASS; typecheck and grep print nothing.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/agent/workflow/steps.ts src/agent/workflow/orchestrator.ts tests/unit/steps.test.ts tests/integration/workflow-steps.test.ts
git commit -m "fix: give tool steps run-unique IDs and show Verify as not needed only after sealing"
```

---

### Task 3: Critias tokens, fonts and theme

**Files:**
- Create: `src/ui/critias-aegean.css` (vendored)
- Create: `src/ui/theme.ts`
- Modify: `src/ui/main.tsx`, `index.html`

- [ ] **Step 1: Vendor the token file**

```bash
{ printf '/* Vendored from the Critias design system token file critias-aegean.css on 2026-10-12.\n   Keep in sync with that file; do not edit here. */\n'; cat <path to critias-aegean.css>; } > src/ui/critias-aegean.css
grep -c "data-theme=\"dark\"" src/ui/critias-aegean.css
```

Expected: `1`.

- [ ] **Step 2: Create `src/ui/theme.ts`**

```ts
import {useSyncExternalStore} from 'react';
export type Theme = 'light' | 'dark';
const query = () => window.matchMedia('(prefers-color-scheme: dark)');
export const currentTheme = (): Theme => (query().matches ? 'dark' : 'light');
// Follows the system preference; the Critias tokens switch on [data-theme="dark"].
export function applyTheme() {
  const set = () => {
    document.documentElement.dataset.theme = currentTheme();
  };
  set();
  query().addEventListener('change', set);
}
const subscribe = (callback: () => void) => {
  const q = query();
  q.addEventListener('change', callback);
  return () => q.removeEventListener('change', callback);
};
export const useTheme = () => useSyncExternalStore(subscribe, currentTheme, (): Theme => 'light');
export const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
```

- [ ] **Step 3: Load fonts, tokens and theme in `src/ui/main.tsx`**

Replace the whole file:

```tsx
import '@fontsource/spectral/400.css';
import '@fontsource/spectral/600.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/spline-sans-mono/400.css';
import '@fontsource/spline-sans-mono/500.css';
import './critias-aegean.css';
import './styles.css';
import {createRoot} from 'react-dom/client';
import {App} from './App.js';
import {applyTheme} from './theme.js';
applyTheme();
createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 4: Declare both colour schemes in `index.html`**

Replace:

```html
<meta name="viewport" content="width=device-width,initial-scale=1">
```

with:

```html
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark">
```

- [ ] **Step 5: Build to confirm fonts are bundled locally**

Run: `npx vite build && ls dist/ui/assets | grep -c woff2`
Expected: build succeeds; count > 0. The fonts are served from the app's own origin.

- [ ] **Step 6: Commit**

```bash
git add src/ui/critias-aegean.css src/ui/theme.ts src/ui/main.tsx index.html
git commit -m "feat: load Critias tokens, self-hosted fonts and system theme"
```

---

### Task 4: Steps store and session wiring

**Files:**
- Create: `src/ui/steps-store.ts`
- Modify: `src/ui/useSession.ts`
- Test: `tests/unit/steps-store.test.ts`, `tests/unit/browser-state.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/steps-store.test.ts`:

```ts
import {expect, it} from 'vitest';
import {createStepsStore} from '../../src/ui/steps-store.js';
import type {Step} from '../../src/contracts.js';
const step = (over: Partial<Step> = {}): Step => ({
  runId: 'r1',
  stepId: 'c1',
  stage: 'analyse',
  kind: 'tool',
  name: 'read',
  state: 'running',
  startedAt: '2026-10-12T10:00:00.000Z',
  summary: 'Read a.csv',
  ...over,
});
it('upserts steps per run, seeds from a snapshot and keeps references stable', () => {
  const store = createStepsStore();
  let calls = 0;
  const off = store.subscribe(() => calls++);
  store.seed([step()]);
  const first = store.get('r1');
  expect(first).toEqual([step()]);
  expect(store.get('r1')).toBe(first);
  store.apply(step({state: 'done'}));
  expect(store.get('r1')).toEqual([step({state: 'done'})]);
  expect(store.get('r1')).not.toBe(first);
  expect(store.get('r2')).toBe(store.get(null));
  expect(calls).toBe(2);
  off();
  store.apply(step());
  expect(calls).toBe(2);
});
```

Append to `tests/unit/browser-state.test.ts` (browser half of the X1 contract test):

```ts
it('advances the sequence on step events without touching messages', () => {
  const state: SessionSnapshot = {
    serverInstanceId: 'i',
    sequence: 1,
    sessionId: 's',
    busy: true,
    activeRun: null,
    runs: [],
    messages: [{id: 'm', role: 'assistant', text: 'x', complete: true}],
    artifacts: [],
    activeSteps: [],
  };
  const event: HarnessEvent = {
    serverInstanceId: 'i',
    sequence: 2,
    sessionId: 's',
    runId: 'r1',
    type: 'step',
    payload: {
      runId: 'r1',
      stepId: 'c1',
      stage: 'analyse',
      kind: 'tool',
      name: 'read',
      state: 'running',
      startedAt: '2026-10-12T10:00:00.000Z',
      summary: 'Read a.csv',
    },
  };
  const next = reduceEvent(state, event);
  expect(next.sequence).toBe(2);
  expect(next.messages).toBe(state.messages);
  // useSession applies a step to the steps store only when the reducer accepts the event.
  expect(reduceEvent(next, event)).toBe(next);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/steps-store.test.ts tests/unit/browser-state.test.ts`
Expected: steps-store FAIL (module missing); browser-state PASS (the reducer already ignores unknown types; this pins that behaviour).

- [ ] **Step 3: Create `src/ui/steps-store.ts`**

```ts
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
```

- [ ] **Step 4: Route steps and track the live run in `src/ui/useSession.ts`**

1. Add the import: `import {stepsStore} from './steps-store.js';` and export the type:

   ```ts
   export type ActiveRun = {id: string; startedAt: string};
   ```

2. Replace the `activity` state line `    [activity, setActivity] = useState(''),` with:

   ```ts
       [live, setLive] = useState<ActiveRun | null>(null),
   ```

3. Replace the body of `apply`:

```ts
    const apply = (event: HarnessEvent) => {
      if (!current.current) return;
      const next = reduceEvent(current.current, event);
      // Stale or duplicate events, such as those buffered during the handshake, must not
      // overwrite newer step states seeded from the snapshot.
      if (next === current.current) return;
      current.current = next;
      if (event.type === 'error') setError(event.payload.message);
      if (event.type === 'step') stepsStore.apply(event.payload);
      if (event.type === 'status' && event.runId && event.payload.startedAt)
        setLive(old => (old?.id === event.runId ? old : {id: event.runId!, startedAt: event.payload.startedAt!}));
      if (event.type === 'settled' && !event.payload.snapshot.activeRun) setLive(null);
      if (event.type !== 'step') setSnapshot(next);
    };
```

   The order matters. `handshake` seeds the store from a snapshot taken at sequence N, then replays events buffered while it waited. A buffered `step` event with sequence ≤ N (for example, a tool's `running` state when the snapshot already has it `done`) would otherwise put the step back to running for good. `reduceEvent` already returns the same state object for stale events, so a step is applied only when its sequence is newer.

4. In `handshake`, directly after `current.current = state;`, add:

   ```ts
           stepsStore.seed(state.activeSteps);
           setLive(null);
   ```

5. Replace `replace`:

```ts
  const replace = (next: SessionSnapshot) => {
    current.current = next;
    stepsStore.seed(next.activeSteps);
    if (!next.activeRun) setLive(null);
    setSnapshot(next);
  };
```

6. Replace the return line with:

```ts
  const run = snapshot?.activeRun;
  const activeRun: ActiveRun | null = run ? {id: run.id, startedAt: run.startedAt} : live;
  return {snapshot, activeRun, connected, error, setError, replace};
```

(A full snapshot's `activeRun` covers reloads mid-run. `live` covers runs that started after the page loaded, because no full snapshot arrives until they end.)

(`App.tsx` still reads `activity` until Task 11 rewrites it. Typecheck fails on that one line until then. That's expected and the only failure allowed between Tasks 4 and 11.)

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/steps-store.test.ts tests/unit/browser-state.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/ui/steps-store.ts src/ui/useSession.ts tests/unit/steps-store.test.ts tests/unit/browser-state.test.ts
git commit -m "feat: keep run steps in a separate store and track the live run"
```

---

### Task 5: View models (pure functions)

**Files:**
- Create: `src/ui/run-view.ts`, `src/ui/outcome.ts`, `src/ui/thread-messages.ts`, `src/ui/numbers.ts`
- Test: `tests/unit/run-view.test.ts`, `tests/unit/outcome.test.ts`, `tests/unit/thread-messages.test.ts`, `tests/unit/numbers.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/unit/run-view.test.ts`:

```ts
import {expect, it} from 'vitest';
import {formatDuration, liveLine, runSummary, stageViews, toolGroups} from '../../src/ui/run-view.js';
import type {Step} from '../../src/contracts.js';
const s = (over: Partial<Step>): Step => ({
  runId: 'r',
  stepId: 'x',
  stage: 'analyse',
  kind: 'tool',
  name: 'read',
  state: 'done',
  startedAt: '2026-10-12T10:00:00.000Z',
  endedAt: '2026-10-12T10:00:04.000Z',
  summary: 'Read a.csv',
  ...over,
});
const now = Date.parse('2026-10-12T10:01:00.000Z');
it('shows Plan as running before any stage step arrives', () => {
  expect(stageViews([], now).map(v => v.state)).toEqual(['running', 'pending', 'pending']);
});
it('derives each stage from its latest stage step', () => {
  const steps = [
    s({stepId: 'stage-1', kind: 'stage', stage: 'plan', name: 'plan', summary: 'Planning'}),
    s({stepId: 'stage-2', kind: 'stage', stage: 'analyse', state: 'running', endedAt: undefined, summary: 'Analysing'}),
    s({stepId: 'verify-skipped', kind: 'stage', stage: 'verify', state: 'skipped', summary: 'Not needed'}),
  ];
  expect(stageViews(steps, now)).toEqual([
    {stage: 'plan', label: 'Plan', state: 'done', ms: 4000},
    {stage: 'analyse', label: 'Analyse', state: 'running', ms: 60000},
    {stage: 'verify', label: 'Verify', state: 'skipped'},
  ]);
});
it('labels the live line from the open model or tool step', () => {
  expect(liveLine([s({stepId: 'm', kind: 'model', state: 'waiting', summary: 'Waiting for model'})])).toMatchObject({
    label: 'Waiting for model…',
    waiting: true,
  });
  expect(liveLine([s({stepId: 'm', kind: 'model', state: 'running'})])).toMatchObject({label: 'Thinking…', waiting: false});
  expect(liveLine([s({stepId: 't1'}), s({stepId: 't2', state: 'running', summary: 'Ran margin.py'})])).toMatchObject({
    label: 'Ran margin.py…',
    last: {stepId: 't1'},
  });
  expect(liveLine([]).label).toBe('Working…');
});
it('groups tool steps by consecutive stage and summarises a finished run', () => {
  const steps = [
    s({stepId: 'p1', stage: 'plan'}),
    s({stepId: 'm', kind: 'model'}),
    s({stepId: 'a1'}),
    s({stepId: 'a2', state: 'retried'}),
  ];
  expect(toolGroups(steps).map(g => [g.stage, g.steps.map(x => x.stepId)])).toEqual([
    ['plan', ['p1']],
    ['analyse', ['a1', 'a2']],
  ]);
  const run = {startedAt: '2026-10-12T10:00:00.000Z', endedAt: '2026-10-12T10:03:10.000Z'};
  expect(runSummary(steps, run)).toBe('3 steps · 3:10');
  expect(runSummary([], run)).toBe('Took 3:10');
  expect(formatDuration(-5)).toBe('0:00');
  expect(formatDuration(65_000)).toBe('1:05');
});
```

`tests/unit/outcome.test.ts`:

```ts
import {expect, it} from 'vitest';
import {announcement, awaitingInput, badgeLabel, messageOutcome} from '../../src/ui/outcome.js';
import type {ChatMessage, RunRecord} from '../../src/contracts.js';
const runs = [
  {id: 'r1', outcome: {kind: 'no-verified-answer'}},
  {id: 'r2', outcome: {kind: 'needs-input'}},
] as RunRecord[];
const messages: ChatMessage[] = [
  {id: 'u1', role: 'user', text: 'Margins by quarter', complete: true, runId: 'r1'},
  {id: 'a1', role: 'assistant', text: 'Stopped', complete: true, runId: 'r1'},
  {id: 'u2', role: 'user', text: 'Next', complete: true, runId: 'r2'},
  {id: 'a2', role: 'assistant', text: 'Which metric?', complete: true, runId: 'r2'},
];
it('attaches B9 outcomes to the last assistant message of a run', () => {
  expect(messageOutcome(messages, runs, 1)).toEqual({status: 'no-checked-answer', retryQuestion: 'Margins by quarter'});
  expect(messageOutcome(messages, runs, 3)).toEqual({status: 'needs-input'});
  expect(messageOutcome(messages, runs, 0)).toEqual({});
  const twoAnswers = [...messages.slice(0, 2), {...messages[1]!, id: 'a1b'}];
  expect(messageOutcome(twoAnswers, runs, 1)).toEqual({});
  expect(awaitingInput(runs)).toBe(true);
  expect(awaitingInput(runs.slice(0, 1))).toBe(false);
});
it('labels badges and announcements with one vocabulary', () => {
  expect(badgeLabel('independently-reviewed')).toBe('Independently verified');
  expect(badgeLabel('mixed')).toBe('Partly independently verified');
  expect(badgeLabel('verifying')).toBe('Verifying…');
  expect(badgeLabel('mixed', 'no-checked-answer')).toBe('No checked answer');
  expect(badgeLabel(undefined)).toBeUndefined();
  expect(announcement(messages[3]!, {status: 'needs-input'})).toBe('The assistant needs your input');
  expect(announcement({...messages[1]!, assurance: 'self-checked'}, {})).toBe('Answer ready, self-checked');
});
```

`tests/unit/thread-messages.test.ts`:

```ts
import {expect, it} from 'vitest';
import {appendText, firstAssistantIdByRun, toThreadMessage} from '../../src/ui/thread-messages.js';
import type {ChatMessage} from '../../src/contracts.js';
it('converts each chat message object once and marks assistant messages complete', () => {
  const m: ChatMessage = {id: 'a', role: 'assistant', text: 'Hi', complete: true};
  expect(toThreadMessage(m)).toBe(toThreadMessage(m));
  expect(toThreadMessage(m)).toEqual({
    id: 'a',
    role: 'assistant',
    content: [{type: 'text', text: 'Hi'}],
    status: {type: 'complete', reason: 'stop'},
  });
  expect(toThreadMessage({...m})).not.toBe(toThreadMessage(m));
  expect(toThreadMessage({id: 'u', role: 'user', text: 'Q', complete: true})).not.toHaveProperty('status');
});
it('extracts the sent text and finds the first answer of each run', () => {
  expect(appendText({content: [{type: 'text', text: ' Margins? '}]} as any)).toBe('Margins?');
  const messages: ChatMessage[] = [
    {id: 'u', role: 'user', text: 'q', complete: true, runId: 'r1'},
    {id: 'a', role: 'assistant', text: 'early', complete: true, runId: 'r1'},
    {id: 'b', role: 'assistant', text: 'more', complete: true, runId: 'r1'},
  ];
  expect(firstAssistantIdByRun(messages)).toEqual(new Map([['r1', 'a']]));
});
```

`tests/unit/numbers.test.ts`:

```ts
import {expect, it} from 'vitest';
import {createElement} from 'react';
import {isNumericCell, textOf} from '../../src/ui/numbers.js';
it('recognises numeric table cells', () => {
  for (const text of ['£1,234.50', '36.09%', '-12', '(1,200)', '2 EA', ' 10 ', '10 GBP'])
    expect(isNumericCell(text), text).toBe(true);
  for (const text of ['Q1', 'Unavailable', '', 'Product 60', '—']) expect(isNumericCell(text), text).toBe(false);
});
it('flattens React children to text', () => {
  expect(textOf(['£', createElement('strong', null, '10'), null, false])).toBe('£10');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/run-view.test.ts tests/unit/outcome.test.ts tests/unit/thread-messages.test.ts tests/unit/numbers.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Create `src/ui/run-view.ts`**

```ts
import type {RunRecord, Step, StepStage} from '../contracts.js';
const STAGES: StepStage[] = ['plan', 'analyse', 'verify'];
export const STAGE_LABEL: Record<StepStage, string> = {plan: 'Plan', analyse: 'Analyse', verify: 'Verify'};
export type StageView = {stage: StepStage; label: string; state: 'pending' | 'running' | 'done' | 'skipped'; ms?: number};
export const stepMs = (step: Step, now: number) =>
  Math.max(0, (step.endedAt ? Date.parse(step.endedAt) : now) - Date.parse(step.startedAt));
export function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
// Plan shows as running from the moment the run is active, before the planner's first step arrives.
export function stageViews(steps: readonly Step[], now: number): StageView[] {
  const anyStage = steps.some(s => s.kind === 'stage');
  return STAGES.map(stage => {
    const own = steps.filter(s => s.kind === 'stage' && s.stage === stage);
    const latest = own.at(-1);
    const label = STAGE_LABEL[stage];
    if (!latest) return {stage, label, state: !anyStage && stage === 'plan' ? 'running' : 'pending'};
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
```

- [ ] **Step 4: Create `src/ui/outcome.ts`**

```ts
import type {ChatMessage, RunRecord} from '../contracts.js';
export type OutcomeStatus = 'needs-input' | 'no-checked-answer';
export type MessageOutcome = {status?: OutcomeStatus; retryQuestion?: string};
const ASSURANCE_LABEL: Record<NonNullable<ChatMessage['assurance']>, string> = {
  'self-checked': 'Self-checked',
  verifying: 'Verifying…',
  'independently-reviewed': 'Independently verified',
  mixed: 'Partly independently verified',
};
const OUTCOME_LABEL: Record<OutcomeStatus, string> = {
  'needs-input': 'Needs your input',
  'no-checked-answer': 'No checked answer',
};
export const badgeLabel = (assurance?: ChatMessage['assurance'], status?: OutcomeStatus) =>
  status ? OUTCOME_LABEL[status] : assurance ? ASSURANCE_LABEL[assurance] : undefined;
// B9: the outcome belongs to the last assistant message of its run.
export function messageOutcome(
  messages: readonly ChatMessage[],
  runs: readonly RunRecord[],
  index: number,
): MessageOutcome {
  const message = messages[index];
  if (!message || message.role !== 'assistant' || !message.runId) return {};
  if (messages.slice(index + 1).some(m => m.role === 'assistant' && m.runId === message.runId)) return {};
  const kind = runs.find(r => r.id === message.runId)?.outcome?.kind;
  if (kind === 'needs-input') return {status: 'needs-input'};
  if (kind !== 'no-verified-answer') return {};
  const question =
    messages.find(m => m.role === 'user' && m.runId === message.runId)?.text ??
    messages
      .slice(0, index)
      .reverse()
      .find(m => m.role === 'user')?.text;
  return {status: 'no-checked-answer', ...(question ? {retryQuestion: question} : {})};
}
export const awaitingInput = (runs: readonly RunRecord[]) => runs.at(-1)?.outcome?.kind === 'needs-input';
export function announcement(message: ChatMessage, outcome: MessageOutcome) {
  if (outcome.status === 'needs-input') return 'The assistant needs your input';
  const label = badgeLabel(message.assurance, outcome.status);
  return label ? `Answer ready, ${label.toLowerCase()}` : 'Answer ready';
}
```

- [ ] **Step 5: Create `src/ui/thread-messages.ts`**

```ts
import type {ExternalStoreAdapter, ThreadMessageLike} from '@assistant-ui/react';
import type {ChatMessage} from '../contracts.js';
type AppendMessage = Parameters<ExternalStoreAdapter<ChatMessage>['onNew']>[0];
const converted = new WeakMap<ChatMessage, ThreadMessageLike>();
// Snapshot updates replace only changed message objects, so identity is a sound cache key.
export function toThreadMessage(message: ChatMessage): ThreadMessageLike {
  let like = converted.get(message);
  if (!like) {
    like = {
      id: message.id,
      role: message.role,
      content: [{type: 'text', text: message.text}],
      ...(message.role === 'assistant' ? {status: {type: 'complete', reason: 'stop'} as const} : {}),
    };
    converted.set(message, like);
  }
  return like;
}
export const appendText = (message: Pick<AppendMessage, 'content'>) =>
  message.content
    .flatMap(part => (part.type === 'text' ? [part.text] : []))
    .join('\n')
    .trim();
export function firstAssistantIdByRun(messages: readonly ChatMessage[]) {
  const first = new Map<string, string>();
  for (const m of messages) if (m.role === 'assistant' && m.runId && !first.has(m.runId)) first.set(m.runId, m.id);
  return first;
}
```

- [ ] **Step 6: Create `src/ui/numbers.ts`**

```ts
import {isValidElement, type ReactNode} from 'react';
// A cell that is only a number, optionally with sign, brackets, currency symbol, percent or short unit.
export const isNumericCell = (text: string) =>
  /\d/.test(text) && /^[−\-+(]?[£$€¥]?\s?[\d.,]+\s?(%|[A-Za-z]{1,3})?\)?$/.test(text.trim());
export function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{children?: ReactNode}>(node)) return textOf(node.props.children);
  return '';
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/unit/run-view.test.ts tests/unit/outcome.test.ts tests/unit/thread-messages.test.ts tests/unit/numbers.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
npm run format
git add src/ui/run-view.ts src/ui/outcome.ts src/ui/thread-messages.ts src/ui/numbers.ts tests/unit/run-view.test.ts tests/unit/outcome.test.ts tests/unit/thread-messages.test.ts tests/unit/numbers.test.ts
git commit -m "feat: add view models for steps, outcomes, messages and numeric cells"
```

---

### Task 6: Badges

**Files:**
- Modify: `src/ui/AssuranceBadge.tsx`
- Modify: `tests/unit/assurance-badge.test.ts`

- [ ] **Step 1: Extend the test**

Append to `tests/unit/assurance-badge.test.ts`:

```ts
it('shows outcome badges over assurance and pulses only while verifying', () => {
  const html = (props: object) => renderToStaticMarkup(createElement(AssuranceBadge, props));
  expect(html({assurance: 'mixed', outcome: 'no-checked-answer'})).toContain('No checked answer');
  expect(html({outcome: 'needs-input'})).toContain('class="badge needs-input"');
  expect(html({assurance: 'verifying'})).toContain('class="dot"');
  expect(html({assurance: 'self-checked'})).not.toContain('class="dot"');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/assurance-badge.test.ts`
Expected: FAIL on the new test.

- [ ] **Step 3: Replace `src/ui/AssuranceBadge.tsx`**

```tsx
import type {ChatMessage} from '../contracts.js';
import {badgeLabel, type OutcomeStatus} from './outcome.js';
export function AssuranceBadge({assurance, outcome}: {assurance?: ChatMessage['assurance']; outcome?: OutcomeStatus}) {
  const label = badgeLabel(assurance, outcome);
  if (!label) return null;
  return (
    <span className={`badge ${outcome ?? assurance}`}>
      {!outcome && assurance === 'verifying' && <span className="dot" aria-hidden="true" />}
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/assurance-badge.test.ts`
Expected: PASS (old and new tests).

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/ui/AssuranceBadge.tsx tests/unit/assurance-badge.test.ts
git commit -m "feat: show outcome badges and a pulsing verifying badge"
```

---

### Task 7: Running view components

**Files:**
- Create: `src/ui/RunningView.tsx`
- Test: `tests/unit/running-view.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
it('renders the stepper with the current stage and a not-needed verify stage', () => {
  const html = renderToStaticMarkup(
    createElement(Stepper, {
      stages: [
        {stage: 'plan', label: 'Plan', state: 'done', ms: 4000},
        {stage: 'analyse', label: 'Analyse', state: 'running', ms: 1000},
        {stage: 'verify', label: 'Verify', state: 'skipped'},
      ],
    }),
  );
  expect(html).toContain('aria-current="step"');
  expect(html).toContain('Not needed');
  expect(html).toContain('0:04');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/running-view.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `src/ui/RunningView.tsx`**

```tsx
import {useEffect, useState} from 'react';
import type {RunRecord, Step} from '../contracts.js';
import {useRunSteps} from './steps-store.js';
import {
  formatDuration,
  liveLine,
  runSummary,
  STAGE_LABEL,
  stageViews,
  stepMs,
  toolGroups,
  type StageView,
} from './run-view.js';
function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}
export function Stepper({stages}: {stages: StageView[]}) {
  return (
    <ol className="stepper">
      {stages.map(view => (
        <li
          key={view.stage}
          className={`stage ${view.state}`}
          aria-current={view.state === 'running' ? 'step' : undefined}
        >
          <span>{view.label}</span>
          <span className="stage-meta">
            {view.state === 'skipped' ? 'Not needed' : view.ms !== undefined ? formatDuration(view.ms) : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}
export function StepRow({step, now}: {step: Step; now: number}) {
  const icon =
    step.state === 'running' ? (
      <span className="dot" aria-hidden="true" />
    ) : (
      <span aria-hidden="true">{step.state === 'retried' ? '↻' : '✓'}</span>
    );
  const label = step.state === 'retried' ? `${step.summary} · retried` : step.summary;
  const line = (
    <>
      {icon}
      <span>{label}</span>
      <span className="step-duration">{formatDuration(stepMs(step, now))}</span>
    </>
  );
  return (
    <li className={`step ${step.state}`}>
      {step.state === 'retried' && step.detail ? (
        <details>
          <summary>{line}</summary>
          <pre>{step.detail}</pre>
        </details>
      ) : (
        line
      )}
    </li>
  );
}
// F4 layout A: stepper, one live line, and the full step list one click away.
export function RunningView({runId, startedAt}: {runId: string; startedAt: string}) {
  const steps = useRunSteps(runId);
  const now = useNow();
  const live = liveLine(steps);
  const groups = toolGroups(steps);
  const total = groups.reduce((n, g) => n + g.steps.length, 0);
  return (
    <section className="running" aria-label="Analysis in progress">
      <Stepper stages={stageViews(steps, now)} />
      <p className="live-line">
        <span className={`dot${live.waiting ? ' waiting' : ''}`} aria-hidden="true" />
        <span>{live.label}</span>
        {live.last && <span className="live-last">· {live.last.summary}</span>}
        <span className="elapsed">{formatDuration(now - Date.parse(startedAt))}</span>
      </p>
      {total > 0 && (
        <details className="step-list">
          <summary>Show all {total} steps</summary>
          {groups.map((group, index) => (
            <div key={`${group.stage}-${index}`}>
              <h4>{STAGE_LABEL[group.stage]}</h4>
              <ol>
                {group.steps.map(step => (
                  <StepRow key={step.stepId} step={step} now={now} />
                ))}
              </ol>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
export function RunSummary({run}: {run: RunRecord}) {
  const steps = useRunSteps(run.id);
  return <p className="run-summary">{runSummary(steps, run)}</p>;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/running-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/ui/RunningView.tsx tests/unit/running-view.test.ts
git commit -m "feat: add the running view with stepper, live line and step list"
```

---

### Task 8: Markdown and mermaid

**Files:**
- Create: `src/ui/Mermaid.tsx`, `src/ui/MarkdownText.tsx`
- Test: `tests/unit/mermaid.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {expect, it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MermaidDiagram} from '../../src/ui/Mermaid.js';
it('shows the raw diagram source until mermaid has rendered', () => {
  const html = renderToStaticMarkup(
    createElement(MermaidDiagram, {
      code: 'flowchart LR\n  A-->B',
      language: 'mermaid',
      components: {Pre: 'pre' as any, Code: 'code' as any},
    }),
  );
  expect(html).toBe('<pre><code>flowchart LR\n  A--&gt;B</code></pre>');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/mermaid.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `src/ui/Mermaid.tsx`**

```tsx
import {useEffect, useId, useState} from 'react';
import type {SyntaxHighlighterProps} from '@assistant-ui/react-markdown';
import {currentTheme} from './theme.js';
// Lazy-loaded; strict security; the source stays visible if rendering fails.
export function MermaidDiagram({code, components: {Pre, Code}}: SyntaxHighlighterProps) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setSvg(null);
    void import('mermaid')
      .then(async ({default: mermaid}) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: currentTheme() === 'dark' ? 'dark' : 'neutral',
        });
        const result = await mermaid.render(id, code);
        if (alive) setSvg(result.svg);
      })
      .catch(() => {
        if (alive) setSvg(null);
      });
    return () => {
      alive = false;
    };
  }, [code, id]);
  return svg ? (
    <div className="mermaid-diagram" role="img" aria-label="Diagram" dangerouslySetInnerHTML={{__html: svg}} />
  ) : (
    <Pre>
      <Code>{code}</Code>
    </Pre>
  );
}
```

- [ ] **Step 4: Create `src/ui/MarkdownText.tsx`**

```tsx
import type {ComponentPropsWithoutRef} from 'react';
import {MarkdownTextPrimitive} from '@assistant-ui/react-markdown';
import remarkGfm from 'remark-gfm';
import {MermaidDiagram} from './Mermaid.js';
import {isNumericCell, textOf} from './numbers.js';
const NoHeader = () => null;
function Cell({node: _node, className, ...props}: ComponentPropsWithoutRef<'td'> & {node?: unknown}) {
  const numeric = isNumericCell(textOf(props.children));
  return <td {...props} className={[className, numeric ? 'num' : ''].filter(Boolean).join(' ') || undefined} />;
}
// Raw HTML in replies is not enabled, so model text cannot inject markup.
export function MarkdownText() {
  return (
    <MarkdownTextPrimitive
      className="markdown"
      smooth={false}
      remarkPlugins={[remarkGfm]}
      components={{td: Cell}}
      componentsByLanguage={{mermaid: {SyntaxHighlighter: MermaidDiagram, CodeHeader: NoHeader}}}
    />
  );
}
```

- [ ] **Step 5: Run the test and typecheck these files**

Run: `npx vitest run tests/unit/mermaid.test.ts && npx tsc --noEmit 2>&1 | grep -v "src/ui/App.tsx" | head`
Expected: test PASS; no typecheck errors outside `App.tsx` (see Task 4 note).

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/ui/Mermaid.tsx src/ui/MarkdownText.tsx tests/unit/mermaid.test.ts
git commit -m "feat: render replies as markdown with mermaid diagrams and numeric cells"
```

---

### Task 9: Compact chart cards

**Files:**
- Create: `src/ui/exploration/views.ts`, `src/ui/exploration/ChartCard.tsx`
- Rewrite: `src/ui/exploration/Exploration.tsx`
- Modify: `src/ui/exploration/PlotlyChart.tsx`, `src/ui/exploration/plotly-adapter.ts`, `src/ui/exploration/ResultTable.tsx`
- Test: `tests/unit/exploration-views.test.ts`, `tests/unit/exploration-ui.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/unit/exploration-views.test.ts`:

```ts
import {expect, it} from 'vitest';
import {explorationViews} from '../../src/ui/exploration/views.js';
import type {ExplorationResult} from '../../src/exploration.js';
const table = (id: string) => ({id, title: id, rowHeader: 'Row', columns: [], rows: []});
it('makes one card per chart and lists tables without a chart after them', () => {
  const result = {
    tables: [table('quarterly'), table('products')],
    charts: [
      {id: 'revenue', title: 'Revenue', kind: 'line', tableId: 'quarterly', series: []},
      {id: 'margin', title: 'Margin', kind: 'line', tableId: 'quarterly', series: []},
      {id: 'orphan', title: 'Orphan', kind: 'bar', tableId: 'missing', series: []},
    ],
  } as unknown as ExplorationResult;
  expect(explorationViews(result).map(v => [v.kind, v.id])).toEqual([
    ['chart', 'chart-revenue'],
    ['chart', 'chart-margin'],
    ['table', 'table-products'],
  ]);
});
```

Append to `tests/unit/exploration-ui.test.ts`:

```ts
it('applies the theme palette and the compact height', () => {
  const r = result();
  const figure = buildPlotlyFigure(r.charts[1]!, r.tables[0]!, {series: ['#111111'], text: '#222222', grid: '#333333'});
  expect((figure.data[0] as any).marker.color).toBe('#111111');
  expect(figure.layout).toMatchObject({height: 280, font: {color: '#222222'}, yaxis: {gridcolor: '#333333'}});
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/exploration-views.test.ts tests/unit/exploration-ui.test.ts`
Expected: FAIL (views module missing; height 350 ≠ 280).

- [ ] **Step 3: Create `src/ui/exploration/views.ts`**

```ts
import type {ChartSpec, ExplorationResult, ResultTable} from '../../exploration.js';
export type ExplorationView =
  | {kind: 'chart'; id: string; chart: ChartSpec; table: ResultTable}
  | {kind: 'table'; id: string; table: ResultTable};
// One card per chart (its data behind a toggle); tables no chart uses follow as plain cards.
export function explorationViews(result: Pick<ExplorationResult, 'charts' | 'tables'>): ExplorationView[] {
  const charts = result.charts.flatMap(chart => {
    const table = result.tables.find(t => t.id === chart.tableId);
    return table ? [{kind: 'chart' as const, id: `chart-${chart.id}`, chart, table}] : [];
  });
  const charted = new Set(charts.map(view => view.table.id));
  return [
    ...charts,
    ...result.tables
      .filter(table => !charted.has(table.id))
      .map(table => ({kind: 'table' as const, id: `table-${table.id}`, table})),
  ];
}
```

- [ ] **Step 4: Theme the Plotly figure in `src/ui/exploration/plotly-adapter.ts`**

1. Above `buildPlotlyFigure`, add:

   ```ts
   export type PlotPalette = {series: string[]; text: string; grid: string};
   export const DEFAULT_PALETTE: PlotPalette = {
     series: ['#2C6E7C', '#B8893C', '#C56A4F', '#86B8BE'],
     text: '#2E3F43',
     grid: '#D2D9DA',
   };
   ```

2. Change the signature to:

   ```ts
   export function buildPlotlyFigure(
     chart: ChartSpec,
     table: ResultTable,
     palette: PlotPalette = DEFAULT_PALETTE,
   ): {data: unknown[]; layout: Record<string, unknown>; config: Record<string, unknown>} {
   ```

3. Delete the line `  const colors = ['#245f85', '#b06f32', '#638869', '#956395'];` and replace `marker: {color: colors[index % colors.length]},` with:

   ```ts
         marker: {color: palette.series[index % palette.series.length]},
   ```

4. Replace the start of `layout`:

   ```ts
       autosize: true,
       height: 350,
       margin: {l: 68, r: 18, t: 24, b: 90},
       font: {family: 'system-ui, sans-serif', size: 12, color: '#32465a'},
       paper_bgcolor: '#ffffff',
       plot_bgcolor: '#ffffff',
   ```

   with:

   ```ts
       autosize: true,
       height: 280,
       margin: {l: 64, r: 16, t: 8, b: 64},
       font: {family: '"Spline Sans Mono", ui-monospace, monospace', size: 11, color: palette.text},
       paper_bgcolor: 'rgba(0,0,0,0)',
       plot_bgcolor: 'rgba(0,0,0,0)',
   ```

5. In `yaxis`, replace `gridcolor: '#e5ebf0',` with `gridcolor: palette.grid,`. In `legend`, replace `y: -0.28` with `y: -0.32`.

- [ ] **Step 5: Replace `src/ui/exploration/PlotlyChart.tsx`**

```tsx
import {useEffect, useRef, useState} from 'react';
import type {ChartSpec, ResultTable} from '../../exploration.js';
import {buildPlotlyFigure, type PlotPalette} from './plotly-adapter.js';
import {token, useTheme} from '../theme.js';
const palette = (): PlotPalette => ({
  series: ['--color-primary', '--color-accent-warm', '--color-accent-secondary', '--sea-mist'].map(token),
  text: token('--color-text'),
  grid: token('--color-border'),
});
// Reset is Plotly's own toolbar button or a double-click on the plot.
export function PlotlyChart({chart, table}: {chart: ChartSpec; table: ResultTable}) {
  const container = useRef<HTMLDivElement>(null),
    plotly = useRef<typeof import('plotly.js-basic-dist-min').default | null>(null);
  const [error, setError] = useState(false);
  const theme = useTheme();
  useEffect(() => {
    const element = container.current!;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    setError(false);
    void import('plotly.js-basic-dist-min')
      .then(async module => {
        if (disposed) return;
        plotly.current = module.default;
        const figure = buildPlotlyFigure(chart, table, palette());
        await module.default.react(
          element,
          structuredClone(figure.data),
          structuredClone(figure.layout),
          structuredClone(figure.config),
        );
        if (disposed) {
          module.default.purge(element);
          return;
        }
        observer = new ResizeObserver(() => {
          void module.default.Plots.resize(element).catch(() => {});
        });
        observer.observe(element);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      plotly.current?.purge(element);
      plotly.current = null;
    };
  }, [chart, table, theme]);
  return error ? (
    <p className="chart-error" role="status">
      This chart could not be displayed. The verified text and data table remain available.
    </p>
  ) : (
    <div
      className="plotly-chart"
      role="img"
      aria-label={`${chart.title}. Switch to Table for the data.`}
      ref={container}
    />
  );
}
```

- [ ] **Step 6: Create `src/ui/exploration/ChartCard.tsx`**

```tsx
import {useState} from 'react';
import type {ChartSpec, ResultTable as ResultTableData} from '../../exploration.js';
import {PlotlyChart} from './PlotlyChart.js';
import {ResultTable} from './ResultTable.js';
export function ChartCard({chart, table}: {chart: ChartSpec; table: ResultTableData}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className="view-card result-chart" aria-label={chart.title}>
      <header className="view-head">
        <h3>{chart.title}</h3>
        <div className="toggle" role="group" aria-label={`${chart.title} view`}>
          <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>
            Chart
          </button>
          <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>
            Table
          </button>
        </div>
      </header>
      {view === 'chart' ? <PlotlyChart chart={chart} table={table} /> : <ResultTable table={table} titled={false} />}
    </section>
  );
}
```

- [ ] **Step 7: Make `ResultTable` work inside a card and align numbers**

In `src/ui/exploration/ResultTable.tsx`:

1. Change the signature to `export function ResultTable({table, titled = true}: {table: ResultTableData; titled?: boolean}) {`
2. Replace `    <section className="result-table" aria-label={table.title}>\n      <h3>{table.title}</h3>` with:

   ```tsx
       <section className={`result-table${titled ? ' view-card' : ''}`} aria-label={table.title}>
         {titled && <h3>{table.title}</h3>}
   ```

3. On the column header `<th scope="col" key={column.key}` add `className="num"`.
4. Replace `<td key={column.key}>` with `<td key={column.key} className="num">`.

- [ ] **Step 8: Replace `src/ui/exploration/Exploration.tsx`**

```tsx
import {useState} from 'react';
import type {ExplorationResult} from '../../exploration.js';
import {ResultTable} from './ResultTable.js';
import {ChartCard} from './ChartCard.js';
import {explorationViews} from './views.js';
// F9: the first view inline; the rest one click away so the answer and composer stay close.
export function Exploration({result}: {result: ExplorationResult}) {
  const views = explorationViews(result);
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? views : views.slice(0, 1);
  const more = views.length - 1;
  return (
    <div className="exploration">
      <div className="result-scope">
        <strong>Verified result</strong>
        <p>
          {result.scope.population} · {result.scope.period} · {result.scope.basis}
        </p>
        {result.scope.rankingWindow && <p>Ranking: {result.scope.rankingWindow}</p>}
        {result.coverage.length > 0 && (
          <ul>
            {result.coverage.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        )}
      </div>
      {shown.map(view =>
        view.kind === 'chart' ? (
          <ChartCard key={view.id} chart={view.chart} table={view.table} />
        ) : (
          <ResultTable key={view.id} table={view.table} />
        ),
      )}
      {!expanded && more > 0 && (
        <button type="button" className="more-views" onClick={() => setExpanded(true)}>
          Show {more} more {more === 1 ? 'view' : 'views'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Run the tests**

Run: `npx vitest run tests/unit/exploration-views.test.ts tests/unit/exploration-ui.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
npm run format
git add src/ui/exploration tests/unit/exploration-views.test.ts tests/unit/exploration-ui.test.ts
git commit -m "feat: compact chart cards with a chart/table toggle and themed Plotly colours"
```

---

### Task 10: Composer, Sources and empty state

**Files:**
- Rewrite: `src/ui/Composer.tsx`
- Create: `src/ui/Sources.tsx`
- Test: `tests/unit/sources.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {expect, it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {formatBytes, Sources} from '../../src/ui/Sources.js';
it('lists workspace sources in a collapsed section', () => {
  const html = renderToStaticMarkup(
    createElement(Sources, {
      files: [
        {id: 'f', name: 'prices.csv', relativePath: 'files/f/prices.csv', bytes: 2048, sha256: 'x', addedAt: '', kind: 'csv'},
      ],
    }),
  );
  expect(html).toContain('<summary>Sources · 1 file</summary>');
  expect(html).toContain('prices.csv');
  expect(html).toContain('2.0 KB');
  expect(formatBytes(12)).toBe('12 B');
  expect(formatBytes(3 * 1048576)).toBe('3.0 MB');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/sources.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `src/ui/Sources.tsx`**

```tsx
import type {SourceFile} from '../contracts.js';
export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
// B7: every workspace file is used; this list is for reference only.
export function Sources({files}: {files: SourceFile[]}) {
  return (
    <details className="bar-section">
      <summary>
        Sources · {files.length} {files.length === 1 ? 'file' : 'files'}
      </summary>
      {files.length ? (
        <ul className="sources">
          {files.map(file => (
            <li key={file.id}>
              <span className="source-name">{file.name}</span>
              <span>{file.kind.toUpperCase()}</span>
              <span>{formatBytes(file.bytes)}</span>
              <span>{file.addedAt ? new Date(file.addedAt).toLocaleDateString() : ''}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No files yet. Add files from the composer.</p>
      )}
    </details>
  );
}
```

- [ ] **Step 4: Replace `src/ui/Composer.tsx`**

```tsx
import {useEffect, useRef, useState} from 'react';
import {AuiIf, ComposerPrimitive} from '@assistant-ui/react';
// F8: Enter sends, Shift+Enter adds a line, Esc never stops a run; drafting is allowed while a run is busy.
export function Composer({
  needsInput,
  uploading,
  upload,
}: {
  needsInput: boolean;
  uploading: boolean;
  upload: (files: File[]) => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (needsInput) input.current?.focus();
  }, [needsInput]);
  return (
    <div
      className={`composer-area${dragging ? ' dragging' : ''}`}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        event.preventDefault();
        setDragging(false);
        const files = [...event.dataTransfer.files];
        if (files.length) upload(files);
      }}
    >
      <ComposerPrimitive.Root className="composer">
        <ComposerPrimitive.Input
          ref={input}
          aria-label="Your question"
          placeholder={needsInput ? 'Answer the question above…' : 'Ask about your sales, margins or pricing…'}
          cancelOnEscape={false}
          submitMode="enter"
          minRows={2}
          maxRows={8}
        />
        <div className="composer-actions">
          <label className="upload-button">
            {uploading ? 'Uploading…' : '+ Add file'}
            <input
              aria-label="Add file"
              type="file"
              multiple
              accept=".csv,.xlsx,.txt,.md"
              disabled={uploading}
              onChange={event => {
                const files = [...(event.target.files ?? [])];
                if (files.length) upload(files);
                event.target.value = '';
              }}
            />
          </label>
          <span className="hint">CSV · Excel · Markdown, or drop files here</span>
          <AuiIf condition={s => s.thread.isRunning}>
            <ComposerPrimitive.Cancel className="stop">Stop</ComposerPrimitive.Cancel>
          </AuiIf>
          <AuiIf condition={s => !s.thread.isRunning}>
            <ComposerPrimitive.Send className="primary">Send ↗</ComposerPrimitive.Send>
          </AuiIf>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
}
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/unit/sources.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/ui/Composer.tsx src/ui/Sources.tsx tests/unit/sources.test.ts
git commit -m "feat: assistant-ui composer with drop upload and a Sources list"
```

---

### Task 11: Thread, messages, announcer, app shell and styles

**Files:**
- Create: `src/ui/thread-context.ts`, `src/ui/Thread.tsx`, `src/ui/Message.tsx`, `src/ui/Announcer.tsx`
- Rewrite: `src/ui/App.tsx`, `src/ui/styles.css`
- Delete: `src/ui/Chat.tsx`

- [ ] **Step 1: Create `src/ui/thread-context.ts` and `src/ui/Thread.tsx`**

`src/ui/thread-context.ts` (its own module so `Thread` and `Message` don't import each other):

```ts
import {createContext} from 'react';
import type {ChatMessage, RunRecord} from '../contracts.js';
export type ThreadValue = {
  messages: readonly ChatMessage[];
  runs: readonly RunRecord[];
  firstByRun: Map<string, string>;
  busy: boolean;
  retry: (question: string) => void;
};
export const ThreadContext = createContext<ThreadValue>({
  messages: [],
  runs: [],
  firstByRun: new Map(),
  busy: false,
  retry: () => {},
});
```

`src/ui/Thread.tsx`:

```tsx
import {ThreadPrimitive, useAui} from '@assistant-ui/react';
import type {ActiveRun} from './useSession.js';
import {Message} from './Message.js';
import {RunningView} from './RunningView.js';
const EXAMPLES = [
  'How have margins in product group X changed over the last five years?',
  'Which customers had the largest price increases this year?',
  'Where are discounts eroding margin the most?',
];
function EmptyState() {
  const aui = useAui();
  return (
    <div className="empty">
      <span className="eyebrow">Start with a question</span>
      <h1>
        Turn sales data into
        <br />
        clear pricing decisions.
      </h1>
      <p>Add your files, describe the business context, and ask what you want to understand.</p>
      <div className="examples">
        {EXAMPLES.map(example => (
          <button type="button" key={example} className="example" onClick={() => aui.composer().setText(example)}>
            “{example}”
          </button>
        ))}
      </div>
    </div>
  );
}
// The running view sits after the messages; it is not a message, so step updates never touch the list.
export function Thread({activeRun}: {activeRun: ActiveRun | null}) {
  return (
    <ThreadPrimitive.Root className="thread">
      <ThreadPrimitive.Viewport className="conversation">
        <ThreadPrimitive.Empty>
          <EmptyState />
        </ThreadPrimitive.Empty>
        <ThreadPrimitive.Messages>{({message}) => <Message id={message.id} />}</ThreadPrimitive.Messages>
        {activeRun && <RunningView runId={activeRun.id} startedAt={activeRun.startedAt} />}
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
```

- [ ] **Step 2: Create `src/ui/Message.tsx`**

```tsx
import {memo, useContext, useRef} from 'react';
import {MessagePrimitive} from '@assistant-ui/react';
import {ThreadContext} from './thread-context.js';
import {AssuranceBadge} from './AssuranceBadge.js';
import {MarkdownText} from './MarkdownText.js';
import {RunSummary} from './RunningView.js';
import {Exploration} from './exploration/Exploration.js';
import {messageOutcome} from './outcome.js';
const PARTS = {Text: MarkdownText};
// data-renders lets the browser test prove step events don't re-render messages (F11 acceptance 4).
export const Message = memo(function Message({id}: {id: string}) {
  const thread = useContext(ThreadContext);
  const renders = useRef(0);
  renders.current++;
  const index = thread.messages.findIndex(m => m.id === id);
  const message = thread.messages[index];
  if (!message) return null;
  const outcome = messageOutcome(thread.messages, thread.runs, index);
  const finishedRun =
    message.runId && thread.firstByRun.get(message.runId) === message.id
      ? thread.runs.find(run => run.id === message.runId && run.endedAt)
      : undefined;
  return (
    <MessagePrimitive.Root className={`message ${message.role}`} data-renders={renders.current}>
      {finishedRun && <RunSummary run={finishedRun} />}
      <div className="message-head">
        <span className="message-role">{message.role === 'user' ? 'You' : 'Pricing assistant'}</span>
        {message.role === 'assistant' && <AssuranceBadge assurance={message.assurance} outcome={outcome.status} />}
      </div>
      {message.role === 'user' ? <p className="user-text">{message.text}</p> : <MessagePrimitive.Parts components={PARTS} />}
      {message.exploration && <Exploration result={message.exploration} />}
      {message.explorationNotice && <p className="exploration-notice">{message.explorationNotice}</p>}
      {outcome.retryQuestion && !thread.busy && (
        <button type="button" className="retry" onClick={() => thread.retry(outcome.retryQuestion!)}>
          Retry
        </button>
      )}
    </MessagePrimitive.Root>
  );
});
```

- [ ] **Step 3: Create `src/ui/Announcer.tsx`**

```tsx
import {useEffect, useRef, useState} from 'react';
import type {SessionSnapshot} from '../contracts.js';
import type {ActiveRun} from './useSession.js';
import {useRunSteps} from './steps-store.js';
import {stageViews} from './run-view.js';
import {announcement, messageOutcome} from './outcome.js';
// F10: one polite region for stage changes, answers and needs-input; never individual steps.
export function Announcer({snapshot, activeRun}: {snapshot: SessionSnapshot | null; activeRun: ActiveRun | null}) {
  const steps = useRunSteps(activeRun?.id);
  const stage = activeRun ? stageViews(steps, Date.now()).find(view => view.state === 'running')?.label : undefined;
  const messages = snapshot?.messages ?? [];
  const runs = snapshot?.runs ?? [];
  const index = messages.length - 1;
  const last = messages[index];
  const answerKey =
    last?.role === 'assistant' ? `${last.id}:${last.assurance ?? ''}:${runs.at(-1)?.outcome?.kind ?? ''}` : '';
  const [text, setText] = useState('');
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (stage) setText(`${stage} stage started`);
  }, [stage, activeRun?.id]);
  useEffect(() => {
    if (seen.current === null) {
      seen.current = answerKey;
      return;
    }
    if (!answerKey || answerKey === seen.current || !last) return;
    seen.current = answerKey;
    setText(announcement(last, messageOutcome(messages, runs, index)));
  }, [answerKey]);
  return (
    <div className="sr-only" role="status" aria-live="polite">
      {text}
    </div>
  );
}
```

- [ ] **Step 4: Replace `src/ui/App.tsx`**

```tsx
import {useEffect, useMemo, useState} from 'react';
import {AssistantRuntimeProvider, useExternalStoreRuntime} from '@assistant-ui/react';
import type {ChatMessage, RunAccepted, SessionSnapshot, SourceFile, SubmitRequest} from '../contracts.js';
import {useSession} from './useSession.js';
import {api, post, APIError} from './api.js';
import {Thread} from './Thread.js';
import {ThreadContext, type ThreadValue} from './thread-context.js';
import {Composer} from './Composer.js';
import {Sources} from './Sources.js';
import {Announcer} from './Announcer.js';
import {appendText, firstAssistantIdByRun, toThreadMessage} from './thread-messages.js';
import {awaitingInput} from './outcome.js';
type Status = {
  modelId: string;
  health: {agent: {ready: boolean; detail: string}; python: {ready: boolean; detail: string}};
};
const NO_MESSAGES: ChatMessage[] = [];
export function App() {
  const {snapshot, activeRun, connected, error, setError, replace} = useSession();
  const [status, setStatus] = useState<Status | null>(null),
    [files, setFiles] = useState<SourceFile[]>([]),
    [uploading, setUploading] = useState(false),
    [uncertain, setUncertain] = useState<SubmitRequest | null>(null);
  useEffect(() => {
    if (connected) {
      void api<Status>('/status')
        .then(setStatus)
        .catch(e => setError(e.message));
      void api<{files: SourceFile[]}>('/files')
        .then(v => setFiles(v.files))
        .catch(e => setError(e.message));
    }
  }, [connected]);
  // B7: fileIds is always empty, which the server treats as "every workspace source".
  const submit = async (request: SubmitRequest) => {
    setError('');
    try {
      await post<RunAccepted>('/messages', request);
      setUncertain(null);
    } catch (e) {
      setError((e as Error).message);
      setUncertain(e instanceof APIError && e.status < 500 ? null : request);
    }
  };
  const ask = (text: string) => submit({requestId: crypto.randomUUID(), text, fileIds: []});
  const upload = async (picked: File[]) => {
    setUploading(true);
    setError('');
    try {
      for (const file of picked) {
        const form = new FormData();
        form.append('file', file);
        const source = await api<SourceFile>('/files', {method: 'POST', body: form});
        setFiles(old => [...old, source]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  const act = async (path: string) => {
    try {
      replace(await post<SessionSnapshot>(path));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const ready = !!(status?.health.agent.ready && status?.health.python.ready);
  const messages = snapshot?.messages ?? NO_MESSAGES;
  const runs = snapshot?.runs ?? [];
  const busy = snapshot?.busy ?? false;
  const runtime = useExternalStoreRuntime<ChatMessage>({
    messages,
    isRunning: busy,
    isDisabled: !connected || !ready || !!uncertain,
    convertMessage: toThreadMessage,
    onNew: async message => {
      await ask(appendText(message));
    },
    onCancel: async () => {
      await act('/cancel');
    },
  });
  const thread = useMemo<ThreadValue>(
    () => ({messages, runs, firstByRun: firstAssistantIdByRun(messages), busy, retry: q => void ask(q)}),
    [messages, runs, busy],
  );
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadContext.Provider value={thread}>
        <div className="app">
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">
                p.
              </span>
              <div>
                <strong>Pricing harness</strong>
                <span>{status?.modelId ?? 'Connecting to workspace'}</span>
              </div>
            </div>
            <div className="header-actions">
              <span className={`connection ${connected ? 'online' : ''}`}>
                {connected ? 'Connected' : 'Reconnecting…'}
              </span>
              <button
                type="button"
                disabled={busy || !connected}
                onClick={() => {
                  setUncertain(null);
                  void act('/session/new');
                }}
              >
                New conversation
              </button>
            </div>
          </header>
          <main className="chat-panel">
            {!ready && status && (
              <div className="notice">
                {!status.health.agent.ready ? status.health.agent.detail : status.health.python.detail}
              </div>
            )}
            {error && (
              <div className="error" role="alert">
                <span>{error}</span>
                {uncertain ? (
                  <>
                    <button type="button" disabled={!connected} onClick={() => void submit(uncertain)}>
                      Retry same request
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUncertain(null);
                        setError('');
                      }}
                    >
                      Keep editing
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setError('')}>
                    Dismiss
                  </button>
                )}
              </div>
            )}
            <Thread activeRun={activeRun} />
            <Composer
              needsInput={!busy && awaitingInput(runs)}
              uploading={uploading}
              upload={picked => void upload(picked)}
            />
          </main>
          <footer className="bottom-bar">
            <Sources files={files} />
            <details className="bar-section">
              <summary>Recent analysis · {runs.length} requests</summary>
              <ul className="runs">
                {runs
                  .slice(-5)
                  .reverse()
                  .map(run => (
                    <li key={run.id}>
                      <strong>{run.outcome?.kind ?? run.state}</strong>
                      <span>{new Date(run.startedAt).toLocaleTimeString()}</span>
                    </li>
                  ))}
              </ul>
            </details>
          </footer>
          <Announcer snapshot={snapshot} activeRun={activeRun} />
        </div>
      </ThreadContext.Provider>
    </AssistantRuntimeProvider>
  );
}
```

- [ ] **Step 5: Delete the old chat component**

```bash
git rm src/ui/Chat.tsx
```

- [ ] **Step 6: Replace `src/ui/styles.css`**

```css
/* Pricing harness UI. Built on critias-aegean.css; use semantic tokens only. */
*{box-sizing:border-box}
html,body,#root{height:100%}
body{margin:0;background:var(--color-bg);background-image:var(--bg-wash);color:var(--color-text);font-family:var(--font-body);font-size:var(--text-base);line-height:var(--leading-normal)}
button,input,textarea{font:inherit;color:inherit}
button{cursor:pointer;border:1px solid var(--color-border-strong);background:var(--color-surface-raised);border-radius:var(--radius-md);padding:var(--space-1) var(--space-3);font-family:var(--font-mono);font-size:var(--text-sm)}
button:hover:not(:disabled){border-color:var(--color-primary)}
button:disabled{color:var(--color-faint);cursor:not-allowed}
button[aria-pressed=true]{background:var(--color-primary);color:var(--color-primary-contrast);border-color:var(--color-primary)}
:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.app{height:100vh;display:grid;grid-template-rows:auto 1fr auto}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:var(--space-4);padding:var(--space-3) var(--space-6);border-bottom:var(--border-rule) solid var(--color-rule)}
.brand{display:flex;align-items:center;gap:var(--space-3)}
.brand-mark{font-family:var(--font-display);font-size:var(--text-2xl);color:var(--color-heading)}
.brand strong{display:block;font-family:var(--font-display);font-weight:400;text-transform:uppercase;letter-spacing:var(--display-tracking);font-size:var(--text-lg);color:var(--color-heading)}
.brand span{font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-muted)}
.header-actions{display:flex;align-items:center;gap:var(--space-3)}
.connection{font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-muted)}
.connection.online{color:var(--color-success-text)}
.chat-panel{min-height:0;display:flex;flex-direction:column;width:100%;max-width:880px;margin:0 auto;padding:0 var(--space-4)}
.notice,.error{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-2);margin:var(--space-3) 0;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);font-size:var(--text-sm)}
.notice{background:var(--color-info-bg);color:var(--color-info-text);border:1px solid var(--color-info-border)}
.error{background:var(--color-danger-bg);color:var(--color-danger-text);border:1px solid var(--color-danger-border)}
.thread{flex:1;min-height:0;display:flex}
.conversation{flex:1;min-width:0;overflow-y:auto;padding:var(--space-6) 0}
.empty{max-width:var(--measure);padding:var(--space-10) 0}
.eyebrow{font-family:var(--font-mono);font-size:var(--text-xs);letter-spacing:var(--tracking-eyebrow);text-transform:uppercase;color:var(--color-accent-warm-text)}
.empty h1{margin:var(--space-3) 0;font-family:var(--font-display);font-weight:400;text-transform:uppercase;letter-spacing:var(--display-tracking);line-height:var(--display-leading);font-size:var(--text-3xl);color:var(--color-heading)}
.examples{display:grid;gap:var(--space-2);margin-top:var(--space-5)}
.example{text-align:left;padding:var(--space-3);font-family:var(--font-body);font-size:var(--text-base);background:var(--color-surface)}
.message{margin:0 0 var(--space-6)}
.message.user{padding:var(--space-3) var(--space-4);background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg)}
.message.assistant{padding-left:var(--space-4);border-left:var(--border-rule) solid var(--color-rule)}
.message-head{display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)}
.message-role{font-family:var(--font-mono);font-size:var(--text-xs);letter-spacing:var(--tracking-label);text-transform:uppercase;color:var(--color-muted)}
.user-text{margin:0;white-space:pre-wrap}
.badge{display:inline-flex;align-items:center;gap:6px;padding:1px var(--space-2);border:1px solid var(--color-border);border-radius:var(--radius-pill);background:var(--color-surface);color:var(--color-muted);font-family:var(--font-mono);font-size:var(--text-xs);transition:background-color var(--dur-slow) var(--ease-standard),color var(--dur-slow) var(--ease-standard),border-color var(--dur-slow) var(--ease-standard)}
.badge.verifying{background:var(--color-warning-bg);color:var(--color-warning-text);border-color:var(--color-warning-border)}
.badge.independently-reviewed{background:var(--color-success-bg);color:var(--color-success-text);border-color:var(--color-success-border)}
.badge.mixed{background:var(--color-info-bg);color:var(--color-info-text);border-color:var(--color-info-border)}
.badge.needs-input{background:var(--color-primary);color:var(--color-primary-contrast);border-color:var(--color-primary)}
.dot{display:inline-block;flex:none;width:7px;height:7px;border-radius:50%;background:currentColor;animation:pulse 1.2s var(--ease-standard) infinite}
.dot.waiting{animation-duration:2.4s}
@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
.markdown{max-width:var(--measure)}
.markdown p{margin:0 0 var(--space-3)}
.markdown table{border-collapse:collapse;margin:var(--space-3) 0}
.markdown th,.markdown td{padding:var(--space-1) var(--space-3);border-bottom:1px solid var(--color-border);text-align:left}
.num{text-align:right!important;font-variant-numeric:tabular-nums lining-nums;white-space:nowrap}
.markdown code{font-family:var(--font-mono);font-size:.9em}
.markdown pre{overflow-x:auto;padding:var(--space-3);background:var(--color-surface);border-radius:var(--radius-md)}
.mermaid-diagram{margin:var(--space-3) 0;overflow-x:auto}
.mermaid-diagram svg{max-width:100%;height:auto}
.run-summary{margin:0 0 var(--space-2);font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-muted)}
.retry{margin-top:var(--space-3)}
.running{margin:0 0 var(--space-6);padding:var(--space-3) var(--space-4);background:var(--color-surface);border-left:var(--border-rule) solid var(--color-primary)}
.stepper{display:flex;gap:var(--space-2);margin:0 0 var(--space-3);padding:0;list-style:none}
.stage{flex:1;display:flex;justify-content:space-between;gap:var(--space-2);padding:var(--space-1) var(--space-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-muted)}
.stage.done{background:var(--color-success-bg);color:var(--color-success-text);border-color:var(--color-success-border)}
.stage.running{background:var(--color-info-bg);color:var(--color-info-text);border-color:var(--color-primary)}
.stage.skipped{border-style:dashed}
.live-line{display:flex;align-items:center;gap:var(--space-2);margin:0;font-size:var(--text-sm)}
.live-line .dot{color:var(--color-primary)}
.live-last{color:var(--color-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.elapsed{margin-left:auto;font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-muted);font-variant-numeric:tabular-nums}
.step-list{margin-top:var(--space-3);font-size:var(--text-sm)}
.step-list>summary{cursor:pointer;font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-link)}
.step-list h4{margin:var(--space-3) 0 var(--space-1);font-family:var(--font-mono);font-size:var(--text-xs);font-weight:400;letter-spacing:var(--tracking-label);text-transform:uppercase;color:var(--color-muted)}
.step-list ol{margin:0;padding:0;list-style:none}
.step,.step summary{display:flex;align-items:center;gap:var(--space-2);padding:2px 0}
.step details{flex:1}
.step summary{cursor:pointer}
.step.retried{color:var(--color-warning-text)}
.step-duration{margin-left:auto;font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-muted)}
.step pre{margin:var(--space-1) 0;padding:var(--space-2);white-space:pre-wrap;font-size:var(--text-xs);background:var(--color-bg);border-radius:var(--radius-sm)}
.exploration{margin-top:var(--space-4);min-width:0}
.result-scope{margin-bottom:var(--space-3);padding:var(--space-3);background:var(--color-surface);border-radius:var(--radius-md);font-size:var(--text-sm)}
.result-scope p,.result-scope ul{margin:var(--space-1) 0}
.view-card{min-width:0;margin:0 0 var(--space-3);padding:var(--space-3) var(--space-4);background:var(--color-surface-raised);border:1px solid var(--color-border);border-radius:var(--radius-lg)}
.view-card h3{margin:0 0 var(--space-2);font-size:var(--text-md);font-weight:600;color:var(--color-heading)}
.view-head{display:flex;justify-content:space-between;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)}
.view-head h3{margin:0}
.toggle{display:flex;gap:var(--space-1)}
.plotly-chart{width:100%;min-width:0;height:280px;overflow:hidden}
.chart-error,.exploration-notice{font-size:var(--text-sm);color:var(--color-warning-text)}
.table-controls{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-2);font-size:var(--text-sm)}
.table-controls input{padding:2px var(--space-2);border:1px solid var(--color-border-strong);border-radius:var(--radius-sm);background:var(--color-surface-raised)}
.table-count,.scroll-hint{margin:var(--space-1) 0;font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-muted)}
.table-scroll{overflow-x:auto}
.result-table table{width:100%;border-collapse:collapse;font-size:var(--text-sm)}
.result-table th,.result-table td{padding:var(--space-1) var(--space-2);border-bottom:1px solid var(--color-border);text-align:left;vertical-align:top}
.result-table th button{padding:0;border:0;background:none;font-family:inherit;font-weight:600}
.held-reason{display:block;white-space:normal;font-size:var(--text-xs);color:var(--color-muted)}
.table-pages{display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-2);font-size:var(--text-sm)}
.more-views{margin-bottom:var(--space-3)}
.composer-area{padding:var(--space-3) 0 var(--space-4)}
.composer{padding:var(--space-3);background:var(--color-surface-raised);border:1px solid var(--color-border-strong);border-radius:var(--radius-lg)}
.composer-area.dragging .composer{outline:2px dashed var(--color-primary);outline-offset:2px}
.composer textarea{width:100%;border:0;outline:none;resize:none;background:transparent;font-size:var(--text-md)}
.composer-actions{display:flex;align-items:center;gap:var(--space-3);margin-top:var(--space-2)}
.upload-button{position:relative;cursor:pointer;font-family:var(--font-mono);font-size:var(--text-sm);color:var(--color-link)}
.upload-button input{position:absolute;inset:0;opacity:0;cursor:pointer}
.hint{font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-muted)}
.primary{margin-left:auto;background:var(--color-primary);color:var(--color-primary-contrast);border-color:var(--color-primary)}
.stop{margin-left:auto;color:var(--color-danger-text);border-color:var(--color-danger-border)}
.bottom-bar{display:flex;flex-wrap:wrap;gap:var(--space-6);padding:var(--space-2) var(--space-6);border-top:1px solid var(--color-border);font-size:var(--text-sm)}
.bar-section summary{cursor:pointer;font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-muted)}
.sources,.runs{max-height:30vh;overflow-y:auto;margin:var(--space-2) 0;padding:0;list-style:none}
.sources li,.runs li{display:flex;gap:var(--space-3);padding:2px 0;font-family:var(--font-mono);font-size:var(--text-xs)}
.source-name{font-family:var(--font-body);font-size:var(--text-sm);color:var(--color-text)}
@media (max-width:640px){.topbar,.bottom-bar{padding-left:var(--space-4);padding-right:var(--space-4)}.stepper{flex-direction:column}.hint{display:none}}
@media (prefers-reduced-motion:reduce){.dot{animation:none}.badge{transition:none}}
```

- [ ] **Step 7: Typecheck, unit tests and build**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: no typecheck output; all unit tests pass; build succeeds.

- [ ] **Step 8: Commit**

```bash
npm run format
git add -A src/ui
git commit -m "feat: assistant-ui thread, messages and app shell on Critias styles"
```

---

### Task 12: Fixture replay and browser specs

**Files:**
- Create: `tests/fixtures/recorded-steps.ts`
- Modify: `tests/fixtures/chat-workflow.ts`, `tests/browser/fixture-server.ts`
- Modify: `tests/browser/app.spec.ts`, `tests/browser/workflow.spec.ts`, `tests/browser/chat-exploration.spec.ts`
- Create: `tests/browser/running-view.spec.ts`

The recorded fixture exists (plan 1 Task 8), so "Recorded synthetic" replays it. It covers the normal path only: no tool was retried, and its skipped Verify is a `stage` step, which the orchestrator emits itself and replay can't inject. "Stepped synthetic" replays a synthetic list with a retried tool. The skipped Verify and background verification use the `/test/verify-state` route (decision 7).

Replay keeps every recorded transition in order: model `waiting` → `running` → `done`, and tool `running` → `done`. The gaps between transitions are the recorded ones, divided by 20 and clamped to 50–1,500 ms. That plays the 2:18 recorded run in about 9.5 s.

- [ ] **Step 1: Create the step replay helper `tests/fixtures/recorded-steps.ts`**

```ts
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
  model('plan', 1),
  tool('plan', 1, 'Read context.md'),
  tool('plan', 2, 'Read fixture.csv'),
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
      if (first) push(step.startedAt, {type: 'tool_start', callId: step.stepId, tool: step.name, summary: step.summary});
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
```

- [ ] **Step 2: Wire replay and a diagram reply into `tests/fixtures/chat-workflow.ts`, and add a Verify-state route**

1. Add imports at the top:

   ```ts
   import {recordedSteps, replayEvents, syntheticSteps} from './recorded-steps.js';
   import {stageOf} from '../../src/agent/workflow/steps.js';
   ```

2. In `createChatFixtureRunner`, directly after the `counters` line, add:

   ```ts
     // The fixture runs the analyst twice (self-check repair); replay each stage once per run.
     const replayed = new Set<string>();
   ```

3. Directly after the first `      if (signal.aborted) throw Error('cancelled');` inside `execute`, add:

   ```ts
         const replay = question.includes('Recorded') ? recordedSteps() : question.includes('Stepped') ? syntheticSteps : [];
         const stage = stageOf(request.role);
         if (replay.length && !replayed.has(`${request.runId}:${stage}`)) {
           replayed.add(`${request.runId}:${stage}`);
           for (const {delayMs, event: step} of replayEvents(replay, stage)) {
             await new Promise(resolve => setTimeout(resolve, delayMs));
             if (signal.aborted) throw Error('cancelled');
             event(step);
           }
         }
   ```

4. Replace the verifier reply:

   ```ts
                   reply:
                     'Synthetic checked values: Q1 revenue £10; Q2 revenue £20; Q1 gross margin 36.09%. Q2 margin is unavailable because unit cost is blank.',
   ```

   with:

   ```ts
                   reply:
                     'Synthetic checked values: Q1 revenue £10; Q2 revenue £20; Q1 gross margin 36.09%. Q2 margin is unavailable because unit cost is blank.' +
                     (question.includes('Diagram')
                       ? '\n\n```mermaid\nflowchart LR\n  A[Sales] --> B[Margin]\n```\n\n| Quarter | Revenue |\n|---|---|\n| Q1 | £10.00 |'
                       : ''),
   ```

5. In `tests/browser/fixture-server.ts`, add `Step` to the `contracts.js` type import (`import type {ChatMessage, Step} from '../../src/contracts.js';`). Then add this route directly after the `/test/activity` route:

   ```ts
   // States the offline workflow never reaches (decision 7): a skipped Verify, or an early
   // answer while Verify runs in the background. Applies to the active run only.
   server.post<{Body: {verify: 'skipped' | 'running'}}>('/test/verify-state', async request => {
     const run = app.view.snapshot().activeRun;
     if (!run) return {applied: false};
     const at = new Date().toISOString();
     const skipped = request.body.verify === 'skipped';
     const step: Step = {
       runId: run.id,
       stepId: 'test-verify',
       stage: 'verify',
       kind: 'stage',
       name: 'verify',
       state: request.body.verify,
       startedAt: at,
       ...(skipped ? {endedAt: at} : {}),
       summary: skipped ? 'Not needed' : 'Verifying',
     };
     app.view.step(step);
     if (!skipped)
       app.view.appendLogical('assistant', 'Early synthetic answer. Verifying independently: Q1 revenue.', {
         runId: run.id,
         assurance: 'verifying',
         pendingClaims: ['Q1 revenue'],
       });
     return {applied: true};
   });
   ```

- [ ] **Step 3: Update `tests/browser/app.spec.ts`**

1. Replace `  await expect(page.locator('.chip').last()).toBeVisible();` with:

   ```ts
     await expect(page.getByText('Sources · 1 file')).toBeVisible();
   ```

2. In the Stop test, replace:

   ```ts
     await page.getByRole('button', {name: 'Stop', exact: true}).click();
     await expect(page.getByRole('button', {name: 'Send'})).toBeVisible();
   ```

   with:

   ```ts
     const stopped = Date.now();
     await page.getByRole('button', {name: 'Stop', exact: true}).click();
     await expect(page.getByRole('button', {name: 'Send'})).toBeVisible();
     expect(Date.now() - stopped).toBeLessThan(2000);
   ```

- [ ] **Step 4: Update `tests/browser/workflow.spec.ts` with B9 treatments**

1. Replace:

   ```ts
     await expect(page.getByText('Which metric should I use?', {exact: true})).toBeVisible();
   ```

   with:

   ```ts
     await expect(page.getByText('Which metric should I use?', {exact: true})).toBeVisible();
     await expect(page.locator('.badge.needs-input')).toHaveText('Needs your input');
     await expect(page.getByLabel('Your question')).toHaveAttribute('placeholder', 'Answer the question above…');
     await expect(page.getByLabel('Your question')).toBeFocused();
   ```

2. Replace:

   ```ts
     await expect(page.getByText(/ENAMETOOLONG|internal-handoff-123.45/)).toHaveCount(0);
   ```

   with:

   ```ts
     await expect(page.getByText(/ENAMETOOLONG|internal-handoff-123.45/)).toHaveCount(0);
     await expect(page.locator('.message.assistant').last().locator('.badge')).toHaveText('No checked answer');
     await expect(page.getByRole('button', {name: 'Retry', exact: true})).toBeVisible();
   ```

- [ ] **Step 5: Update `tests/browser/chat-exploration.spec.ts`**

1. In the first test, replace:

   ```ts
     await send(page);
     const charts = page.locator('.plotly-chart');
   ```

   with:

   ```ts
     await send(page);
     await page.getByRole('button', {name: 'Show 3 more views'}).click();
     const charts = page.locator('.plotly-chart');
   ```

2. Replace **both** occurrences (use replace-all) of:

   ```ts
     await revenue.getByRole('button', {name: 'Reset chart', exact: true}).click();
   ```

   with:

   ```ts
     await revenue.locator('.nsewdrag').dblclick();
   ```

3. In the screenshot loop, replace:

   ```ts
       await page.getByRole('heading', {name: 'Quarterly performance', exact: true}).scrollIntoViewIfNeeded();
   ```

   with:

   ```ts
       await products.scrollIntoViewIfNeeded();
   ```

4. In "keeps exploration state independent…", replace:

   ```ts
     const first = page.locator('.message.assistant').first();
     await first.getByLabel('Search table labels').nth(1).fill('Product 60');
   ```

   with:

   ```ts
     const first = page.locator('.message.assistant').first();
     await first.getByRole('button', {name: 'Show 3 more views'}).click();
     await first.getByLabel('Search table labels').first().fill('Product 60');
   ```

   and replace:

   ```ts
     await second.getByLabel('Search table labels').nth(1).fill('Product 2');
     await expect(first.getByLabel('Search table labels').nth(1)).toHaveValue('Product 60');
   ```

   with:

   ```ts
     await second.getByRole('button', {name: 'Show 3 more views'}).click();
     await second.getByLabel('Search table labels').first().fill('Product 2');
     await expect(first.getByLabel('Search table labels').first()).toHaveValue('Product 60');
   ```

   Then make the scroll check wait for the delayed settle. Today it can pass before `/test/activity` settles 100 ms later (plan 1 review). Replace:

   ```ts
     await page.request.post('/test/activity');
     await expect.poll(() => page.locator('.conversation').evaluate(element => element.scrollTop)).toBe(0);
   ```

   with:

   ```ts
     // The settled snapshot re-renders every message, so a higher render count proves it arrived.
     const rendersBeforeSettle = Number(await first.getAttribute('data-renders'));
     await page.request.post('/test/activity');
     await expect.poll(async () => Number(await first.getAttribute('data-renders'))).toBeGreaterThan(rendersBeforeSettle);
     expect(await page.locator('.conversation').evaluate(element => element.scrollTop)).toBe(0);
   ```

5. In "keeps verified tables and text if the lazy Plotly renderer fails", replace:

   ```ts
     await expect(page.getByRole('heading', {name: 'Quarterly performance', exact: true})).toBeVisible();
   ```

   with:

   ```ts
     await page.getByRole('button', {name: 'Table', exact: true}).first().click();
     await expect(page.getByRole('region', {name: /Quarterly performance data/})).toBeVisible();
   ```

6. Append a markdown/mermaid test at the end of the file:

   ```ts
   test('renders markdown tables with aligned numbers and mermaid diagrams locally', async ({page}) => {
     await send(page, 'Diagram synthetic');
     await expect(page.locator('.mermaid-diagram svg')).toBeVisible();
     await expect(page.locator('.markdown td.num')).toHaveText('£10.00');
   });
   ```

- [ ] **Step 6: Create `tests/browser/running-view.spec.ts`**

```ts
import {test, expect, type Page} from 'playwright/test';
import {fixtureCsv} from '../fixtures/chat-workflow.js';
test.use({trace: 'on'});
const stepCount = async (page: Page) =>
  Number(((await page.locator('.step-list > summary').textContent().catch(() => '')) ?? '').match(/\d+/)?.[0] ?? 0);
test.beforeEach(async ({page}) => {
  await page.goto('/');
  await expect(page.getByText('Connected', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'New conversation'}).click();
  await page
    .getByLabel('Add file', {exact: true})
    .setInputFiles({name: 'fixture.csv', mimeType: 'text/csv', buffer: Buffer.from(fixtureCsv)});
  await expect(page.getByText('Sources · 1 file')).toBeVisible();
});
test('shows the running view within a second, restores it after reload and summarises the run', async ({page}) => {
  test.setTimeout(60000);
  await page.getByLabel('Your question').fill('Recorded synthetic');
  const sent = Date.now();
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.locator('.running .stage.running')).toBeVisible({timeout: 1000});
  expect(Date.now() - sent).toBeLessThan(1000);
  await expect.poll(() => stepCount(page)).toBeGreaterThanOrEqual(2);
  const before = await stepCount(page);
  await page.reload();
  await expect(page.locator('.running .stepper')).toBeVisible();
  await expect(page.locator('.running .live-line')).toBeVisible();
  await expect.poll(() => stepCount(page)).toBeGreaterThanOrEqual(before);
  await expect(page.getByText(/Synthetic checked values/)).toBeVisible({timeout: 45000});
  await expect(page.locator('.running')).toHaveCount(0);
  await expect(page.locator('.run-summary').first()).toHaveText(/\d+ steps · \d+:\d\d/);
});
test('groups steps by stage, reveals retried detail and never re-renders earlier messages on steps', async ({page}) => {
  await page.getByLabel('Your question').fill('Explore synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.getByText(/Synthetic checked values/)).toBeVisible();
  const earlier = page.locator('.message.assistant').first();
  await page.getByLabel('Your question').fill('Stepped synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect.poll(() => stepCount(page)).toBeGreaterThanOrEqual(2);
  const rendersBefore = Number(await earlier.getAttribute('data-renders'));
  const stepsBefore = await stepCount(page);
  await expect.poll(() => stepCount(page), {timeout: 15000}).toBeGreaterThanOrEqual(stepsBefore + 6);
  const rendersAfter = Number(await earlier.getAttribute('data-renders'));
  expect(rendersAfter - rendersBefore).toBeLessThanOrEqual(2);
  await page.locator('.step-list > summary').click();
  await expect(page.locator('.step-list h4').first()).toBeVisible();
  const retried = page.locator('.step.retried').first();
  await expect(retried).toContainText('Ran margin.py · retried');
  await retried.locator('summary').click();
  await expect(retried.locator('pre')).toContainText('Binder Error');
});
test('follows the dark system theme and respects reduced motion', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark', reducedMotion: 'reduce'});
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.getByLabel('Your question').fill('Stepped synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  const dot = page.locator('.live-line .dot');
  await expect(dot).toBeVisible();
  expect(await dot.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await expect(page.locator('.running .elapsed')).toHaveText(/\d+:\d\d/);
});
test('Esc does not stop a running analysis', async ({page}) => {
  await page.getByLabel('Your question').fill('Stepped synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.getByRole('button', {name: 'Stop', exact: true})).toBeVisible();
  await page.getByLabel('Your question').press('Escape');
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', {name: 'Stop', exact: true})).toBeVisible();
});
test('shows a skipped Verify as not needed and keeps the stepper live under an early answer', async ({page}) => {
  await page.getByLabel('Your question').fill('slow synthetic');
  await page.getByRole('button', {name: 'Send'}).click();
  await expect(page.locator('.running .stage.running')).toBeVisible();
  expect((await (await page.request.post('/test/verify-state', {data: {verify: 'skipped'}})).json()).applied).toBe(true);
  await expect(page.locator('.running .stage.skipped')).toContainText('Not needed');
  await page.request.post('/test/verify-state', {data: {verify: 'running'}});
  await expect(page.locator('.message.assistant .badge.verifying')).toHaveText('Verifying…');
  await expect(page.locator('.running .stage.running', {hasText: 'Verify'})).toBeVisible();
  // The running view stays below the early answer until the run settles.
  expect(
    await page
      .locator('.conversation')
      .evaluate(element =>
        Boolean(
          element.querySelector('.message.assistant')!.compareDocumentPosition(element.querySelector('.running')!) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
  ).toBe(true);
  await page.getByRole('button', {name: 'Stop', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Send'})).toBeVisible();
  await expect(page.locator('.running')).toHaveCount(0);
});
```

- [ ] **Step 7: Run the browser suite**

Run: `npm run build && npm run test:browser`
Expected: all specs pass. If a selector differs because assistant-ui renders an extra wrapper, adjust the selector in the spec, not the behaviour. Record any such change in the commit message.

- [ ] **Step 8: Commit**

```bash
npm run format
git add tests/fixtures/recorded-steps.ts tests/fixtures/chat-workflow.ts tests/browser
git commit -m "test: browser coverage for the running view, outcomes, markdown, theme and motion"
```

---

### Task 13: Full verification and visual check

- [ ] **Step 1: Run every check**

```bash
npx vitest run && npx tsc --noEmit && npm run format:check && npm run build && npm run test:browser
```

Expected: all pass. The build may still warn about large Plotly and mermaid chunks; both load only when needed.

- [ ] **Step 2: Look at it**

Start the fixture server (`node node_modules/tsx/dist/cli.mjs tests/browser/fixture-server.ts`) and open `http://127.0.0.1:4318`. Upload `fixture.csv` from `tests/fixtures` (or any CSV), then check by eye in light and dark system themes, at 1280×900 and 390×844:

1. **Empty state:** Critias display heading; clicking an example fills the composer without sending.
2. **"Stepped synthetic":**
   - The stepper moves Plan → Analyse, and Verify shows a state.
   - The live line pulses and the timer ticks.
   - "Show all N steps" groups the steps by stage.
   - The retried row expands to show the error.
3. **Answer:**
   - The running view collapses to "N steps · m:ss" above the answer.
   - The badge is coloured.
   - The first chart card has the Chart / Table toggle, and "Show 3 more views" expands the rest.
4. **"Diagram synthetic":** the mermaid diagram renders, and the £ figures in the table align right.
5. **F7 check:** the digits in table columns line up. If Spectral's figures don't align, change `.num` in `styles.css` to add `font-family: var(--font-mono)`, and commit that as the F7 adjustment.
6. **No layout problems:** no horizontal page scroll at 390 px, and focus rings are visible when tabbing through the stepper, step list, toggles and composer.

- [ ] **Step 3: Commit any fixes from Step 2**, each as its own small commit with what changed and why.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| `ExternalStoreRuntime`, `onNew` with `fileIds: []`, `onCancel`, no edit/regenerate | 11 |
| Steps store separate from messages; snapshot seeds steps; stale buffered step events ignored | 4 |
| Running view: stepper, live line, waiting/thinking, collapsed grouped steps, summary after the answer, Verify "Not needed" | 5, 7, 11, 12 |
| Verify "Not needed" only after the self-check seals; run-unique tool step IDs (plan 1 review) | 2b |
| Background verification: stepper stays live on Verify under the early answer | 11, 12 |
| Running-view fixture: recorded run replayed with its transitions and scaled timing; retried step; skipped Verify | 12 |
| Generic step row, retried with detail on click, model steps not listed | 5, 7 |
| Markdown, mermaid (lazy, strict, fallback), numeric alignment | 5, 8 |
| Badges and labels (F6, X4), fade, verifying pulse | 5, 6, 11 (CSS) |
| B9 outcomes, Retry, needs-input placeholder and focus, request-error banner | 2, 5, 10, 11 |
| Charts inline, Chart/Table toggle, 280 px, no help or Reset, "Show N more views", theme colours | 9 |
| Composer: no queue, Enter/Shift+Enter, no Esc stop, clickable examples, drop upload | 10, 11, 12 |
| Sources disclosure, no selection | 10, 11 |
| Critias tokens vendored, self-hosted fonts, light/dark, no Tailwind | 3, 11 |
| Accessibility: single polite announcer, no aria-live on the thread, native disclosure, `aria-pressed`, focus ring, reduced motion | 7, 9, 11, 12 |
| Acceptance 1–7 (first step < 1 s, reload restore, Stop < 2 s, no re-render on steps, no external requests, AA and motion, B9 treatments) | 12, 13 |
| Clean break, old UI removed | 11 |
| Deferred items (conversation list, reasoning, history view, structured corrections, copy table) | not built |
