# Bounded-agent workflow — focused evaluation, 8 October 2026

**The bounded infrastructure is implemented, but the focused live evaluation does not show improved analytical delivery. No new verified numerical answer or chart was delivered. The harness is not ready on this evidence.**

All five scenarios/nine planned messages were accounted for: eight original messages were submitted once, and the dependent rebate/service message was blocked because no verified Q3 cohort existed. Exactly two labeled affected replays were submitted. No automatic recovery, broader evaluation, full test suite, benchmark, commit, push or deployment was performed.

## Evidence and execution

[Complete responses](../../../.cache/focused-agent-workflow-2026-10-08/2026-10-08T10-01-31.726Z-1ee9629b/responses.md) · [All combined records](../../../.cache/focused-agent-workflow-2026-10-08/2026-10-08T10-01-31.726Z-1ee9629b/combined-records.json) · [Per-stage timings/counters/cost](../../../.cache/focused-agent-workflow-2026-10-08/2026-10-08T10-01-31.726Z-1ee9629b/stage-metrics.csv) · [Approved manifest](../superpowers/plans/2026-10-08-bounded-agent-workflow/focused-evaluation.json) · [Integrity/configuration audit](../../../.cache/focused-agent-workflow-2026-10-08/2026-10-08T10-01-31.726Z-1ee9629b/evaluator/integrity-verification.json).

All 15 observed role sessions used OpenRouter **openai/gpt-6-luna, reasoning high**. Pricing bundle 0.2.0 and Pi SDK 1.0.4 remain pinned; visualization is 0.1.1. Revised bundle fingerprint: `e4b494bbb00c73c22fa29b9b5d175aa20a98beffcaceb5541c29058d412b3c5d` (historical: `4a375d8c128c97de8d5cedbdaf45a4fc60abe4bbbae99b7bc708ebc59d0c14b2`). Run JSON contains role-prompt hashes and compiled-file inventories for each build used. The final routing fix was built after the replays and has deterministic verification only.

F01–F03 shared one fresh conversation; F04/F05 started fresh. Only raw CSVs, company documents and dictionary were file inputs; warm context was the manifest fixture. Controls, historical responses and scripts remained evaluator-only. Product code is generated on demand; the generic execution recorder instruments reads/SQL and contains no commercial query library. Native execution is exploratory and has no OS isolation guarantee.

The batch ran from 10:01:31 to approximately 10:32:36 UTC, **31.1 minutes**, including fix/rebuild pauses and both replays; the 60-minute allowance was never reset. Recorded SDK estimate: originals **$0.068923**, replays **$0.015160**, total **$0.084082**, below $5. These fields are not a provider billing guarantee, especially the valid zero recorded on aborted calls.

F01 initially caused the evaluator to stop on incomplete controller usage. The saved SDK session actually contained all 18 terminal usage records: the supervisor discarded the aborted-call record during cancellation grace. A failing regression reproduced this. The fix accepts usage only during bounded stopping grace while still rejecting late work/results. [SDK reconciliation](../../../.cache/focused-agent-workflow-2026-10-08/2026-10-08T10-01-31.726Z-1ee9629b/evaluator/sdk-usage-reconciliation.json) records the valid zero and matching cost totals; original files were retained unchanged, then only unsubmitted planned messages resumed within the original allowance.

## Before/after delivery

Historical originals and recoveries are separate below. Historical timings had concurrency, provider interruptions, warm caches and continuation confounds; these are descriptive comparisons, not causal A/B evidence. Historical first-verified-answer time was not instrumented. Current first-verified-answer time is **unavailable for every message**, not zero.

