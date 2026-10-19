# Slow-run diagnosis: "what sku had the highest absolute gross margin"

Date: 2026-10-13. Model: `openai/gpt-6-luna`, thinking `high`. Workspace: Northbridge sample pack.

## Runs examined

| Run | Skills | Wall time | Cost | Stages | Outcome |
|---|---|---|---|---|---|
| Original `8bc1fae7` (2026-10-12) | 0.2.0 | 1008 s | $0.170 | plan 32 s, analyse 502 s, verify 180 s, correct 160 s, verify 132 s | Complete, but headline answer **held** |
| Recreation `7f6d7636` + `4e6796ef` | 0.2.0 | 42 s + 615 s | $0.125 | plan asked a clarifying question; then plan 59 s, analyse 342 s, continue 114 s, verify 98 s | Partial: `handoffRepair budget exhausted: Ranking cohort lacks independent approval`; headline **held** |
| 0.4.0 check `a1a4023a` | 0.4.0 | 425 s | $0.054 | plan 30 s, analyse 394 s | Failed: provider `Connection error.` then `Request timed out.` |

Evidence: original under `workspace/northbridge-test/analyses/8bc1fae7-…`; recreation and 0.4.0 runs under `.cache/slow-run-repro-2026-10-13/` (isolated workspace copies; the real workspace was not touched).

## Where the time goes

Original run, from session transcripts:

| | Seconds | Share |
|---|---|---|
| Model inference (61 calls) | 968 | 96 % |
| of which time to first token | 281 | 28 % |
| of which generation (103 k output tokens) | 687 | 68 % |
| Tool execution (reads, bash, DuckDB) | 34 | 3 % |

DuckDB executions take 1–6 s. File reads return instantly. Wall time tracks the number of stages, output tokens, and context size.

## Findings, most impactful first

### 1. Held answers that were provable (method gap, both skill versions)

The original run held "highest gross-profit SKU" because 6 SKUs lacked a unique dated cost. Those SKUs' total revenue was at most £112,341 (`POST` postage, `TEST001`, and four small SKUs). Gross profit cannot exceed revenue when costs are non-negative, so none could beat 22423 REGENCY CAKESTAND 3 TIER at £139,548. The user received "I can't confirm an overall highest-gross-profit SKU" after 17 minutes.

Skill text driving this: metric verification says a bounded partial result "does not replace a requested complete comparison" (0.2.0 and 0.4.0). Neither version tells the analyst to bound the uncovered population and conclude when the bound cannot change the ranking.

In the recreation the hold was more defensible: 85123A (revenue £253,720) has a blank unit of measure in `product_master`, and that run treated all its costs as unusable. The original run accepted EA. The two runs made different data-handling judgements on the same data.

### 2. A hold drives continuation and review loops (harness design)

A held claim leaves its tasks in `pendingOperations`. The orchestrator treats pending tasks as unfinished work and starts an `analyst/continue` stage. In the recreation, that stage recomputed the same ranking under new claim IDs (`continued_*`). Its eligibility diagnostic still named the old claim IDs, so the covered-hold exemption (`checkpoints.ts`, `coveredHold`) did not apply. The run escalated to a full verifier, failed the ranking-cohort check three times and ended partial. That accounts for roughly 210 s of 615 s.

### 3. Mandatory reconciliation diagnostic with exact tolerance routes to full review (harness design)

`reconciliation` is a required diagnostic kind (`output-contract.ts` `diagnosticKinds`). Any difference above 1e-9 relative is a failure, and `reconciliation` is in `workflow.review.full`. In the original run the coordinator added an unrequested operation ("compare aggregate SKU results with the monthly finance gross-profit totals"). The analyst then spent about 320 s trying to close a £2,477 residual on £8.35 M (0.03 %). When it could not, the controller ran verifier → correction → verifier: 472 s, 47 % of the run. The analyst could have satisfied the requirement with internal identities, which passed (`D_line_arithmetic`, `D_finance_identity`).

### 4. Planner scope creep is nondeterministic

The coordinator role prompt says "Do not add optional investigations". Across five Luna runs on the 12th and 13th, the coordinator added validation and reconciliation workstreams in most, asked a clarifying question in one and not in the others. The three `max` thinking runs all exhausted the 842 s budget.

### 5. Context bloat raises time to first token on every call

- `sourceProfiles` is 112,796 chars (~28 k tokens) in every stage prompt. `compactProfiles(maxChars = 40000)` already removed every sample value and still exceeded its own cap 2.8×. Its last step trims only sheets with more than 50 columns, and no Northbridge source has that many.
- Each stage is a cold session that re-reads the same files. The original run made 50 reads (415 KB), mostly `data_dictionary.md` (15.8 KB), `data-analysis.md` (13 KB), `finance_definitions.md`, `data_coverage_profile.md`, `pricing-analyze`, and the previous stage's script.
- The run processed 4.76 M prompt tokens in total. Caching keeps the cost down, but not time to first token (281 s).

### 6. Retry re-sends the whole stage prompt; one timeout message was not retried

