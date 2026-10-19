# assistant-ui frontend: brainstorm guide

Date: 2026-10-10. Working guide for a separate design session. It lists the backend and frontend questions to settle before writing an implementation plan for an assistant-ui interface. It does not make the decisions. Each question has the relevant current-code facts, the realistic options and a suggested starting position to argue with.

Builds on [chat UI options](chat-ui-options-2026-10-09.md), which selected assistant-ui's `ExternalStoreRuntime`, and the [latency diagnosis](query-latency-diagnosis-2026-10-09.md).

## How to run the session

1. Read "Current state" below so the discussion starts from facts, not assumptions.
2. Work through the sections in order. Backend event contract decisions (B1–B4) constrain almost everything in the frontend, so settle them first.
3. For each question, record the decision in the log at the bottom: choice, reason, and what would make you revisit it.
4. Park anything that depends on unbuilt latency work (background verification, targeted review) as "contract only": decide its event/message shape now and build the behaviour later.
5. Exit when every question has a decision or an explicit "defer". Output: a short spec (event contract + message model + component inventory + acceptance criteria) to feed the implementation plan.

## Goal

A smooth chat experience where a 2–5 minute analysis feels alive and trustworthy. The user always knows what stage the work is at, what the agent is doing right now, what has been checked, and when an answer is provisional versus verified.

Non-goals for this round: multi-run concurrency, multiple users, changing model/provider, OpenUI-style generated components.

## Current state (facts from the code)

- **Server owns state.** `EventView` (`src/agent/events.ts`) holds a `SessionSnapshot` (messages, runs, artifacts, busy, activeRun). The browser restores it from `GET /api/session` and applies `HarnessEvent`s from SSE `GET /api/events` with a sequence-number handshake (`src/ui/useSession.ts`). Keep this as the source of truth.
- **Event types today:** `hello`, `message`, `tool`, `status`, `error`, `settled` (`src/contracts.ts`). `ChatMessage` is `{id, role, text, complete, runId?, exploration?, explorationNotice?}`.
- **Workers' activity never reaches the browser.** Stage workers (`src/agent/workflow/worker.ts`) emit `usage`, `read`, `operation`, `execution`, `configuration` and `analyst_revision` events to the orchestrator, which writes them to `analyses/<run>/events.jsonl` only. The browser sees a `status` line every 5 s: "analysis: 45s elapsed; 1150s remaining" (`orchestrator.ts:33`). The `tool` event type exists but is only fed by the legacy main session, not by workflow stages.
- **Answers arrive whole.** The reply comes from the sealed checkpoint (`checkpoint.reply`), not from a token stream. Assistant text is model-written JSON assembled by the controller.
- **Rendering:** plain text (`Chat.tsx:7`), no markdown. Rich results are `exploration` (Plotly charts + tables bound to checked claim IDs) rendered by `src/ui/exploration/*`.
- **Files:** uploaded via `POST /api/files`, persisted as workspace sources across conversations, selected as chips per request (`Composer.tsx`). Not per-message attachments.
- **Conversations:** one active conversation, "New conversation" replaces it (`/api/session/new`). No thread list or history browsing.
- **Runs:** one at a time (`RunController`, `BUSY` 409). Cancel via `POST /api/cancel`.
- **Styling:** hand-written `styles.css` (about 7 KB). No Tailwind or shadcn. Vite + React 19.
- **Tests:** Playwright browser specs in `tests/browser/*` with a fixture server, and unit tests for the browser state reducer.

Planned latency work that changes the UI contract:
- Per-request timing (first token, tokens/s) recorded in events.
- Background verification: a self-checked answer is shown early with a "verifying" state, later upgraded to "verified" or corrected.
- Targeted verification: the verifier may check only a subset of claims, giving mixed assurance.

---

## Backend questions

### B1. What is a "step" event and how fine-grained is it?

The core new contract. Options:
- (a) Stage-level only: planning / analysis / self-check / verification start and end, with elapsed time.
- (b) Plus tool-level: each `read`, `bash`, `write`, `edit` and `execute_analysis` call, with start/end, a short argument summary and a short result summary.
- (c) Plus model-level: each model request, with first-token time and tokens/s (ties into the latency instrumentation).
- (d) Plus reasoning/text deltas streamed live.

