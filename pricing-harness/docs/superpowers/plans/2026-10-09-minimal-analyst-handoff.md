# Minimal Analyst Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for inline implementation. Work each local ticket in order and preserve existing workspace changes.

**Goal:** After the analyst's configured calculation revisions are exhausted, remove its executable tools and have it return its actual final JSON through the existing canonical handoff and verification path.

**Architecture:** Keep the worker-owned SDK session and parent result lifecycle. A narrow production-used helper clears model tools and steers the existing session with its canonical schema, current file inventory and preservation instructions. `finishHandoff` remains the bounded JSON/schema/evidence repair path; the parent checks and persists only after the worker stops.

**Tech Stack:** Existing TypeScript/Node.js, Pi coding-agent SDK 1.0.4, Vitest, bundled Markdown guidance, Python/DuckDB analysis and existing workflow orchestrator.

**Spec:** [Approved minimal analyst handoff brief](../specs/2026-10-09-minimal-analyst-handoff-design.md).

## Global Constraints

- All application source, bundled guidance, test and release-document paths below are relative to `pricing-harness/`. The explicit workspace-root exceptions are `PROJECT_GUIDE.md` and `.cache/`. Commands that use `tests/...` paths run from `pricing-harness/`.
- Preserve saved app model `deepseek/deepseek-v4.1-flash` at high reasoning and evaluation override `openai/gpt-6-luna` at high reasoning; no fallback or dependency upgrades.
- Preserve analysis/report limits: 1,200 seconds total, 360-second finalization reserve, 100 model attempts and 150 tool calls; two shared analyst revisions; four shared final-format repairs, at most one per stage; one numerical correction. Evaluation remains capped at 1,800 seconds / USD1.
- Remove analyst `validate_handoff` and all required preflight instructions. After revision exhaustion, declare zero active tools and steer to final JSON using the existing schema and file inventory.
- Keep existing schema, source/execution/hash checks, independent numerical verification, stop/check/persist sequence, immutable checkpoint and partial-delivery behavior. A valid package is not numerical approval.
- Do not add `submit_result`, IPC/ack protocol, generic engine/state machine, restart or exactly-once claims, schema/coverage redesign, acceptance freeze/remap, placeholder blacklist, fallback, budgets, test-only product config hooks, broad dependency injection, or other-role completion changes. Do not change model or budget configuration.
- Keep role prompts at or below 80 words. Preserve all existing edits and live/evaluator evidence. No full suite, paid evaluation, commit, push or deployment; a future paid run needs a new explicit user request.

## Before AH-01 — Preserve the starting state

From the workspace root, create a unique ignored evidence directory and capture the starting hashes and guide status before editing any planned file. Reuse this directory in AH-03.

```sh
mkdir -p .cache
handoff_evidence_dir="$(mktemp -d .cache/minimal-analyst-handoff-2026-10-09.XXXXXX)"
shasum -a 256 PROJECT_GUIDE.md pricing-harness/src/agent/workflow/worker.ts pricing-harness/src/agent/workflow/handoff.ts pricing-harness/src/agent/workflow/role-prompts.ts pricing-harness/src/agent/workflow/revisions.ts pricing-harness/bundled/harness-tools/data-analysis.md pricing-harness/bundled/versions.json pricing-harness/tests/unit/workflow-handoff.test.ts pricing-harness/tests/unit/workflow-revisions.test.ts > "$handoff_evidence_dir/baseline-sha256.txt"
rg -n 'Open Tasks|preflight|validate_handoff' PROJECT_GUIDE.md > "$handoff_evidence_dir/guide-before.txt"
```

## Review Focus

