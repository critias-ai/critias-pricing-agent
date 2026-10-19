# Bounded Agent Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Prefer native inline implementation. Product workflow roles are not an instruction to spawn Codex implementation agents; if developer subagents are necessary, follow the user's Luna/max preference.

**Goal:** Deliver useful, appropriately sized, independently checked pricing answers on Luna while bounding execution and reusing workspace-generated analysis code.

**Architecture:** A controller owns the logical conversation, immutable checkpoints and one request budget. Lightweight coordinator, analyst, optional visualizer and verifier roles use separate scoped SDK contexts; numerical verification precedes optional presentation, and final verification covers only newly added claims. The quick route reuses compatible verified results without forcing a full pipeline.

**Tech Stack:** Existing TypeScript/Node.js, Pi SDK 1.0.4, Fastify/React, Python/DuckDB and offline Plotly/Playwright. No new orchestration framework or domain-query library.

**Spec:** [Implementation brief](../specs/2026-10-08-bounded-agent-workflow.md).

## Global constraints

- Runtime instructions stay lightweight: new role guidance at most 150 words per role; shared added guidance at most 200 words. Existing detailed pricing references remain progressively read.
- General purpose on first use: no canned commercial SQL, domain-specific function library, source-pack special cases or historical evaluator scripts injected into product workspaces.
- Reuse code produced by prior workspace analyses; verify compatibility before reusing results. Keep derived analysis separate from confirmed company facts.
- All live product roles use `openai/gpt-6-luna`, reasoning `high`, through OpenRouter. No model fallback, stronger verifier or lower-effort experiment in this pass.
- Defaults: quick 120 seconds/12 model attempts/20 tool calls; analysis 300/24/60; detailed report 600/36/90. Whole-request cumulative limits include planning, retries, corrections and finalization. Reserve 20% for verification/finalization.
- One cumulative transient-provider retry; one semantic correction round; maximum two report renders/two previews. A visual repair consumes the semantic correction allowance. Three repeated identical normalized operation/result pairs without new evidence stop the loop.
- Cancellation grace is two seconds, after which supervised stage work must be stopped rather than indefinitely awaited. Controller settlement/publication cannot depend on an additional model call.
- Maintain source immutability, credential filtering, path/hash validation, artifact provenance, request idempotency and one visible conversation. Native execution remains distinct from OS-isolated acceptance.
- Five selected scenarios/nine messages only; sequential; no automatic timeout recoveries. At most two additional affected messages after a scoped fix, within the same remaining live-batch allowance; restore captured pre-turn state without extra warm-up calls. Live batch maximum 60 minutes and USD5 cumulative SDK-estimated cost before another turn starts; Missing SDK usage/cost fields stop further paid turns; actual provider charges remain unverified unless separately retrieved.
- This session creates planning artifacts only. The fresh implementation session may edit, test and build for the focused live run. No full suite, scale benchmark, dependency upgrade, commit, push, deployment or publication.

## Review focus

1. A provider/SDK/tool ignores abort: PH-01/PH-06 tests must prove bounded settlement, stopped stage work, no late publication and a usable next request.
2. A follow-up changes quarter but retains the group: PH-02/PH-03 tests preserve the original cohort unless explicitly re-ranked and never reuse stale result scope.
3. A cost row has valid dates/currency but a blank amount, or an expense has repeated business keys: PH-04 source-based checks hold unsupported values and count an evidenced event once.
4. A chart or verifier fails after numerical approval: PH-05/PH-06 retain immutable applicable verified numbers, disclose incomplete presentation and do not publish drafts as verified.
5. A role switch/reload/new conversation changes SDK session IDs: PH-04/PH-06 preserve the public transcript/request ID and isolate historical analytical results from new conversation context.

## Ticket index and dependencies

IDs below are local planning references, not existing Jira issue keys. [CSV export](2026-10-08-bounded-agent-workflow/jira-tickets.csv) contains one epic and eight stories. A future importer must map local IDs and blocking references to real Jira keys; this task does not publish issues remotely.

