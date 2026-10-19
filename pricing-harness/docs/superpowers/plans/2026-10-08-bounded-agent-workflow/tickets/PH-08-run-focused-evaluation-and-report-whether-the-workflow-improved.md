# PH-08 — Run focused evaluation and report whether the workflow improved

**Issue type:** Story

**Priority:** Highest

**Blocked by:** PH-01, PH-02, PH-03, PH-04, PH-05, PH-06, PH-07

**Status:** done — evaluation reported; delivery failed

## What to build

Produce an honest before/after report for the five selected scenarios, including numerical correctness, continuity, response depth, useful graphs, delivery and inference cost.

## Acceptance criteria

- [x] Run affected deterministic tests and typecheck, then build the changed application once before the live run. Do not execute the full live/acceptance/scale suites or unrelated broad tests.
- [x] Run the nine planned messages using the manifest, fixed model/effort and sequential execution. Retain complete/partial/held/failed/blocked outcomes separately.
- [x] Independently recompute reported figures from raw data and inspect final desktop/narrow charts. Evaluator controls never enter product-agent inputs.
- [x] Compare to the specified original and recovery records separately. Historical latency had concurrency/provider confounds; report descriptive changes without claiming causal isolation.
- [x] Check numerical controls in evaluator-controls.json, question-specific graph choices, source integrity, ranking inheritance and short recovery-answer behavior.
- [x] If a focused test finds an implementation defect, make a scoped fix and rerun at most two additional submitted messages, labeled supplemental and within the same remaining 60-minute/USD5 batch allowance; if it is exhausted, defer the rerun; no unbounded tuning or broader suite.
- [x] Publish a report with stage timing, complete-answer rate, verified partials, tool/model/preview counts, numerical/visual defects, estimated cost per correct completed answer and remaining uncertainty. Update the guide; no commit, push or deployment.

## Delivery checklist

- [x] Add failing tests for the stated behavior and confirm they fail for the intended reason.
- [x] Implement the smallest complete slice, including any affected API/UI persistence.
- [x] Run the ticket’s focused checks and typecheck; record the result.
- [x] Review the diff and evidence, then mark the ticket done locally. Do not commit or push.

## Implementation evidence — 2026-10-08

Evaluation/report complete with negative delivery result: zero verified numerical answers/graphs; eight submitted originals, one blocked, two failed replays; SDK-estimated total USD0.084082. All42 independent controls and source/history/configuration audits pass. No live rerun of the final report-class repair because two supplemental submissions are exhausted. See [focused evaluation report](../../../../releases/focused-agent-workflow-evaluation-2026-10-08.md) and the focused check/evidence links there. Unchecked criteria remain explicit; no commit or push.
