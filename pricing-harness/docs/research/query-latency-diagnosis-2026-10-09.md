# Query latency diagnosis — 9 October 2026

The latest in-chat Lighting & Candles run spent **344.840 of 383.547 seconds (89.91%) inside 50 sequential model requests**. The main bottleneck is the agent workflow's number of requests and growing context. Database execution and local application overhead are secondary in this run.

This is a retrospective measurement of the actual completed workflow, not a new paid test or a claimed performance fix. Model-request time includes network transport, provider queues, prompt processing, reasoning and generated output; existing events cannot separate those components. The observed question is a category review, not a bare aggregate: it produced 25 checked claims and had missing-cost coverage to handle. That does not justify 102 seconds of planning.

## Measured breakdown

Question: “Review how Lighting & Candles performed over the last five complete quarters.” Run `a4635343-3e8d-4c9b-afa6-c595e25d4af9`, DeepSeek V4.1 Flash, high reasoning, workflow 2.0.0.

| Stage | Wall seconds | Model requests | Seconds inside model requests | Tools |
| --- | ---: | ---: | ---: | ---: |
| Coordinator | 101.734 | 6 | 100.402 | 20 |
| Analyst | 196.901 | 29 | 183.516 | 33 |
| Numerical verifier | 82.026 | 15 | 60.922 | 19 |
| Outside stages | 2.886 | 0 | — | — |
| Total | 383.547 | 50 | 344.840 | 72 |

All five `execute_analysis` attempts together occupied approximately **24.628 seconds**, including tool dispatch, provenance and hashes. Four succeeded; one failed. The successful analyst executions took 4.216 and 2.849 seconds; the verifier executions took 7.649 and 2.449 seconds. Additional shell calculations are included in the remaining wall time, so these are not all computation time or isolated SQL timings. Everything outside model requests combined was 38.707 seconds. Even eliminating all of that would leave about 5 minutes 45 seconds at the measured model timings.

No provider retry, numerical correction request, handoff repair, report renderer or preview occurred. There was one analyst revision round. Thus repeated format repairs and retired report stages do not explain this run. Total recorded usage reconciles with all 50 model starts; cost was USD 0.157824288. The model portion averaged 6.897 seconds per request. Fifty requests, even with a moderately fast average, accumulate several minutes.

## Confirmed contributors

1. **Planning performs substantial source exploration.** The coordinator used 20 reads, including seven reads of `product_master.csv`, a transaction sample and a nonexistent `data_catalog.json`. Six product-master chunks were requested in one late batch. Context grew from 5,544 to 84,614 tokens; the final planning request took about 35 seconds. Confirmed category, period and metric basis were already supplied. A planner allowed to inspect raw files is doing some analyst work before handing off to another fresh session.
2. **The bounded stage prompt omits the general data-reading guard.** `src/agent/session.ts:11` defines a general prompt saying not to send large sources to the model. Line 12 replaces it with the short role prompt for bounded stages. This is a concrete prompt-composition gap; the active coordinator also has the unrestricted `read` tool. A structural metadata interface would be stronger than restoring a sentence alone.
3. **Analysis is fragmented across many model decisions.** Analyst tools: 10 reads, 15 shell calls, two writes, four edits and two recorded executions. Three shell SQL probes failed: a persisted view referenced a missing attached schema, a projected view lacked `product_name`, and an alias caused a parser error. File edits, repeated inspections, probes and packaging each trigger further model requests. The first successful recorded calculation finished around 140 seconds after submission; the next successful analyst calculation was over two minutes later. Those later steps included a necessary missing-cost correction as well as packaging, so that entire interval cannot simply be removed.
4. **Verification also includes avoidable discovery and packaging.** Verifier tools: eight shell calls, four reads, three writes, one edit and three recorded executions. One execution failed with `TypeError: unhashable type: 'list'`; a shell query referenced a column omitted from its view. It independently recomputed raw-source values, then wrote another checking script, another results file and final response JSON. Keep independent computation; reduce the surrounding interactions and duplicate serialization.
5. **All roles share high reasoning.** Actual configuration events confirm high for the planner, analyst and verifier. The trace records 19,497 reasoning tokens in total. This is an optimization candidate, not proof that changing reasoning alone will preserve correctness or achieve a target latency.
6. **The full workflow is the default even for simple uncached questions.** `coordinator.ts:23` changes `quick` to `analysis` without a cache result. `orchestrator.ts` then runs coordinator → analyst → verifier sequentially. “What was total Lighting & Candles revenue in Q3 2011?” classifies as analysis, and an explicitly quick work order for it is also converted to analysis. Quick presently means a compatible cache lookup or blocking clarification, not a compact fresh calculation.
7. **Reuse is brittle and still pays for planning.** `analysis-index.ts:7` compares population, period and basis as exact prose strings; even “Lighting & Candles merchandise” versus “Merchandise in Lighting & Candles” fails that equality. This proves susceptibility to wording differences, not that this fresh run suffered a cache miss. Every cache delivery still passes through a model-driven coordinator first. Changing an unrelated registered source also changes the full source-set key.