Questions to settle:
- Exact shape: `{type:'step', payload:{runId, stage, stepId, kind, name, state, startedAt, endedAt?, summary?, detail?}}`?
- How are summaries produced: from tool args (for example `execute_analysis: margin_by_quarter.py`) or by a cheap rule per tool? Never by an extra model call.
- Truncation limits for summaries and details. Today's `operation` events log whole tool results; some lines exceed 512 KB.
- Do failed tool calls show as failures, or are they softened ("retrying")? Seven or eight failed calls per run is normal today. Showing every SQL alias error may erode trust; hiding them may feel like stalling.

Suggested start: (a)+(b)+(c) now, with failures shown as a quiet "retried" state. (d) is decided in B2.

### B2. Should reasoning be shown, and how?

The workers can subscribe to thinking deltas (`message_update`). Options: hide it; show a live one-line "thinking…" ticker; show collapsible full reasoning per stage; show it only after the run ends.

Considerations:
- Reasoning may contain wrong intermediate numbers that look authoritative next to verified results. This matters for a finance tool.
- Some providers return no reasoning text, or a summary only. The UI must not depend on it.
- Volume: 15k–40k reasoning tokens per run. Throttling (for example 100 ms batches) and storage policy are needed.
- Persist reasoning, or drop it after the run?

Suggested start: a collapsed "reasoning" part per stage, labelled as unverified working, not persisted past the run, with a live one-line ticker while collapsed.

### B3. Persistence and replay of steps

- Are steps stored in the `RunRecord`, in `events.jsonl` (source for replay), or in a new `steps.json` per run?
- On page reload mid-run, does the browser get all steps so far in the `/api/session` snapshot, or replay them via SSE from a sequence number?
- After the run, are steps kept for history ("show how this was computed") or collapsed to a summary?
- Snapshot size: 100+ steps per run times many runs. Include only the active run's steps in the snapshot and lazy-load the rest via `GET /api/runs/:id/steps`?

Suggested start: steps in a per-run file; the snapshot carries the active run's steps; history is lazy-loaded.

### B4. Message model for assurance states

Background and targeted verification need the message to change after delivery. Decide:
- Message fields: `assurance: 'self-checked' | 'verifying' | 'independently-reviewed' | 'mixed'` plus a per-claim status?
- Correction semantics: does a correction replace the message text in place, append a new "corrected" message, or show a diff? What happens to charts bound to corrected claims?
- Does the run count as "busy" while background verification runs? Can the user ask the next question then? (Single-run constraint: probably not, unless verification is exempt from the busy lock.)
- Cancelling: does Stop cancel the background verifier, leaving the answer "self-checked"?
- Which event announces the transition: a `message` update with the same ID, or a dedicated `assurance` event?

Suggested start: update the same message ID in place, add a visible "Corrected" note with the old value struck through, keep the run busy until verification finishes, and let Stop leave the answer self-checked.

### B5. Answer text format

- Should the reply be markdown (tables, bold, lists)? The model writes it inside JSON; the controller could validate allowed markdown.
- Should claim values in the text be linkable to their checked claim IDs (hover shows the source script and check)? That needs the controller to emit structured spans, not just text.
- Do coverage and holds stay appended prose, or become a structured "Limitations" part?

Suggested start: markdown reply, plus structured `coverage`/`holds` parts. Claim-linked spans deferred.

### B6. Exploration (charts and tables) as message parts

- Keep `exploration` as one blob, or split it into one data part per chart and table so each renders and memoizes independently?
- Load Plotly lazily per part (it is already lazy)?
- Invalidation (`invalidateExplorations`) currently strips the field. With parts, what replaces them: a notice part?

Suggested start: one `data-exploration` part per chart and table plus a `data-notice` part on invalidation.

### B7. Files: attachments or workspace sources?

