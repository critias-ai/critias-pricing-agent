# Verifier retry repair and twenty-minute evaluation — 9 October 2026

The saved verifier now executes repeatedly and seals a numerical checkpoint locally. The fresh Luna/high run used the scratch repair successfully but failed at the analyst's file-path handoff after **241.932 seconds**, with **15.97 minutes remaining**. No live verifier, checkpoint, answer or chart was produced. The twenty-minute allowance was not exhausted and its effect on late verification remains unproven.

## Change and local verification

`harness.config.json` sets analysis/report to **1,200 seconds total and 360 seconds reserved for verification/finalisation**. Model/tool limits remain **100/150**, two analyst revision rounds, one numerical correction, four shared format repairs with one per stage. Quick requests retain their existing budget. Saved DeepSeek/high app settings and the Luna/high evaluation override are unchanged. The reserve limits optional work; it is not an isolated verifier deadline or a promise that analysis finishes at minute 14.

The existing `connect_analysis` helper adds an explicit `fresh=True` option to clear only `analysis.duckdb` and its WAL inside the caller's scratch directory. Existing calls preserve their persistent database behavior. The source cache and saved analysis code/results remain. The helper guide explains scratch ownership, closing connections, repeatable views, reserved SQL aliases and pandas null serialization. No role prompt expansion, analytical query library or new agent layer was introduced. Data helper version: **0.1.1**.

The last saved final-verifier script was repaired in a cloned workspace, preserving historical evidence. Local execution exposed additional reserved aliases (`cost`, `rows`), an ambiguous joined currency column and pandas null handling beyond the previous late edits. Aliases were renamed, the joined column qualified, nonfinite missing values preserved as null, and the scratch reset uses the helper option. This generated script is retained only as evaluator evidence; it is not seeded into the fresh live workspace.

Verification:

- A test-first helper reproduction failed before the new option, then passed with two successive view-building executions, persistent default behavior and unchanged sources/cache.
- **37 focused TypeScript tests in five files**, **three affected Python tests**, typecheck and app build passed. No full suite ran.
- The corrected saved verifier executed repeatedly with identical **40 checks: 38 approvals and two source-related holds**. Independent evaluator calculations from raw CSVs matched **40/40 values**.
- The real handoff validator accepted its recorded execution/provenance; the checkpoint sealer froze **38 claims and two holds**. Original and cloned raw sources remained unchanged. This is a local replay, not a returned live answer.
- Configured dry run confirmed the exact prompt, Luna/high override, 1,200/360-second budgets and existing call/repair caps before submission.

Local evidence: `.scratch/verifier-repair/`, also copied under the live evidence's `evaluator/local-repair/`. Evaluator calculations and expected values stay outside product-agent inputs.

## Live attempt accounting

Prompt: “Review how Lighting & Candles performed over the last five complete quarters.”

The first sandbox attempt failed on immediate connection errors before any analysis: **3.071 seconds**, two coordinator attempts, zero tools and SDK-reported **$0**, no answer/chart. Shell DNS could not resolve OpenRouter. Evidence: `.cache/configured-agent-evaluations/2026-10-08T22-22-43.738Z-16605e33/`. Zero SDK usage is recorded; it is not a provider billing guarantee.

Automatic approval review initially rejected external network access over payload-disclosure concerns. The payload's company brief identifies fictional company/commercial additions around a public retail dataset, and the user-invoked implementation prompt explicitly authorizes sample-data excerpts/calculations through OpenRouter. Resubmission with this evidence was accepted. No indirect bypass or model change occurred.

One fresh retry uses the same confirmed context and raw source inputs, generic handoff examples and no historical analysis code or evaluator answers. Evidence: `.cache/configured-agent-evaluations/2026-10-08T22-23-28.775Z-f74d94df/`. Native execution is exploratory, not OS-isolated acceptance. The live batch remains capped at 30 minutes and SDK-estimated $1, with no automatic recovery messages.

## Before/after and remaining failures

