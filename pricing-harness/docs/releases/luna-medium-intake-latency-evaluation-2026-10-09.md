# Luna/medium with intake and batching — 9 October 2026

The requested single-question trial stopped after **288.051 seconds**, costing **USD 0.02530235**, with **28 model requests and 32 tool calls**. It delivered **no verified answer**. Independent raw-source controls match all 53 analyst candidate values, including four unavailable values. A verifier tolerance-contract error prevented checkpoint creation.

## Configuration and comparison

Same question: “Review how Lighting & Candles performed over the last five complete quarters.” Fresh workspace: `/private/tmp/pricing-luna-medium-intake-qXnrJV`. Expanded intake is installed identically as `.context.md` and `.pricing/context.md`. No prior analysis code or expected answers were supplied.

All three actual role configuration events confirm **`openai/gpt-6-luna` / `medium`**. This is an experiment override; saved app configuration remains DeepSeek/high. Source inventory, context bytes, role prompts and budget limits match the prior expanded-context trial. Compiled application files match; the only bundled-file difference from that earlier trial is the batching paragraph added afterward to `harness-tools/data-analysis.md`. No product changes occurred during this trial.

| Measure | DeepSeek/high, expanded intake | Luna/medium, intake + batching |
| --- | ---: | ---: |
| Elapsed | 339.977s | 288.051s |
| Planner | 15.221s | 19.453s |
| Analyst | 187.722s | 146.768s |
| Verifier | 134.414s | 120.112s |
| Model requests | 41 | 28 |
| Tool calls | 43 | 32 |
| SDK cost | USD 0.065783244 | USD 0.02530235 |
| Candidate claims | 18 | 53 |
| Delivered checkpoint | Yes, failed independent correctness review | None |

Time to termination was 15.27% shorter and recorded cost 61.54% lower. This is **not** a verified-answer speed improvement: the Luna run failed delivery, and the DeepSeek delivery failed independent financial review. Model, reasoning and batching instructions changed together; work orders and candidate sets also differ. One trial cannot isolate their effects or establish reliability.

The coordinator chose report depth with four operations and `visualize:false`; analysis/report have identical configured 1,200-second, 100-model, 150-tool and 360-second reserve limits. No rich result was produced. Time inside model requests was 262.829s (91.24%); the trace cannot separate provider/network waiting from prompt processing, reasoning and generation.

## Independent numerical assessment

Evaluator-only exact-decimal source controls reproduce **53/53 candidate values** at their stated display precision, including quantities, COGS, revenue, margin, sequential movements, cost coverage and repeated-observation counts. The candidate keeps unavailable Q3 2011 COGS, margin amount, margin rate and margin movement as null. It does not publish the unsupported full-window margin claims from the earlier DeepSeek run.

The verifier's successful recorded execution produces 49 approved numeric checks and four held null checks. All 49 numeric check values agree with their corresponding candidates within declared tolerance. Source controls independently establish the 53 missing-cost lines and GBP 163.33 affected revenue. This is promising arithmetic/eligibility evidence for the draft; it does not substitute for a successfully sealed and delivered answer.

## Exact delivery failure

`validateNumericalEvidence` rejects an approved numeric check if its declared tolerance exceeds `max(0.01, abs(candidateValue) * 0.000001)`, even when the actual and candidate values agree. The verifier used `0.011` for many checks. Ten checks exceed their allowed ceiling of `0.01`.

The first is Q2 2011 revenue movement: candidate `8916.64`, independently recomputed `8916.639999999985`, difference about `1.46e-11`, declared tolerance `0.011`, allowed maximum `0.01`. Other rejected declarations include exact matches such as 478 eligible products and 53 missing-cost lines. There are **zero actual-versus-candidate differences exceeding declared tolerance** among the 49 approved numeric checks.

Read-only replay of the original execution output, source-access records, final handoff and current controller reproduces the exact `Analyst/verifier disagree` error. The shared message conflates a tolerance declaration violation with a value mismatch. One handoff repair altered the reply but did not change/re-execute the invalid checks. The stage then exhausted its one-repair allowance. The guard correctly retained no checkpoint; widening the tolerance ceiling is not the proposed fix.

Next targeted change: document/expose the per-claim tolerance ceiling and return the failing claim ID, declared tolerance, maximum and actual difference. A repair must fix and re-execute the check payload when that payload is invalid; a reply-only repair cannot change executed evidence. This change remains unimplemented in this evaluation.

Five tool failures occurred: a wrong skill-reference path, an analyst reserved-word alias and JSON NaN serialization, and verifier reserved-word alias/date-key issues. The model recovered from those within the original request. There was one analyst revision, one handoff repair, zero provider retries and zero numerical-correction requests. SDK usage is complete for all 28 model attempts.

## Evidence and scope

Evidence folder: `.cache/luna-medium-intake-2026-10-09/2026-10-09T14-57-04.505Z-1beecd8e/`.

- `result.json`: full run metrics and delivered failure response.
- `experiment.json`, `comparison-inputs.json`, `comparison-controls.json`: inputs/configuration and same-source/context/budget/prompt checks; saved configuration is unchanged.
- `analysis/`: original sessions, execution records, generated scripts and outputs.
- `independent-source-controls.json`, `independent-delivery-review.json`: raw-source controls and all 53 candidate comparisons.
- `handoff-rejection-review.json`: exact replay rejection, ten excessive tolerances and zero value disagreements.
- `preservation.json`: compiled/bundled files unchanged during the trial and source hashes.

Reproduction/evaluation scripts are in `.scratch/luna-medium-intake-2026-10-09/`; derived timing is `timing.json`. Source controls and candidate review commands were executed successfully. No product change, extra paid rerun, model fallback, default-setting change, full test suite, build, plugin installation, commit or push was performed.
