# Luna medium: single-prompt experiment — 8 October 2026

**Medium reasoning produced a faster planning response, but no analytical answer.** The single authorized request failed after 9.263 seconds because the coordinator returned an invalid optional field. Analysis, independent verification and visualization never started. This does not demonstrate improved end-to-end performance.

Prompt: “Review how Lighting & Candles performed over the last five complete quarters.”

| Same initial prompt | Request seconds | Planning seconds | SDK USD | Verified answer |
|---|---:|---:|---:|---|
| Luna/high, latest repair run | 242.639 | 23.437 | 0.017486 | No: time reserve |
| DeepSeek/high | 132.541 | 101.689 | 0.046512 | No: call budget |
| **Luna/medium, this experiment** | **9.263** | **8.718** | **0.000844** | **No: invalid work order** |

Actual SDK configuration was **OpenRouter `openai/gpt-6-luna` / medium**. One model call, zero tools, retries, corrections, renders or previews; 18 reply words; no checkpoint or registered artifact. Batch wall time including workspace preparation was 11.330 seconds. SDK usage was complete and reconciles exactly to USD0.000843675. Estimates are not billing guarantees.

## Exact failure

The planner correctly selected Q3 2010 through Q3 2011 and supplied the requested population, metric basis, operations and visualization flag. It also supplied:

```json
"rankingWindow": null
```

The controller's `Scope` contract allows `rankingWindow` to be omitted or contain a string. An explicit null is rejected as `Invalid work order`. An offline check reproduced the rejection; removing only that field made the saved work order pass validation. This diagnosis changed no product code or saved model output and made no additional live request. The existing output-schema example describes the field as “ranking dates if any,” while validation rejects null; the optional-field handoff remains fragile and has no automatic structural repair here.

Complete user-visible response:

> I could not independently verify an answer within this request: Invalid work order. Retained analysis files are drafts.

No calculations or charts exist to independently grade. Their correctness and visual quality are **unassessed**, not passed. No conversation-continuity claim can be made from a single initial request.

## Controls and interpretation

Fresh workspace, identical raw sources and confirmed definitions, unchanged role prompts and compiled application. The ordinary request cap remained 300 seconds / 24 model calls / 60 tools with the existing reserve/retry/repair limits. The manifest permits exactly this one original prompt and no supplemental recovery message. Five focused manifest tests and 33 evidence-integrity checks passed, including source hashes, actual model/reasoning, unseeded workspace and complete usage reconciliation. The prior build was reused because no application code changed; no full suite was run.

The same current bundle was used as in the DeepSeek experiment. The older Luna/high run predates the documented cache-provenance and connection-retry fixes. Single-trial variability and that difference prevent attributing all timing changes solely to reasoning level. Medium's planner was faster in this observation, but the failed handoff prevents comparison of actual analysis speed or answer quality.

This was a **one-off runtime override**. The saved application selection remains DeepSeek/high. Historical evidence and existing changes were preserved; no commit, push, deployment, workflow tuning or second live submission occurred.

[Complete response and run evidence](../../../.cache/luna-medium-single-2026-10-08/2026-10-08T14-29-22.705Z-54ca0000/F01-1.json); [offline failure diagnosis](../../../.cache/luna-medium-single-2026-10-08/2026-10-08T14-29-22.705Z-54ca0000/evaluator/work-order-diagnosis.json); [comparison and integrity checks](../../../.cache/luna-medium-single-2026-10-08/2026-10-08T14-29-22.705Z-54ca0000/evaluator/comparison-and-integrity.json).
