# PH-02 — Reuse workspace analysis code and verified scope

**Issue type:** Story

**Priority:** High

**Blocked by:** PH-01

**Status:** implemented — live validation limits recorded

## What to build

A follow-up discovers code created by earlier analyses in this workspace and reuses or adapts it while preserving the requested financial basis and ranking. First-use work remains general purpose.

## Acceptance criteria

- [x] Maintain an atomic compact analysis index with code/result paths and hashes, source hashes, calculation version, scope/basis, coverage, holds and verification references.
- [x] Do not seed domain-specific SQL, pricing helpers or scripts from historical evaluator workspaces. A fresh workspace has an empty index and the analyst authors its own calculation code.
- [x] Permit reuse of compatible verified results only after dependency checks. Adapted code, changed periods/definitions or changed sources require fresh execution and verification.
- [x] Unverified candidate code can be discovered but must be inspected/executed/checked before any result is approved; it is never represented as a verified cached answer.
- [x] Keep analysis state separate from confirmed company facts. Preserve fixed top-ten cohorts until a user explicitly requests re-ranking; save the ranking window.
- [x] Reject missing, changed, escaping or conflicting code/result paths; invalidate stale results without deleting original source data or silently reusing another workspace.
- [ ] Tests cover an empty index, compatible reuse, source/code/basis drift, explicit quarter re-ranking, no-activity cells, restart persistence and index-write concurrency.

## Delivery checklist

- [x] Add failing tests for the stated behavior and confirm they fail for the intended reason.
- [x] Implement the smallest complete slice, including any affected API/UI persistence.
- [x] Run the ticket’s focused checks and typecheck; record the result.
- [ ] Review the diff and evidence, then mark the ticket done locally. Do not commit or push.

## Implementation evidence — 2026-10-08

Empty/atomic index, source/corpus/code/basis invalidation and candidate-versus-verified reuse are implemented and checked. Live analyses produced no accepted packet/index entry, so reuse and no-activity behavior through real cached replies remain unvalidated. See [focused evaluation report](../../../../releases/focused-agent-workflow-evaluation-2026-10-08.md) and the focused check/evidence links there. Unchecked criteria remain explicit; no commit or push.
