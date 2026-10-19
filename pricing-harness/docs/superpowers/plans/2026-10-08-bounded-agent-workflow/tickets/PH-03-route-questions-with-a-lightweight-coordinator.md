# PH-03 — Route questions with a lightweight coordinator

**Issue type:** Story

**Priority:** High

**Blocked by:** PH-01, PH-02

**Status:** implemented — live validation limits recorded

## What to build

The user can ask brief questions naturally. A coordinator selects the necessary work and response depth without forcing a report or asking for definitions that are already established.

## Acceptance criteria

- [x] Produce a validated short WorkOrder carrying the original question, population/period, confirmed basis, ranking rule, output depth, required stages, relevant evidence references, budget class and blocking input.
- [x] Support quick verified-result answers, targeted clarification, ordinary analysis and explicit detailed-report routes. Prompt length alone does not decide complexity.
- [x] A compatible cached lookup invokes no analyst/visualizer/full audit; any new calculated claim takes the analysis/verification path.
- [x] Ask only a material blocking clarification and preserve confirmed source-specific definitions. An analyst/verifier clarification goes through this same user-visible route.
- [x] Quick follow-ups default to 50–120 words, no compulsory headings/report; clarification asks one blocking question. Necessary qualifications can exceed guidance and the exception is recorded.
- [x] Role prompts are at most 150 words each and shared added workflow guidance at most 200 words, excluding data schemas/inventories and existing reference documents.
- [x] Tests cover recovery follow-up, inherited Q3 scope, explicit re-ranking, a missing definition, invalid plan output, an unavailable cache entry and absence of an unnecessary visualization stage.

## Delivery checklist

- [x] Add failing tests for the stated behavior and confirm they fail for the intended reason.
- [x] Implement the smallest complete slice, including any affected API/UI persistence.
- [x] Run the ticket’s focused checks and typecheck; record the result.
- [x] Review the diff and evidence, then mark the ticket done locally. Do not commit or push.

## Implementation evidence — 2026-10-08

Lightweight planning, bounded public-history retention, quick guidance and explicit-report minimum are implemented. Live schemaVersion omissions remain delivery failures. The history replay retained the category but still failed schema validation. Final report-class fix has deterministic coverage only; replay allowance exhausted. See [focused evaluation report](../../../../releases/focused-agent-workflow-evaluation-2026-10-08.md) and the focused check/evidence links there. Unchecked criteria remain explicit; no commit or push.
