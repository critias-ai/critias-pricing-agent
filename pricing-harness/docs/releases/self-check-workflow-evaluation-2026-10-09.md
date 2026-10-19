# Self-checking and conditional verification — 9 October 2026

The analyst now calculates and self-checks in one executed script. The controller delivers self-checked results when recorded evidence passes its gates, and activates the independent verifier for missing/failed controls, declared uncertainty, or explicit independent-review requests. Final workflow version: **2.1.1**.

The three paid Lighting & Candles trials completed with correct numerical results, but **did not establish a latency improvement**. The first two exposed avoidable handoff rules that escalated to the verifier; those rules are corrected. The final-version live trial took **437.216s (7m17s)** and activated the verifier because the analyst explicitly declared uncertainty about a missing selling-unit label. Separately, replay of the second trial's unchanged recorded coordinator/analyst evidence seals and delivers 59 self-checked claims without a verifier. That replay proves the conditional path, not live generation speed.

## Delivered behavior

- Analyst stdout supplies executed checks, scope, reply, task completion, uncertainty reasons and six diagnostic categories: source coverage, parsing, join integrity, period coverage, reconciliation and eligibility. The controller requires finite applicable controls, recorded raw-source access and unchanged sources/scripts/outputs. Missing or invalid self-checks activate independent review.
- Every delivered claim must agree with an executed check. Null measures cannot be approved; holds require executed source-supported reasons. Supporting calculations may be checked without appearing in the delivered subset. Unchecked candidate claims remain blocked.
- The controller attaches recorded check output to claim evidence automatically. Producers do not have to repeat stdout paths in every claim.
- Eligibility gaps can be handled without independent review only when explicitly affected submitted claims are all source-supported holds. Other control failures, unresolved reasons or an affected approved claim activate the verifier. Properly labelled verified-cost subsets may be reported with their coverage; they do not establish full-population margins.
- The controller owns numerical tolerances: `max(0.01, abs(candidateValue) * Number.EPSILON * 8)`. This allows ordinary display rounding and floating noise without a broad relative financial tolerance. Producer declarations cannot widen it; genuine differences return the claim ID, actual value and allowed tolerance.
- Checkpoints and claims record self-checked or independently-reviewed assurance. Continuations preserve earlier assurance and mark mixed checkpoints. Cached self-checked/mixed results cannot satisfy recognized explicit independent-review requests. Self-checked replies identify their assurance. Existing checkpoint/outcome field names remain for compatibility.

Self-checks can share the analyst's mistaken assumptions. These gates validate recorded evidence and declared controls; they cannot prove the semantics of arbitrary generated calculations. Independent raw-source audits remain necessary when evaluating accuracy.

## Paid trials

Same question: “Review how Lighting & Candles performed over the last five complete quarters.” Each trial used a fresh workspace with the expanded `.context.md` installed identically as `.pricing/context.md`, unchanged synthetic source files, and **GPT-6 Luna / medium for every actual role**. Saved defaults remain DeepSeek/high. Existing 1,200-second/100-model/150-tool analysis budgets and revision/repair ceilings were retained.

| Measure | Previous Luna/medium baseline | First self-check attempt | Follow-up attempt | Final-version trial |
| --- | ---: | ---: | ---: | ---: |
| Run elapsed | 288.051s | 297.533s | 402.972s | 437.216s |
| Analyst | 146.768s | 202.053s | 295.908s | 231.368s |
| Verifier | 120.112s | 75.575s | 86.476s | 183.568s |
| Model requests / tools | 28 / 32 | 23 / 26 | 46 / 52 | 49 / 55 |
| SDK cost | USD 0.02530235 | USD 0.02968556 | USD 0.04497460 | USD 0.056854765 |
| Outcome | No checkpoint | Complete, independently reviewed | Complete, independently reviewed | Complete, independently reviewed |

Wrapper times were 297.741s, 403.245s and 437.474s. Plans, claim sets and view choices varied despite the identical user question. These are individual stochastic observations, not an isolated performance benchmark.

The first attempt escalated because claims referenced an ordinary result file rather than duplicating the recorded stdout path. It also exposed an eligibility control comparing fully covered lines to all lines, despite affected margins being withheld. Controller binding and explicit held-claim handling were corrected before the follow-up.

The follow-up executed 76 checks but submitted a useful subset of 59 claims. A diagnostic referenced supporting calculations outside that subset; the earlier gate rejected the reference and activated the verifier. The final gate permits references to executed supporting check IDs and derives approval/hold lists only for submitted claims. Independent-verifier unknown-ID guards remain active.

