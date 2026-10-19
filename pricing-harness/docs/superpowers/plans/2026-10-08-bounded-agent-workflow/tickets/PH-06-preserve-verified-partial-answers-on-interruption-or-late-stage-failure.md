# PH-06 — Preserve verified partial answers on interruption or late-stage failure

**Issue type:** Story

**Priority:** Highest

**Blocked by:** PH-04, PH-05

**Status:** implemented — live validation limits recorded

## What to build

If optional work fails or a request exhausts its budget, the user receives the applicable verified result and a clear account of what remains incomplete, instead of an empty hang.

## Acceptance criteria

- [x] Retain existing run lifecycle states and add an optional outcome for complete, verified partial, needs input or no verified answer. Legitimate source-related holds differ from budget truncation.
- [x] Only publish previously verified, hash-stable claims that answer the current scope. Never substitute a stale checkpoint or relabel an unfinished draft as verified.
- [x] Deadline/cancellation fallback is deterministic and does not require another model request. A late worker result cannot overwrite the terminal response or a frozen checkpoint.
- [x] Stop every active role/tool, release busy state once, retain diagnostic files, and permit the next user request. Restart marks interrupted work without automatically retrying paid calls.
- [x] Keep registered CSV/script evidence available if optional HTML fails; clearly separate returned answer quality from successful file generation.
- [x] No automatic whole-pipeline restart. Any explicit continuation gets a new recorded budget and revalidates source/basis/artifact compatibility.
- [x] Integration/browser tests cover provider stall, blocked abort, source mutation, verifier unavailable, interruption after numeric approval, restart, client reconnection and a successful next question.

## Delivery checklist

- [x] Add failing tests for the stated behavior and confirm they fail for the intended reason.
- [x] Implement the smallest complete slice, including any affected API/UI persistence.
- [x] Run the ticket’s focused checks and typecheck; record the result.
- [x] Review the diff and evidence, then mark the ticket done locally. Do not commit or push.

## Implementation evidence — 2026-10-08

Checked-partial persistence and interruption/reconnect/next-request pass deterministic and single-browser checks. Missing-checkpoint startup recovery was repaired with RED→GREEN coverage. Live runs never reached numerical approval, so live post-checkpoint fallback remains unexercised. See [focused evaluation report](../../../../releases/focused-agent-workflow-evaluation-2026-10-08.md) and the focused check/evidence links there. Unchecked criteria remain explicit; no commit or push.