| Ticket | Deliverable | Blocked by |
| --- | --- | --- |
| [PH-01](2026-10-08-bounded-agent-workflow/tickets/PH-01-bound-execution-and-expose-real-progress.md) | Enforced request budgets, bounded cancellation and meaningful timing/progress | None |
| [PH-02](2026-10-08-bounded-agent-workflow/tickets/PH-02-reuse-workspace-analysis-code-and-verified-scope.md) | Workspace code/result index with scope and validity checks | [PH-01](2026-10-08-bounded-agent-workflow/tickets/PH-01-bound-execution-and-expose-real-progress.md) |
| [PH-03](2026-10-08-bounded-agent-workflow/tickets/PH-03-route-questions-with-a-lightweight-coordinator.md) | Lightweight coordinator and adaptive answer/work routing | PH-01, PH-02 |
| [PH-04](2026-10-08-bounded-agent-workflow/tickets/PH-04-deliver-independently-verified-analysis-through-separate-role-contexts.md) | Separate analyst/verifier contexts, numerical checkpoint and stable conversation | [PH-03](2026-10-08-bounded-agent-workflow/tickets/PH-03-route-questions-with-a-lightweight-coordinator.md) |
| [PH-05](2026-10-08-bounded-agent-workflow/tickets/PH-05-add-optional-visualization-with-bounded-verification-and-repairs.md) | Optional visualizer, chart verification and bounded scoped repairs | [PH-04](2026-10-08-bounded-agent-workflow/tickets/PH-04-deliver-independently-verified-analysis-through-separate-role-contexts.md) |
| [PH-06](2026-10-08-bounded-agent-workflow/tickets/PH-06-preserve-verified-partial-answers-on-interruption-or-late-stage-failure.md) | Safe partial delivery, interruption/restart handling and available evidence | PH-04, PH-05 |
| [PH-07](2026-10-08-bounded-agent-workflow/tickets/PH-07-create-a-bounded-five-scenario-regression-runner.md) | Focused regression runner and complete evidence recording | PH-01, PH-03, PH-06 |
| [PH-08](2026-10-08-bounded-agent-workflow/tickets/PH-08-run-focused-evaluation-and-report-whether-the-workflow-improved.md) | Execute five scenarios, independently assess and report changes | PH-01–PH-07 |

The eight [ticket files](2026-10-08-bounded-agent-workflow/tickets/) carry behavior, acceptance criteria and delivery checklists. Work the frontier in the displayed order; avoid wide unrelated refactors. Foundation slices must remain testable in isolation; expose the staged workflow as the default only after its verified-delivery path works. An explicitly selected legacy mode may remain for compatibility/testing, but stage failure must not silently fall back to it.

## Implementation seams

Paths below are relative to `pricing-harness/`; create narrowly scoped modules rather than putting all behavior into the current controller.

| File or group | Responsibility / owning tickets |
| --- | --- |
| `src/runtime.ts`, `.env.example` | Validate workflow mode and configurable limits; preserve explicit model/effort checks. PH-01/PH-03 |
| `src/contracts.ts` | Backward-compatible optional outcome/metrics/checkpoint fields and workflow status phases. PH-01/PH-04/PH-06 |
| `src/agent/workflow/contracts.ts` | Internal work order, packet, verification and stage protocol types. PH-02–PH-06 |
| `src/agent/workflow/budget.ts` | One deadline/counter/retry/repair/no-progress policy and bounded cancellation. PH-01 |
| `src/agent/workflow/stage-runner.ts`, `worker.ts` | Supervised SDK stage execution; forward events/results and stop work after cancellation grace. PH-01/PH-04 |
| `src/agent/workflow/analysis-index.ts` | Atomic workspace code/result registry and dependency matching. PH-02 |
| `src/agent/workflow/coordinator.ts`, `role-prompts.ts` | Short work order validation, depth/routing and minimal role adapters. PH-03 |
| `src/agent/workflow/render-tools.ts` | Generic controller-counted wrappers around existing render/preview helpers; no canned analytical code. PH-05 |
| `src/agent/workflow/checkpoints.ts` | Validate evidence/artifact references, freeze hashed approved claims and reject mutations. PH-04/PH-06 |
| `src/agent/workflow/orchestrator.ts` | Stage sequencing, verification reserve, optional visualization and bounded correction ownership. PH-04–PH-06 |
| `src/agent/session.ts`, `runs.ts`, `events.ts`, `src/application.ts` | Integrate staged execution while preserving public conversation/events and legacy record loading. PH-01/PH-04/PH-06 |
| `src/workspace.ts`, `src/files.ts` | Persist state separately from confirmed context; safely register immutable checkpoint/final files. PH-02/PH-04/PH-06 |
| `src/ui/useSession.ts`, `state.ts`, `Chat.tsx`, `Outputs.tsx` | Stage progress, correctly labeled partial/held outcomes and stable reloads/artifact access. PH-01/PH-06 |
| `bundled/harness-skills/analysis-visualize/SKILL.md`, `bundled/versions.json` | Short scope/preview repair limits and intentional harness visualization provenance revision. PH-05; do not edit installed plugin caches |
| `scripts/eval-focused-workflow.mjs` | Updated-application runner for the supplied manifest only. PH-07 |
| `tests/unit/workflow-{budget,index,coordinator,checkpoints}.test.ts`, `tests/integration/workflow.test.ts`, `tests/browser/workflow.spec.ts` | Deterministic fake-provider/worker checks and one focused user flow. Owning ticket's failing test comes first |

