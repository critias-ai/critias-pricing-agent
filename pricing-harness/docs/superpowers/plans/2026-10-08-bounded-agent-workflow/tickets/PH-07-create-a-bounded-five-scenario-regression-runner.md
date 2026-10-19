# PH-07 — Create a bounded five-scenario regression runner

**Issue type:** Story

**Priority:** High

**Blocked by:** PH-01, PH-03, PH-06

**Status:** implemented — live validation limits recorded

## What to build

The implementation can be assessed quickly using exactly the selected five scenarios/nine messages, with complete evidence and historical references, without launching the full evaluation suite.

## Acceptance criteria

- [x] Use focused-evaluation.json exactly. F01–F03 share one fresh conversation/workspace; F04 and F05 each use a fresh workspace. Copy only raw pack CSVs/company notes/dictionary as file inputs.
- [x] Seed only the declared confirmed fixture context for warm scenarios. Keep test plans, controls, baseline scripts/responses and reviews outside product-agent file inputs; do not seed old generated queries.
- [x] All roles use OpenRouter openai/gpt-6-luna/high, sequentially. Record actual role configurations and updated bundle fingerprint; do not test a lower effort or stronger model in this pass.
- [x] Attempt planned messages once within runtime budgets. Record dependencies that are genuinely blocked; do not supply expected answers to fabricate a continuation. Continue independent scenarios after a failure.
- [x] Use a 60-minute live-batch stop and stop before a new turn if cumulative SDK-estimated cost reaches USD5; missing SDK usage/cost fields stop further paid turns; a reported valid zero is still only an SDK estimate. These are evaluator limits, not a provider-invoice guarantee.
- [x] Save raw responses, stage/tool/provider events, time to first verified answer, total time, attempts/corrections, words, reused code/hashes, registered artifacts and actual chart renders. Preserve historical records unchanged.
- [x] Runner tests prove the nine-message manifest, session grouping, file-input exclusion, configuration consistency, deadline/cost stops, secret redaction and no automatic timeout recovery/full-suite fallback.

## Delivery checklist

- [x] Add failing tests for the stated behavior and confirm they fail for the intended reason.
- [x] Implement the smallest complete slice, including any affected API/UI persistence.
- [x] Run the ticket’s focused checks and typecheck; record the result.
- [x] Review the diff and evidence, then mark the ticket done locally. Do not commit or push.

## Implementation evidence — 2026-10-08

Exactly nine planned messages accounted for: eight submitted once, one genuinely blocked dependent message. Three fresh groups and exact fixture context/input exclusions preserved. Usage-reconciliation resumption and two labeled affected replays retained the original batch allowance and failures; no automatic recovery. See [focused evaluation report](../../../../releases/focused-agent-workflow-evaluation-2026-10-08.md) and the focused check/evidence links there. Unchecked criteria remain explicit; no commit or push.
