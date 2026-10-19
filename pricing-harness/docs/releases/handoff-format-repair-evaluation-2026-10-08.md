# Handoff format repair — 8 October 2026

The handoff repair is implemented and passes deterministic checks. The single live rerun **did not reach the analyst handoff**: two consecutive provider connection errors exhausted the one-retry allowance. No verified answer or chart was delivered. This trial does not establish live success or a performance improvement.

Each role now receives a formal JSON Schema instead of an English placeholder object. The analyst's scope is an object containing population, period and basis; enum values, optional fields, claim types, evidence paths and completed/pending operations are explicit. The numerical and visual verifier contracts are separate. Minimal blocking-input and targeted-correction records are valid alternatives; provisional correction metadata cannot publish approvals. The verifier's check-output schema uses the same types the harness validates.

Before a worker ends its existing session, it validates its returned JSON and the receiving stage's acceptance requirements. A rejection supplies precise errors to that same agent for one configurable `workflow.policy.handoffRepair` attempt across the whole request. That repair shares the original time, model and tool allowances. Provider retries and verifier-directed analytical corrections retain their separate existing ceilings. The existing analyst/verifier correction route remains; no additional coordination layer was added. The stage prompt now gives its actual deadline, including the reserved finalization time.

Adjacent fixes check scope equality, complete work accounting, previously checked claim IDs, readable result files, standard JSON (including rejection of `NaN`), successful execution evidence and recorded rendering/capture evidence. Numerical validation now runs without writing checkpoint files or mutating the packet; duplicate independent check IDs are rejected. Checkpoints are frozen only after validation. Following the live run, a final regression exposed and repaired acceptance of code edited after execution: both recorded script and stdout hashes must still match. Clarifications during a correction/recheck also now retain their needs-input meaning instead of becoming malformed results. Both final guards were tested locally, without another paid submission.

The saved failed packet now yields **`/scope must be object`**. Replacing only scope in an offline copy makes it match the formal schema. Its original result JSON still contains `NaN`, which the new file check rejects. Historical evidence was preserved.

Exactly one fresh source-only submission used OpenRouter `openai/gpt-6-luna`, high reasoning:

> Review how Lighting & Candles performed over the last five complete quarters.

The same confirmed context and raw sources were retained, with no historical code or evaluator references supplied. Analysis/report limits remain 600 seconds total, a 180-second reserve and 100 calls; saved app model remains DeepSeek/high.

| Measure | Previous ten-minute trial | Handoff-repair trial |
|---|---:|---:|
| Prompt latency | 371.838s | 331.008s |
| SDK estimated cost | $0.032858800 | $0.012568365 |
| Model / tool calls | 27 / 39 | 14 / 19 |
| Selected class / tool allowance | analysis / 60 | report / 90 |
| Coordinator operations | 3 | 6 |
| Main script | 320 lines / 22,974 bytes | 108 lines / 15,889 bytes |
| Successful main calculation executions | 3 | 0 |
| Analyst packet | Invalid scope type | Not returned |
| Handoff repairs / provider retries | — / 0 | 0 / 1 |
| Verified answers / rendered charts | 0 / 0 | 0 / 0 |
| Public response | 18 words | 18 words |

The new batch took 333.215 seconds. Planning took 38.586 seconds and analysis 291.017 seconds. At stop, 269.248 seconds, 86 model calls and 71 tools remained. The coordinator chose report depth, visualization and six operations, including top-ten contributors and price/volume/mix patterns. Both class budgets were configured identically to the previous settings, but the generated work order selected a different class and more work. This stochastic scope variation prevents a clean causal timing comparison.

The analyst's exploratory script executed successfully. Its main script failed with a missing `product_name` column; the retained script includes that projection repair, but it was not successfully rerun before two SDK **`Connection error.`** responses. No complete result files, independent application verification or rendering followed. Evaluator-owned raw controls were regenerated independently, but there is no complete numerical output to compare. Calculation quality, rendered chart quality and conversation continuity remain unassessed. The smaller script is an unfinished draft; reduced latency/cost is not an improvement in delivered quality.

Complete public response:

> I could not independently verify an answer within this request: retry budget exhausted. Retained analysis files are drafts.

**61 focused checks across 12 files, typecheck and app build passed. All 34 live integrity checks passed**, confirming one fresh submission, unchanged inputs/context, actual Luna/high, configured budgets, absence of evaluator controls and reconciliation of all 14 SDK usage records. Live workflow version was 1.0.6; the final post-run evidence/clarification guards and build are 1.0.7. No full suite, extra replay, commit, push or deployment occurred.

Remaining failures are provider connection stability, the broad generated work order and an uncompleted calculation rerun. Full live handoff/verification/presentation success remains unproven. The one-repair limit intentionally stops repeated rejected outputs; larger allowances can be selected in the config file rather than code.

- [Complete response](../../../.cache/configured-agent-evaluations/2026-10-08T16-57-48.972Z-81a4811b/responses.md)
- [Run integrity and provider errors](../../../.cache/configured-agent-evaluations/2026-10-08T16-57-48.972Z-81a4811b/evaluator/integrity.json), [draft review](../../../.cache/configured-agent-evaluations/2026-10-08T16-57-48.972Z-81a4811b/evaluator/draft-review.json), [saved-packet replay](../../../.cache/configured-agent-evaluations/2026-10-08T16-57-48.972Z-81a4811b/evaluator/saved-packet-replay.json)
- [Formal contracts](../../src/agent/workflow/output-contract.ts), [same-session validation and repair](../../src/agent/workflow/handoff.ts)
- [Editable settings](../../harness.config.json)
