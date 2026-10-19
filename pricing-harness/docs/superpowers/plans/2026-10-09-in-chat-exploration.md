# In-chat Exploration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task inline. Steps use checkbox (`- [x]`) syntax for tracking. The user selected a new implementation session; do not implement during the planning session or dispatch subagents.

**Goal:** Replace standalone reports with verified charts and searchable/sortable tables inside assistant messages, with no model calls during exploration.

**Architecture:** Keep coordinator → analyst → independent numerical verifier → immutable checkpoint. The analyst's optional view description references claim IDs; the controller resolves values from the checkpoint and delivers a bounded rich chat payload. React/Plotly render trusted structures locally; the report/visual-review model branch is removed.

**Tech Stack:** Existing TypeScript, React 19, Vite, Fastify, Pi SDK 1.0.4, DuckDB/Python; pinned `plotly.js-basic-dist-min@4.1.2`; Vitest and Playwright. No OpenUI or React Plotly wrapper.

**Spec:** [In-chat exploration design](../specs/2026-10-09-in-chat-exploration-design.md)

## Global Constraints

- Implement native React/Plotly in-chat exploration; no OpenUI, new agent runtime, UI-generation model stage, preflight or submission tool.
- Interactions are local chart exploration and table search/sort/pagination only; no new model/tool calls, drilldown, what-if calculations or exports.
- Every displayed numeric cell/point binds to independently approved facts; held values remain unavailable, never zero.
- Preserve source/execution/checkpoint guards, independent numerical verification, final JSON/repair, scope/ranking continuity and verified partial answers.
- Preserve existing user changes, source data, historical outputs/evidence, credentials, saved model/reasoning settings and budgets; no Python dependency or environment changes.
- Keep report budget/config keys and historical counters readable; retire report-producing execution and new artifact publication.
- Pin plotly.js-basic-dist-min exactly to 4.1.2; workflowVersion becomes 2.0.0 and visualizationVersion becomes 0.2.0; pricing/data/SDK versions stay unchanged.
- Stop after focused local checks, browser checks, typecheck/build and the configured dry run; no paid evaluation, full suite, scale run, fallback, commit, push or deployment.

## Review Focus

1. A result CSV in checkpoint storage contains unchecked cells: only approved claim bindings may reach charts/tables (IC-01/02).
2. Missing cost, mixed units and percent-versus-fraction conventions: preserve gaps, reasons and canonical units; never silently scale or combine units (IC-01/04).
3. Reconnect, restart or source mutation after a rich answer: restore from intact sealed evidence, deduplicate messages and retract invalid payloads (IC-03).
4. Large result tables and narrow screens: all delivered rows remain searchable/pageable, page width stays contained, controls do not trigger analysis (IC-04/06).
5. Continuation/cache reuse and chart lifecycle: no view-ID overwrite, unrelated cached data, stale plot mutation or activity-driven scroll jumps (IC-02/03/04).

## Preparation and file map

Work in the existing checkout at the repository root, with application commands in `pricing-harness/`. It has substantial uncommitted work, including modified visualization files. Inspect the actual files before every edit; do not reset, stash, replace the checkout, cherry-pick an old baseline or create a clean worktree that loses those changes. User preservation/no-commit instructions override skill defaults.

Create a unique ignored `.cache/in-chat-exploration-<UTC timestamp>/` at the repository root. Save initial `git status`, hashes of existing source/bundled/test/config/credential files (never credential contents), and a task ledger. Distinguish intended report-code removals from accidental deletions. Do not write evaluator inputs/expected answers into a model workspace.

| File/module | Responsibility |
|---|---|
| New `src/exploration.ts` | Shared types, constants and browser-safe descriptor validation. |
| New `src/agent/workflow/exploration.ts` | Resolve claim bindings, merge descriptions, build bounded rich results. |
| New `src/agent/workflow/exploration-restore.ts` | Rebuild saved message payloads from intact checkpoints. |
| Existing workflow contracts/output-contract/handoff/checkpoints | Optional descriptions, held metadata and frozen integrity. |
| Existing orchestrator/runs/events/application/contracts | Approval-time rich messages, persistence/invalidation, no report branch. |
| New `src/ui/exploration/` modules | Table state, formatting, Plotly adapter and accessible result rendering. |
| Existing Chat/App/styles | In-chat results, scrolling and removal of report product UI. |
| Existing worker/runtime/session/bundle/headless | Retire report execution and startup prerequisites; keep historical reads. |
| Existing evaluator + new tests | Rich-message evidence and focused local acceptance. |

