# Luna/medium with 100 model calls — 8 October 2026

The wider budget did not deliver a verified answer. The single rerun used 20 of 100 calls before the harness rejected the analyst's result format. Independent calculation review also found that the draft excluded an eligible SKU. Lower latency and cost do not constitute a quality improvement.

## Configuration and scope

Saved local quick, analysis and report model-attempt caps are now 100 per prompt, shared across workflow stages. Existing time/tool limits remain unchanged: quick 120 seconds/20 tools, analysis 300 seconds/60 tools, report 600 seconds/90 tools, with the existing finalization reserve. Retry, correction, rendering and preview allowances remain unchanged.

Exactly one newly authorized live message was submitted on OpenRouter `openai/gpt-6-luna`, medium reasoning:

> Review how Lighting & Candles performed over the last five complete quarters.

The run used a fresh source-only workspace and the same confirmed context as the prior single-prompt run. No historical analysis code or evaluator controls were supplied. The saved model remains `deepseek/deepseek-v4.1-flash` with high reasoning; Luna/medium was an explicit one-off evaluation override.

## Before and after

| Measure | Prior Luna/medium, 24-call cap | Luna/medium, 100-call cap |
|---|---:|---:|
| Submitted prompt latency | 216.007 seconds | 204.021 seconds |
| Estimated SDK cost | $0.021342635 | $0.016941485 |
| Model calls | 24 | 20 |
| Tool calls | 27 | 26 |
| Public response | Budget failure; no verified answer | 19-word format failure; no verified answer |
| Verified answers / charts | 0 / 0 | 0 / 0 |
| Stopping condition | Model-call limit | Invalid analysis packet claim |

The current batch took 205.841 seconds including setup. Planning took 9.411 seconds; analysis took 193.441 seconds. At failure, 80 calls, 34 tools and approximately 96 seconds remained. No retry, correction, render or preview was used. The analyst completed its stage response, but verification and visualization never started.

Latency was 5.5% lower and estimated cost 20.6% lower than the prior run. Both used identical compiled application code, fixtures and role instructions; the configured call cap changed. This is one stochastic trial, not evidence of a reliable performance gain. Conversation continuity cannot be evaluated from one initial message. Neither failure response satisfies the requested review.

Complete public response:

> I could not independently verify an answer within this request: Invalid analysis packet claim. Retained analysis files are drafts.

## Independent review and remaining failures

1. **Result format:** three claim values contained nested objects or arrays of objects. The contract accepts numbers, strings, null or arrays of strings. Offline validation reproduced `Invalid analysis packet claim`. No product fix or supplemental live submission was made.
2. **Requested population:** the draft required `product_master.selling_uom='EA'`, excluding SKU 85123A because its master field is blank, despite the supplied confirmed EA definition. This omitted 3,438 observations and £144,934.78 revenue. Draft revenue was £786,130.32 versus independently verified requested revenue of £931,065.10. Every quarterly shortfall equals the omitted SKU's revenue.
3. **Arithmetic versus scope:** all 35 comparisons pass for the narrowed population actually selected. This does not validate the requested population. The draft correctly identifies the 53 missing-cost lines; it avoids the prior run's missing-cost error but introduces the population omission.
4. **Delivery and charts:** no independently verified checkpoint, numerical answer or rendered chart was published. Chart quality remains unassessed; there was no chart to inspect.

## Checks and evidence

Fifteen focused checks across budget, evaluation and runtime tests passed; typechecking passed. The unchanged compiled app was reused, with its inventory verified identical before/after and against the prior rerun. All 35 integrity checks passed, including source hashes, isolated evaluator controls, exact one-message scope, actual model/reasoning/caps and reconciliation of all 20 usage events. No full suite, additional prompt, commit, push or deployment was run.

- [Current full responses and run evidence](../../../.cache/luna-medium-100-calls-2026-10-08/2026-10-08T14-56-35.958Z-02d74be0/responses.md)
- [Population review](../../../.cache/luna-medium-100-calls-2026-10-08/2026-10-08T14-56-35.958Z-02d74be0/evaluator/draft-population-review.json)
- [Contract review](../../../.cache/luna-medium-100-calls-2026-10-08/2026-10-08T14-56-35.958Z-02d74be0/evaluator/contract-review.json)
- [Prior 24-call evaluation](luna-medium-ranking-window-repair-2026-10-08.md)