assistant-ui's attachment adapter models files per message. The app models files as persistent workspace sources selected per run.
- Use the attachment adapter for upload (drag and drop, paste) but keep sources as the real model, so an attachment equals "upload and select"?
- Where does source selection live: composer chips (today), a side panel, or both?
- Show which sources a past message used (`run.inputs` already records them)?

Suggested start: attachment adapter as the upload entry point, sources panel as the selection model, past messages showing their inputs.

### B8. Conversations

- Is a thread list in scope? The backend has a single conversation file (`.pricing/workflow/conversation.json`) and session JSONL files.
- If yes: list, switch, rename, delete endpoints; how analysis-index and cache scope relate to conversations (they are per conversation today).

Suggested start: defer the thread list; keep "New conversation". Design the endpoint shape only if cheap.

### B9. Errors, outcomes and cancellation mapping

Map each `RunRecord.outcome.kind` (`complete`, `verified-partial`, `needs-input`, `no-verified-answer`) and `error.code` (`WORKFLOW_FAILED`, `NO_VERIFIED_ANSWER`, `SOURCE_CHANGED`, `BUSY`, `NOT_READY`) to a UI treatment: message status (`complete`/`incomplete`), banner, retry affordance, or a "needs your input" composer state.

Suggested start: draw the table in the session; every state gets one visible treatment and one action.

### B10. Timing data in the UI

Once first-token time and tokens/s are recorded:
- Show the user anything (for example "waiting for model provider" versus "model is writing")? Could reduce frustration during provider queueing.
- Or keep it in a developer panel only?

Suggested start: a developer toggle that shows per-stage timing; the user-facing view shows only stage and elapsed time.

### B11. Event volume and backpressure

- Maximum event rate to the browser (tool events plus throttled deltas)?
- Coalescing on the server versus the client?
- SSE heartbeats exist (15 s). Is any reconnect behaviour needed beyond today's handshake?

Suggested start: server-side throttle at 10 events/s per run for deltas; tool and stage events unthrottled.

---

## Frontend questions

### F1. Runtime wiring

- `useExternalStoreRuntime` with `messages` from the snapshot, `isRunning = snapshot.busy`, `onNew` → `POST /api/messages`, `onCancel` → `POST /api/cancel`. Confirm there is no need for `onEdit`, `onReload` (regenerate) or branching for now.
- Where does the active run's in-progress "assistant message" come from: a synthetic message built client-side from steps, or a server-side placeholder message?
- `convertMessage` memoization: which inputs trigger re-conversion?

Suggested start: synthetic running message built client-side from the steps store; no edit, regenerate or branches.

### F2. State layout for smoothness

- Keep the snapshot (messages) and the steps stream in separate stores so 10 updates/s of steps do not re-render the message list or Plotly charts. Zustand, `useSyncExternalStore`, or the existing `useSession` split in two?
- Should `reduceEvent`'s per-event message-array cloning stay?

Suggested start: a separate steps store keyed by run ID with selectors; the messages store changes only on `message`/`settled`.

### F3. Styling approach

- (a) Tailwind v4 (`@tailwindcss/vite`) plus assistant-ui's shadcn-style components, restyled to the current palette.
- (b) assistant-ui unstyled primitives with the existing hand-written CSS.
- (c) A hybrid: primitives for the thread, existing CSS for the shell and exploration.

Considerations: speed of getting polish (a) versus keeping a single styling system and a small dependency set (b). Exploration components are custom either way.

Suggested start: (a) if you are happy adopting Tailwind app-wide; otherwise (b).

### F4. The running-analysis view

The most important design question for perceived speed. Decide:
- Layout: a stage stepper (Plan → Analyse → Self-check → Verify) at the top of the running message, a tool timeline below it, and a collapsible reasoning section?
- What collapses automatically when the answer arrives?
- Elapsed time per stage and overall; an expected-duration hint ("usually 2–4 min")?
- How to represent a skipped verifier (self-check passed) versus a pending one?

Sketch two or three alternatives on paper in the session before choosing.

### F5. Tool cards

Per tool, what does a card show?
- `execute_analysis`: script name, duration, success, an expandable stdout excerpt, and a link to the script.
- `bash`: command (truncated), exit state.
- `read`: file name only.
- `write`/`edit`: file name, maybe a diff toggle.