1. **Revision exhaustion:** once the initial success and configured revisions are spent, the installed SDK's next request has no declared tools and contains a final-JSON steer. Use a synthetic stream on the actual SDK agent loop and the production-used transition helper; no network or credentials.
2. **Final schema/evidence rejection:** one final-format repair can correct one invalid package; handoff repair count increments once and revision count does not. Cover in `workflow-handoff.test.ts`.
3. **Placeholder-shaped but packageable content:** `blockingInput: "x"` and the observed `id:"foo", label:"bar", value:1, unit:"x"` candidate remain packaging-valid when pointing at real files. Existing execution/source checks and the independent verifier still decide whether anything is publishable. Cover in `workflow-handoff.test.ts` and preserve checkpoint tests.
4. **Cancellation/provider failure:** neither becomes a format repair or grants another attempt. Cover in `workflow-handoff.test.ts`.
5. **Late presentation failure:** an existing numerical checkpoint and partial answer survive later visual failure. Preserve and run `workflow-presentation.test.ts` regressions.

The “no more probing” effect is a hypothesis. These local tests prove the SDK tool loadout, JSON handoff and existing guards; they do not prove a fresh live model will return a complete answer or produce a good chart.

## Local Ticket Index

These AH identifiers are plan-local; no Jira issues are created.

| Ticket | Outcome | Depends on |
|---|---|---|
| AH-01 | Tool-free analyst final handoff through the actual SDK session | — |
| AH-02 | Bounded repair, packaging-only and downstream guard regressions | AH-01 |
| AH-03 | Focused local validation, evidence report and guide update | AH-01, AH-02 |

### AH-01 — Replace analyst preflight with direct final JSON

**Problem / outcome:** The current worker switches to `validate_handoff`, and both role guidance and the bundled data-analysis guide tell the model to preflight before returning. Remove that probe and steer directly to the final package when `AnalystRevisions.afterExecution()` reports `handoffRequired`.

**Scope:** Remove the validator tool and ready-state exception for it. Set the SDK session's active tools to `[]`; keep the `beforeToolCall` ready-state guard so any already-queued/stale tool call is rejected. Preserve existing file inventory, `finishHandoff`, output schema, execution evidence, and parent lifecycle. Update only obsolete analyst preflight language. Bump `workflowVersion` from `1.0.14` to `1.0.15`; do not change pricing or visualization versions.

**Files:** Modify `src/agent/workflow/worker.ts`, `src/agent/workflow/handoff.ts`, `src/agent/workflow/role-prompts.ts`, `bundled/harness-tools/data-analysis.md`, `bundled/versions.json`. Add `src/agent/workflow/analyst-handoff.ts` as a narrow production-used helper and `tests/integration/analyst-handoff-lifecycle.test.ts`.

**Interface:** Export `steerAnalystToFinalJson(session: Pick<AgentSession, 'setActiveToolsByName' | 'steer'>, request: StageRequest, executions: Execution[], revisionState: Awaited<ReturnType<AnalystRevisions['afterExecution']>>): Promise<void>` and `assertAnalystToolCallAllowed(revisionsReady: boolean, toolName: string): void`. The first helper calls `setActiveToolsByName([])` and steers with the `files` inventory from existing `handoffContext`, the existing `outputSchema` from `JSON.parse(request.prompt)`, revision state and concise instructions to return final JSON now, preserve claim values/calculations, and avoid rerunning analysis. The worker calls it only when `handoffRequired` is true. The second helper rejects any tool call after handoff readiness; the worker uses it in `beforeToolCall` so stale/batched requests remain blocked.

