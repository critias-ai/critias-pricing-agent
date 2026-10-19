# Minimal analyst handoff — local validation, 9 October 2026

AH-01–AH-03 completed inline on workflow **1.0.15**. Analyst preflight is removed. After the configured calculation revisions are exhausted, the installed SDK receives an empty active tool list and a steer to return final JSON using the existing output schema, canonical file inventory and preservation guidance. The ready-state guard rejects every stale tool call, including a write already queued in the final calculation's batch.

The existing `finishHandoff`, schema/path canonicalization, execution/source checks, parent worker-result → stop → integrity check → save sequence, independent verifier, immutable checkpoints and verified-partial delivery remain. No new submission tool, protocol, schema, recovery, fallback or dependency was added. Other roles retain their completion behavior.

## Changes

- Added `src/agent/workflow/analyst-handoff.ts`, a narrow helper used by the worker for tool removal, schema/inventory steering and stale-call rejection.
- Updated `src/agent/workflow/worker.ts` to call the helper and remove analyst validator registration and its ready-state exception.
- Removed the dead `checkHandoff` helper from `src/agent/workflow/handoff.ts`; retained `handoffContext`, final validation and bounded repair.
- Updated only obsolete analyst guidance in `src/agent/workflow/role-prompts.ts` and `bundled/harness-tools/data-analysis.md`. All role prompts remain at most 80 words.
- Bumped only `workflowVersion` from 1.0.14 to 1.0.15 in `bundled/versions.json`; existing pricing, visualization, data-tool and SDK versions remain.
- Added `tests/integration/analyst-handoff-lifecycle.test.ts`; expanded `tests/unit/workflow-handoff.test.ts` characterizations. Updated root `PROJECT_GUIDE.md` within its 2,000-word limit.

## Local verification

All commands ran from `pricing-harness/`; outputs are saved in the unique evidence directory below.

| Check | Result | Log |
| --- | --- | --- |
| AH-01 RED: new SDK lifecycle test before implementation | Expected missing helper-module failure | `ah01-red.log` |
| AH-01 lifecycle + existing handoff checks | 22/22 passed | `ah01-green.log` |
| AH-02 handoff characterizations | 20/20 passed | `ah02-characterization.log` |
| AH-02 handoff, revisions, checkpoints, workflow and presentation regressions | 58/58 passed | `ah02-green.log` |
| Final focused acceptance: 10 files | **77/77 passed** | `focused-acceptance.log` |
| `npm run typecheck` | Exit 0 | `typecheck.log` |
| `npm run build` | Exit 0; compiled worker/helper refreshed | `build.log` |
| `npm run eval:configured -- --dry-run` | Exit 0; one message; `paidCalls: false` | `configured-dry-run.log`, `.json` |

Final focused command:

```sh
npm test -- tests/integration/analyst-handoff-lifecycle.test.ts tests/unit/workflow-handoff.test.ts tests/unit/workflow-revisions.test.ts tests/unit/workflow-checkpoints.test.ts tests/integration/workflow.test.ts tests/integration/workflow-presentation.test.ts tests/unit/workflow-runner.test.ts tests/integration/session.test.ts tests/unit/settings.test.ts tests/unit/bundle.test.ts
```

The lifecycle test uses a real `createPricingSession`, installed Pi SDK 1.0.4 and local Luna model metadata, with `ModelRuntime.create({modelsPath:null, refreshOnCreate:false})`. Only the provider stream and calculation results are synthetic. It runs the real `session.agent.prompt` loop without the provider/auth prompt path: initial success plus two revisions, a stale batched write, then the next request with zero declared tools and the exact schema/inventory steer. Final assistant JSON passes through real `finishHandoff` and `validateStageOutput` against temporary files and recorded hashes. Six named stale-tool guard cases also pass.

Handoff characterizations confirm one evidence-rejection repair spends one `handoffRepair`, exactly two calculation revisions and no further execution; one repair per stage and four shared repairs remain enforced. Cancellation/provider-error reads spend zero repairs and do not prompt again. `blockingInput: "x"` and the observed `foo`/`bar`/`1` candidate remain packaging-valid without verification or task-completion approval. Missing/unsafe evidence, missing executions, changed scripts/outputs, source checks, checkpoint integrity, cancellation and later presentation failure remain covered by the focused regressions. A prior numerical checkpoint and partial answer survive later presentation failure.

## Preserved configuration and evidence

The dry run selects exactly one unchanged message:

> Review how Lighting & Candles performed over the last five complete quarters.

Saved application model remains **deepseek/deepseek-v4.1-flash / high**; evaluation override remains **openai/gpt-6-luna / high**. Analysis/report caps remain **1,200 seconds / 360-second finalization reserve, 100 model calls / 150 tool calls**. Policy remains **two analyst revisions, four shared final-format repairs with at most one per stage, one numerical correction**. Evaluation batch remains **1,800 seconds / USD1**, with zero automatic recovery messages. Configuration and local credential-file hashes match the pre-edit baseline; credentials were not printed.

Unique root evidence directory:

`.cache/minimal-analyst-handoff-2026-10-09T08-09-02Z-12d3826b/`

It contains baseline hashes/status/guide/settings, the task ledger, command logs, compiled/bundle/settings fingerprints, final status/scoped diff and preservation review. All 367 baseline files were compared: seven planned existing files changed, no file disappeared, and the other 360 files match. This includes all 35 baseline `sample_data_1/` files and 31 historical release reports. Three planned files were added: the helper, lifecycle test and this report. Historical ignored raw evaluation evidence was left in place and never used as a write target.

## Review and limits

Final review was performed inline against the actual source, new tests, scoped diff and baseline hashes. No blocking findings or deferred minor findings. The user's current-checkout, focused-validation and no-commit instructions take precedence over the execution skill's isolation/commit/full-suite workflow; the evidence ledger replaces a commit record for this phase. An inline author review provides less independence than a fresh reviewer.

These checks prove deterministic SDK tool declarations, steering, final packaging/repair and existing downstream guards. They do **not** prove the real worker IPC transition end to end, fresh-model request coverage, a live answer, numerical approval or chart quality. The hypothesis that removing preflight stops live probing remains untested. Historical paid failures and presentation/mobile limitations remain unchanged.

Stopped after local validation and the configured dry run. No paid evaluation, full suite, fallback, commit, push or deployment occurred.