Task dependencies: IC-01 → IC-02 → IC-03; IC-04 consumes IC-01/03; IC-05 finishes removal after IC-03/04; IC-06 validates the integrated change. Each task ends with its own tests and a scoped diff review instead of a commit.

---

## IC-01: Define bounded views and resolve checked facts

**Files**
- Create `src/exploration.ts`, `src/agent/workflow/exploration.ts`.
- Create `tests/unit/exploration.test.ts`, `tests/unit/workflow-exploration.test.ts`, `tests/fixtures/exploration.ts`.

**Interfaces**
- Shared types: `ExplorationSpec`, `TableSpec`, `ChartSpec`, `HeldFact`, `ResultCell`, `ResultTable`, `ExplorationResult`, exactly as the spec defines.
- `normalizeExploration(raw: unknown): {spec?: ExplorationSpec; issues: string[]}`; undefined means absent without an issue. Structural failures return an issue rather than throw into numerical handoff repair.
- `mergeExploration(previous: ExplorationSpec | undefined, next: ExplorationSpec | undefined): {spec?: ExplorationSpec; issues: string[]}`; preserve earlier IDs; omit colliding new views/dependents.
- `bindExploration(checkpoint: Checkpoint, ref: FileRef, requested: boolean): {result?: ExplorationResult; issues: string[]}`; uses optional checkpoint metadata added by IC-02. Until then use an intersection type for that additive metadata, without changing old checkpoints.

- [x] **1. Write failing contract tests.** Define fixture facts: `rev_q1=10 GBP`, `rev_q2=20 GBP`, `margin_q1=36.09 %`; held `margin_q2` has reason `blank unit cost`. A quarterly table binds revenue/margin columns to those four IDs; separate line charts select revenue and margin. Assert resolved cells are exactly `10`, `20`, `36.09`, `null`, with held status/reason. Unknown claim, held-without-metadata, ranking-array cell, finite-value violation and unit mismatch omit the affected table/chart; approved text/evidence remains usable. No file contents are read by the binder.
- [x] **2. Write failing limit/structure tests.** Accept exactly 4 tables/4 charts/12 columns/1,000 rows/5,000 total cells/4 series and a payload at 1 MiB; reject the next element/byte without truncation. Build size-boundary fixtures with valid references rather than accidental duplicate IDs. Reject duplicate view/row/column keys, missing/extra row column keys, dangling table IDs and mixed-unit chart series. Preserve original row order. Absent description + requested exploration yields fact tables grouped by unit; malformed description with recorded issues yields no invented view; requested=false yields no payload.
- [x] **3. Run RED.** `npm test -- tests/unit/exploration.test.ts tests/unit/workflow-exploration.test.ts`; expect missing modules/exports or unmet assertions, not an unrelated environment failure.
- [x] **4. Implement the interfaces.** Use plain browser-safe validation and constants, not a second schema framework. The controller builds numeric values solely from `checkpoint.claims`; held metadata authorizes null cells only. Reject a chart dependent on a rejected table and retain unrelated valid views. Use UTF-8 byte size, not JavaScript string length; do not mutate checkpoints/specifications. Table defaults use one numeric value column per unit group and claim labels as row labels. If limits cannot represent the requested default, omit it with a limitation.
- [x] **5. Run GREEN and review the scoped diff.** Run the IC-01 command again; all cases pass. Verify that no arbitrary Plotly traces/layout or financial arithmetic entered the contract.

## IC-02: Carry views and held reasons through the existing financial handoff

**Files**
- Modify `src/agent/workflow/{contracts,output-contract,handoff,checkpoints}.ts` and IC-01 binder as needed.
- Modify `tests/unit/{workflow-handoff,workflow-checkpoints,workflow-exploration}.test.ts`.
- Modify `tests/integration/analyst-handoff-lifecycle.test.ts`.

