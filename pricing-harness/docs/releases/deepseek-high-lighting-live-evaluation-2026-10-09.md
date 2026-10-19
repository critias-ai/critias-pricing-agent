# DeepSeek/high Lighting & Candles evaluation

The requested fresh-workspace run on OpenRouter `deepseek/deepseek-v4.1-flash` with **high** reasoning ended after **477.950 seconds (7 minutes 58 seconds)** with **no verified answer, checkpoint, chart, or published artifact**. Estimated SDK cost was **USD 0.12462102**. The model completed analysis and independent recomputation, but the controller rejected the verifier's executed output twice because it contained two JSON documents.

Prompt: “Review how Lighting & Candles performed over the last five complete quarters.” Exactly one original prompt was submitted. No supplemental recovery prompt or fallback model was used.

## Timing and useful delivery

| Measure | Luna/high baseline, workflow 1.0.17 | DeepSeek/high, this run |
| --- | ---: | ---: |
| Outcome | Complete, report published | No verified answer |
| Request seconds | 712.633 | 477.950 |
| First verified answer seconds | 360.366 | Unavailable |
| Estimated SDK cost, USD | 0.081282555 | 0.12462102 |
| Model calls / tool calls | 72 / 117 | 43 / 50 |
| Published artifacts | 18 | 0 |

The shorter failure duration does not establish faster useful delivery. This run exceeded the baseline's time to first verified answer and cost about 53% more, without delivering an answer. The low-effort attempt preceding it failed with two immediate `Connection error.` responses and zero tokens, so it provides no reasoning-effort speed comparison. The medium attempt failed at session startup before prompt submission.

| DeepSeek stage | Seconds | Model calls | Tool calls | Estimated SDK cost, USD |
| --- | ---: | ---: | ---: | ---: |
| Coordinator | 28.616 | 3 | 3 | 0.005660028 |
| Analyst | 219.459 | 22 | 25 | 0.063344544 |
| Numerical verifier | 228.269 | 18 | 22 | 0.055616448 |

Recorded model-call intervals total 458.901 seconds, about 96% of request time. Those intervals include provider waiting and generation; the trace cannot separate queue time from reasoning. The analyst recovered from generated SQL/script errors, used one analytical revision, and repaired its final JSON once. The verifier used its one allowed format repair. There were no provider retries, numerical corrections, renders, or previews in the high run.

## Delivery failure

The verifier executed `check_schema.py` through `execute_analysis`. The script printed a valid `{"checks": [...]}` document, then printed a second JSON object containing diagnostic notes. The controller parses the complete stdout of the latest successful verifier execution as one JSON document. It rejected the second object's first character at position 8620, line 257:

```text
Unexpected non-whitespace character after JSON at position 8620 (line 257 column 1)
```

The repair message explicitly permitted repairs to files or checks. The model returned a revised final reply but did not change or rerun the script. The controller therefore encountered the same executed-output error again and exhausted the default one-repair-per-stage ceiling. The verifier's final reply itself was valid JSON; the rejected data was the recorded execution stdout. Numerical verification never committed a checkpoint, and presentation never started.

## Independent review of retained drafts

Evaluator code reread the raw sources outside the tested workspace. Six source checks passed across all 1,067,371 sales observations and the 41,684-row Lighting cohort. **All 68 draft arithmetic comparisons passed**: 43 quarterly values and movements, four summary totals, and all 21 candidate scalar claims.

The five quarterly signed revenues reproduce as GBP 167,950.37, 331,019.82, 134,150.38, 143,067.02, and 154,877.51. Supported complete-quarter margins reproduce. Q3 2011's 53 affected observations have GBP 163.33 revenue and 322 signed units without usable cost. The draft's explicitly labelled cost-covered subset margins also reproduce, but full-category Q3 and full-window margin remain unavailable. The unaccepted verifier output contains 19 approvals and two holds; these are retained draft judgments, not controller-approved results.

Two data-quality notes are inaccurate:

- The analyst reports zero non-EA product-master rows because its diagnostic misses NULL values. Product `85123A` has NULL `selling_uom`. The confirmed stock-code EA convention supports the arithmetic, but the flag is wrong; the verifier noticed it.
- Analyst and verifier prose say none of the five null-cost ledger records belong to the cohort. Two category products have null-cost records, including `84596L`, which contributes the separately disclosed 53 affected window observations. The prose contradicts that disclosure.

Arithmetic reproduction does not make this a correctness pass. There is no delivered answer or chart to assess, and the draft assurance language needs correction.

## Scope and comparison limits

Actual stage configuration records confirm DeepSeek V4.1 Flash/high for all three roles. The conversation and workspace were fresh, with the confirmed fictional fixture context and only the source data, company documents, and data dictionary copied in. Source hashes, bundled skills, and every compiled application file match the successful Luna baseline. All 24 source hashes, saved configuration, and local credential file remained unchanged. All 43 usage records reconcile; 38 evidence-integrity checks pass, including a scan with zero exact configured-credential matches in saved evidence.

This was not a controlled model comparison. Both runs allowed 2,400 seconds, 200 model attempts, and 300 tools per analysis/report request, with a 3,600-second / USD 2 batch admission ceiling. This run used a 360-second finalization reserve and the saved policy: two analyst revisions, four shared format repairs with one per stage, one correction, and two renders/previews. The Luna baseline used a 720-second reserve, four revisions, 12 shared format repairs with three per stage, three corrections, and four renders/previews. The per-stage repair ceiling materially limited this run's recovery. One trial also cannot establish reliability.

The first request for network access was rejected because automatic approval review classified the pack as sensitive company data. Read-only inspection established that Northbridge and the commercial additions are fictional and the transaction source is public Kaggle/UCI Online Retail II. The reviewed retry was then approved. No application behavior, saved settings, or source data changed; evaluation files, this report, and project context were saved. No additional paid run, full test suite, commit, push, or deployment followed.

## Evidence

- [Final response and run record](../../../.cache/configured-agent-evaluations/2026-10-09T12-46-10.752Z-162207c1/F01-1.json).
- [Stage events](../../../.cache/configured-agent-evaluations/2026-10-09T12-46-10.752Z-162207c1/analyses/F01-1/events.jsonl).
- [Rejected execution stdout](../../../.cache/configured-agent-evaluations/2026-10-09T12-46-10.752Z-162207c1/analyses/F01-1/3-verifier/execution-41abeef1-1acc-4d7f-9ed4-bc274b4e79f3.txt).
- [Independent draft comparisons](../../../.cache/deepseek-high-lighting-live-2026-10-09/independent-review/draft-cross-check.json).
- [Evidence review](../../../.cache/deepseek-high-lighting-live-2026-10-09/evidence-review.json).
- [Temporary experiment configuration](../../.cache/lighting-deepseek-high-2026-10-09/harness.config.json).
- Fresh workspace: `/private/tmp/pricing-focused-2026-10-09T12-46-10.752Z-162207c1/lighting`.
- [Successful Luna baseline](minimal-visual-review-live-evaluation-2026-10-09.md).
