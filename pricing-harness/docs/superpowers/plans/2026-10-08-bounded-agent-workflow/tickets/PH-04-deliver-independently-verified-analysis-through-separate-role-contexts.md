# PH-04 — Deliver independently verified analysis through separate role contexts

**Issue type:** Story

**Priority:** Highest

**Blocked by:** PH-03

**Status:** implemented — live validation limits recorded

## What to build

An ordinary analysis completes through coordinator, analyst and verifier roles while remaining one visible conversation. Numerical results become a reusable verified checkpoint before optional report production.

## Acceptance criteria

- [x] Create separate SDK role sessions, all using the explicit configured model/reasoning; disable model substitution. Forward scoped artifacts and definitions, not entire predecessor tool histories.
- [x] The analyst prepares an AnalysisPacket containing generated code, executed results, material claims, basis/scope, coverage/holds and source/artifact hashes. Source files and controller metadata remain immutable.
- [x] The verifier independently executes source-based checks of material claims, including requested population, arithmetic, numeric cost presence, join/event cardinality, signed observations and units/currency. Rerunning the analyst script alone is insufficient.
- [x] Record approved/held claims and executed evidence in a VerificationRecord. Never claim all finance measures reconcile from a revenue-only bridge.
- [x] Publish controller-validated immutable numerical checkpoint files and a concise user-visible checked summary before optional presentation. An agent-written status string alone cannot authorize verification or artifact publication.
- [x] The same logical chat/request ID survives role changes, reloads and next turns. Hidden role chatter/tool histories must not become the user conversation or erase earlier user/assistant messages.
- [ ] Reserve verification/finalization time; failed verification withholds only affected claims. Tests cover null cost despite a dated match, mixed currency, repeated documented event keys, analyst/verifier disagreement, artifact mutation and continuity across role transitions.

## Delivery checklist

- [x] Add failing tests for the stated behavior and confirm they fail for the intended reason.
- [x] Implement the smallest complete slice, including any affected API/UI persistence.
- [x] Run the ticket’s focused checks and typecheck; record the result.
- [ ] Review the diff and evidence, then mark the ticket done locally. Do not commit or push.

## Implementation evidence — 2026-10-08

Separate scopes and independently executed/hash-frozen checkpoints pass contract/integration checks. No live verifier stage was reached; source/cost/currency/event semantic verification in the product is still unvalidated. Evaluator-only raw controls are not a product pass. See [focused evaluation report](../../../../releases/focused-agent-workflow-evaluation-2026-10-08.md) and the focused check/evidence links there. Unchecked criteria remain explicit; no commit or push.