**Interfaces**
- `AnalysisPacket` gains optional normalized `exploration` and controller-derived `explorationIssues: string[]`.
- `Checkpoint` gains optional `exploration`, `explorationIssues: string[]`, `heldDetails: HeldFact[]`; existing fields/version 1 remain valid.
- Analyst output schema accepts optional `exploration: unknown`; the normalized packet uses the validated spec. Do not allow producer `explorationIssues`/`heldDetails` to authorize facts.
- `validateNumericalEvidence` additionally returns `heldDetails: HeldFact[]` derived from executed checks and packet claim labels/units. `sealCheckpoint` freezes/merges this metadata and normalized views.

- [x] **1. Write failing financial-preservation tests.** A valid candidate with valid views returns the same claim IDs/values, code/results and calculation version. A malformed view remains a valid financial candidate with `explorationIssues`; this fact survives sealing/restoration and cannot trigger default tables. Approved IDs/held reasons still come from the latest successful verifier stdout. Tests retain disagreement, changed source/script/output, independent-access and wrong-period rejection.
- [x] **2. Write failing continuation/legacy tests.** Old checkpoints with neither view nor heldDetails load unchanged. New held metadata includes only executed holds and cannot display the analyst's held numeric draft. Previous view IDs win over collisions; new noncolliding views can bind earlier approved claims. No reused claim ID is admitted merely because a new view references it. Old checkpoint missing held metadata does not manufacture a missing reason/value.
- [x] **3. Extend the installed-SDK lifecycle fixture.** Include a valid optional descriptor and then a malformed optional descriptor while retaining the final calculation → zero active tools → final JSON behavior. Assert no descriptor preflight, new tool or extra format-repair/model request is introduced. Existing stale batched write rejection still passes.
- [x] **4. Run RED.** `npm test -- tests/unit/workflow-handoff.test.ts tests/unit/workflow-checkpoints.test.ts tests/unit/workflow-exploration.test.ts tests/integration/analyst-handoff-lifecycle.test.ts`.
- [x] **5. Implement the additive checkpoint path.** Normalize advisory views after financial schema/evidence handling. Derive held details from the same parsed executed-check output already used for verification; do not run another script/model stage. Merge prior metadata immutably and retain source/hash checks. Record structural/binding limitations in controller-owned metadata and visible coverage, without marking missing numerical operations complete.
- [x] **6. Run GREEN and inspect the diff.** Repeat the task command; ensure optional visual failures cannot consume `handoffRepair` and no numerical validation was relaxed.

## IC-03: Deliver and restore rich messages at numerical approval

**Files**
- Create `src/agent/workflow/exploration-restore.ts`.
- Modify `src/contracts.ts`, `src/agent/{events,runs}.ts`, `src/application.ts`, `src/agent/workflow/orchestrator.ts`.
- Modify `tests/unit/{workflow-conversation,browser-state,runs,workflow-evaluation}.test.ts`.
- Create `tests/integration/workflow-chat-exploration.test.ts`; update `tests/integration/{workflow,workflow-controller}.test.ts`.

**Interfaces**
- `ChatMessage` adds optional `runId`, `exploration`, `explorationNotice`; `AssistantMessageOptions = Pick<ChatMessage, 'runId' | 'exploration' | 'explorationNotice'>` is exported from `src/contracts.ts`.
- Orchestrator `onMessage(text: string, options?: AssistantMessageOptions)` keeps old one-argument callbacks usable.
- Add runtime `explorationEnabled?: boolean` (default true) to RunController/orchestrator options. `createApplication` derives it from the existing `requireVisualization` option; bind with `explorationEnabled && workOrder.visualize`. Do not add a saved setting.
- `EventView.appendLogical(role, text, options?: AssistantMessageOptions): ChatMessage`; `EventView.invalidateExplorations(runId: string, notice: string): void` replaces affected messages in place and emits the existing `message` event.
- `restoreExplorations(root: string, conversationId: string, messages: ChatMessage[]): Promise<ChatMessage[]>` loads frozen checkpoints and regenerates payloads; its return type stays the public message type.

