# Two analyst revision rounds — 8 October 2026

The configurable two-round limit is implemented. In the single authorized fresh-workspace live test, the analyst completed its initial calculation and exactly two revision rounds, stopped tool use, and returned a package well before the seven-minute cutoff. **The package was rejected, so no verified answer or chart was delivered.** Earlier stopping is demonstrated; improved delivered quality is not.

`workflow.policy.revisionRounds` in `harness.config.json` is set to 2. The first successful `execute_analysis` establishes the working calculation. Each subsequent attempt completes one revision round, including failures; any number of edits can be batched before that attempt. Initial execution failures remain within the existing time/model/tool ceilings. The allowance is shared across analyst continuations. At the ceiling, the worker disables tools and steers the same session to produce its AnalysisPacket. A snapshot retains the last successful generated code/results; if the final revision fails, those files are restored before packaging. Successful execution is still evidence of execution, not financial approval. Independent numerical verification and its existing targeted correction remain separate.

The implementation adds a 25-line revision helper and a small worker wrapper, with shared budget/config fields and no extra agent layer or analytical query library. Coordinator instructions now request numerical outcomes rather than optional investigations or causal bridges; presentation is requested with `visualize` and belongs to the visualizer. Analyst instructions call for material batched fixes, timely handoff and explicit coverage/holds/pending work. Methods remain in the pricing skills. A JSON handoff repair remains capped at one; after the self-review ceiling, tools stay disabled, so any repair must use the existing evidence rather than initiate further file editing.

**66 focused checks across 10 files, typecheck and app build passed.** New tests first failed for the missing revision mechanism/config setting, then passed for batched edits, initial failures, failed revision accounting, last-working-file restoration and shared allowances. The evaluator test initially used stale compiled configuration; rebuilding and rerunning the same focused checks resolved that dependency. Workflow version is 1.0.8. No full suite was run.

Exactly one fresh source-only workspace received the same confirmed fictional context, raw inputs and prompt, with no historical scripts or evaluator controls:

> Review how Lighting & Candles performed over the last five complete quarters.

OpenRouter `openai/gpt-6-luna`/high, 600-second analysis/report budgets, 180-second finalization reserve and 100 model attempts were retained. The saved app remains DeepSeek/high. Provider retry, handoff repair and targeted correction caps remain one. The coordinator selected analysis depth (60 tools) rather than the previous report depth (90 tools); both class configurations are unchanged.

| Measure | Before: last retry | After: two rounds |
|---|---:|---:|
| Prompt latency | 422.763s | 273.988s |
| SDK estimated cost | $0.054581240 | $0.034106770 |
| Model / tool calls | 44 / 70 | 21 / 26 |
| Generated operations | 4 | 2 |
| Main script lines / bytes | 275 / 30,651 | 219 / 16,408 |
| Successful main executions | 5 | 3 |
| Analyst edit / read calls | 15 / 38 | 5 / 13 |
| Peak SDK input + cache tokens | 93,934 | 58,371 |
| Analyst packet | Never returned | Returned, rejected |
| Self-review rounds enforced | No separate ceiling | 2 |
| Handoff repairs | 0 | 1 |
| Verified answers / rendered charts | 0 / 0 | 0 / 0 |
| Public response words | 17 | 18 |

Observed latency fell 35.2%, cost 37.5%, script lines 20.4% and script bytes 46.5%. These outcomes reflect both narrower role instructions and revision control, plus a different generated work order/class; a single stochastic trial does not isolate causation. The batch took 275.943 seconds. Planning used 20.309 seconds and analysis/packaging 252.394 seconds. At failure, 326.244 seconds, 79 model attempts and 34 tools remained. No provider connection errors occurred.

The initial generated calculation failed once because SQL alias `value` was reserved, then succeeded at 17:55:07.410 UTC. Revision one completed at 17:56:28.131; revision two at 17:56:51.334 switched to mandatory handoff. There were no further tool admissions. The first packet finished at 17:57:42.637, approximately 251 seconds into the request; it changed the work-order scope wording and was rejected. The one permitted same-session repair copied scope correctly, finishing at 17:58:02.837, but kept paraphrased completed operations and invented pending-operation strings. The receiver requires the original requested operation strings, so it rejected the repaired package and exhausted the handoff-repair allowance. No numerical verifier or visualizer started.

An offline replay preserves the actual failures: first `/scope must equal input.workOrder.scope`, then `Invalid requested work accounting`. In an evaluator-owned in-memory copy, normalizing only operation accounting reveals another acceptance blocker: the referenced `summary.json` contains nonstandard `NaN` values. The actual workspace and saved model packets were not repaired or altered by the replay. This shows that correcting scope alone was insufficient; errors are currently returned one at a time rather than together. The two-round feature does not fix those contract/serialization issues.

**All 289 independent draft comparisons passed**, covering quarterly amounts, cost-covered rates, quarter/endpoint movements, coverage, repeated observations and displayed claim values. They are a narrower output set than the previous 8,128-comparison trial, which also generated detailed SKU bridge records and chart data. The current draft includes all 41,684 category lines, 494,476 signed EA and £931,065.10 revenue. It restored the major SKU with blank master UOM under the confirmed EA convention. Four quarters have complete cost coverage; 53 Q3 2011 lines (£163.33 revenue, 322 EA) have blank effective cost. The packet explicitly holds full-category Q3 margin and labels 41.0096% as the cost-covered rate. No repeated sales observations were silently removed. Passing numerical comparisons does not make the invalid JSON file or handoff acceptable.

There are no chart specifications, renders, previews, captures or published artifacts to review. This reflects the intended numerical/presentation separation, but the run stopped before the visualizer could use it. Rendered quality and multi-turn conversation continuity remain unassessed. The complete public response is:

> I could not independently verify an answer within this request: handoffRepair budget exhausted. Retained analysis files are drafts.

All **36 integrity checks passed**: one submission, identical raw inputs/prompt/context, actual Luna/high, original budgets, two counted revision rounds, no tools after required handoff, no evaluator controls, unchanged compiled files and all 21 SDK usage records reconciled to $0.034106770. Last-working snapshot restoration and cumulative continuation limits passed deterministic tests; neither branch was needed in this single live prompt.

Remaining failures are exact scope/operation handoff identity, standard JSON serialization, sequential rejection feedback and end-to-end numerical/presentation delivery. The existing formal schema describes operation arrays as strings but does not encode their allowed literal values or the exact scope value. Clearer boundary constraints would address that gap without expanding analytical instructions or adding another agent layer. No further paid submission, commit, push or deployment was performed.

- [Editable configuration](../../harness.config.json)
- [Revision helper](../../src/agent/workflow/revisions.ts), [worker integration](../../src/agent/workflow/worker.ts), [focused revision checks](../../tests/unit/workflow-revisions.test.ts)
- [Complete response](../../../.cache/configured-agent-evaluations/2026-10-08T17-53-29.661Z-494de9be/responses.md), [run record](../../../.cache/configured-agent-evaluations/2026-10-08T17-53-29.661Z-494de9be/F01-1.json)
- [Independent calculations](../../../.cache/configured-agent-evaluations/2026-10-08T17-53-29.661Z-494de9be/evaluator/draft-review.json), [integrity](../../../.cache/configured-agent-evaluations/2026-10-08T17-53-29.661Z-494de9be/evaluator/integrity.json), [handoff replay](../../../.cache/configured-agent-evaluations/2026-10-08T17-53-29.661Z-494de9be/evaluator/handoff-replay.json)