## Shared interface decisions

Use schema version 1 for new internal records; validate them at role boundaries. Public existing run lifecycle states remain unchanged. Optional fields let old records load without claiming they were independently verified.

- `WorkOrder`: original request, scope/basis key, confirmed definitions, ranking window/cohort, depth (`quick`, `analysis`, `report`), required operations, evidence references, budget class and blocking input. Coordinator does not calculate financial claims.
- `AnalysisIndexEntry`: generated code/result references and hashes, source dependencies, calculation version, scope/basis, coverage/holds and candidate-versus-verified status. No mandatory domain SQL schema.
- `AnalysisPacket`: executed result references, claims with units/basis/evidence, coverage/holds, code references and dependency hashes. A self-declared analyst approval is not an independent verification.
- `VerificationRecord`: approved/held claims, corrections, executed tool/evidence references and hashes. Controller validates references against successful recorded executions and file hashes before committing a checkpoint; this records verification evidence rather than providing an absolute guarantee of business truth.
- `StageRequest`: parent run/conversation ID, role, operation, scoped input references, stage directories and shared remaining budget. `StageResult`: outcome, packet/evidence references, proposed concise reply and usage/events. All published output belongs to the parent request.
- `StageRunner.execute(request, signal)`: execute one scoped operation; support bounded `stop()` and forwarded attempt/tool events. SDK/provider retry settings cannot introduce hidden extra attempts.
- `WorkflowBudget`: start once at request submission; debit model/tool/retry/repair events; expose remaining limits, optional-work reserve and the stopping reason. Budget class is selected once by the validated initial plan; no later silent extension.
- `Outcome`: `complete`, `verified-partial`, `needs-input`, `no-verified-answer`, plus reason and applicable checkpoint reference. A complete answer may legitimately hold unsupported source-dependent measures; a budget-truncated answer is partial.

Use a controller-owned logical transcript, compact scoped analysis state and stage-specific SDK session directories. Do not repeatedly call the existing view binding in a way that clears chat at every role switch. Do not push analytical hypotheses/results into `.pricing/context.md`.

## Execution checklist

For each ticket, follow its acceptance criteria and this sequence:

- [ ] Add the owning test(s) with explicit fake-clock/provider/artifact inputs and the stated assertions.
- [ ] Run only those tests and confirm the intended failure, excluding unrelated environmental failures.
- [ ] Implement the complete narrow path and any affected persistence/API/UI behavior.
- [ ] Rerun the targeted tests and `npm run typecheck` from `pricing-harness/`.
- [ ] Inspect the diff and record evidence in the ticket. Do not commit or push.

Suggested test commands as modules become available:

- PH-01: `npm test -- tests/unit/workflow-budget.test.ts tests/unit/runs.test.ts tests/unit/runtime.test.ts`
- PH-02: `npm test -- tests/unit/workflow-index.test.ts tests/unit/storage.test.ts`
- PH-03: `npm test -- tests/unit/workflow-coordinator.test.ts`
- PH-04: `npm test -- tests/unit/workflow-checkpoints.test.ts tests/integration/workflow.test.ts tests/unit/tool-environment.test.ts`
- PH-05/PH-06: `npm test -- tests/unit/workflow-checkpoints.test.ts tests/integration/workflow.test.ts tests/unit/browser-state.test.ts tests/unit/bundle.test.ts`
- Affected user flow: `npx playwright test tests/browser/workflow.spec.ts`. Use configured Python and existing browser cache; do not install or run the full browser suite.
- PH-07: add/run a `tests/unit/focused-workflow-eval.test.ts` runner test without paid model calls.