- `worker.ts` retries with `active.prompt(request.prompt)`, which appends the full 121 k-char stage payload as a new user message in a session already ~110 k tokens deep.
- `isTransientFailure("Request timed out.")` returned false. **Fixed** in this change (regex now accepts `timed.out`; test added). The 0.4.0 run would still have failed: its single retry had already been spent on `Connection error.`

### 7. Delivered reply dumped a 4,909-item ranking

The recreation's self-checked reply listed every cost-covered SKU under "Checked figures".

0.4.0 adds a mandatory `shared-rules.md` read (4.5 KB) per skill use and doubles total skill text (37 k to 72 k chars). On the analyst path it adds about 5–8 k chars per stage, small next to the profiles. Shared-rules §3 ("do not stop when only the interpretation is open and the arithmetic is the same") should reduce some holds, but it does not address finding 1.

## Changes made (approved 2026-10-13)

| # | Change | Where | Test |
|---|---|---|---|
| 1 | "Bound before holding": bound what unusable records could contribute; report a conclusion no bound can change as complete. Released as Pricing Plugin **0.4.1** (`ffbe3a1`, local commit on `v2`, not pushed). The harness bundle moves from 0.2.0 to 0.4.1. | `skills/knowledge/metric-verification.md`, `skills/pricing-analyze/SKILL.md`; bundle, `versions.json`, notices, README | Plugin package check; bundle validation |
| 2 | Held is terminal: when a group holds claims, operations it lists as pending ended in that hold and are not continued. Operations it never mentions still run (caught by the browser workflow test before commit). | `delivery.ts` `remainingWork` | `workflow-handoff.test.ts` |
| 3 | A failing reconciliation diagnostic that names no claims becomes a `supporting-reconciliation` trigger, routed to `note` in `harness.config.json`. Reconciliation failures that name claims still go to full review. | `checkpoints.ts`, `review-policy.ts`, `harness.config.json` | `workflow-self-check.test.ts` |
| 4a | Profiles use a columnar prompt form (`columnFields` header, one row per column, non-zero parsing counters as `flags`, samples capped at 40 chars). The cap is honoured by dropping samples, then trimming wide sheets. Northbridge: 112,796 → 36,856 chars, with all 429 columns, every statistic and one sample per column. | `source-profiles.ts`, `stage-prompt.ts`, `orchestrator.ts` | `source-profiles.test.ts` |
| 4b | Coordinator: operations name requested results only; the analyst's diagnostics own validation, coverage and reconciliation; no tie-outs to other sources. | `role-prompts.ts` | Live run |
| 4c | Retry resumes with a short continuation message instead of re-sending the stage prompt; `Request timed out.` counts as transient. | `transient-error.ts` `retryTransient`, `worker.ts` | `workflow-transient-error.test.ts` |
| 7 | Ranking claims under "Checked figures" show the first 10 entries and count the rest. | `checked-figures.ts` | `checked-figures.test.ts` |

Vitest 336/336, Python 18/18, typecheck, build and Prettier pass.

## Fresh-session rerun after the changes

Run `6729fceb`: same question, same starting context as the original (two confirmations), Luna/high, bundle 0.4.1. Evidence is in `.cache/slow-run-repro-2026-10-13/fixed-ws/`.

| | Original | After changes |
|---|---|---|
| Wall time | 1008 s | 746 s |
| Cost | $0.170 | $0.071 |
| Stages | 5 (plan, analyse, verify, correct, verify) | 3 (plan, analyse, verify) |
| Model calls | 61 | 36 |
| Output tokens | 103 k | 48 k |
| Prompt tokens processed | 4.76 M | 1.76 M |
| Reads | 50 (415 KB) | 32 (220 KB) |
| Planner operations | 3, including a finance tie-out | 1: "identify the merchandise SKU with the highest total gross profit" |

What happened:

- At 2 m 45 s, the analyst's first execution approved **22423 REGENCY CAKESTAND 3 TIER** as "rank-stable", applying the new bound rule.
- Its own diagnostics then showed join and eligibility gaps. While investigating, it added a finance-monthly tie-out and found a genuine source contradiction: `product_master` labels `POST`/POSTAGE (£112 k revenue) as MERCHANDISE, but the finance rollup excludes it. POST has no cost history and has credit lines (−£15,256). Uncosted credits mean its gross profit cannot be capped from the data, because a credit's reversed cost raises gross profit.
- It held the leader and asked whether POST belongs in the ranking. The verifier agreed, with no correction loop.

The final reply asks a legitimate definition question rather than holding a provable answer. Two inefficiencies remain:

1. The analyst spent about 6 minutes after a correct first answer. Its own diagnostics expect zero gaps, even when a bound already handles them.
2. It filed a classification question as `eligibility`, which routes to the verifier (151 s), instead of `definition`, which asks the user directly.

## Possible next steps

- Confirm in the company context whether postage counts as merchandise. This is a business decision that belongs to the user.
- Ask analysts to file population or classification contradictions as `definition` review reasons so they reach the user without a verifier pass.
- Let a diagnostic record that a gap is bounded (for example, an optional bound note), so a bounded gap does not read as a failed control.
- Send only the profiles the work order needs to stages after planning (part of recommendation 5, not done).
