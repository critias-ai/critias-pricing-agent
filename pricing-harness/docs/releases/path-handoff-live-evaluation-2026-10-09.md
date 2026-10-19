# Path handoff repair — fresh live evaluation, 9 October 2026

One fresh Luna/high evaluation ended with **no verified answer** after **653.699 seconds**, at SDK-estimated **$0.067889980**. Analyst preflight and the final analyst handoff succeeded. A generated independent verifier executed successfully, but both verifier handoffs supplied the wrong representation of `checkExecution`. No checkpoint, published numerical answer, presentation stage or chart resulted.

This is further stage progress than the previous analyst handoff failure, but **delivered quality remains unsuccessful**. Correct retained drafts and evaluator-confirmed arithmetic do not constitute independently verified product delivery.

## Setup and scope

Read `PROJECT_GUIDE.md`, then `path-handoff-repair-2026-10-09.md`. Preserved all existing changes. Fresh typecheck passed. A temporary server compilation matched all **64** existing compiled files byte for byte; the existing UI build was newer than its sources. No application rebuild or application/configuration edit was needed. No full suite was run.

From `pricing-harness/`, ran `npm run eval:configured -- --dry-run`. It selected exactly one message:

> Review how Lighting & Candles performed over the last five complete quarters.

Effective evaluation: **OpenRouter / `openai/gpt-6-luna` / high**. Saved application model remains **`deepseek/deepseek-v4.1-flash` / high**. Analysis and report limits both resolve to **1,200 seconds total, 360-second finalisation reserve, 100 model calls and 150 tool calls**. Policy: **two shared analyst revisions, four shared final-format repairs with at most one per stage, one numerical correction**. Batch: **1,800 seconds / SDK-estimated $1**, sequential, zero automatic recovery messages.

Then ran `npm run eval:configured` **exactly once**, with authorized network access. No fallback, second submission, recovery message or historical script/response/answer seeding. The fresh external workspace contained only the 24 raw data/company/dictionary files and the manifest's confirmed fictional context before submission; no prior messages, runs or analysis code. Independent evaluator controls remained outside it. The prompt and confirmed context match the preceding 241.932-second trial. Execution was native exploratory, without an OS isolation boundary.

## Result, timings and usage

| Stage | Seconds | Model calls | Tools | SDK-estimated USD |
|---|---:|---:|---:|---:|
| Coordinator | 16.589 | 2 | 1 | 0.001526860 |
| Analyst | 394.538 | 25 | 33 | 0.036000840 |
| Numerical verifier | 240.819 | 25 | 30 | 0.030362280 |
| Request total, including overhead | **653.699** | **52** | **64** | **0.067889980** |

Batch wall time was **655.611 seconds**. All **52** SDK usage records reconcile to the recorded cost. SDK token fields sum to: input **156**, output **62,113**, cache read **1,809,413**, cache write **149,790**, total **2,021,472**. Peak input plus cache was **72,381 tokens**. These are SDK accounting fields and cost estimates, not a provider billing receipt.