| Measure | Previous ten-minute run | Fresh twenty-minute run |
|---|---:|---:|
| Total request seconds | 602.264 | **241.932** |
| SDK-estimated USD | 0.089127705 | **0.033255105** |
| Model / tool calls | 67 / 82 | **19 / 25** |
| Analyst script lines / bytes | 173 / 16,214 initially; 183 / 16,854 corrected | **144 / 14,215 final** |
| Analyst revisions / format repairs / corrections | 2 / 2 / 1 | **2 / 1 / 0** |
| Public response words | 17 | **990** |
| Live verified checkpoints / charts | 0 / 0 | **0 / 0** |
| Stop | Deadline during final verifier | **Analyst stage format-repair exhausted** |

The fresh run took 60% less time and cost 63% less, but stopped before independent product verification. These are faster/cheaper failures, not improved delivered quality. The previous run was confounded by one fixture value in a guide example; this run used generic examples. Single generated runs with different stage progress do not establish causal performance. There is no time to first verified answer in either run.

The coordinator took **14.286 seconds**, two model calls/two tools and **$0.001542150**. The analyst consumed 17 model calls/23 tools and **$0.031712955**. No verifier or presentation stage started. All three analyst executions succeeded, including its two revisions; the generated code used `fresh=True` and `CREATE OR REPLACE VIEW`. Unlike the saved failed verifier, these executions encountered no SQL retry collision. Read/bash/edit tool failures remain in the complete session; there were no provider error/abort records or retries in the network-enabled run.

The first final package put descriptions after filenames in `results` and included raw-source filenames in claim result evidence. The repair prompt included validation feedback. The repair replaced result paths with long prose summaries and claim evidence with statements such as “Readable result: Q3 2010 revenue …”. The controller consequently had no readable calculation-result evidence to attach to claims. One per-stage format repair was exhausted; the four-repair request allowance was not. The saved SQL fix did not address this separate packaging failure. Both packages are preserved in `evaluator/failed-packages.json`.

Independent raw-source review passed **352/352 comparisons**: 117 JSON calculation fields, 127 CSV comparisons, and 54 scalar values in each rejected package. Currency/margin claims are rounded to two decimals and were compared within half a cent or half a percentage-point hundredth; underlying results were compared at full precision. Relative changes and weighted margin in the result files are decimal fractions, while scalar margin claims are percentage values. The source-related Q3 2011 and complete-window cost/margin holds reconcile with 53 missing-cost observations; the full population and correct signed totals remain intact. Draft diagnostic labels inaccurately characterize these blank-cost rows as supplier/noncomparability conflicts; no supplier conflict is established by that label. The final claim packages omit first-to-last comparison and relative-change claims, though sequential rate calculations are present in result files. Arithmetic passing does not make this a complete review or a verified product answer.

Integrity review passed **62/62 checks**, including fresh source-only workspace, input/source hashes, excluded evaluator files, model/budgets, all 19 usage records and their cost sum, unchanged compiled code, successful script hash and revision allowance. Peak input plus cache: **53,806 tokens**, versus 101,267 previously. Complete response and sessions are preserved. SDK cost is an estimate, not a provider billing guarantee.

The entire public response is retained in the evidence's `responses.md` and `F01-1.json`. It begins:

> I could not independently verify an answer within this request: stage handoffRepair budget exhausted:

The rest is an internal path/validation error dump containing unapproved numerical statements and absolute workspace paths. This is a **990-word failure notice**, not a useful answer or an independently verified report. Its response-length regression is a separate failure in error presentation.

No artifacts/charts were published or staged for rendering, so desktop/narrow layout and chart-number verification are unavailable. The single prompt does not exercise multi-turn continuity; scope/context input equality passed, but conversation quality remains untested.

Remaining failures: unreliable analyst file inventories/evidence references, ineffective format-repair feedback, missing endpoint claims, misleading diagnostic labels and verbose internal error exposure. Larger time reserves cannot resolve a stage that exits on invalid paths with time left. The saved SQL repair is locally verified and fresh-scratch behavior is live-observed; complete live independent verification, charts and delivery remain unproven. No further paid prompt, post-run harness tuning or automatic timeout recovery was made.

No commit, push, deployment, model-baseline change or full-suite run occurred.