- [ ] **RED:** Add `declares zero tools on the next SDK request and returns final JSON through finishHandoff` to `tests/integration/analyst-handoff-lifecycle.test.ts`. Create a real `createPricingSession` with `ModelRuntime.create({modelsPath:null, refreshOnCreate:false})`, the installed local Luna model and the current stage loadout, including a fixture `validate_handoff` definition. Call the production helper, assert `session.getActiveToolNames()` is empty and the public `session.getSteeringMessages()` contains the existing schema/inventory and exhaustion state. Replace `session.agent.streamFunction` with a deterministic synthetic stream built with the already-installed `createAssistantMessageEventStream`; on its next request assert `getCurrentTools(context.messages)` is empty and the steered message is present, then return valid final JSON. Run the real `session.agent.prompt()` loop (this avoids `session.prompt` auth and any provider/network call), read its assistant JSON, and pass it through the existing `finishHandoff`/`validateStageOutput` with a real temp result and successful execution record. Also assert `assertAnalystToolCallAllowed(true, name)` rejects stale `read`, `write`, `edit`, `bash`, `execute_analysis` and `validate_handoff` calls while the ready=false case allows them, and that the analyst role prompt remains at most 80 words. Run from `pricing-harness/`: `npm test -- tests/integration/analyst-handoff-lifecycle.test.ts`; expected to fail because the helpers are absent.
- [ ] **GREEN:** Implement the two narrow helpers and wire both into the worker: empty loadout plus direct steer at `handoffRequired`, and the all-tool guard in `beforeToolCall`. Remove the analyst validator definition/import/registration and its ready-state exception. Remove preflight wording from the analyst prompt and replace the bundled guidance with direct final-JSON instructions. Confirm the analyst prompt remains at most 80 words and `rg -n 'validate_handoff|preflight' src/agent/workflow bundled/harness-tools/data-analysis.md` has no obsolete production instruction/tool references.
- [ ] Run `npm test -- tests/integration/analyst-handoff-lifecycle.test.ts tests/unit/workflow-handoff.test.ts`; expected PASS. Document that this exercises the real SDK agent loop and installed loadout with a synthetic stream, while bypassing worker IPC and the `AgentSession.prompt()` authentication wrapper; it makes no claim about live model behavior.

**Done when:** The worker's real handoff branch uses the tested helper; no analyst tool or bundled prompt tells the model to preflight; output schema, final file inventory, revision counts and downstream execution/source validation remain the existing ones.

### AH-02 — Pin final repair accounting and retained guards

**Problem / outcome:** Removing preflight must not weaken package validation or turn a provider/cancellation failure into another repair. Keep final JSON repair separate from calculation revisions and keep acceptance of packaging distinct from verification.

**Scope:** Update only stale preflight-focused cases and add narrow assertions. Remove `checkHandoff` and its tests; after AH-01 removes the only production caller it is dead code. Retain `handoffContext` inventory coverage and all `validateStageOutput` integrity checks. Do not add semantic checks for placeholder words.

**Files:** Modify `tests/unit/workflow-handoff.test.ts`; retain `tests/unit/workflow-revisions.test.ts`, `tests/unit/workflow-checkpoints.test.ts`, `tests/integration/workflow.test.ts` and `tests/integration/workflow-presentation.test.ts` as regressions. Modify `src/agent/workflow/handoff.ts` only to remove the unused preflight helper and revise its final instructions.

- [ ] **Characterization / RED where needed:** Replace `gives bounded path-specific feedback and validates packaging after calculation revisions end` with focused cases: `repairs one schema/evidence rejection without spending another revision`, `keeps placeholder-shaped values packaging-only`, and a parameterized cancellation/provider-error case. The schema/evidence case starts from one successful initial execution plus two spent analyst revisions, gives `finishHandoff` a structurally valid but evidence-invalid JSON package, repairs it once to valid evidence, and asserts one `handoffRepair`, exactly two `revisionRounds`, and no additional analysis execution. Run `npm test -- tests/unit/workflow-handoff.test.ts`; existing guards may already pass before this ticket. Do not manufacture a red test when a characterization is already green; any RED must identify a real missing requirement.
- [ ] **GREEN:** Keep the existing one-repair-per-stage/four-shared-repairs checks. Assert `blockingInput: "x"` and the observed structurally valid `foo`/`bar`/`1` candidate with unit `x` remain schema/package shape, not verified approval; retain rejection for absent/unsafe evidence, changed script/output and missing successful execution. Confirm cancelled and provider-error reads leave `handoffRepair` at zero. Delete old assertions whose only purpose was invoking `checkHandoff`.
- [ ] Run `npm test -- tests/unit/workflow-handoff.test.ts tests/unit/workflow-revisions.test.ts tests/unit/workflow-checkpoints.test.ts tests/integration/workflow.test.ts tests/integration/workflow-presentation.test.ts`; expected PASS, including existing prior-checkpoint/verified-partial assertions after later presentation failure.

