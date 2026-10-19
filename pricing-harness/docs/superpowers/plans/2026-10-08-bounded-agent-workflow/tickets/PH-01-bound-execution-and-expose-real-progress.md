# PH-01 — Bound execution and expose real progress

**Issue type:** Story

**Priority:** Highest

**Blocked by:** None — can start immediately

**Status:** implemented — live validation limits recorded

## What to build

Every request has one enforced execution budget and useful phase/timing feedback, including when the provider or a tool stalls. Preserve existing request idempotency, busy-state, cancellation and source-integrity behavior.

## Acceptance criteria

- [x] Apply the quick/analysis/report limits in the brief across the entire request; role handoffs and successful intermediate calls never reset them.
- [x] Count model attempts, tool calls and provider retry time separately. Configure nested SDK/provider retries so the single cumulative retry cannot be bypassed.
- [x] Enforce an abortable whole-request deadline and a bounded cancellation grace; terminal settlement must not wait indefinitely for a model/tool. Supervise stage work so uncooperative work can be stopped and cannot publish afterward.
- [x] Emit meaningful planning/analysis/verification/visualization/finalization progress, elapsed time and remaining budget. Do not expose hidden reasoning or credentials.
- [x] Stop three identical normalized operation/result pairs without new evidence and record the reason. Ignore new evidence, distinct scoped operations and transport retries for this detector.
- [x] Record actual configured provider/model/reasoning, bundle and role-prompt hashes, budget class, timing and counters. Existing legacy run records remain readable.
- [x] Fake-clock tests pin deadline, cumulative retries, idempotent cancellation, exactly-once settlement, no late publication, meaningful progress and no premature settlement on a retrying agent_end.

## Delivery checklist

- [x] Add failing tests for the stated behavior and confirm they fail for the intended reason.
- [x] Implement the smallest complete slice, including any affected API/UI persistence.
- [x] Run the ticket’s focused checks and typecheck; record the result.
- [x] Review the diff and evidence, then mark the ticket done locally. Do not commit or push.

## Implementation evidence — 2026-10-08

Budget, cancellation/process-group and missing-usage gates pass focused checks. Live ordinary attempts stopped at the reserve; abort-grace SDK usage loss was fixed after a failing regression. No provider retry occurred in this batch. See [focused evaluation report](../../../../releases/focused-agent-workflow-evaluation-2026-10-08.md) and the focused check/evidence links there. Unchecked criteria remain explicit; no commit or push.
