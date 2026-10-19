# PH-05 — Add optional visualization with bounded verification and repairs

**Issue type:** Story

**Priority:** High

**Blocked by:** PH-04

**Status:** implemented — live validation limits recorded

## What to build

Substantial analyses receive useful charts derived from the verified numerical packet. Narrow answers stay short, and plotting problems cannot trap the entire request in report refinement.

## Acceptance criteria

- [x] Invoke visualization only when the work order requires it; the visualizer receives verified results and may not silently change eligibility, costing, ranking or numerical assumptions.
- [ ] Select graphs for distinct questions, preserve units and missing/partial cells, and keep exact figures/coverage accessible. No compulsory chart count or fixed chat section template.
- [ ] Inspect actual desktop and 390-pixel chart captures. Avoid reading every full-page section repeatedly; use per-chart captures for labels, legends and clipping.
- [x] Run rendering/preview through controller-counted wrappers around the existing generic helpers; only ledger-backed output is eligible for visual approval. Use at most two report renders/two previews and one global semantic correction round, including visual self-repair and verifier-requested repair. Route a defect only to its owning role.
- [x] Reuse the numerical verifier checkpoint; the verifier checks new chart/final-response claims and captured renders without repeating the entire numerical analysis.
- [x] After exhausted visual repairs, return approved numbers/table and disclose the specific visual limitation; drafts do not count as published graphs or successful inspection.
- [ ] Tests pin visualization skipping, wrong population/percent scaling, undefined heatmap cells, preview failure, narrow clipping, scoped correction routing, exhausted repairs and reuse of approved numerical hashes.

## Delivery checklist

- [x] Add failing tests for the stated behavior and confirm they fail for the intended reason.
- [x] Implement the smallest complete slice, including any affected API/UI persistence.
- [x] Run the ticket’s focused checks and typecheck; record the result.
- [ ] Review the diff and evidence, then mark the ticket done locally. Do not commit or push.

## Implementation evidence — 2026-10-08

Counted render/preview gates, per-chart desktop/390px coverage, numerical reuse and partial fallback pass focused checks. No live chart was published; actual product chart choice/layout and complete requested visual-edge coverage remain pending. See [focused evaluation report](../../../../releases/focused-agent-workflow-evaluation-2026-10-08.md) and the focused check/evidence links there. Unchecked criteria remain explicit; no commit or push.
