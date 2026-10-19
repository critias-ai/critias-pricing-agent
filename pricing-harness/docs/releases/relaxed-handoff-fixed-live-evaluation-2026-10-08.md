# Workflow 1.0.10 live evaluation — 8 October 2026

The path fix reached the live numerical verifier. The request still failed: the analyst omitted an eligible product, the verifier detected and recomputed the error, and the correction stage exhausted the shared tool budget before editing or executing a corrected package. **No verified answer, checkpoint or chart was delivered.**

## Scope and settings

Exactly one paid message was submitted using `npm run eval:configured` in a fresh source-only workspace:

> Review how Lighting & Candles performed over the last five complete quarters.

The experiment used **openai/gpt-6-luna/high**, workflow **1.0.10**, the same confirmed context and sources as the previous trials, and unchanged limits: **600 seconds, 180-second finalization reserve, 100 model calls, 60 shared analysis tool calls, two shared analyst revision rounds**, one handoff repair and one numerical correction. The coordinator selected the analysis budget. No expected results, historical scripts or evaluator controls were given to the tested model. This was native exploratory execution, not operating-system isolation.

The saved app baseline remains **deepseek/deepseek-v4.1-flash/high**. No application code or settings changed during this test. Existing focused checks and the build preceded this run; no full suite or additional paid retry ran. No commit, push or deployment occurred.

Run ID: `78daae82-5c9f-44c0-8182-156d1d5ada97`. Request ran from 21:10:57 to 21:18:55 UTC.

## Before/after comparison

| Measure | Two-round trial, 1.0.8 | Relaxed handoff, 1.0.9 | Fixed paths, 1.0.10 |
|---|---:|---:|---:|
| Request duration | 273.988s | 207.073s | **478.093s** |
| SDK-estimated cost | $0.03410677 | $0.02800481 | **$0.066953715** |
| Model / tool calls | 21 / 26 | 17 / 22 | **45 / 60** |
| Analyst script lines / bytes | 219 / 16,408 | 157 / 13,546 | **299 / 20,638** |
| Shared revisions / handoff repairs | 2 / 1 | 2 / 1 | 2 / 1 |
| Numerical verifier reached | No | No | **Yes** |
| Public response words | 18 | 18 | 18 |
| Verified answers / rendered charts | 0 / 0 | 0 / 0 | **0 / 0** |

The latest run took 2.31 times as long and cost 2.39 times as much as the previous relaxed-handoff trial. It reached verification and detected a material error, but delivered quality remains a failure. Larger code and a short failure response are not improvements. These are descriptive single-run observations; generated work orders and model behavior also varied, so the comparison does not isolate a causal effect of the path fix.

There is no time to first verified answer. A single fresh message cannot establish multi-turn continuity. No charts were generated, so rendered chart accuracy, choice and layout could not be assessed.

## Stage behavior

| Stage | Seconds | Model / tool calls | SDK cost |
|---|---:|---:|---:|
| Coordinator | 16.181 | 2 / 1 | $0.001101965 |
| Analyst, including envelope repair | 265.737 | 24 / 30 | $0.038062245 |
| Numerical verifier | 175.884 | 16 / 24 | $0.024873285 |
| Analyst correction | 17.880 | 3 / 5 | $0.002916220 |

The analyst completed an initial successful execution and two successful revision executions. It also encountered an unavailable generic `python` command, an initial empty population from a category mismatch, and two ambiguous edit matches. Its first candidate used bare evidence filenames while the inventory used absolute paths. One envelope-only repair supplied workspace-relative evidence paths; absolute script paths passed the fixed receiving checks. The accepted package contained five claims and four result files with controller-owned scope and execution metadata. No analytical rerun was needed for that envelope repair.

The verifier read the raw sources, wrote its own CSV/Decimal analysis, fixed a local variable-name error, executed independent checks and requested a targeted analyst correction. It approved no claims. Task-completion fields in this correction response do not constitute a verified public checkpoint.

