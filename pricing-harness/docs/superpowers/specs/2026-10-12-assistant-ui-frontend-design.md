# assistant-ui frontend: design spec

Date: 2026-10-12. Output of the design session run from the [assistant-ui brainstorm guide](../../research/assistant-ui-brainstorm-guide-2026-10-10.md). Each section cites the decision IDs (B1–B11, F1–F11, X1–X4) recorded in that guide's decision log, which also holds the reasons and revisit triggers. This spec is the input for the implementation plan.

## Goal

Replace the current chat UI with an assistant-ui interface in which a 2–5 minute analysis feels alive and trustworthy. The user always knows which stage the work is at, that the agent is doing something right now, and whether an answer is self-checked, being verified, or independently verified.

Simplicity is the governing constraint. Where a decision had a simpler and a richer option, the simpler one was chosen and the richer one recorded as a revisit trigger.

## Scope

**In scope:** `step` events from workflow stages to the browser; a steps file per run; the active run's steps in the session snapshot; a new React UI built on assistant-ui's `ExternalStoreRuntime` and unstyled primitives, styled with the Critias Aegean design system; markdown and mermaid rendering; compact inline charts; a Sources disclosure; outcome treatments; rewritten browser tests and a recorded running-view fixture.

**Out of scope (deferred):**

| Item | Revisit trigger |
|---|---|
| Conversation list (B8). **Important; planned for a later round.** | Next design round |
| Reasoning text in the UI (B2) | Users report runs feel opaque; add a `kind: 'reasoning'` step |
| Past-run step history and `GET /api/runs/:id/steps` (B3) | Users ask how a past answer was computed |
| Structured corrections with struck-through old values (B4) | Users miss corrections in prose |
| Claim-linked numbers in reply text (B5) | Users want to trace a figure to its check |
| Per-chart message parts, side panel for charts (B6, F9) | Answers regularly carry 3–4+ views |
| File remove/replace, per-run file selection (B7) | Workspace size makes runs slow or costly |
| Developer timing panel (B10) | Latency diagnosis needs it in the UI |
| Edit, regenerate, branching, queued messages (F1, F8) | Users ask for them |
| Copy-table button (F7) | Users ask for it |

## Migration

Clean break (F11). The UI is replaced directly on a feature branch; there is no `?ui=next` flag, no parallel old UI and no data migration. The app is private and single-user; bugs in the new UI are fixed as they emerge. Backend pieces that only served the old UI are removed: the legacy `tool` event and the 5-second elapsed/remaining status ticker (`orchestrator.ts:136–139`).

## Backend contract

### Step event (B1, B10)

One new event type replaces `tool`. Types live in `src/contracts.ts` (X1).

```ts
export type StepStage = 'plan' | 'analyse' | 'verify';
export type StepKind = 'stage' | 'tool' | 'model';
export type StepState = 'waiting' | 'running' | 'done' | 'retried' | 'skipped';
export type Step = {
  runId: string;
  stepId: string; // stable per step; updates upsert by stepId
  stage: StepStage;
  kind: StepKind;
  name: string; // stage name, tool name, or 'model'
  state: StepState;
  startedAt: string; // ISO
  endedAt?: string;
  summary: string; // ≤ 200 chars, rule-derived, never model-written
  detail?: string; // ≤ 1,000 chars; error text for a retried tool call
};
// HarnessEvent gains: | {type: 'step'; payload: Step}
```

States by kind:

| Kind | States used | Meaning |
|---|---|---|
| `stage` | `running`, `done`, `skipped` | `skipped` = Verify not needed (self-check sufficient) |
| `tool` | `running`, `done`, `retried` | `retried` = the call failed; the error goes in `detail` |
| `model` | `waiting`, `running`, `done` | `waiting` until first token (provider queueing), then `running` ("Thinking…") |

Stage mapping: coordinator → `plan`, analyst (including self-check) → `analyse`, verifier (full or targeted) → `verify`. Finalisation work belongs to the last active stage.

Tool summaries are fixed rules over tool arguments (F5):

| Tool | Summary |
|---|---|
| `execute_analysis` | `Ran <script file name>` |
| `read` | `Read <file name>` |
| `write` / `edit` | `Wrote <file name>` / `Edited <file name>` |
| `bash` | `Ran command: <first ~60 chars of the command>` |
| any other | `<tool name>` |