Usage: **one of two analyst revisions**, **one of four shared final-format repairs** (the numerical verifier's only allowed repair), **zero numerical corrections**, zero provider retries, renders or previews. Three successful executions: initial analyst, one analyst revision, independent verifier. Four analyst execution attempts included two failures before initial success; six verifier attempts included five failures. There were six tool errors in each analytical stage, including relative-path errors, the unavailable generic `python` command, SQL aliases and verifier claim-ID lookup errors. No provider-error or aborted assistant records were present.

Final analyst script: **256 lines / 18,104 bytes**. Verifier script: **178 lines / 12,304 bytes**. Both final script hashes match successfully recorded executions. No historical code reuse was recorded.

Stop reason:

```text
stage handoffRepair budget exhausted: Independent verification execution evidence is required
```

The request stopped with **546.580 seconds**, **48 model calls** and **86 tools** still available. Three shared format repairs remained, but the verifier's per-stage allowance was exhausted. It was not a timeout, numerical-correction exhaustion or batch-cost stop. The runner exited 0 after recording the failed workflow; that exit code is not an analysis pass.

## Handoff and preflight behavior

At **05:26:26.075 UTC**, the analyst called `validate_handoff` with 70 claims and exact filenames. SDK argument validation rejected `resolvedRanking: null` before semantic preflight ran. The error echoed the full candidate rather than the bounded semantic feedback.

At **05:26:56.875 UTC**, a second call returned `{"valid":true}` with 62 claims. The analyst removed the inapplicable null ranking field and eight revenue/quantity QoQ percentage claims; the percentages remain in calculation files. The accepted final analyst packet used exact script/results/evidence paths, with zero final-format repairs. Preflight after complete exhaustion of both revisions remains untested: this analyst used only one revision.

The numerical verifier independently recomputed all 62 claim IDs and printed **53 approved / nine source-related held** checks. Its successful execution ID was:

```text
28b42df4-3b5e-4ceb-af94-e5f9fc5517dc
```

Its first `checkExecution` was a prose string beginning `executionId=28b42df4-...`, followed by the output path and a caption. The repaired value was the output-file path ending `execution-28b42df4-3b5e-4ceb-af94-e5f9fc5517dc.txt`. Neither equals the bare recorded execution UUID. Both were rejected, at **05:30:06.171** and **05:31:22.139 UTC**.

Read-only reproduction passed the **unchanged** two candidates and recorded executions to the existing validator; both reproduced the exact error, without model calls, edits or checkpoint creation. `checkpoints.ts` requires exact equality between `producer.checkExecution` and a successful verifier execution's `id`. The numerical output schema describes this field only as a nonempty string; prompt/helper guidance calls it the recorded `checkExecution`, and repair feedback reports missing evidence without listing the admissible UUID. This identifies the immediate representation/feedback failure. No corrected candidate was constructed or tested, so downstream acceptance is not claimed.

## Independent calculations and integrity

Fresh raw-source recomputation passed **326/326 comparisons**:

- 111 quarterly-table checks and 25 summary checks;
- all 62 accepted analyst scalar/null claims;
- four repeated-signature controls;
- all 62 executed verifier actual values and 62 statuses.

Six additional source-structure checks passed: signed line values equal quantity × price, deduplicated master cardinality is unique, the scoped population has 41,684 observations, each has exactly one historical cost interval, matched records use GBP/EA, and 53 observations have blank numeric costs. All 15 catalog CSV hashes match their original catalog entries.

Verified evaluator controls include **£931,065.10** signed revenue and **494,476 EA** over Q3 2010–Q3 2011. Endpoint changes: revenue **−£13,072.86 / −7.7837637%**, quantity **−22,915 EA / −21.2707695%**. Q3 2011 full COGS/margin and complete-window cost/margin remain unavailable because 53 lines for product 84596L, **322 EA / £163.33 revenue**, have blank effective unit costs. Supported Q3 2011 subtotals are explicitly partial. All repeated sales observations remain included; 1,997 candidate signature groups contain 4,057 observations, with 2,060 excess observations and £82,528.13 signed revenue.

Integrity passed **62/62 audit checks**. All **357 pre-existing repository files** were unchanged before the authorized report/guide updates; all **24** copied inputs match originals and remain unchanged in the live workspace. All compiled files retain their hashes. All **33** archived analysis/output files match the live workspace. No evaluator-control paths appear in observed tool operations; context remains unchanged. Source and saved model configuration were not edited.

The evaluator corrected an early review assumption after observing that the final analyst revision preserved valid Q3 2010 cost endpoints despite the incomplete full window. The final comparison expectations follow raw-source availability; no application change or model prompt was involved.

## Delivery and chart review

Complete user-visible response, 15 words:

> I could not independently verify an answer within this request. Retained analysis files are drafts.

Complete assistant text, final stage packages, raw sessions/tool outputs, events and execution evidence are retained. There is **no checkpoint, published artifact, rendered HTML/image or chart capture**. Desktop and **390px** chart inspection are therefore **not applicable**, rather than passed. The work order requested visualization, but no presentation stage started. Time to first verified answer is absent.

## Comparison and remaining work

| Measure | Previous handoff failure | This run |
|---|---:|---:|
| Request seconds | 241.932 | 653.699 |
| SDK-estimated USD | 0.033255105 | 0.067889980 |
| Model / tool calls | 19 / 25 | 52 / 64 |
| Accepted analyst handoff | No | Yes |
| Successful live independent verifier execution | No | Yes |
| Checked answer / checkpoint / chart | 0 / 0 / 0 | 0 / 0 / 0 |

This run was **2.70× slower and 2.04× costlier**. The path/preflight change is live-observed to admit an analyst packet, but delivery remains blocked on verifier execution identity. Neither faster failure nor deeper stage progress alone establishes improvement in delivered quality. These single generated runs do not establish causal speed/cost effects.

Future work would need to make the verifier execution-reference contract and repair feedback unambiguous while retaining executed-source guards. Complete numerical checkpoint and visual delivery remain unproven. No code fix, recovery, follow-up paid prompt, fallback, full suite, commit, push or deployment was performed.

## Evidence

Live evidence: `.cache/configured-agent-evaluations/2026-10-09T05-20-26.832Z-e835d99c/`.

Independent evaluation evidence: `.cache/path-handoff-live-2026-10-09T05-19-52.083231Z/`, including `live-console.log`, `effective-preflight.json`, `build-readiness.json`, baseline hashes/status, complete `responses.md` and `stage-responses.md`, `audit.json`, `run-metrics.json`, `verifier-handoff-diagnosis.json`, `unchanged-handoff-reproduction.json`, `calculation-review.json`, raw-source controls and `supplemental-review.json`.
