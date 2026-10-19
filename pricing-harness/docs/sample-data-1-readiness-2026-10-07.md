# Sample data 1: readiness and conversation tests

Assessed 7 October 2026. Scenario date: 12 December 2011.

## Decision

**Ready for exploratory live harness tests, including brief prompts and multi-turn analysis.** It supplies realistic transaction scale, separate commercial ledgers, history, ambiguity, and useful data defects. It is not ready to serve as an unquestioned, fully reconciled financial answer key. Preserve the supplied data and score the agent's handling of unresolved inputs as well as its arithmetic.

This assessment inspected the harness and executed independent full-population SQL profiling. It did **not** submit live model requests, evaluate the harness's answers, change application behavior, or modify the source pack.

## What is present and verified

- `sample_data_1/user_pack`: approximately 236 MiB; 15 CSV sources. All catalog row counts, byte counts, and SHA-256 hashes matched the supplied files.
- Sales: 1,067,371 unique line IDs; 5,305 stock codes; 5,942 identified customers; 53,628 invoices. Dates run from 1 December 2009 through 9 December 2011. Every supplied line value equals signed quantity times unit price at six-decimal precision.
- Product/category and customer/parent masters, dated cost and list histories, agreements, recognized adjustments, service expenses, approval rules/logs, exceptions, open quotes/orders, monthly finance, and derived invoice/credit views.
- Company, finance, coverage, policy, operations, and source notes; a hidden prior-project context fixture; a separate industrial-company case. Every file named by the 15 manual requests exists, including the hidden context file.
- Fifteen existing requests, 48–115 words each, mostly detailed instructions. They are useful comparison cases but insufficient evidence of performance from ordinary 1–2 sentence requests.
- Seventeen merchandise categories. Category fields and other commercial attributes are fictional scenario mappings; source transaction history is derived from Online Retail II. Costs and finance are scenario evidence, not the original retailer's audited accounts.

## Material issues to test

| Observation | Expected harness behavior |
| --- | --- |
| December 2011 ends on the ninth; Q4 2011 is incomplete | State the scenario clock and period choice. Last five complete quarters are Q3 2010 through Q3 2011. If current quarter is requested, label Q4 as partial and avoid an unqualified full-quarter comparison. |
| 243,007 missing customer IDs; 34,335 identical source repeats beyond first occurrence; 22,950 negative-quantity lines | Preserve source observations. Keep unidentified activity visible; do not silently delete repeat candidates or signed credits. |
| Duplicate product `21790` and customer `12348` master keys | Check join cardinality. Their non-record-ID payloads are identical; an analysis can propose collapsing duplicate master payloads without deduplicating sales. |
| Under the current merchandise mapping, 2,138 transaction lines lack an effective cost | Diagnose separately: 2,122 `POST` lines, 15 `TEST001` lines, and one `22185` line dated 1 July 2010. Do not infer zero cost or discard their revenue. `POST` is marked merchandise despite postage/freight context; resolve this classification. |
| Five current effective cost records have blank unit-cost values | A matched interval is insufficient: verify the numeric value. Lighting & Candles has 53 such Q3 2011 lines for `84596L`, representing GBP 163.33 of invoice revenue. Withhold its full-quarter margin unless a justified costing rule is established. This value-level gap was identified and independently checked during the subsequent live tests. |
| SKU `84247K` has two applicable costs for one sale on 30 June 2010 | Expose the overlapping effective intervals and hold the affected cost result until a selection rule is established. |
| Five cost records have `cost_uom=PACK`; five say `currency=EUR` despite `unit_cost_gbp` | Field names do not resolve the conflict. Request actual unit/FX meaning before computing affected margins; supplier-pack metadata is not automatic conversion authority. |
| One duplicate recognized adjustment event; 30 duplicate service business keys | Check economic event keys before summing. The duplicated adjustment is `EV-LINE-852A42E12EF5DA`, with two −GBP 0.71 records. Service duplicates share `cost_event_id + cost_type`. |
| Thirty variable-service records say EUR despite a GBP-labelled amount field | Hold or separately disclose unresolved amounts; do not add currencies blindly. |
| Recognized customer-period rebates have `product_id=ALL` and explicitly no product allocation | Category/SKU net margins need an agreed allocation rule. Invoice margin before rebates is a different measure and must be named accordingly. |
| Source-ledger calculations do not fully tie to `finance_monthly` | Report discrepancies; do not force a reconciliation or treat the finance export as automatic truth. |