Example sequence (abridged):

```json
{"type":"step","payload":{"runId":"r1","stepId":"stage-plan","stage":"plan","kind":"stage","name":"plan","state":"running","startedAt":"2026-10-12T10:00:00.000Z","summary":"Planning"}}
{"type":"step","payload":{"runId":"r1","stepId":"model-1","stage":"plan","kind":"model","name":"model","state":"waiting","startedAt":"2026-10-12T10:00:00.200Z","summary":"Waiting for model"}}
{"type":"step","payload":{"runId":"r1","stepId":"model-1","stage":"plan","kind":"model","name":"model","state":"running","startedAt":"2026-10-12T10:00:00.200Z","summary":"Thinking"}}
{"type":"step","payload":{"runId":"r1","stepId":"call_7","stage":"analyse","kind":"tool","name":"execute_analysis","state":"retried","startedAt":"2026-10-12T10:01:10.000Z","endedAt":"2026-10-12T10:01:14.000Z","summary":"Ran margin_by_quarter.py","detail":"Binder Error: column \"q\" not found"}}
{"type":"step","payload":{"runId":"r1","stepId":"stage-verify","stage":"verify","kind":"stage","name":"verify","state":"skipped","startedAt":"2026-10-12T10:03:05.000Z","endedAt":"2026-10-12T10:03:05.000Z","summary":"Not needed"}}
```

No reasoning or text deltas are forwarded (B2). No throttling or coalescing (B11): volume is a few hundred events per run.

### Persistence and reload (B3)

- Each step event is appended to `analyses/<run>/steps.jsonl` (append-only; a crash leaves a valid prefix).
- `EventView` keeps the active run's steps in memory (upsert by `stepId`) and adds them to `SessionSnapshot` as `activeSteps: Step[]`. They are cleared when the run settles.
- No SSE replay buffer. Reload mid-run is served by the snapshot plus the existing sequence handshake and 15 s heartbeats.
- Past-run steps are never in the snapshot.

### Status event

The periodic elapsed/remaining ticker is removed (B11). `status` remains only for run-state transitions emitted by `EventView.setRun` (`running`, `cancelling`), which the browser uses to set `busy`. Elapsed time is computed in the browser from step `startedAt`.

### Message model (B4, B5, B6)

`ChatMessage` is unchanged: `{id, role, text, complete, runId?, exploration?, explorationNotice?, assurance?, pendingClaims?, corrections?}`.

- `text` is rendered as markdown. Fenced `mermaid` blocks render as diagrams. Assurance notes, checked figures, holds, coverage and correction prose stay in the text as the controller writes them today.
- Early answers and their upgrade use the existing in-place update: a `message` event with the same `id` (`EventView.updateLogical`). The run stays busy until verification ends. Stop or verifier failure falls back to `self-checked` with an explanatory note and outcome `verified-partial`.
- `exploration` stays one part; charts attach only to the final checkpoint, so they always show corrected values. Invalidation keeps using `explorationNotice`.

### Files (B7)

No file selection. The UI always sends `fileIds: []`, which `RunController` already treats as "all workspace sources" (`runs.ts:142`); `run.inputs` still records the files used. No backend change. No remove endpoint: the user keeps the workspace clean.

## Outcome and error treatments (B9)

The UI joins each assistant message to its run via `runId` → `snapshot.runs[].outcome`. No backend change.

| State | Shown | Action |
|---|---|---|
| `complete` | Answer + assurance badge | — |
| `verified-partial` | Answer + badge; existing note in text | — |
| `needs-input` | "Needs your input" badge on the agent's question; composer placeholder "Answer the question above…", composer focused | Type the answer |
| `no-verified-answer` (stopped, budget, failed, source changed) | Existing explanation + muted "No checked answer" badge | **Retry**: resends the same question via the normal send path |
| Request errors (`BUSY`, `NOT_READY`, upload, connection) | Banner with `role="alert"`, cleared on next successful action | Dismiss; connection reconnects automatically |

## Frontend

### Runtime and state (F1, F2)

- `useExternalStoreRuntime({messages, isRunning: snapshot.busy, onNew, onCancel, convertMessage})`.
  - `onNew` → `POST /api/messages {requestId, text, fileIds: []}`. Retry uses the same path.
  - `onCancel` → `POST /api/cancel`.
  - No `onEdit`, `onReload` or branching.
  - `convertMessage` is memoized by message object identity.
