# Luna/high evaluation with 150 tool calls — 8 October 2026

Both **analysis and report tool limits are now 150** in `harness.config.json`. The fresh Lighting trial produced independently correct calculations, but still returned no verified answer or chart. It stopped on the shared handoff-repair cap, using only 40 of 150 tools. Increasing the tool allowance removed the previous constraint; a different receiving-format failure now blocks publication.

## Change and verification

Only `workflow.limits.analysis.toolCalls` (60 → 150) and `workflow.limits.report.toolCalls` (90 → 150) changed. Both classes need the setting because the coordinator can route the same group-review question as analysis or report. Quick limits, elapsed-time/model/revision/repair limits and product code remain unchanged.

Five focused settings tests passed. A no-paid dry run confirmed both effective 150-tool limits, the same one-message manifest, **openai/gpt-6-luna/high**, 600 seconds, 180-second finalization reserve, 100 model calls and two shared analyst revisions. Configuration is loaded at startup; existing app processes require restart to use it. No compiled code changed, so no rebuild or full suite was needed. The saved app baseline remains **deepseek/deepseek-v4.1-flash/high**. No commit, push or deployment occurred.

Prompt:

> Review how Lighting & Candles performed over the last five complete quarters.

The completed attempt used a fresh source-only workspace, identical confirmed fixture context and raw input hashes, with evaluator controls kept outside product-agent inputs.

## Before/after

| Measure | Previous 60-tool trial | New 150-tool trial |
|---|---:|---:|
| Workflow | 1.0.10 | 1.0.10 |
| Request duration | 478.093s | **278.726s** |
| SDK-estimated cost | $0.066953715 | **$0.034818360** |
| Model / tool calls | 45 / 60 | **31 / 40** |
| Analyst script lines / bytes | 299 / 20,638 | **174 / 13,559** |
| Shared revisions / handoff repairs | 2 / 1 | 2 / 1 |
| Analyst numerical comparisons | 19/86 passed | **97/97 passed** |
| Verifier numerical comparisons | 107/107 passed | **95/95 passed** |
| Display comparisons | Included in prior draft review | **26/26 passed** |
| Public response words | 18 | 18 |
| Verified answers / charts | 0 / 0 | **0 / 0** |
| Stop reason | Tools exhausted | **Handoff repair exhausted** |

Time fell 41.7% and SDK cost 48.0% for the completed attempt; script lines fell 41.8%. Independent draft quality improved, including the previously omitted product and correct percentage-point labels. **Delivered quality remains a failure.** A faster unsuccessful answer is not a successful workflow. Counts cover different output structures and should not be treated as identical benchmark denominators. Coordinator/model behavior varied; these single runs do not isolate the causal effect of raising the cap.

No time to first verified answer exists. No chart was produced, so chart values, layout and mobile rendering cannot be judged. This fresh one-message case does not exercise live conversation continuity.

## Stage results and exact failure

| Stage | Seconds | Model / tool calls | SDK cost |
|---|---:|---:|---:|
| Coordinator | 24.496 | 3 / 2 | $0.001890545 |
| Analyst, including envelope repair | 166.964 | 18 / 23 | $0.021918555 |
| Numerical verifier | 85.521 | 10 / 15 | $0.011009260 |

The analyst had three initial failed execution attempts, followed by an initial successful execution and two successful revisions. Its first packet used paths such as `2-analyst/quarterly_results.csv`, which the controller resolved from the workspace root rather than the run directory. The one existing handoff repair changed paths to the full workspace-relative form. The package then passed, with seven text-valued claims and readable results. That used the shared request-wide handoff-repair allowance.

The verifier independently read raw CSVs, computed correct figures with its own CSV/Decimal script and returned a private 380-word review. Its executed checks had two format problems:

- An additional top-level `independent_recalculation` object is prohibited by the receiving check schema.
- Each claim's `actual` was a nested table or object, while the numerical-check contract allows scalar values or string arrays. The analyst's corresponding claim values were prose strings. All seven producer/comparison representations therefore differed, even though the underlying figures reconciled.

Recorded rejection:

> `/independent_recalculation schema is false; / must not have additional properties; /checks/0/actual must be number; /checks/0/actual must be string; /checks/0/actual must be null`