A diagnostic rebuild, after collapsing identical master payloads but before resolving cost coverage, overlap, currency, unit and event issues, showed monthly differences of up to GBP 70.80 in invoice sales, GBP 2.40 in adjustments, GBP 1,709.0304 in COGS, and GBP 134.792 in variable service. These are **diagnostic differences, not approved corrected financial results**. The inner cost join used in that diagnostic omits uncosted lines and duplicates overlapping matches; its YTD/group amounts must not be used as a financial oracle. Some discrepancy causes remain unresolved.

## First conversation to run

Use Lighting & Candles (`LIGHTING_AND_CANDLES`) first. Across Q3 2010–Q3 2011 its 41,684 merchandise lines have exactly one effective cost record each, all GBP/EA, but `84596L` has 53 Q3 2011 lines whose cost value is blank. Its group-level Q3 margin therefore remains unavailable; the selected top ten have usable cost values. This creates a tractable drilldown test while retaining a meaningful group-level coverage limit.

Run each message separately in the **same conversation and workspace**. Do not concatenate future messages into the first prompt.

| Turn | User message | What to assess |
| --- | --- | --- |
| 1 | “Review how Lighting & Candles performed over the last five complete quarters.” | Recognize the category; establish the period and metric with minimal clarification; calculate the full population; give a useful group review. |
| 2 | “Show me how the top 10 items by revenue in that group performed.” | Inherit category, five-quarter window, and financial basis. Rank within the group over that window, show exactly ten unique SKUs, and explain coverage. |
| 3 | “Why did 85123A perform so badly in Q2?” | Resolve Q2 to 2011 from the preceding results, or clarify if the previous response made the reference ambiguous. Drill into the same SKU and basis, quantify invoice realization, quantities, credits, and historical cost. Separate measured drivers from unsupported causes. |
| 4 | “Did it recover in the following quarter?” | Resolve “it” to `85123A` and “following quarter” to Q3 2011. Reconcile against the previous SKU table rather than starting unrelated intake. |
| 5 | “What about the lowest-margin item in those top 10?” | Resolve the existing top-10 set and use its period-total margin. On the invoice basis below this is `21733`; it is not the lowest-margin item in the entire group. |
| 6 | “Now rank the top 10 using only the latest complete quarter.” | Explicitly replace the ranking window with Q3 2011, execute a new ranking, and identify the changed scope. Preserve prior results as earlier-period results. |

Optional separate branches: “Include rebates and service costs”; “Include the current quarter too”; “Use Kitchen & Dining instead.” Check that a changed metric triggers the necessary allocation/units review, a partial period remains visible, and a new group produces new results rather than stale artifacts.

### Two starting states

1. **Fresh context:** no imported confirmed facts. Supply the relevant company, finance, coverage, dictionary, and data inputs. Allow a concise, task-relevant clarification before affected financial results. Documents alone do not confirm reusable definitions. Do not fail a responsible clarification merely because the prompt was brief.
2. **Confirmed scenario context:** establish the test conventions through explicit fixture confirmations before the conversation, then repeat the same short messages. The agent should reuse them without restarting intake every turn. The old UK-wholesale prior context is not a suitable all-channel shortcut.

For the initial numerical conversation, the evaluator can explicitly confirm: scenario date 12 December 2011; all-channel category membership from `product_master.category`; last five complete calendar quarters; signed merchandise invoice sales; historical GBP/EA costs; and **invoice margin before off-invoice rebates and service expenses**. Rank by signed invoice sales over the selected window, breaking ties by SKU. This is a deliberately scoped test measure, not a redefinition of the supplied net-sales gross-margin convention. Keep the user messages short; setup confirmations are separate turns or evaluator-owned fixture context.

### Independent reference for that scoped test

Top 10 by signed invoice revenue over Q3 2010–Q3 2011, in order:

`85123A`, `79321`, `84347`, `22178`, `21733`, `21731`, `71477`, `22969`, `84978`, `72741`.

All ten have valid GBP/EA cost matches in this window. `85123A` has invoice sales of GBP 144,934.78, historical scenario COGS of GBP 96,459.1864, and a period-total invoice margin of 33.44648786%. The lowest period-total invoice margin within this top ten is `21733`, at 26.83644450%.

| Quarter | `85123A` signed invoice sales, GBP | Scenario COGS, GBP | Invoice margin before rebates/service |
| --- | ---: | ---: | ---: |
| Q3 2010 | 34,107.66 | 20,952.0864 | 38.57073045% |
| Q4 2010 | 43,110.89 | 25,830.3696 | 40.08388693% |
| Q1 2011 | 25,874.97 | 16,175.1744 | 37.48717622% |
| Q2 2011 | 20,875.52 | 19,930.0640 | 4.52901772% |
| Q3 2011 | 20,965.74 | 13,571.4920 | 35.26824238% |

Q2's positive-quantity weighted invoice price is approximately GBP 1.9161, versus GBP 2.7592 in Q1 and GBP 2.7875 in Q3. Negative-quantity source value is −GBP 5,039.50 in Q2. Those are investigative signals, not proof of poor negotiation, physical returns, or a causal demand response. A useful diagnosis should inspect the underlying lines and bridge the reported amounts before assigning causes.

## Other short cases

- “How did margins evolve for Kitchen & Dining over the last five quarters?” Tests period ambiguity and PACK/EUR cost handling.
- “Identify why we are struggling with SKU 85123A.” Tests what “struggling” means and whether a temporary dip is distinguished from continuing weakness.
- “How did margins evolve for product group X over the last five quarters?” Use literal nonexistent `X`; ask for the group rather than inventing one. Repeat with literal nonexistent SKU `Z`.
- “What would a 4% January price increase do to profit?” Tests conditional economics and contract constraints without asserting guaranteed pass-through or volume.
- Repeat a detailed original request on the same confirmed basis in a separate workspace. Compare supported results and clarification burden against the short version.

## Harness fit and scoring

The existing UI and headless JSON-line interface support sequential turns in one session. The evaluation case schema also accepts a `turns` array; the runner waits for a turn to end before sending the next. A new session retains workspace context, so independent fresh-context cases need a fresh workspace as well.

The supplied `prompts/test_cases.json` is a manual-request format (`ideas`, `source_files`, `follow_up_messages`), not the harness's `EvalCase` format. Existing numeric checks use predetermined artifact names and small expected tables; short prompts need manual artifact/value extraction or a separate evaluator adaptation, without inserting output schemas or skill names into the user request. `expectClarification`, `critical`, and `repeats` are declared metadata but are not enforced as behavioral assertions or repetition loops by the current runner/verifier. Human review criteria remain essential.

Score each turn on: correct scope/period/metric; independent amounts and rankings; preservation of references and earlier decisions; necessary clarification without repeated intake; executed full-population evidence; coherent artifacts; and truthful limits/causal claims. Record elapsed time and model usage where available. A completed run is transport/execution status, not a correctness verdict. For a first pass, run the six-turn path in both starting states, then repeat the confirmed path three times in fresh workspaces to check consistency.

Copy only the selected input CSVs and documentation into an isolated harness workspace's `files/` tree, preserving relative paths. Exclude `prompts/`, this assessment, evaluator profiles, expected answers, and the unrelated industrial case. All registered sources are listed to the agent, so UI file selection is not file-access isolation. `.json` catalogs are not automatically registered sources; supply dictionary Markdown and CSVs, or provide the catalog path deliberately if needed. For strict evaluator isolation use the existing Docker runtime, which excludes evaluator files; a normal native run is not an OS sandbox.

Local evaluator evidence is `.cache/sample-data-1/profile.py` and `profile.json`. The script uses direct DuckDB queries rather than the harness's analysis helpers. Integrity/cardinality checks and the explicitly scoped Lighting reference are usable evidence; its broad uncorrected financial aggregates are diagnostic only. Keep this document and those files outside model inputs.