- **Messages store:** the existing snapshot reducer; changes only on `message`, `status` and `settled`.
- **Steps store:** a separate module keyed by run ID, read through `useSyncExternalStore`. It is seeded from `snapshot.activeSteps` and updated by `step` events. Only the in-progress reply subscribes, so step updates never re-render messages or charts.
- The in-progress reply is a synthetic assistant message built client-side from the steps store. It is removed when the run's real `message` arrives. No server placeholder.

### Component inventory

| Component | Backed by | Decision |
|---|---|---|
| App shell (header, connection state, New conversation, bottom bar) | Custom | F3 |
| Thread, viewport, scroll-to-bottom | assistant-ui `ThreadPrimitive` | F1 |
| User and assistant message | assistant-ui `MessagePrimitive` | F1 |
| Reply text | `@assistant-ui/react-markdown` with a mermaid code-block renderer (lazy, strict security, raw code fallback) | B5 |
| Assurance / outcome badge | Custom (extends `AssuranceBadge`) | F6, B9 |
| Retry button | Custom; calls the runtime's send path | B9 |
| Running view: stage stepper, live line, collapsed step list, post-run summary | Custom, subscribes to steps store | F4 |
| Step row | Custom, one generic component | F5 |
| Thinking / waiting indicator | Custom; animated dot, elapsed counter under reduced motion | B2, B10 |
| Exploration: scope box, chart cards with Chart/Table toggle, plain tables, "Show N more views" | Existing exploration components, restyled and recomposed | B6, F9 |
| Composer, send/stop, upload, drop zone | assistant-ui `ComposerPrimitive` + attachment adapter (upload only) | F8, B7 |
| Sources disclosure | Custom `<details>` in the bottom bar | B7 |
| Empty state with clickable examples | Custom; examples fill, not send | F8 |
| Status announcer | Custom visually hidden live region | F10 |

### Running view (F4, F5)

- **Stepper:** Plan → Analyse → Verify. Done stages use the success style, the active stage the primary style, and a skipped Verify shows "Not needed" in the muted style.
- **Live line:** the animated "Waiting for model…" or "Thinking…" indicator from the latest model step, the last completed tool step, and overall elapsed time.
- **Step list:** collapsed behind "Show all N steps" and grouped by stage with a small heading per stage. Each row shows a state icon (done, retried, or a running dot), the summary and the duration. A retried row reveals `detail` on click. Model steps are not listed.
- **After the answer arrives:** the view collapses to a single line, "14 steps · 3:10", above the answer. It is not re-expandable for past runs.
- **Background verification:** the stepper stays live on Verify under the early answer until the badge changes.
- No expected-duration hint.

### Assurance badges (F6, X4)

Badges appear in the message header only.

| State | Label | Critias token family |
|---|---|---|
| `self-checked` | Self-checked | muted (marble) |
| `verifying` | Verifying… (pulsing dot) | warning (brass) |
| `independently-reviewed` | Independently verified | success |
| `mixed` | Partly independently verified | info |
| outcome `no-verified-answer` | No checked answer | muted |
| outcome `needs-input` | Needs your input | primary (teal) |

A change of state does one colour fade (`--dur-slow`); there is no fade under reduced motion.

### Charts and tables (B6, F9, F7)

- Charts stay inline in the message.
- Each chart is one card with a Chart / Table toggle that uses `aria-pressed`.
- Tables without a chart render plain.
- Plot height is about 280 px, reserved before Plotly loads so the layout doesn't shift.
- The per-chart help paragraph and the "Reset chart" button are removed; the Plotly toolbar and double-click cover reset.
- With more than one view, only the first is shown; the rest sit behind "Show N more views".
- Plotly series colours come from the Critias ramp tokens and follow the theme.
- Numeric columns, in both reply markdown tables and data tables, are right-aligned with `tabular-nums`. If Spectral lacks tabular figures, numeric cells use Spline Sans Mono. This number styling is a starting point and is expected to be tuned during live work.

### Composer and files (F8, B7)

- **During a run:** the user can type a draft, but sending is blocked and Stop replaces Send. There are no queued messages.
- **Keyboard:** Enter sends and Shift+Enter adds a newline. There is no Esc-to-stop.
- **Uploads:**
  - "+ Add file", plus drag-and-drop onto the composer and multi-file upload through the attachment adapter.
  - An attachment is only an upload: `POST /api/files`. Nothing is shown in the sent message.
  - A subtle outline appears while dragging.
