# Handoff repair live retry — 8 October 2026

The user-authorized retry completed without a connection failure, but **delivered no verified answer or rendered chart**. The analyst reached the seven-minute analysis cutoff without returning an AnalysisPacket. The three-minute reserve remained unused because there was no packet to verify. Formal handoff repair was never triggered, so its live effectiveness remains unproven.

Exactly one fresh, source-only workspace received the same confirmed fictional context and prompt:

> Review how Lighting & Candles performed over the last five complete quarters.

The run used OpenRouter `openai/gpt-6-luna` with high reasoning, the current workflow 1.0.7 build, 600 seconds total, a 180-second reserve, 100 model attempts and report-class 90 tool calls. Provider retry, analytical correction and effective handoff repair each remained capped at one. The saved app selection remains DeepSeek/high. No product code or configuration changed for this retry. The prior 61 focused checks, typecheck and build remain the implementation validation; this turn reran only the live prompt and independent evaluator checks.

| Measure | Before formal repair: ten-minute trial | Interrupted handoff-repair trial | This retry |
|---|---:|---:|---:|
| Prompt latency | 371.838s | 331.008s | 422.763s |
| SDK estimated cost | $0.032858800 | $0.012568365 | $0.054581240 |
| Model / tool calls | 27 / 39 | 14 / 19 | 44 / 70 |
| Workflow class / tool cap | analysis / 60 | report / 90 | report / 90 |
| Coordinator operations | 3 | 6 | 4 |
| Main script lines / bytes | 320 / 22,974 | 108 / 15,889 | 275 / 30,651 |
| Successful main-script executions | 3 | 0 | 5 |
| Analyst packet | Invalid scope | Absent | Absent |
| Provider connection errors / retries | 0 / 0 | 2 / 1 | 0 / 0 |
| Handoff repairs | Not implemented | 0 | 0 |
| Verified answers / rendered charts | 0 / 0 | 0 / 0 | 0 / 0 |
| Public response words | 18 | 18 | 17 |

The batch took 424.910 seconds. Planning used 18.444 seconds, 2 model calls and 3 tools. Analysis used 402.999 seconds, 42 model calls and 67 tools. At stop, 177.474 seconds, 56 model attempts and 20 tools remained. Compared with the pre-repair ten-minute trial, latency rose 13.7% and cost rose 66.1%. Script line count fell 14.1%, but byte count rose 33.4%; fewer physical lines do not establish simpler code. Compared with the interrupted run, cost was 4.34 times greater. Generated work orders differed between runs, so these are observed outcomes rather than an isolated causal measurement.

The user identified an internet disconnect as the cause of the previous interruption. That interruption did not recur here. The final SDK message was aborted by the harness reserve, not rejected by the provider.

The analyst repaired three generated SQL syntax errors caused by aliases `cost`, `overlaps` and `quarter`, plus one ambiguous edit. It then investigated a blank product-master selling unit that had incorrectly excluded SKU 85123A: 3,438 sales lines and £144,934.78. It restored those observations under the confirmed EA convention. It also separated total-category revenue from cost-covered COGS/margin after finding 53 missing-cost lines. Later edits added quarterly changes, corrected missing JSON values to `null`, refined report qualifications and reread result files. The analyst used 38 reads, 15 edits, 8 execution attempts, 5 bash calls and one write. Five executions succeeded. The final successful execution was recorded at 17:30:29.892 UTC; subsequent calls read several result files, ending at 17:30:45.921. No final analyst JSON packet appeared before the cutoff. Peak SDK input plus cache-read/write tokens reached 93,934; this records accumulated context, but does not establish that context size caused the delay.

Independent evaluator code reread the raw sources outside the model workspace. **All 8,128 draft comparisons passed**, covering five quarterly rows, 363 endpoint product records, their reconciled margin bridge, summary values, coverage, repeated observations and both draft chart specifications. All four result/report/figure JSON files parse as standard JSON. The calculation includes 41,684 Lighting lines, 494,476 signed EA and £931,065.10 revenue. Quarterly revenue is £167,950.37, £331,019.82, £134,150.38, £143,067.02 and £154,877.51. Four completely cost-covered quarterly margins reconcile; Q3 2011's 53 missing-cost lines (£163.33 revenue) prevent a full-category margin. The draft explicitly identifies 41.0096% as the cost-covered Q3 rate rather than a full-category result. It preserves repeated source observations.

This is evaluator verification of retained drafts, not an application checkpoint or delivered answer. Two chart JSON specifications have correct compared data and complementary views: quarterly revenue/margin and SKU revenue movements. The application made zero render/preview calls, generated no captures and published no artifacts. Rendered appearance, responsiveness and visual approval cannot be assessed. Single-message scope and period are retained in the calculations; multi-turn conversation continuity remains untested in this retry.

All **34 integrity checks passed**: one fresh submission, identical prompt/context/raw inputs, actual Luna/high, original limits, no evaluator controls in agent tool inputs, unchanged compiled files, and reconciliation of all 44 SDK usage records to $0.054581240. The latest script matches a successful recorded execution. The entire public response is:

> I could not independently verify an answer within this request: verification/finalization reserve. Retained analysis files are drafts.

Remaining failures are timely analyst packet delivery, end-to-end numerical approval, rendering/visual approval and useful final response delivery. Formal schemas cannot repair an output that is never submitted. Correct drafts and a shorter failure response are not a quality improvement. This run consumed the single authorized retry; no additional paid prompt, full suite, commit, push or deployment was performed.

- [Complete response](../../../.cache/configured-agent-evaluations/2026-10-08T17-23-53.343Z-a02dd951/responses.md)
- [Run record](../../../.cache/configured-agent-evaluations/2026-10-08T17-23-53.343Z-a02dd951/F01-1.json)
- [Independent calculation review](../../../.cache/configured-agent-evaluations/2026-10-08T17-23-53.343Z-a02dd951/evaluator/draft-review.json), [review code](../../../.cache/configured-agent-evaluations/2026-10-08T17-23-53.343Z-a02dd951/evaluator/review-handoff-retry.py)
- [Integrity checks](../../../.cache/configured-agent-evaluations/2026-10-08T17-23-53.343Z-a02dd951/evaluator/integrity.json), [delivery investigation](../../../.cache/configured-agent-evaluations/2026-10-08T17-23-53.343Z-a02dd951/evaluator/delivery-review.json)
- [Before/after repair report](handoff-format-repair-evaluation-2026-10-08.md)