Should cards be grouped per stage and collapsed by default after completion? Use `makeAssistantToolUI` per tool name, or one generic card with a per-tool summary function?

### F6. Assurance badges and corrections

Visual language for self-checked, verifying, independently reviewed, mixed and corrected. Placement: the message header, per claim, or both. How a correction animates in without being missed, and without making the original look like it was hidden.

### F7. Markdown and numbers

`@assistant-ui/react-markdown` for replies? Table styling for financial figures (tabular numerals, right alignment, currency)? Copy-to-clipboard for tables?

### F8. Composer behaviour

- During a run: disable input, or allow typing a queued next message?
- Keyboard: Enter to send, Shift+Enter for newline (today). Esc to stop?
- Suggestions/starter prompts on the empty state?
- The "needs input" state: should the composer highlight that the agent asked a question?

### F9. Exploration in the thread

Charts inside the message flow versus a side panel. Behaviour on narrow screens. Avoiding layout shift when Plotly loads (reserve height). Do charts re-render when steps update? (They should not; see F2.)

### F10. Accessibility and motion

`aria-live` policy: announce stage changes and final answers, not every tool event. Respect `prefers-reduced-motion` for streaming and animations. Keyboard reachability of collapsible sections.

### F11. Testing and migration

- Keep the existing Playwright specs passing against the new UI, or rewrite them? Selectors will change.
- Ship behind a flag (`?ui=next`) and keep the old UI until parity?
- Fixture server: add recorded step-event fixtures from a real `events.jsonl` to exercise the running view without paid calls.
- Acceptance criteria for "smooth": for example, no visible jank at 10 events/s, the first step visible within 1 s of send, reload mid-run restores the running view, and Stop responds within 2 s.

---

## Cross-cutting questions

- **Contract ownership:** where do event and message types live so the server and UI share them (today: `src/contracts.ts`)? Add contract tests for every new event type.
- **Order of work:** backend events first (testable via SSE without UI), then the UI. Confirm.
- **Dependency on latency work:** which UI pieces wait for background verification? Suggested: build the `verifying`/`corrected` states against fixtures now; wire them live when the backend lands.
- **Trust wording:** one glossary for the UI (self-checked, independently reviewed, held, coverage) consistent with the controller's assurance notes.

## Decision log