- [x] **1. Write failing end-to-end synthetic workflow checks.** Use real source CSVs and executed independent verifier scripts/provenance like the existing workflow fixture. Stage sequence for ordinary success must be exactly `['coordinator:plan','analyst:analyse','verifier:numerical']`; rich cells equal independently checked values. No visualizer/visual verifier stage, render, preview, output manifest or copied export file occurs. Text-only questions and no-valid-view answers still complete according to numerical operation accounting.
- [x] **2. Write failing persistence/failure checks.** Assert one message ID survives SSE reconnect/snapshot restoration and contains text plus payload. Restart rebuilds a tampered serialized cell from the sealed checkpoint. Missing/changed source/checkpoint, cross-conversation reference or wrong producing run removes rich data and adds a generic notice. Text-only historical messages remain unchanged. Cache-selected claim lookup stays text-only and cannot show the rest of the old checkpoint. Multi-group results preserve prior verified messages without duplicate view-ID overwrite.
- [x] **3. Write failing lifecycle checks.** Cancel before approval: no rich numbers. Cancel after intact approval: checked partial text/UI retained. Source changes detected during finalization: earlier payload removed via same-ID message replacement and persisted. Optional binder failure preserves financially complete text with a limitation. Pending financial operations still produce `verified-partial`. Internal failure paths/filenames do not leak into notices.
- [x] **4. Run RED.** `npm test -- tests/integration/workflow-chat-exploration.test.ts tests/integration/workflow.test.ts tests/integration/workflow-controller.test.ts tests/unit/workflow-conversation.test.ts tests/unit/browser-state.test.ts tests/unit/runs.test.ts`.
- [x] **5. Implement approval-time delivery.** Bind after sealing and before emitting the verifier answer. Stop invoking the report branch and `publishEvidence`; frozen internal checkpoint files remain. Persist every rich message/update and rehydrate before `EventView.useLogical` on startup. Validate checkpoint path, hashes, source stability, scope, conversation and producing run through existing safe loaders. Preserve completion/usage/cancellation checks. On source-change finalization, invalidate the run's rich messages and persist before settlement.
- [x] **6. Run GREEN and review.** Repeat the task command. Historical artifact listing/download APIs stay read-only and unchanged; new analysis must not depend on artifact registration for success.

## IC-04: Render interactive tables and Plotly charts inside chat

**Files**
- Create `src/ui/exploration/{Exploration,ResultTable,PlotlyChart}.tsx`, `src/ui/exploration/{table-state,format,plotly-adapter}.ts`, `src/ui/exploration/plotly.d.ts`.
- Modify `src/ui/{Chat,App}.tsx`, `src/ui/styles.css`, `package.json`, `package-lock.json`, `THIRD_PARTY_NOTICES.md`.
- Create `tests/unit/exploration-ui.test.ts`, `tests/browser/chat-exploration.spec.ts`.
- Update `tests/browser/fixture-server.ts` with bounded offline workflow fixtures and test-only run/model/tool counters; start migrating existing browser expectations away from report output.

**Interfaces**
- `Exploration({result}: {result: ExplorationResult})`, `ResultTable({table}: {table: ResultTable})`, `PlotlyChart({chart,table}: {chart: ChartSpec; table: ResultTable})`.
- `selectTableRows(table: ResultTable, state: {query: string; sort?: {key: string; direction: 'asc' | 'desc'}; page: number}): {rows: ResultTable['rows']; filtered: number; total: number; page: number; pages: number}`; page size 25, case-insensitive label search, held last both directions, stable ties, clamped page.
- `formatValue(value: number | null, unit: string): string`; `%`, `percentage points`, `bps` retain canonical values; currency formatting uses supplied recognized currency code; unknown units show a safe numeric value plus suffix. Null returns `Unavailable`.
- `buildPlotlyFigure(chart: ChartSpec, table: ResultTable): {data: unknown[]; layout: Record<string,unknown>; config: Record<string,unknown>}` constructs only fixed bar/scatter recipes from bound data; no arbitrary model Plotly attributes.