- **Sources:** a collapsed "Sources · N files" disclosure in the bottom bar, next to "Recent analysis". It lists name, type, size and date added. No selection and no remove action.
- **Empty state:** the existing example plus one or two more. Clicking an example fills the composer.

### Styling (F3)

- **Approach:**
  - assistant-ui unstyled primitives with plain hand-written CSS.
  - No Tailwind or UI kit.
- **Tokens:**
  - Vendor a copy of the Critias design system token file `critias-aegean.css` into `src/ui/` with a header note to keep it in sync.
  - Components use semantic tokens only.
- **Themes:**
  - Light and dark, via `data-theme`.
  - The default follows `prefers-color-scheme`.
- **Fonts:**
  - Instrument Serif (display; sparing in an app UI), Spectral (body) and Spline Sans Mono (labels and figures).
  - Self-hosted, for example via `@fontsource`.
  - Never loaded from Google: the app must make no external requests.
- **Motion:** the token durations collapse to 0 under `prefers-reduced-motion`.

### Accessibility (F10)

- **Live regions:**
  - Remove `aria-live` from the conversation.
  - One visually hidden polite status region announces only stage changes, answer arrival with its assurance, and needs-input.
  - Errors use `role="alert"`.
  - Step rows, timers and the indicator are not announced.
- **Keyboard:** all collapsibles are native `<details>` or `<button>` elements, and focus uses `--focus-ring`.
- **Contrast:** both themes meet WCAG AA, using the token pairs documented in `critias-design-system/tokens/contrast-and-usage.md`.

### Trust wording (X4)

User-facing text uses "independently verified" everywhere. The controller's "independently reviewed" phrasing (`delivery.ts` `assuranceNote`) is changed to match. The internal enum value `independently-reviewed` is unchanged.

| Term | Meaning |
|---|---|
| Self-checked | The analyst's own executed checks passed; no independent recomputation |
| Independently verified | A separate verifier recomputed the figures from raw sources |
| Partly independently verified | Some figures independently verified, the rest self-checked |
| Held | A figure withheld, with a stated reason |
| Coverage | What the answer does and does not include |

## Testing and acceptance (F11, X1)

- **Contract tests:** one per new or changed event (`step`, and a snapshot carrying `activeSteps`). Each test checks a server-emitted example against what the browser reducer and the steps store accept.
- **Unit tests:**
  - Steps store upsert and seeding from the snapshot.
  - Per-tool summary rules and truncation.
  - Joining an outcome to its message by `runId`.
- **Browser specs:**
  - Rewrite the selectors.
  - Keep the existing behaviours: no external requests (now including fonts), escaped labels, held values shown as gaps, reload restoring state, and Stop.
- **Running-view fixture:**
  - A sanitised `steps.jsonl` recorded from one real run after the backend work lands (X3).
  - The fixture server replays it with realistic timing.
  - It covers the stepper, a retried step, a skipped Verify and background verification.

Acceptance criteria:

1. The first step is visible within 1 s of sending.
2. Reloading mid-run restores the stepper, the live line and the step list.
3. Stop takes effect within 2 s.
4. Step events do not re-render messages or charts, asserted with a render counter in the fixture test.
5. No external network requests.
6. Light and dark themes pass AA, and reduced motion is respected.
7. Every outcome in the B9 table shows its treatment and action.

## Order of work (X2, X3)

1. **Backend:**
   - `step` contract.
   - Step emission from the workers and orchestrator.
   - `steps.jsonl`.
   - `activeSteps` in the snapshot.
   - Removal of the `tool` event and the status ticker.
   - "Independently verified" wording.
   - All testable over SSE and with unit tests, before any UI exists.
2. **Recorded fixture:** record one real run and sanitise its `steps.jsonl`.
3. **Frontend:**
   - Tokens and fonts.
   - Runtime and stores.
   - Thread and messages.
   - Running view.
   - Exploration recomposition.
   - Composer, uploads and Sources.
   - Outcome treatments.
   - Accessibility pass.
4. **Tests:** rewrite the browser specs and verify the acceptance criteria.

Nothing in the UI waits on further latency work. Early answers, in-place updates and the `verifying` and `mixed` states have already landed.