| ID | Decision | Reason | Revisit if |
|---|---|---|---|
| B1 | Stage + tool + model-request steps as one `step` event type (`kind: 'stage' \| 'tool' \| 'model'`) replacing the `tool` event. Summaries derived from tool args by a fixed per-tool rule, capped at ~200 chars, never by a model call. Failed tool calls shown as a quiet "retried" state with the error one click away. Live reasoning/text deltas decided in B2. | One shape simplifies replay (B3) and the steps store (F2). Hiding failures reads as stalling; showing every SQL alias error erodes trust in a finance tool. | Users read "retried" as hiding errors, or step volume makes the running view noisy. |
| B2 | No reasoning text in the UI. Model-request steps (B1) drive an animated "Thinking…" activity indicator so the agent never looks stalled; under `prefers-reduced-motion` it falls back to a non-motion cue such as a live elapsed-seconds counter (F10). Reasoning text is not forwarded or persisted. | Reasoning carries unverified intermediate numbers that undermine trust next to verified results; tool steps already show concrete activity; avoids throttling, storage and provider-variance work. | Users report runs feel opaque. Then add a collapsed, non-persisted reasoning section via a new `kind: 'reasoning'` step without changing the B1 contract. |
| B3 | Append B1 step events to `analyses/<run>/steps.jsonl`. `EventView` holds the active run's steps in memory and includes them in the `/api/session` snapshot; cleared on settle. No SSE replay buffer, no past-run steps in the snapshot. History endpoint (`GET /api/runs/:id/steps`) and the "how was this computed" view are deferred; the file is kept so they can be added later. | Simplest option: no replay buffer exists today, so the snapshot is the only reload path; the file costs almost nothing and keeps history possible. | Users ask to see how a past answer was computed, or active-run steps make the snapshot noticeably large. |
| B4 | Keep current behaviour: the early answer is updated in place via a `message` event with the same ID; the run stays busy until verification finishes; Stop or failure falls back to `self-checked` with a note and `verified-partial` outcome; charts attach only to the final checkpoint. Corrections stay as today's prose in the reply text (plus `corrections: string[]`). No structured corrections and no struck-through old values in this round. | Already built and tested; simplest path. | Users miss corrections inside the prose, or F6 needs the old and new values rendered separately. |
| B5 | Render reply text as markdown with assistant-ui's markdown text component. Fenced `mermaid` blocks render as diagrams (for flowcharts and process explanations), lazy-loaded, with strict security and the raw code block as fallback on parse errors. Coverage and holds stay as prose in the text; no structured parts. Claim-linked spans deferred. | Markdown is assistant-ui's default text rendering, so it costs little; mermaid gives the agent diagrams without new message parts. | Stray markdown characters mangle replies, or diagrams start carrying unverified figures. |
| B6 | Keep `exploration` as one message part rendered by the existing exploration components; keep `explorationNotice` text on invalidation. No per-chart parts. | The separate steps store (F2) already prevents re-renders, which was the main reason to split; least work. | Individual charts need independent updates or memoization proves insufficient. |
| B7 | No file selection: every workspace source is used by every run (UI sends `fileIds: []`, which the backend already treats as "all sources"; `run.inputs` still records what was used). Remove the composer chips. Upload via "+ Add file" plus the assistant-ui attachment adapter for drag-and-drop and multi-file upload; attachments only add to the workspace and are not shown in messages. A collapsed "Sources · N files" disclosure in the bottom bar (like "Recent analysis") lists name, type, size and date added. No remove/replace action and no per-answer "Used:" caption: the user is responsible for keeping the workspace clean. | Chips were noisy with several files; selection added little value; no backend change needed. | Large or many workspace files make runs noticeably slower or costlier, or users repeatedly need to exclude a file without leaving the app. |
| B8 | Deferred, but marked **important**: a conversation list is a planned feature for a later round. Keep "New conversation" for now. | Not needed for this round's goal (a live, trustworthy running view) and touches several backend areas (endpoints, per-conversation analysis cache, switching during a run). assistant-ui's thread list can be added later without changing earlier decisions. | Next design round: plan list, switch, rename and delete endpoints and how the analysis index and cache follow conversations. |
| B9 | UI looks up each message's outcome from `snapshot.runs` by `runId` (no backend change). `complete`: answer + assurance badge. `verified-partial`: answer + badge, existing note stays in text. `needs-input`: "Needs your input" label on the agent's question, composer placeholder "Answer the question above…" and focus. `no-verified-answer`: existing explanation with a muted "No checked answer" label instead of a badge, plus a **Retry** button that resends the same question through the normal send path (not assistant-ui regenerate). Request errors (`BUSY`, `NOT_READY`, upload, connection): red banner as today, cleared on next successful action. | One visible treatment and at most one action per state; every outcome already produces an explanatory message. | Retry is mostly used after budget exhaustion and fails again, or users need different actions per failure reason. |
| B10 | No developer timing panel; model timing stays in run files. The model step (B1) carries one extra state: "Waiting for model…" until first token, then the animated "Thinking…" (B2). Users see current stage, elapsed time per stage and overall, and that label; no tokens/s or millisecond figures. | Honest labelling during provider queueing prevents a run looking stalled; costs one step state, not a feature. | Developers need timing in the UI to diagnose latency, or users ask why a run is slow. |
| B11 | No throttling or coalescing (server or client): without reasoning deltas (B2) volume is a few hundred step events per run. New UI computes elapsed time client-side from step `startedAt`; the 5 s status line and the legacy `tool` event are removed in the clean break (F11). Reconnect relies on existing heartbeats and the snapshot handshake (B3). | Low volume; smoother timer; nothing new to build. | Reasoning deltas are added later, or measured event rates cause jank. |
| F1 | `useExternalStoreRuntime` with `messages` from the snapshot and `isRunning = snapshot.busy`; `onNew` → `POST /api/messages` with `fileIds: []` (also used by B9 Retry); `onCancel` → `POST /api/cancel`. No edit, regenerate or branching. The in-progress reply is built client-side from the active run's steps (stage stepper, tool cards, waiting/thinking indicator) and is replaced when the real `message` arrives; no server placeholder. `convertMessage` memoized by message object identity. | Follows from B1–B4 and B7; least moving parts. | Users need to edit questions or regenerate answers. |
| F2 | Separate steps store keyed by run ID: a plain module exposed through React's `useSyncExternalStore`, no new dependency. Step events go only there and only the in-progress reply subscribes. The messages snapshot changes only on `message` and `settled`. Keep `reduceEvent`'s copying. | `reduceEvent` clones the snapshot per event, so routing steps through it would re-render the app and charts on every tool call. | Profiling shows jank in the running view, or another component needs step data. |
| F3 | Option (b): assistant-ui unstyled primitives with plain hand-written CSS, rebuilt on the Critias Aegean design system (`hackerman/governance/critias-design-system/tokens/critias-aegean.css`, as used by `critias-web`). Vendor a copy of the token file into the UI with a note to keep it in sync; components use semantic tokens only. Light and dark themes (`data-theme`, defaulting to the system preference). Fonts (Instrument Serif, Spectral, Spline Sans Mono) are self-hosted (e.g. `@fontsource`), never loaded from Google, because the app must make no external requests. Plotly colours come from the token ramp instead of the hard-coded adapter palette and follow the theme. Assurance and outcome states map to the semantic success/warning/info/danger tokens. No Tailwind or UI kit. | One styling system, no new build tooling, and a consistent brand with the rest of the Critias work; matches critias-web's deliberate "no Tailwind" choice. | The UI needs many generic components (e.g. for the conversation list) that a kit would provide much faster. |
| F4 | Layout A: a Plan → Analyse → Verify stepper at the top of the in-progress reply; one live line with the animated "Waiting for model…" / "Thinking…" indicator (B2, B10), the last completed step and overall elapsed time; the full step list collapsed behind "Show all N steps". When the answer arrives, the view collapses to a "14 steps · 3:10" summary line above it (not re-expandable for past runs, per B3). Verify shows "Not needed" (muted) when skipped; during background verification the stepper stays live on Verify under the early answer until the badge changes. No expected-duration hint. | Stepper answers "where are we", the live line answers "is it doing something"; full list stays one click away instead of a wall of steps on 30+ step runs. | Users keep expanding the step list (make it open by default) or ignore the stepper. |
| F5 | One generic step row (state icon: done / retried / running dot; summary; duration), grouped by stage inside the collapsed list. No per-tool cards, stdout excerpts, diffs or script links; no `makeAssistantToolUI` (steps come from the steps store, not message content). Summaries use the fixed B1 rules: `execute_analysis` → "Ran <script>", `read` → "Read <file>", `write`/`edit` → "Wrote/Edited <file>", `bash` → "Ran command: <first ~60 chars>"; failures show "retried" with the error on click. Model-request steps are not listed; they only drive the live indicator. | Simplest component that fits layout A; avoids duplicate "Thinking… / Ran…" rows. | Users need script output or code to trust a step. |
| F6 | Badges in the message header only; no per-claim markers. Mapping to Critias semantic tokens: Self-checked → muted (marble); Verifying… → warning (brass) with the same pulsing dot as "Thinking…"; Independently verified → success; Partly independently verified → info; No checked answer (B9) → muted; Needs your input (B9) → primary (teal). A badge change does one soft colour fade (`--dur-slow`, none under reduced motion); correction prose arrives in the same message update. | Reuses existing badges and B4/B9 states; noticeable without being distracting. | Users miss the Verifying → Verified change or misread a state. |
| F7 | Starting point, **expected to be adjusted during live work**: markdown tables in replies and chart-card data tables use right-aligned numeric columns with `font-variant-numeric: tabular-nums`; if Spectral lacks tabular figures, numeric cells use Spline Sans Mono. No copy-table button for now. | Aligned figures are the minimum for financial tables; the rest is best tuned against real answers. | Real answers show alignment, unit or currency formatting problems, or users ask for copying. |
| F8 | During a run the user can draft the next question but cannot send or queue it; Stop replaces Send (as today). Enter sends, Shift+Enter adds a newline; no Esc-to-stop. Empty state: the example question becomes clickable and fills (does not send) the composer, plus one or two more examples in Critias voice. "Needs your input" per B9. Dropping files on the composer uploads them (B7) with a subtle drag outline. | Keeps today's working behaviour; a stray Esc must not discard a paid multi-minute run. | Users want to queue a follow-up while a run finishes. |
| F9 | Charts stay inline in the message. One card per chart with a Chart / Table toggle (tables without a chart stay plain); plot height about 280 px; drop the per-chart help paragraph and Reset button (Plotly toolbar and double-click cover it); when there are several views show the first and collapse the rest behind "Show N more views". Height stays reserved to avoid layout shift. No side panel. | Fixture answer measured ~3,200 px tall with each chart ~470 px in a ~507 px conversation area; charts and their data were separated. Inline is the least work and works on narrow screens. | Answers regularly carry 3–4+ views, or users want to compare charts across messages. Then consider a side panel. |
| F10 | Remove `aria-live` from the conversation. One visually hidden status region announces only stage changes, answer arrival with its assurance, and needs-input; errors keep `role="alert"`. Step rows, timers and the thinking indicator are not announced. Reduced motion: Critias tokens zero durations; thinking/verifying dots and badge fade fall back to static or the elapsed counter (B2). All collapsibles are native `<details>`/`<button>`; Chart/Table toggle uses `aria-pressed`; focus uses `--focus-ring`. | The running view would otherwise flood screen readers; most motion handling is already in the tokens. | Screen-reader testing shows missing or excessive announcements. |
| F11 | Clean break: replace the UI directly on a feature branch; no `?ui=next` flag, no parallel old UI, no migration. Old-UI-only backend pieces (5 s status line, `tool` event) are removed. Bugs are fixed in the new UI as they emerge (private tool). Playwright specs: rewrite selectors, keep the behaviours (no external requests incl. fonts, escaped labels, held values as gaps, reload restore, Stop). Fixture: a sanitised `steps.jsonl` from one real run, replayed by the fixture server with realistic timing. Acceptance: first step visible within 1 s of send; reload mid-run restores stepper, live line and step list; Stop takes effect within 2 s; step events do not re-render messages or charts (render counter in fixture test); no external network requests; light and dark pass AA; reduced motion respected. | The old UI is not worth keeping; the app is private and single-user, so a parallel migration costs more than it protects. | A regression blocks daily use and the fix is not quick. |
| X1 | Shared types stay in `src/contracts.ts`; the `step` event and step types are added there. One contract test per new or changed event (`step`, snapshot with active-run steps). | Server and UI already share this file. | Contract drift between server and UI shows up in practice. |
| X2 | Backend first (step events, `steps.jsonl`, snapshot), testable over SSE and with the recorded fixture; then the UI. | Backend contract constrains the UI and can be tested without it. | — |
| X3 | Nothing in the UI waits on latency work: early answers, in-place updates and `verifying`/`mixed` states have landed. Only the recorded fixture waits for one real run after the backend step work. | Latency work already shipped the states the UI needs. | — |
| X4 | User-facing wording uses "independently verified" everywhere (badge already does; controller notes change from "independently reviewed"). Internal enum `independently-reviewed` unchanged. Glossary: self-checked, independently verified, partly independently verified, held, coverage. | One term for one concept; the verifier really recomputes the figures. | — |

## Session output checklist

Completed 2026-10-12: see the [design spec](../superpowers/specs/2026-10-12-assistant-ui-frontend-design.md).

- [x] Step event schema (B1–B3) with example payloads
- [x] Message model including assurance and correction states (B4–B6)
- [x] Outcome/error → UI treatment table (B9)
- [x] Component inventory with which assistant-ui primitive or custom component backs each (F1–F9)
- [x] Styling decision (F3)
- [x] Acceptance criteria and test approach (F11)
- [x] Items explicitly deferred, with the trigger to revisit