- [x] **1. Write failing table/format tests.** Sort `2,10,100,null` numerically with null last for asc/desc; filter across all 60 rows, not just page 1; reset returns original order/page; zero matches returns an empty result; shrinking filters clamp page. Assert `formatValue(36.09,'%')` does not multiply by 100; distinguish `-4.75 percentage points`, `500 bps`, GBP and EA. Inputs/other messages remain unchanged.
- [x] **2. Write failing chart/browser tests.** Load a synthetic two-quarter result with GBP and percent charts. Assert actual Plotly x/y values/order and `connectgaps:false`; held point is null. Hover shows `36.09%`; legend toggle changes trace visibility; zoom changes axis range and reset restores it. Table search/sort/pagination affect only that table and do not reorder chart points. Keyboard controls work. Markup-like labels display literally and cannot load remote content. Rendering failure shows table/text and a clear limitation.
- [x] **3. Write no-network/viewport tests.** Record submissions/model/tools before interacting; after hover, zoom, pan, legend, sort, search, page and reset, counters are unchanged and no POST `/api/messages` or external request occurred. At 1280px/390px, `document.documentElement.scrollWidth <= window.innerWidth`; wide tables stay inside their labelled scroll containers. A 60-row table has 25 rows per first page and complete search access. Activity/message updates while exploring an older answer do not force-scroll it away.
- [x] **4. Run RED.** `npm test -- tests/unit/exploration-ui.test.ts`; `npm run test:browser -- tests/browser/chat-exploration.spec.ts`. Confirm failures address missing UI behavior rather than a paid provider call; fixtures must be offline.
- [x] **5. Install the one pinned browser dependency.** Verify `plotly.js-basic-dist-min@4.1.2` exists, then `npm install --save-exact plotly.js-basic-dist-min@4.1.2`. If unavailable, report the concrete limitation instead of changing versions. Save dependency diff/license notice. No OpenUI, table library, React wrapper or Python dependency update. A narrow local declaration describes only Plotly functions used by the adapter.
- [x] **6. Implement the UI modules.** Lazy-load Plotly into a Vite chunk; use `Plotly.react`, `ResizeObserver`, and `Plotly.purge` with cleanup/late-load protection. Clone trace inputs so Plotly cannot mutate message/checkpoint state. Apply app-owned responsive layout/theme, explicit unit suffixes, no dual axes, null gaps and no export controls. Render only declared safe data/text, never `dangerouslySetInnerHTML`; escape markup in Plotly text fields. Add a readable table alternative for each chart. Auto-scroll only when already near the bottom or on the user's own submission, not every activity event. Remove the report modal/sidebar from App; retain recent-run status in a compact workspace area and file uploads in the composer.
- [x] **7. Run GREEN and inspect screenshots.** Repeat both task commands; inspect desktop/narrow captures and actual chart data. Keep screenshots explicitly labelled synthetic UI verification.

## IC-05: Remove report execution and update active guidance

**Files**
- Modify `src/agent/workflow/{worker,role-prompts,contracts,output-contract,handoff,coordinator}.ts`, `src/agent/{runs,session,bundle}.ts`, `src/{application,runtime,headless}.ts` and any active imports identified below.
- Remove `src/agent/workflow/{render-input,render-tools}.ts`, `src/ui/Outputs.tsx` after confirming no remaining active use.
- Rewrite `bundled/harness-skills/analysis-visualize/SKILL.md`; retain/update `references/chart-selection.md`; add `references/in-chat-exploration.md` with exact candidate/view examples.
- Remove report-only bundled `assets/report.html`, `references/html-reporting.md`, `scripts/{render_report,report_contract,plotly_theme}.py`, `scripts/preview_report.mjs`.
- Modify `bundled/harness-tools/data-analysis.md`, `bundled/versions.json`, `README.md`, `docs/{local-setup,acceptance}.md`, `package.json` description and relevant setup/start guidance only where it requires report runtime.
- Update `tests/unit/{runtime,bundle,settings,workflow-runner,workflow-coordinator,runs}.test.ts`, `tests/integration/{session,http,packaged-app}.test.ts`, `tests/browser/{fixture-server,app.spec,workflow.spec}.ts`.