The verifier was about to receive bounded format feedback, but the controller's attempt to debit another handoff repair failed. It stopped with **321.511 seconds, 69 model calls and 110 tool calls remaining**. The verifier did not get a repair turn. No numerical correction or rendering stage started. There were no provider connection errors or retries.

The verifier's returned `held` field also contained descriptive limitation sentences rather than claim IDs. This is a further receiving-contract defect, inferred from the saved reply and checkpoint validation code; it was not the first live rejection. Its missing-cost limitations are financially valid, but they need to be encoded as supported holds/coverage rather than invented IDs. Simply tolerating the extra top-level object would not solve the mismatched claim comparisons or this hold issue.

## Independent review

A separate evaluator recalculated the full raw population without running or importing either agent's code. **218/218 comparisons passed**:

- 97 analyst table, movement and window comparisons;
- 95 verifier quarterly/window, source-count and repeated-observation comparisons;
- 26 independently rounded displayed-number comparisons.

The correct five-quarter population includes **41,684 observations, 494,476 signed units and £931,065.10 revenue**. The formerly omitted SKU 85123A is included on the confirmed EA stock-code basis. Quarterly revenues are £167,950.37, £331,019.82, £134,150.38, £143,067.02 and £154,877.51. Q3 2010 to Q3 2011 revenue falls **£13,072.86 / 7.78%**, and signed units fall **22,915 / 21.27%**.

Full-population Q3 2011 COGS/margin, full-window COGS/margin and cost-dependent movements remain held because **53 observations for 84596L have a blank applicable unit cost**. This legitimate source limitation was not treated as zero. Source repeats were retained. The final table correctly uses percentage points for margin-rate movements. The intermediate `quarterly_initial.csv` contains a partial margin diagnostic based on full revenue less available costs; final published-candidate tables replace affected complete-scope margins with nulls. That intermediate diagnostic is not an approved complete-scope metric.

Integrity checks passed **61/61**, covering source/workspace hashes, unchanged compiled files, exact model/settings, fresh inputs, excluded evaluator controls, recorded script identity, two-revision enforcement, 31 complete usage records and cost reconciliation. Peak input plus cache was 39,744 tokens, versus 71,603 previously. These are SDK cost estimates, not provider billing guarantees. Private verifier calculations are evaluator-checked drafts, not a product checkpoint.

Complete public response:

> I could not independently verify an answer within this request: handoffRepair budget exhausted. Retained analysis files are drafts.

## Interrupted initial attempt

This task had an additional explicitly recorded interrupted submission. The first configuration change raised only the analysis limit. Its coordinator selected report, still carrying the old 90-tool cap. The evaluator process was stopped and both classes were set to 150 before the completed fresh restart.

Interrupted evidence: `.cache/configured-agent-evaluations/2026-10-08T21-25-11.984Z-6f7dbba7/`. Its saved stage sessions account for five completed usage records and **$0.004052390**. An in-flight call has no final usage record, so total interruption cost is unknown. Recorded task cost is **at least $0.038870750**, combining that known amount with the completed attempt. The before/after table compares completed attempts and does not include the interrupted setup attempt. It is not represented as an additional completed 150-tool trial.

## Remaining failures

The requested 150-tool setting is active and persisted. The next product fix is the verifier handoff: comparison values must retain the analyst claim representation after independent computation, auxiliary recalculation detail belongs in evidence files, and holds must use actual claim IDs. Format repair also needs a bounded allowance that one stage cannot consume entirely before another stage needs it, while preserving a whole-request cap. These changes were **not implemented** in this configuration-only task. Raising tools again would not address the observed failure.

Verified publication, numerical checkpoints, chart generation and live continuity remain unproven. No further paid submission was made after the completed 150-tool run.

Evidence: `.cache/configured-agent-evaluations/2026-10-08T21-26-45.333Z-5a9a9fdb/`. It preserves sessions, execution outputs, work order, accepted analyst candidate, complete public response and usage. `evaluator/quality-review.json` contains all 218 comparisons and seven representation mismatches; `integrity.json` contains 61 integrity checks; `rejected-verification-record.json` and `rejected-verifier-reply.md` preserve the rejected private reply. Run: `bf1b6ce6-f8bd-4837-b35d-34dcead971ff`.