| Message | Historical original: seconds / words / outcome | Current original: seconds / words / outcome | Current SDK estimate |
| --- | --- | --- | ---: |
| F01-1 Group review | 720.4 / 0 / cancelled, no answer | 242.3 / 17 / no verified answer | $0.010168 |
| F02-1 Five-quarter top ten | 826.1 / 430 / delivered | 242.3 / 17 / no verified answer | $0.018485 |
| F02-2 Q2 SKU diagnosis | 718.7 / 291 / delivered | 49.1 / 18 / no verified answer | $0.002335 |
| F02-3 Following-quarter recovery | 122.1 / 145 / delivered | 242.3 / 17 / no verified answer | $0.016774 |
| F03-1 Q3-only ranking | 495.0 / 300 / delivered | 33.4 / 16 / unnecessary category clarification | $0.001772 |
| F03-2 Rebates/service costs | 423.9 / 174 / delivered | — / — / blocked | — |
| F04-1 Fresh brief SKU request | 37.3 / 286 / clarification | 69.6 / 30 / clarification | $0.004274 |
| F04-2 Explicit definition reply | 1483.1 / 0 / cancelled, no answer | 242.3 / 17 / no verified answer | $0.010407 |
| F05-1 Detailed price scenario | 1076.3 / 0 / cancelled, no answer | 73.4 / 38 / whole request blocked for pocket basis | $0.004708 |

| Historical recovery | Seconds | Words | SDK estimate | Result |
| --- | ---: | ---: | ---: | --- |
| F01 conversation-confirmed-1/turn-02.json | 188.9 | 451 | $0.013590 | Supported group answer; full-Q3 margin hold |
| F04 brief-sku-fresh/turn-03.json | 337.3 | 529 | $0.061447 | Supported SKU answer with additional fixture unit convention |
| F05 detailed-price-impact/turn-02.json | 1800.6 | 0 | $0.272514 | Cancelled; no final answer |

Historical selected originals delivered six replies: four numerical/context passes, one service-pool result requiring a hold/correction, and one clarification; three originals failed delivery. Their estimated spend was $0.372259. The three selected recoveries cost another $0.347552 and delivered two supported answers; the detailed-price recovery still failed. The SKU recovery had an added selling-unit convention, so its basis is not an identical replay of the scripted original.

Current originals: **0 complete, 0 verified partial, 5 no-verified-answer, 3 needs-input, 1 blocked**. Only F04’s initial clarification was appropriate; F03 lost established category context, and F05 blocked supported components unnecessarily. Analytical complete-answer rate is **0/8 planned analytical messages (0/7 submitted)**. Cost per correct completed analytical answer is **undefined**, because none completed. On the numerical/context-pass denominator, historical original spend was about $0.0931 per pass (four), and recovery spend $0.1738 per pass (two); these do not certify chart quality or causal efficiency.

Original current responses total 170 words, including all interim/public messages; replays add 35 words. The 17–18-word failure notices are not concise answers. F04’s clarification fell from 286 to 30 words but slowed from 37.3 to 69.6 seconds. The recovery question took 242.3 seconds and delivered no answer, versus the historical 122.1-second, 145-word supported reply.

## Stage behavior and repairs

Original attempts used 84 model attempts/145 tool calls; replays used 21/34, total **105/179**. There were 10 coordinator stages and 5 analyst stages, **no verifier or visualizer stage**. No provider retry, semantic correction, render or preview occurred; retry time was therefore zero. All stages share the same request counters/deadline. Ordinary analysts stopped at the 20% verification/finalization reserve with approximately 58 seconds left after the 2-second cancellation grace. No unverified draft was relabeled as a checkpoint.

| Affected replay | State restoration | Observed result |
| --- | --- | --- |
| F03-1 ranking | Exact recorded pre-turn files, same absolute workspace root, hashes matched; original post-run workspace archived by rename | 24.1s, 18 words, $0.001779; Lighting & Candles retained correctly, but missing schemaVersion caused invalid WorkOrder and no answer. |
| F05-1 price scenario | Exact recorded fresh pre-turn files/context, hashes matched; no expected answers or warm-up calls | 242.2s, 17 words, $0.013381; independent components proceeded into analysis, but planner selected ordinary-analysis class and hit its reserve before verification. |

All original failures remain recorded. Two replays exhaust the approved supplemental allowance. The final controller fix now prevents an explicit full-pass-through/break-even/report request from being downgraded to ordinary analysis; genuinely blocking clarifications remain quick. Its RED→GREEN test, typecheck and build passed, but another live run is deferred.

The history fix retains up to 20 earlier bounded user requests plus the recent public messages, without forwarding role/tool histories. Lightweight guidance now asks a whole-request blocking question only if no useful component can proceed, and states 50–120-word guidance for quick user answers. Shared/role additions remain below 200/150 words. A separate restart regression exposed missing-checkpoint startup failure; recovery now withholds the invalid checkpoint and restores an interrupted unverified run.