**Interfaces**
- Introduce `ActiveRole = 'coordinator' | 'analyst' | 'verifier'` for new stage requests. Historical `Role`/stage metrics continue reading `visualizer` records. Runtime worker guard rejects `visualizer` and verifier `visual` before creating a model session.
- Keep `WorkOrder.visualize` with exploration semantics; `report` depth/settings key stays a detailed-analysis allowance.
- `checkRuntime` retains agent/Python readiness; report/preview/vision probes are retired. Existing callers/tests/status consumers must tolerate historical capability keys without requiring them.
- Explicit legacy mode is rejected by `loadConfig` before provider resolution. Settings parsing may still read historical `mode:'legacy'` files so the runtime can return actionable guidance; no silent mode substitution.

- [x] **1. Write failing retirement checks.** New workers expose no `render_report`/`preview_report` tools, accept no presentation stage and never require image input. Startup with working analysis Python but unavailable Plotly/Jinja/Chromium remains usable. Explicit legacy mode fails before any provider call. Saved `report` budgets/render/preview fields still parse without modification; historical stage records and artifact downloads still load. Bundle reference validation passes with the rewritten guidance.
- [x] **2. Run RED.** `npm test -- tests/unit/runtime.test.ts tests/unit/bundle.test.ts tests/unit/settings.test.ts tests/unit/workflow-runner.test.ts tests/unit/workflow-coordinator.test.ts tests/integration/session.test.ts tests/integration/http.test.ts tests/integration/packaged-app.test.ts`.
- [x] **3. Remove active report production.** Delete controller/worker registration, schemas, imports and legacy model-routing branches that can produce reports. Keep historical artifact/file handling in `files.ts`/routes; remove normal-run registration/copying dependencies. Keep retired counter/config fields passive. Rewrite both shared session and role guidance: choose relevant pricing methods, return fact bindings as optional exploration, no HTML/figure/render/screenshot work. No instruction change to the preserved pricing plugin itself.
- [x] **4. Retire obsolete implementation-only tests.** Remove `tests/unit/{workflow-presentation-paths,workflow-render-input,workflow-render,preview}.test.ts`, `tests/integration/{workflow-presentation,visual-review-lifecycle}.test.ts` and `tests/python/test_reporting.py` once replacement trust/UI/retirement checks pass. Record each deletion/replacement in the evidence ledger. Update `workflow-artifacts.test.ts` to test historical storage instead of new publication where applicable; retain source/checkpoint/numerical tests. Do not rewrite historical release reports, raw evidence or old evaluation oracle/case contents to look successful.
- [x] **5. Finish migration docs and fixtures.** Browser app/workflow tests use offline bounded requests and verify in-chat UI/partial/cancel/reconnect behavior, no Python-generated report fixture or legacy bypass. Document old report-centric full acceptance cases as pending migration, not passing. Keep `--pricing-only` as text-only display intent by propagating the existing `requireVisualization:false` option to exploration delivery; numerical verification remains active. Set workflowVersion `2.0.0`, visualizationVersion `0.2.0`; preserve pricing/data/SDK versions, settings file and Python locks.
- [x] **6. Run GREEN and review removals.** Repeat the task command. Search active `src/`/bundled guidance for `render_report|preview_report|write_html|offline HTML|report.json`; any match must be intentional historical compatibility/help, not executable production guidance. Verify modified baseline visualization work was deliberately superseded rather than accidentally discarded.

## IC-06: Validate the integrated product and save evidence

**Files**
- Modify `scripts/eval-focused-workflow.mjs`, `tests/unit/workflow-evaluation.test.ts` to record rich results in new evaluation records.
- Update `tests/browser/chat-exploration.spec.ts`, `tests/integration/workflow-chat-exploration.test.ts` for final integration gaps.
- Create `docs/releases/in-chat-exploration-local-validation-2026-10-09.md` (use actual completion date if later); update root `PROJECT_GUIDE.md` under 2,000 words.

**Interfaces**
- New configured-evaluation records include `explorations: ExplorationResult[]`, collected from newly delivered assistant messages. Keep existing response/messages/run/timing fields and configured manifest/settings inputs unchanged. Do not reinterpret historical JSON.