Changes to shared HTTP/session contracts require their existing affected integration tests as well. These are focused regressions, not permission to run all suites. If a rendering/Python implementation changes, run only the matching reporting checks.

## Five-scenario live evaluation

Exact prompts, warm fixture context, grouping and historical references are in [focused-evaluation.json](2026-10-08-bounded-agent-workflow/focused-evaluation.json). [evaluator-controls.json](2026-10-08-bounded-agent-workflow/evaluator-controls.json) is evaluator-only and must not enter product-agent inputs.

| Scenario | Messages | Why selected / required assessment |
| --- | ---: | --- |
| F01: Initial Lighting review | 1 | Every initial Lighting calculation timed out. Check full-window revenue, missing-cost hold, useful margin/revenue views and first verified answer time. |
| F02: Top ten → Q2 SKU diagnosis → recovery | 3 | Slow top-ten/diagnosis, crowded chart choices and overly long small answers. Check fixed ranking, quarterly evolution, signed zero-price/credit drivers, code reuse and brief recovery reply. |
| F03: Q3 re-ranking → rebates/service | 2 | Inherited-scope change and a confirmed mixed-currency/duplicate service pool error. Verify new cohort, documented event key, separate EUR amount and unsupported SKU allocation hold. |
| F04: Fresh brief SKU request → definition reply | 2 | Intake burden, initial cancellation and later three complementary charts. Check focused clarification, supplied metric basis, supported diagnosis and readable narrow charts. |
| F05: Detailed price/contract scenario | 1 | No final response after the original run or 30-minute recovery; 200 tools/six renders/five previews. Check list versus realized/modelled revenue bases, conditional rights, locks, coverage, contribution limits and bounded completion. |

F01–F03 share one fresh workspace/conversation. F04 and F05 each start fresh; F05 uses the same declared warm fixture definitions, without numerical expected answers. Do not preload historical generated analysis code. Reuse scripts authored during F01–F03 so the test measures the intended workspace behavior.

- [ ] Finish focused deterministic checks and typecheck.
- [ ] Run `npm run build` once so the live runner imports the changed compiled application. Rebuild after a supplemental implementation fix only if code changed; every live pass must use current compiled code. Record compiled-code/bundle fingerprints and role-prompt hashes.
- [ ] Run from `pricing-harness/`: `node --env-file=.env scripts/eval-focused-workflow.mjs --plan docs/superpowers/plans/2026-10-08-bounded-agent-workflow/focused-evaluation.json --output ../.cache/focused-agent-workflow-2026-10-08 --workspace-root /private/tmp/pricing-focused-agent-workflow-2026-10-08`.
- [ ] Preserve old evidence; use unique run directories if this path already exists. No parallel scenarios, automatic recovery prompts or full-suite fallback.
- [ ] Record all planned outcomes. Do not create false context if a dependent prompt is genuinely blocked; continue independent scenarios and label blocked cases.
- [ ] Independently recalculate claimed values and inspect actual final desktop/narrow renders. Check source and artifact hashes and scan evidence for configured credentials without printing them.
- [ ] Save `docs/releases/focused-agent-workflow-evaluation-2026-10-08.md` with full-response/artifact links into the ignored evidence directory. Update the guide.

The first run aims to deliver complete supported answers to all nine messages, preserve mandatory holds, make the recovery answer brief and avoid any unresolved hang. Faster cancellation alone is not a pass. Compare first-attempt completion separately from historical recovery successes. Report median/max latency alongside individual stages; do not use a single average mixing clarification and complex analysis.

Record cost per correct completed answer, all partial/failed costs, actual role attempts, reuse, tool/preview counts and visual usefulness. Response length includes all visible interim/final messages; first verified answer means a user-visible checked summary, not merely a hidden checkpoint timestamp. Treat SDK costs as estimates. Historical concurrency/provider errors prevent a clean causal A/B claim; a separate lower-reasoning or fresh legacy rerun requires a later explicitly scoped experiment.

## Handoff

[Copy-ready implementation prompt](2026-10-08-bounded-agent-workflow/IMPLEMENTATION_PROMPT.md). The fresh session implements and runs this focused plan; this planning session does not start implementation or create a new chat.
