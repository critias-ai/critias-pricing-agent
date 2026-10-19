# Minimal analyst handoff — approved design brief

**Date:** 9 October 2026. **Status:** User approved this minimal direction and requested a subagent-authored implementation plan plus a fresh-session implementation prompt. No implementation or additional paid evaluation is part of this planning session.

## Problem and evidence

Workflow 1.0.14's latest paid run stopped after 316.545 seconds / SDK USD0.044143640, with no verified answer. Independently selected draft comparisons passed 334/334, but the analyst repeatedly used `validate_handoff` to probe schema and validate a dummy claim rather than returning its actual final JSON. The no-progress guard stopped it before numerical verification. See `../../releases/presentation-path-live-evaluation-2026-10-09.md` for full evidence and comparisons.

Current preflight is read-only and explicitly requires a second final response. The existing `finishHandoff` final-JSON path already validates, provides one bounded format repair, and returns a canonical result. The parent runner stops the worker before the orchestrator checks protected evidence and saves its result. Retain that architecture.

## Approved change

- Remove analyst `validate_handoff` and instructions requiring preflight.
- After calculation revisions are exhausted, expose no executable tools and steer the model to return its actual final JSON. Include the existing file inventory, output schema context and preservation guidance; do not ask it to rerun or edit analysis.
- Use existing `finishHandoff`, canonicalization, source/execution guards, parent persistence, independent verification and immutable numerical checkpoints. Final JSON remains a submission for checking, not numerical approval.
- Keep one corrected final response per stage within four shared final-format repairs. Keep numerical corrections and calculation revisions separate. Do not turn cancellation, provider failure or integrity violations into new recovery permissions.
- Keep role prompts short (existing <=80-word checks). Detailed file/method guidance belongs in bundled documentation. Remove misleading stale preflight references consistently.
- Verify this behavior through a deterministic lifecycle test using actual SDK behavior or a narrow production-used seam. A fake Runner returning prepared StageResults cannot establish whether the model really sees zero tools. Test repair accounting and retain downstream guard/partial-delivery regressions.

## Adversarial review and rationale

An explicitly requested independent reviewer rejected the broader immediate redesign. Its strongest findings:

1. Turning successful preflight into terminal acceptance would accept the observed `blockingInput: "x"` or `foo/bar/1` probes earlier. Do not blacklist placeholder words; retain independent checks and honest pending-task behavior.
2. A terminal SDK tool does not by itself stop subsequent tools in a mixed batch. Sequential calls still continue; termination depends on all finalized results, and finishTurn hooks must be chained. No new terminal tool is needed for this first experiment.
3. A parent asynchronous submit/ack protocol would add cancellation, filesystem and acknowledgement races where the existing worker-result sequence already works.
4. Tool argument validation precedes normal tool-debit hooks; the latest run has 64 session requests / 62 debits. A new submission tool would complicate format-repair accounting.
5. Valid packaging, checked claims and requested-task coverage are distinct. Removing preflight does not guarantee a fresh model will answer the full request.
6. In-process duplicate suppression is not restart-safe exactly-once execution. Atomic file writes are not a transactional workflow journal. Broad early evidence copying/remapping would touch provenance and reuse unnecessarily.

Therefore remove the probing affordance first, preserve the existing acceptance path, and evaluate its effect. This is a bounded engineering hypothesis, not proof of live reliability.

## Explicit exclusions

No `submit_result` tool; no parent IPC/ack redesign; no new generic workflow engine, state-machine layer, restart/resumption guarantee, schema/coverage redesign, placeholder heuristics or early file remapping. No changes to other roles' completion semantics, model selection, budgets, dependencies, verification standards or source fixtures. Do not fix unrelated rendering/mobile/correction-budget issues in this work.

Preserve all existing dirty changes and historical/evaluator evidence. No full suite, commit, push, deployment, automatic recovery or model fallback. Planning and the future implementation prompt authorize local deterministic verification and configured dry run only. Another paid evaluation requires a new explicit user instruction; no paid-live execution ticket belongs in this plan.

## Fixed configuration and acceptance

Saved app model: `deepseek/deepseek-v4.1-flash`, high. Configured evaluation override: `openai/gpt-6-luna`, high. Analysis/report limits: 1,200 seconds total / 360-second finalisation reserve; 100 model / 150 tool calls; two shared analyst revisions; four shared final-format repairs, at most one per stage; one correction. Evaluation batch remains 1,800 seconds / USD1. Preserve all values.

Local acceptance requires analyst final JSON to reach the existing canonical validator after tool-free handoff, bounded format repair with unchanged revision accounting, and unchanged evidence/verification/partial-result guards. Verify compiled readiness, typecheck/build as appropriate and run `npm run eval:configured -- --dry-run` only. It must still select exactly one message: “Review how Lighting & Candles performed over the last five complete quarters.” Save unique local evidence and document limits: no fresh live behavior, numerical approval or chart quality has been established by deterministic tests.