Only five tool calls remained for correction. The new analyst stage spent them reading the analysis skill, detailed methods, both sections of its original script and its original results. Its next shell call to copy and inspect the script was denied as the 61st tool call. **No corrected script was written or executed.** At shutdown, **122.147 seconds and 55 model calls remained**, but zero tools remained. There were no provider connection errors or provider retries.

## Independent numerical review

Evaluator controls were recomputed from the original raw sources, independently of both agents' generated code. The final initial-analyst tables and displayed claims passed **19 of 86 comparisons; 67 failed**. The verifier's corrected quarterly values, movements, endpoint figures, repeat signatures and population/source counts passed a separate **107 of 107 comparisons**. These counts cover different outputs and must not be combined into one quality score. Evaluator confirmation of private verifier results is not a product approval or delivered answer.

The analyst required `product_master.selling_uom='EA'`. That silently excluded **85123A**, whose master unit is blank even though the confirmed context defines stock-code selling units as EA. The omitted population contains **3,438 observations, 56,871 signed units and £144,934.78 revenue**. The analyst therefore analyzed 38,246 observations instead of the required 41,684.

| Quarter | Analyst revenue | Independently checked revenue |
|---|---:|---:|
| Q3 2010 | £133,842.71 | £167,950.37 |
| Q4 2010 | £287,908.93 | £331,019.82 |
| Q1 2011 | £108,275.41 | £134,150.38 |
| Q2 2011 | £122,191.50 | £143,067.02 |
| Q3 2011 | £133,911.77 | £154,877.51 |

The incorrect endpoint narrative reported **+£69.06 / +0.05%** revenue; the correct change is **−£13,072.86 / −7.78%**. Correct signed units declined by **22,915 / 21.27%**. This is a scope error with a material effect on interpretation, not a serialization problem.

Separately, `qoq_margin_change_pp` in the analyst CSV contains fractional changes rather than percentage points. A displayed claim multiplied by 100, but the supporting table's unit label remains wrong.

The legitimate missing-cost hold remains: **53 observations for 84596L, 322 signed units and £163.33 revenue** have unavailable costs. Full-population Q3 2011 gross profit/margin and corresponding endpoint movements must remain unavailable. Earlier quarters can be calculated; the absent source cost must not be treated as zero. The verifier preserved this hold while correcting the omitted population.

Full-window signed revenue is **£931,065.10**. Repeated-observation diagnostics independently reconcile to **1,997 groups, 2,060 observations beyond the first, 10,335 excess signed units and £41,477.54 excess signed revenue**. Source observations were retained.

## Complete public response

> I could not independently verify an answer within this request: tool budget exhausted. Retained analysis files are drafts.

## Remaining failures and next investigation

1. The analyst did not apply the confirmed unit basis consistently and produced materially wrong totals. The verifier caught it, but the correction did not complete.
2. The shared 60-tool cap left no execution capacity for repair. Increasing elapsed time alone would not address this stop. A small correction-tool reserve or configured larger cap, together with less repeated reading in the correction stage, is the next bounded experiment; neither change was made here.
3. Bare stage-relative evidence filenames still needed the existing envelope repair. Absolute workspace paths now pass. This remaining usability issue did not terminate this run.
4. Percentage-point labeling in supporting output remains inconsistent.
5. Verified publication, chart generation and live conversation continuity remain unproven for this workflow. Private corrected figures cannot be counted as delivery.

## Evidence

Evidence root: `.cache/configured-agent-evaluations/2026-10-08T21-10-55.250Z-cd43e02a/`.

It retains complete stage sessions, public response, work order, accepted analyst packet, generated files, execution records, verifier correction and usage. `evaluator/quality-review.json` records the 86 analyst comparisons; `evaluator/verifier-review.json` records 107 verifier comparisons. Integrity checks passed **60/60**, including source/workspace hashes, fresh inputs, exact model/settings, unchanged compiled files, excluded evaluator inputs, two-round limits, recorded script identity and all 45 usage records with cost reconciliation. Costs are SDK estimates.

Prior results remain in `relaxed-handoff-evaluation-2026-10-08.md` and `two-revision-rounds-evaluation-2026-10-08.md`; their evidence is unchanged. No further paid submission was made.
