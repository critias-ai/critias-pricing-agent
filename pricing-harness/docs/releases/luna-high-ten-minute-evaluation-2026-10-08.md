# Luna/high with a ten-minute budget — 8 October 2026

The expanded budget let the analyst finish and produce independently correct numerical drafts. The application still delivered **no verified answer**: a malformed scope field stopped the handoff before verification, with 3 minutes 48 seconds remaining. This trial isolates a contract failure after the earlier time-limit failure.

Local analysis and report budgets are now **600 seconds total, with 180 seconds reserved for verification/finalization**. Planning and analysis share the first 420 seconds. The reserve is configurable; absent an override, the existing 20% behavior remains. Quick requests retain their existing limits. Model-attempt caps remain 100; tool and retry/repair limits are unchanged. Saved DeepSeek/high configuration remains intact; this evaluation used a one-off OpenRouter `openai/gpt-6-luna`/high override. Workflow version is 1.0.4; lightweight role prompts are unchanged.

Exactly one prompt was submitted in a fresh source-only workspace, with identical confirmed context and raw inputs, without historical code or evaluator references:

> Review how Lighting & Candles performed over the last five complete quarters.

| Measure | Previous 5-minute trial | New 10-minute trial |
|---|---:|---:|
| Analysis cutoff / finalization reserve | 240s / 60s | 420s / 180s |
| Prompt latency | 242.833s | 371.838s |
| Estimated SDK cost | $0.020346715 | $0.032858800 |
| Model / tool calls | 21 / 28 | 27 / 39 |
| Analyst peak reported input tokens | 44,555 | 65,918 |
| Final script | 242 lines / 17,326 bytes | 320 lines / 22,974 bytes |
| Successful calculation executions | 3 | 3 |
| Independent draft comparisons | 97/97 pass | 163/163 pass |
| Analysis packet returned | No | Yes, invalid scope type |
| Public response length | 17 words | 18 words |
| Verified answers / rendered charts | 0 / 0 | 0 / 0 |

Planning took 14.249 seconds and analysis 356.346 seconds; the full batch took 373.874 seconds. Latency rose 53.1%, estimated cost 61.5%, and code length 32.2%. These are single stochastic trials with different generated work orders, not a reliable causal performance estimate. Time to a verified answer remains unmeasured because neither run delivered one. Conversation continuity is unassessed with one initial message. No chart was rendered, so visual quality could not be inspected.

Independent raw-data controls confirm all **163 compared values**: quarterly revenue, quantities, supported costs, weighted margins, coverage, movements, aggregate totals and repeated-observation counts. Totals reconcile to 41,684 observations, 494,476 signed units and £931,065.10 revenue. Unlike the previous draft, the four supported quarterly margin rates are explicit. Q3 2011 and whole-window full cost/margin are correctly withheld because 53 lines (£163.33 revenue) lack numeric cost. This validates the unpublished calculations, not the application's verification stage or a complete user-facing answer.

The analyst repaired two failed text edits and a decimal multiplication overflow, then made three successful calculation executions. A `python` shell command also failed because that executable name was unavailable. Later review caught an invalid whole-window aggregation that omitted the incomplete quarter's costs; the final script labels partial matched costs separately and withholds full-window margin. The final retained script matches a recorded successful execution. There were no workflow retries, verifier corrections, renders or previews.

The remaining delivery failure is precise: `AnalysisPacket.scope` was prose, while validation requires an object containing `population`, `period` and `basis`. The unchanged analyst output example itself shows `scope: 'exact work order scope'`, an ambiguous interface instruction. An **offline copy** with only scope replaced by the original work-order object passes packet validation, scope equality and completed-operation checks. The original packet was preserved; no live repair or extra submission occurred. The internal checks JSON additionally contains nonstandard `NaN` for withheld measures; CSV cells are blank. This remains an interoperability defect.

Complete public response:

> I could not independently verify an answer within this request: Invalid analysis packet. Retained analysis files are drafts.

**32 focused checks across six files, typechecking and the app build passed. All 37 run-integrity checks passed**, including source/context/prompt identity, fresh workspace, actual Luna/high settings, the new 600/180 budget and reconciliation of all 27 SDK usage records. No full suite, commit, push, deployment, model-baseline change or further replay was performed.

- [Complete response](../../../.cache/luna-high-ten-minutes-2026-10-08/2026-10-08T15-59-14.724Z-388875da/responses.md)
- [Numerical review](../../../.cache/luna-high-ten-minutes-2026-10-08/2026-10-08T15-59-14.724Z-388875da/evaluator/draft-review.json), [contract review](../../../.cache/luna-high-ten-minutes-2026-10-08/2026-10-08T15-59-14.724Z-388875da/evaluator/contract-review.json), [run integrity](../../../.cache/luna-high-ten-minutes-2026-10-08/2026-10-08T15-59-14.724Z-388875da/evaluator/integrity.json)
- [Final generated script](../../../.cache/luna-high-ten-minutes-2026-10-08/2026-10-08T15-59-14.724Z-388875da/analyses/F01-1/2-analyst/analysis.py)
- [Previous five-minute report](luna-high-lightweight-prompts-evaluation-2026-10-08.md)