The planner additionally expanded the review into nine operations, including a top-ten product ranking. Some method checks are necessary; ranking was not explicitly requested. Describe business outcomes in the work order and keep implementation steps inside the analysis script, rather than presenting every technical step as an independently tracked task.

## Recommended order of work

1. **Constrain planner inputs and work.** Give it confirmed context, bounded source schemas/category metadata and indexed prior evidence. Prevent raw CSV pagination in planning. Aim for one planning request in ordinary confirmed-scope cases, escalating only for actual ambiguity. Build metadata from sources without adding predefined financial calculations.
2. **Batch analysis and checks.** Give the analyst schema metadata and the data-helper contract at entry. Generate one analysis script containing relevant eligibility, join and coverage checks; return bounded diagnostics together. Revise for an observed discrepancy, not through repeated exploratory shell fragments. Keep generated/adaptable analysis code and source-integrity guards.
3. **Reduce handoff serialization.** Let executed scripts save bounded candidate/check payloads once and let the controller validate and assemble their transport metadata. Avoid model-written JSON files followed by regeneration of the same JSON in another response. Numerical acceptance must remain tied to independent executed checks, not an analyst's self-approval.
4. **Create a compact path for simple calculations and verified follow-ups.** Use canonical structured scope keys and explicit compatible claim selection; changed filters, dates, accounting basis and cohort must still invalidate reuse. Simple uncached calculations can retain independent verification with fewer planning/discovery turns. Broader reviews continue through the deeper workflow.
5. **Then compare supported reasoning settings per role.** Start with planner reasoning, keeping the model and numerical checks fixed. Do not silently substitute models or unsupported reasoning levels. Measure one change at a time against the same questions and independent expected values.

Proposed performance goals, not measured promises: common category reviews under 120 seconds with roughly 10–15 total model requests; simple verified follow-ups in seconds rather than minutes. Use repeated warm/cold runs and median plus slow-tail latency before accepting these goals. Include the same category review, a top-ten drilldown, an uncached scalar question, a cached scalar question and changed-scope invalidation. Compare correct delivered claims, held coverage, model calls, context size and time to first verified answer. Add provider first-token timing if the remaining question is queue/transport latency versus model generation.

Lower deadlines alone would produce more incomplete answers; raising allowances only permits more work. Removing numerical verification would address 82 seconds in this run while leaving roughly five minutes elsewhere and weakening an existing correctness requirement. Optimizing DuckDB, parallelizing the three dependent stages, or changing chart libraries is not the first intervention supported by these measurements.

## Reproduction and limits

Read-only timing audit: `.scratch/latency-audit-2026-10-09/audit.py`; full derived measurements: `.scratch/latency-audit-2026-10-09/timing.json`. Original workspace is recorded in `pricing-harness/.cache/local-server-preview.json`.

```sh
python3 .scratch/latency-audit-2026-10-09/audit.py \
  /private/var/folders/ks/93d8rcl53rn2cgtgbcdn0txc0000gn/T/pricing-in-chat-preview-x5_8j9au/analyses/a4635343-3e8d-4c9b-afa6-c595e25d4af9 \
  --output .scratch/latency-audit-2026-10-09/timing.json --max-seconds 120
```

Observed exit **2**, intentionally flagging the recorded latency violation: `LATENCY FAIL: 383.547s > 120.000s`. Event-to-session model counts and tool counts reconcile. This fast deterministic replay detects an existing slow trace; it does not predict live timings after changes. No new paid call or product/configuration change was made. The running HTTP endpoint was unavailable from this session, so diagnosis used retained completed-run evidence. Fresh live measurements remain necessary to validate any speed improvement.