**Done when:** One final schema/evidence repair is counted through the existing shared budget, no extra revision or execution is permitted, packaging placeholders receive no semantic approval, and source/execution/checkpoint protections still fail closed.

### AH-03 — Record local acceptance and stop before live evaluation

**Problem / outcome:** The implementation needs reproducible local evidence and current project context, with the live reliability limit stated plainly.

**Scope:** Run focused checks only, refresh compiled worker output, run the configured evaluation preview, and record the result. Do not run the configured evaluation itself or any paid/live prompt. Preserve the existing report and all raw historical evidence.

**Files:** Create `docs/releases/minimal-analyst-handoff-local-validation-2026-10-09.md`; update root `PROJECT_GUIDE.md` Open Tasks and Update Log. Store generated command/evidence outputs under a new unique ignored root `.cache/minimal-analyst-handoff-<UTC timestamp>-<id>/` directory; never overwrite earlier evaluation folders.

- [ ] **Compare against pre-change baseline:** From the workspace root, hash the same files and compare with `baseline-sha256.txt` captured before AH-01; confirm the guide changes only as planned. Preserve that baseline and all prior evidence.
- [ ] **GREEN / focused acceptance:** From `pricing-harness/`, run `npm test -- tests/integration/analyst-handoff-lifecycle.test.ts tests/unit/workflow-handoff.test.ts tests/unit/workflow-revisions.test.ts tests/unit/workflow-checkpoints.test.ts tests/integration/workflow.test.ts tests/integration/workflow-presentation.test.ts tests/unit/workflow-runner.test.ts tests/integration/session.test.ts tests/unit/settings.test.ts tests/unit/bundle.test.ts`; then `npm run typecheck`; then `npm run build` to refresh `dist/agent/workflow/worker.js`; then `npm run eval:configured -- --dry-run`. Expected dry-run: exactly one selected message, `Review how Lighting & Candles performed over the last five complete quarters.` Record command output, model/settings snapshot and compiled/bundle fingerprints without printing credentials. Do not run a full suite or live evaluator.
- [ ] Write the report with changed files, focused results, dry-run selection and evidence path; state that deterministic local validation proves the actual SDK agent loop's tool declarations and handoff guards only, not worker IPC, a live answer, numerical approval or chart quality. Update `PROJECT_GUIDE.md` to replace the obsolete preflight open task with “local tool-free handoff verified; fresh live behavior remains unproven” and timestamp the update.
- [ ] **Final review:** From the workspace root, inspect `git status --short` and `git diff -- PROJECT_GUIDE.md pricing-harness/src/agent/workflow/worker.ts pricing-harness/src/agent/workflow/handoff.ts pricing-harness/src/agent/workflow/role-prompts.ts pricing-harness/bundled/harness-tools/data-analysis.md pricing-harness/bundled/versions.json pricing-harness/tests/unit/workflow-handoff.test.ts pricing-harness/tests/integration/analyst-handoff-lifecycle.test.ts`. Review newly created files directly and compare current hashes with the pre-AH-01 baseline; confirm only planned files changed. Preserve pre-existing user changes and historical reports. Run `rg -n 'Use validate_handoff|validate_handoff before|stops in analyst preflight' pricing-harness/src pricing-harness/bundled PROJECT_GUIDE.md`; it should return no obsolete live instructions/status.

**Done when:** Focused tests, typecheck, build and dry-run have recorded passing output; the selected dry-run message is unchanged; the report and guide distinguish local proof from unproven model behavior. Stop here. There is no paid-live execution ticket; another live test requires a new explicit user request.

## Implementation Handoff

Recommend inline implementation in a **fresh session**, using the [copy-ready prompt](2026-10-09-minimal-analyst-handoff-implementation-prompt.md). The three sequential tickets share one worker lifecycle; preserve existing dirty state. Stop after AH-03's focused validation, report its evidence and request separate authorization before paid live evaluation.