The final-version trial escalated on explicit analyst uncertainty. Its diagnostic used `coalesce(selling_uom,'') <> 'EA'`, treating a blank label as non-EA. Independent source inspection found 477 Lighting product records labelled EA, one null label affecting 3,438 scoped lines, and zero observed non-EA labels. Confirmed context already specifies stock-code selling units as EA. The verifier reconciled the missing metadata against that basis without numerical corrections. This is the requested uncertainty trigger working; it also shows how an overly broad diagnostic can cause expensive review.

The first run spent 80.98% of elapsed time inside model requests; the follow-up spent **96.03%**. The follow-up analyst used 29 model requests and encountered eight tool failures, including reserved SQL aliases, grouping errors, a stale dataframe column, JSON NaN serialization and read/probe errors. Its seven `execute_analysis` attempts together occupied about eight seconds. The trace combines provider waiting, prompt processing, reasoning and generation; it cannot isolate those components. Removing mandatory verification alone does not address the analyst's 296-second duration in this attempt.

The final trial spent **389.341s (89.05%) inside model requests**. The analyst used 23 model calls and encountered seven tool errors; the verifier used 24 model calls and encountered six tool errors. Execution attempts together took about 42 seconds, including failures, tool dispatch and provenance. The evidence points to repeated model/tool turns and generated-code repairs as major contributors, rather than slow arithmetic on this dataset. Provider waiting, reasoning and generation remain inseparable in this trace.

## Accuracy and final-gate replay

Evaluator-only exact-decimal raw-source calculations remained outside model workspaces. They establish 41,684 retained lines, GBP 931,065.10 revenue, 494,476 signed units and 53 missing-cost lines affecting GBP 163.33 revenue.

- First attempt: **60/60** candidate/delivered-value comparisons pass. Q3 and full-window population margins were withheld.
- Follow-up: **194/194** comparisons pass: 59 candidates, 59 delivered claims and 76 executed self-check facts. COGS, gross profit and margin are explicitly labelled as verified-cost subsets, including Q3 margin 41.01% and window margin 42.92%; coverage limitations accompany them. The final narrative contains an unnecessary internal diagnostic-ID sentence. Four bound tables were delivered; no charts. Browser rendering was not assessed.
- Final-version trial: **157/157** comparisons pass: 55 candidates, 46 delivered claims and 56 executed self-check facts. Nine Q3 full-population cost/margin measures and dependent changes are correctly held because 53 lines lack numeric costs. The response describes the quarterly pattern and endpoint changes; no rich tables or charts were delivered. The verifier corrects the analyst's non-EA wording to missing metadata and confirms the EA basis.
- Corrected numerical gate: original follow-up evidence accepted as self-checked in 0.353s, with no model call, script rerun or checkpoint creation.
- Corrected full controller: replayed original coordinator/analyst results and controller-received execution provenance, delivered and froze **59 self-checked claims**, four tables and the assurance notice in 2.377s. Roles were coordinator and analyst; zero model calls and no verifier. This replay proves routing, sealing and delivery using the recorded calculations, not fresh generation speed.

## Local validation and evidence

**114 focused tests across 13 files pass**, including self-check delivery, escalation, uncertainty, holds, source/script integrity, large-value tolerances, supporting calculations, cache assurance, continuations, cancellation and exploration. Typecheck and backend TypeScript compilation pass. No dependency installation, frontend rebuild, full suite, plugin migration, commit, push or saved-setting change was performed.

Evidence directories:

- First: `.cache/self-check-latency-2026-10-09/2026-10-09T18-02-58.748Z-23f88f9a/`; live run `a08a8ff4-d73c-4d8b-a1ca-aa9d763c6f95`.
- Follow-up: `.cache/self-check-followup-2026-10-09/2026-10-09T18-09-45.670Z-11d6e423/`; live run `3a4d4617-ebc5-4a1b-809f-91453daeef00`.
- Final version: `.cache/self-check-final-2026-10-09/2026-10-09T18-23-25.143Z-7b87104b/`; live run `a00d4d89-26d1-4426-9315-6041543fef37`.

All three retain complete results/messages, original analysis sessions/executions, timing, source controls, independent delivery review, comparison controls and preservation fingerprints. Compiled/bundled files were unchanged during each live run; sources, portable context and saved settings match the baseline. The final supporting-check/tolerance fixes were made after the follow-up analyst completed; its running compiled application remained unchanged. The third live trial used the final implementation throughout.

Follow-up files `corrected-self-check-replay.json` and `corrected-controller-replay.json` distinguish replay from live results. Reproduction and evaluator scripts are in `.scratch/self-check-{latency,followup,final}-2026-10-09/`. No live trial has yet demonstrated self-only delivery or a latency improvement; the final live uncertainty escalation is independently documented.