## Independent numerical and visual assessment

[Raw calculation review](../../../.cache/focused-agent-workflow-2026-10-08/2026-10-08T10-01-31.726Z-1ee9629b/evaluator/numerical-review.md) · [42 control comparisons](../../../.cache/focused-agent-workflow-2026-10-08/2026-10-08T10-01-31.726Z-1ee9629b/evaluator/control-verification.json) · [Actual-render review](../../../.cache/focused-agent-workflow-2026-10-08/2026-10-08T10-01-31.726Z-1ee9629b/evaluator/visual-review.md).

All 42 raw-data controls reproduced. Key guards remain: full Q3 Lighting margin held for 53 blank-cost lines; SKU 85123A Q2/Q3 margins 4.5290%/35.2682%; Q3 top-ten comparable deduplicated service pool GBP 47,062.3535 with EUR 1.084 separate; provisional rebate movement −GBP 892.03 cannot establish SKU allocation. Fixed-basket list value rises 2.1143%, not 4%; 40 January-delivery orders are locked, and zero January executed agreements exist. These are independent evaluator results, **not product passes**. No delivered numerical claim exists to score for the current runs. One recorded analysis execution profiled inputs; its draft is not an independently verified answer.

No current-run artifact or chart was published: useful-graph delivery **0**, desktop/390px final-chart verification **unassessed**, chart-choice improvement **unproven**. The saved historical top-ten HTML was re-captured offline into new evidence and both charts viewed at both widths. Its 10 ranked bars and 50 quarterly revenue points match raw controls. At 390px, titles clip and the ten-series trend legend overlaps axis labels; the bar plus crowded revenue trend also lacks a quarterly margin view. Existing historical group/SKU reports remain supported numerical comparisons with documented layout limits; F05 has no historical final chart. Absence of a new chart is not a rendering pass.

All approved input hashes match the raw pack; all 1,294 pinned historical files are unchanged. Actual role model/provider/effort checks pass. A configured-secret scan of 617 evidence files found no credential value. Restored pre-turn state, code, events, draft files and complete response text are retained. No live code reuse was achieved because analyses never produced an accepted packet/checkpoint/index entry; deterministic compatibility/invalidation checks pass, but a live reuse benefit remains unproved.

## Verification and remaining failures

[Focused check record](../../../.cache/focused-agent-workflow-2026-10-08/checks/verification.md). Initial affected selection: 37 passing tests in 17 files, plus targeted HTTP/state/environment and native preview checks. After scoped fixes, 19 focused tests passed; final explicit-report routing checks added a RED→GREEN case and 14 targeted tests passed. Typecheck and final build passed. The single offline browser workflow check passed after the history/startup fixes; it verifies partial-answer persistence/reload/next question, not live financial correctness. No full suite ran.

1. Analytical delivery remains failed: ordinary work consumed its reserve before independently verified findings. No live checkpoint, finance reconciliation, partial-answer fallback after numerical approval, ranking continuity through approved cohorts or useful chart set was exercised.
2. Coordinator schemaVersion omissions caused the original Q2 diagnosis and supplemental ranking to fail. Strict validation correctly rejected them; schema reliability/repair remains unresolved.
3. The history fix removed the redundant category question in its replay, but no Q3 cohort was verified, so adjusted-margin follow-up remains blocked.
4. Component-level hold guidance removed F05’s early whole-request block, but the replay exposed budget under-classification. The final routing correction has no paid rerun because the two-replay limit is exhausted.
5. Financial edge cases and actual chart-quality claims still require successful live results. Generic provenance proves observed access/execution and hash stability, not business semantics or protection against hostile native code.

Implementation rulings: inline work/no commits/focused suites follow the user override; planning selects a validated class once without resetting counters, with a final explicit-report minimum; the existing Playwright package’s missing matching Chromium binary was installed through approved escalation without dependency upgrades; generic read/SQL provenance was added without analytical templates. The static Luna/max review found substantive issues and the focused fix pass addressed them; live evaluation exposed the additional failures above. Tickets retain unchecked live/semantic coverage instead of claiming release acceptance.
