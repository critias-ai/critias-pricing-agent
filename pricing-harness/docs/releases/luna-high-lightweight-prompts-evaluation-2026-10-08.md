# Luna/high with lighter prompts — 8 October 2026

The retained analysis improved and its final script was 38% smaller, but the run still delivered no verified answer. It stopped at the same finalization reserve after 242.833 seconds. Shorter prompts did not improve user-facing completion in this single trial.

Exactly one newly authorized prompt was submitted on OpenRouter `openai/gpt-6-luna`, high reasoning:

> Review how Lighting & Candles performed over the last five complete quarters.

A new source-only workspace used the same confirmed context and raw files, without historical scripts or evaluator references. The cumulative 100-call, 300-second/60-tool analysis budget, 20% reserve and existing retry/repair limits were unchanged. The saved DeepSeek/high default was not changed. No follow-up prompt or evaluator repair was supplied to the model.

## Before and after

| Measure | Previous Luna/high | Lighter prompts, Luna/high |
|---|---:|---:|
| Shared + analyst instructions | 298 words | 125 words |
| Final analyst script | 393 lines / 27,364 bytes | 242 lines / 17,326 bytes |
| Successful calculation executions | 0 | 3 |
| First successful execution | Never | 105.698 seconds |
| Prompt latency | 242.846s | 242.833s |
| Estimated SDK cost | $0.018143180 | $0.020346715 |
| Model / tool calls | 10 / 15 | 21 / 28 |
| Analyst peak reported input tokens | 39,220 | 44,555 |
| Public response length | 17 words | 17 words |
| Verified answers / rendered charts | 0 / 0 | 0 / 0 |

The current batch took 244.910 seconds. Planning took 24.059 seconds versus 31.243 previously; analysis took 217.400 seconds versus 210.171. At stop, 79 calls, 32 tools and 57.418 seconds remained, with that time reserved for finalization. There were no workflow retries, verifier corrections, renders or previews. Internal analyst code edits and execution-error repairs still occurred.

Code shrank 38.4% by lines and 36.7% by bytes; estimated cost rose 12.1%. Both latency figures are constrained by the same reserve stop, so they do not measure time to a completed answer. Despite smaller initial instructions, subsequent tool results and self-review grew the session's peak context. This single stochastic comparison does not establish a reliable causal performance gain.

## Independent calculation review

All **97 numerical comparisons passed** against freshly generated evaluator controls: quarterly source counts, quantities, revenue, supported COGS/profit, cost coverage, signed average realized prices, quarter-over-quarter movements and full-window/Q3 comparison findings. The final retained script matches a recorded successful execution.

The draft correctly retains the actual category and SKU 85123A. Requested totals reconcile to **41,684 observations, 494,476 signed units and £931,065.10 revenue**. Q3 2011 correctly identifies **53 missing-cost lines and £163.33 uncovered revenue**, and supported gross profit uses the supported revenue population. These fix the prior high run's zero-match category filter and avoid the previous medium run's omitted-SKU and missing-cost defects.

This is independent review of unpublished drafts, not a verified application answer. Weighted margin rates were not output, although the first four quarters have complete cost coverage. No final AnalysisPacket or completed supported margin bridge was returned. Verification and visualization never started. Conversation continuity and rendered-chart quality remain unassessed.

## Remaining failures

The coordinator read the pricing skill and still assigned four broad operations, including a margin bridge. The previous work order had three operations. The revised work order chose no visualization, whereas the earlier one chose visualization; neither run reached that stage.

The analyst made one failed calculation attempt before three successful executions, repaired two failed edits, and encountered three incorrect relative skill-reference paths. It ultimately had valid numerical files but continued investigating/editing instead of completing the JSON handoff before the reserve. Simplifying the prompts alone did not resolve that delivery problem. No further product fix or live replay was performed.

Complete public response:

> I could not independently verify an answer within this request: verification/finalization reserve. Retained analysis files are drafts.

Subsequent reserve inspection: the 300-second allowance reserves 60 seconds, hard-aborting optional analysis at approximately 240 seconds. It does not request a final packet before aborting. Increasing the reserve fraction would stop analysis earlier. The analyst's initial prompt reported 275.401 seconds remaining, although only 215.401 seconds were available before that cutoff; the prompt does not disclose the reserve cutoff or update the time snapshot during the stage. Execution results arrived at 97.4 seconds (SQL failure), 105.7 seconds (first success), 165.6 seconds (expanded coverage/movements) and 223.0 seconds (corrected confirmed selling-unit/missing-cost treatment). The last execution leaves roughly 17 seconds before the cutoff. The saved [reserve inspection](../../../.cache/luna-high-100-calls-2026-10-08/2026-10-08T15-39-50.375Z-b7961029/evaluator/reserve-inspection.json) records this; no settings, product code or paid calls were changed during inspection.

## Checks and evidence

Seven fresh evaluation-manifest checks passed. The preceding prompt change's 30 focused checks, typechecking and app build passed; this run used that build. All **36 integrity checks passed**, confirming actual simplified prompts/model/reasoning, fresh conversation, identical inputs/context/budgets, source hashes, unchanged compiled files during execution and reconciliation of all 21 usage records. Only the compiled role-prompt JavaScript/declarations differ from the earlier high run; the workflow version/fingerprint also changed as recorded. No full suite, commit, push or deployment was run.

- [Complete response and run evidence](../../../.cache/luna-high-100-calls-2026-10-08/2026-10-08T15-39-50.375Z-b7961029/responses.md)
- [Independent draft comparisons](../../../.cache/luna-high-100-calls-2026-10-08/2026-10-08T15-39-50.375Z-b7961029/evaluator/draft-review.json)
- [Final generated script](../../../.cache/luna-high-100-calls-2026-10-08/2026-10-08T15-39-50.375Z-b7961029/analyses/F01-1/2-analyst/analysis.py)
- [Previous high-reasoning evaluation](luna-high-100-calls-evaluation-2026-10-08.md)