- [x] **1. Add failing evaluator assertions.** New records preserve rich payloads and per-stage accounting; no new manifest scenario/model/budget is introduced. `--dry-run` remains zero paid calls and does not start an agent/provider session. Old record readers tolerate missing `explorations`.
- [x] **2. Implement only that evaluator adaptation and run GREEN.** `npm test -- tests/unit/workflow-evaluation.test.ts`.
- [x] **3. Run focused final tests.** From `pricing-harness/`:

```sh
npm test -- tests/unit/exploration.test.ts tests/unit/workflow-exploration.test.ts tests/unit/exploration-ui.test.ts tests/unit/workflow-handoff.test.ts tests/unit/workflow-checkpoints.test.ts tests/unit/workflow-conversation.test.ts tests/unit/workflow-coordinator.test.ts tests/unit/workflow-budget.test.ts tests/unit/workflow-index.test.ts tests/unit/workflow-runner.test.ts tests/unit/workflow-evaluation.test.ts tests/unit/browser-state.test.ts tests/unit/runtime.test.ts tests/unit/bundle.test.ts tests/unit/settings.test.ts tests/unit/runs.test.ts tests/unit/storage.test.ts tests/unit/workflow-artifacts.test.ts tests/integration/workflow-chat-exploration.test.ts tests/integration/workflow.test.ts tests/integration/workflow-controller.test.ts tests/integration/analyst-handoff-lifecycle.test.ts tests/integration/session.test.ts tests/integration/http.test.ts tests/integration/packaged-app.test.ts
npm run typecheck
npm run build
npm run test:browser -- tests/browser/chat-exploration.spec.ts tests/browser/app.spec.ts tests/browser/workflow.spec.ts
npm run eval:configured -- --dry-run
```

Expected: focused tests pass; typecheck/build exit 0; all three browser files pass using local synthetic fixtures; dry run uses the unchanged configured prompt/model/budgets and reports `paidCalls:false`. Save stdout/stderr, command exit codes, browser traces/screenshots and compiled/settings/bundle fingerprints. A loopback/browser sandbox rejection can be retried with the platform's proper approval flow; never switch to a paid evaluation as a workaround.

- [x] **4. Inspect real rendered fixture output.** Record verified fixture chart x/y and units, null gaps, numeric sorting, full-table search/pagination, hover/zoom/reset, keyboard operation, 390px containment, two-message state isolation, Plotly cleanup and no request/model/tool increment during controls. Use existing actual browser captures, not generated mockups. Note this is local application verification, not live model quality evidence.
- [x] **5. Perform inline final review.** Compare current files with initial hashes/status; identify only planned code/dependency/doc removals/changes. Verify sources, credentials, saved model/settings/budgets, Python locks and historical evidence match. Confirm zero visualizer/visual-review stages, renders/previews, report manifests or new export files in fresh synthetic workflow outputs. Confirm independently wrong numbers still fail; do not equate a rendered chart with correctness.
- [x] **6. Save release evidence and update the guide.** State exactly what passed, what remains unverified, all explicit deletions, and the preserved numerical safeguards. No claimed live latency saving or full acceptance pass. Update product direction from planned to implemented only after these checks pass. Stop; no paid run, commit, push or deployment.

## Plan self-review and handoff

Coverage: contract/trust → IC-01/02; delivery/restart/cancel/source mutation → IC-03; local controls/accessibility/units/scroll/limits → IC-04; report/runtime/guidance/version/historical compatibility → IC-05; evaluator/evidence/local acceptance → IC-06. Every Review Focus item is assigned a named failing assertion. Function/property names are consistent with the spec; optional UI failures remain outside numerical repair and completion accounting.

The user explicitly requested a new implementation session. Use the [implementation prompt](2026-10-09-in-chat-exploration-implementation-prompt.md), execute IC-01–IC-06 inline, and stop at local validation. No implementation or task completion is implied by this planning document.

## Implementation completion — 2026-10-09

IC-01–IC-06 completed inline with TDD. Exact focused tests: 162/162; browser files: 6/6; typecheck/build/configured dry run exit 0 (`paidCalls:false`). See [local validation and limitations](../../releases/in-chat-exploration-local-validation-2026-10-09.md). Existing checkout changes preserved; explicit retirements backed up. No paid run, full suite, fallback, commit, push or deployment.
