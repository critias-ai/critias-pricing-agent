# Experiment: does a precomputed workspace index help?

Date: 2026-10-13. Branch `experiment/workspace-index` (uncommitted). Approved by the user: Luna and DeepSeek 4.1 Flash, both at high reasoning, two variants plus a baseline, $0.20 budget per variant.

## Question

If the agent receives a code-built index of the data (tables, keys, joins, data issues with value at stake and default handling), does it answer faster, cheaper and more consistently than when it gets 37 KB of column profiles and has to discover the defects itself?

## Design

| Variant | What the stages receive |
|---|---|
| `baseline` | Current harness: inline source profiles (about 37 KB). |
| `index` | The index (`prototype/build_index.py`, about 7.7 KB) in place of the inline profiles; the profiles are saved to a file the agent can open. |
| `index_view` | As `index`, plus a prepared Parquet view of every sales line: one master row per key, month and quarter, the as-of cost with a `cost_status`, line COGS when the cost is usable, and a repeat marker. The row ledger is checked. |

Agent change for both index variants (`PRICING_WORKSPACE_INDEX`): a `workspaceIndex` field in the stage prompt and a short note in the shared system prompt. That note tells the agent to start from the index, not to re-derive what it states, to apply defaults unless confirmed context overrides them, and to cite issue IDs. The coordinator, analyst and verifier role prompts, skills, review routing and stopping rules are unchanged.

Index guard: the index states only what generic checks produce (counts, keys, overlaps, coverage, value at stake, tie-out residuals and the products that account for them). It contains no business judgement. For example, it reports that POST has no cost and that the finance residual is within 5% of POST's total. It does not say whether postage is merchandise. The index is built for this pack's tables, but each check is a generic one from `02-deterministic-profiling.md`. Building it takes about 5 seconds.

Question (same as the 2026-10-13 slow-run diagnosis): "what sku had the highest absolute gross margin". Context: the workspace's two confirmations (rank by absolute margin in GBP over the full period; gross profit as the margin layer).

Reference: 22423 REGENCY CAKESTAND 3 TIER, revenue £327,813.65, COGS £188,265.5042, gross profit £139,548.1458. All its lines have one usable cost. Uncovered merchandise totals £133,165, mostly POST (£112,341 net, £127,597 positive lines, −£15,256 credits). The diagnosis covers why POST's classification is a legitimate open question.

Budget control: every run uses a fresh copy of the workspace. A run is stopped once the variant's spend would pass $0.20; Luna is capped at $0.10 so DeepSeek keeps at least $0.10. The three variants ran in parallel. Tool time was about 3% of wall time in earlier runs, so local contention should barely affect the timings.

Limits: one question, one run per model per variant. That is enough to see large effects (several minutes, or a different number of stages), not run-to-run variance.

Evidence: `.cache/index-experiment-2026-10-13/<variant>/` (git-ignored) holds the workspaces, stdout and stderr, and `summary.json`.

## Results

Total spend $0.441 (baseline $0.129, index $0.176, index_view $0.137); no run hit its cap.

| Variant | Model | Wall | Cost | Stages (analyst / verifier s) | Output tokens | Outcome |
|---|---|---|---|---|---|---|
| baseline | Luna | 70 s | $0.006 | plan only | 4.7 k | Asked how to treat `product_id=ALL` rebates (needs input) |
| baseline | DeepSeek | 270 s | $0.122 | 132 / 121 | 55 k | **Correct, verified**: 22423, £139,548.15, rank certified by bound |
| index | Luna | 401 s | $0.037 | 287 / 70 | 30 k | Held: 22423 named as covered-lines leader; uncovered credits "unbounded" |
| index | DeepSeek | 581 s | $0.139 | 281 / 273 | 54 k | **Correct, verified**, cites issue IDs, rank certified by bound |
| index_view | Luna | 361 s | $0.047 | 223 / 98 | 30 k | Held, same reason as index |
| index_view | DeepSeek | 270 s | $0.090 | 166 / 82 | 41 k | Failed: `handoffRepair budget exhausted: Ranking cohort lacks independent approval` |

For reference, the same question, code and context on Luna earlier today (run `6729fceb`) took 746 s and $0.071 and also held, on the POST classification.

## What the runs show

With one run per cell, only large effects count.

1. **The index alone did not make the runs faster or more correct.** DeepSeek was correct with and without it. Its index run was slower (581 s against 270 s), almost all of that in the verifier. Luna held in both index variants. Luna was about twice as fast and cheap as this morning's run, but today's Luna baseline asked a question instead of answering, so that comparison crosses sessions and is weak.
2. **Time is generation, not prompt reading.** In every stage, generation time exceeded time to first token, often 3–4×. Output stayed at about 30 k tokens for Luna and 41–55 k for DeepSeek in every variant. Cutting the prompt from 37 KB to 7.7 KB did not reduce time to first token: the profiles came back as reads of `source-profiles.json` (2–3 per run), and skills were re-read (Luna read `metric-verification.md` 5 times).
3. **The agents used the prepared view only lightly.** One analyst script in each `index_view` run read it. Each verifier still recomputed from raw files, as its role prompt requires.
4. **Every failure came from control flow and policy, not from missing information:**
   - Luna held the answer because it could not bound uncovered credit lines. A credit's reversed cost raises gross profit, and the data does not cap it. The index's `bound_uncovered` default named the policy but gave no bound.
   - Luna's baseline asked about rebate allocation, a question the index's default answers. But the baseline never saw the index, so this is not evidence either way.
   - DeepSeek's `index_view` run failed in the ranking-cohort approval loop.

   These map to synthesis items 1 (code-owned stopping), 6 (deterministic checks, risk-routed verifier) and 7 (bound in code), not to item 3 (index).

## Interpretation

Giving the model better information does not reduce the work it does, because the contract still makes it do the same work. The analyst must compute all six diagnostic kinds and the verifier must recompute every claim from raw files, with or without the index. The index can only pay off once code takes over the jobs the index makes possible: the diagnostics, the ranking bound and the decision to stop.

## Suggested next experiment (not approved)

Keep `index_view` and add three code-side changes:

1. The controller fills the coverage, join, period and parsing diagnostics from the index, so the analyst no longer computes them.
2. A code-computed bound certifies the top-N ranking. It uses a recorded assumption for uncovered credits; one candidate is "reversed cost ≤ the credit's own price".
3. The verifier is skipped when the deterministic checks pass.

Run the same question on both models and compare with these runs. A second question, such as the Lighting & Candles top-10, would also show whether the gain generalises.

---

# Experiment 2: code takes over the checks the index makes possible

Date: 2026-10-13, approved by the user with the same structure: baseline plus two variants, Luna and DeepSeek at high reasoning, $0.20 per variant, the same question and context. Evidence: `.cache/index-experiment-2026-10-13-run2/`.

| Variant | Adds to `index_view` |
|---|---|
| `baseline` | Nothing (current harness, rerun for a second sample). |
| `code_checks` | (1) **Controller-supplied diagnostics.** With `PRICING_INDEX_DIAGNOSTICS`, `checkpoints.ts` adds the index's source-coverage (row ledger), parsing (value = qty × price on every row), join-integrity (no fan-out after one master row per key) and period-coverage diagnostics whenever the analyst omits those kinds. The analyst supplies only reconciliation and eligibility. (2) **Bound columns.** `gp_lower_gbp` / `gp_upper_gbp` in the prepared view, under the decision **D-cost-range**: an unusable unit cost lies between 0 and the line's own price. This is an experiment default, not confirmed by the user. (3) **`certify_ranking(rows, top_n)`**, a generic helper that reports whether a top-N set and its order can change under the bounds. A certified ranking is complete. |
| `code_checks_noverify` | As `code_checks`, plus review routing (an alternative `harness.config.json`) that sends calculation, coverage, eligibility, join, parsing, period and source triggers to notes. The LLM verifier then runs only for reconciliation failures that name claims, and for scope or unclassified triggers. Definition questions still go to the user. |

Check before running: on the reference question, the certifier certifies 22423. Its bound is £139,548.15, against the best rival upper bound of £127,597.42 (POST, every positive line counted as pure profit), a margin of £11,950.73. Top-3 is not certified, which is correct, because POST's upper bound beats 85123A.

Guard: the index still does not answer the question. The bound columns and certifier are question-agnostic. The analyst still decides the population, the measure and the grouping.

## Experiment 2 results

Spend $0.464: baseline $0.2024, code_checks $0.132, code_checks_noverify $0.130. The baseline went $0.0024 over its cap: the runner polls cost every 10 s, so the stop came one poll late.

| Variant | Model | Wall | Cost | Stages | Output tokens | Outcome |
|---|---|---|---|---|---|---|
| baseline | Luna | 822 s | $0.095 | plan 29 / analyse 709 / verify 78 | 57 k | Held: "can't certify", 2,953 uncovered lines, finance control not reconciled |
| baseline | DeepSeek | 371 s | $0.107 | plan 16 / analyse 344 (stopped) | 52 k | Stopped at the budget cap inside the analyst stage; no answer |
| code_checks | Luna | **190 s** | **$0.019** | plan 54 / analyse 126 | 14 k | **Correct, self-checked, certified by the bound**; no verifier |
| code_checks | DeepSeek | 341 s | $0.114 | plan 6 / analyse 96 / verify 235 | 39 k | **Correct, verified, certified**. The verifier ran only because the analyst's scope text differed from the work order (a packaging error) |
| code_checks_noverify | Luna | 310 s | $0.036 | plan 94 / analyse 144 / correct 67 | 24 k | **Correct, self-checked, certified**, after one correction for a `resolvedRanking` packaging mismatch |
| code_checks_noverify | DeepSeek | 361 s | $0.094 | plan 11 / analyse 253 / correct 89 | 38 k | Failed on packaging: a diagnostic cited a non-source path, then `Ranking cohort lacks independent approval` |

## Across both experiments, same question

| | Luna attempts | Luna correct and certified | DeepSeek attempts | DeepSeek correct |
|---|---|---|---|---|
| Current harness (incl. this morning's run) | 3: 746 s held, 70 s asked, 822 s held | 0 | 2 | 1 (270 s) |
| Index / index + view | 2: 401 s held, 361 s held | 0 | 2 | 1 (581 s) |
| Index + view + code checks and bound | 2: **190 s, 310 s** | **2** | 2 | 1 (341 s) |

## What experiment 2 shows

1. **Putting the bound in code turned Luna's held answers into correct, certified ones, 4× faster and 5× cheaper.** In every earlier Luna run the analyst could not bound uncovered credits and held the answer. With the bound columns and `certify_ranking`, Luna answered correctly in 190 s for $0.019, its analyst writing 11 k tokens against 51 k in the baseline. Both code-check runs succeeded. That is two runs, but the change is large and in the direction the research predicted.
2. **The index was useful once code acted on it.** Experiment 1 gave the same information without the bound and saw no gain. Every code-check analyst read the prepared view and called the certifier.
3. **DeepSeek's remaining failures are packaging errors, not analysis errors.** Its analyst stage was short when the run worked (96 s). The failures and the extra verifier pass came from the output contract: scope text that has to match the work order exactly, a diagnostic citing a non-source path, and a `resolvedRanking` that has to mirror the ranking claim. This matches research file `04`: small models fail on protocol. Luna hit the ranking mismatch once too, and recovered.
4. **Skipping the verifier added nothing visible here.** The `code_checks` Luna run had no verifier anyway, because its checks passed. The no-verify variant's runs spent their time on correction stages instead.
5. **Analysts still wrote all six diagnostics themselves**, copying the index figures, so the controller's injection was rarely needed. The prompt did not make clear that they could leave those four out.

## Suggested next steps (not approved)

- Make the bound and certification standard: generic bound columns in the prepared view, a recorded cost-range decision confirmed by the user at onboarding, and the certifier as a bundled helper.
- Cut packaging failures in code:
  - the controller copies the work-order scope instead of requiring the analyst to echo it
  - drop or normalise non-source paths in diagnostics instead of failing the packet
  - derive `resolvedRanking` from the approved ranking claim
- Repeat on a second question (the Lighting & Candles top-10) and with 2–3 runs per cell before drawing firm conclusions. That needs a larger budget than $0.20 per variant.

---

# Experiment 3: seeded pack, main vs data findings

Date: 2026-10-14. Plan Task 13, run at the user's request after the branch review passed. Same question and context as experiments 1 and 2, on `workspace/northbridge-seeded` (37 planted anomaly types). `main` at `4ae523f` (worktree) against `feat/data-findings` at `b5a53f5`. Luna and DeepSeek 4.1 Flash at high reasoning, $0.20 per variant with each model capped at $0.10. Both variants ran in parallel; models ran one after the other within each variant. Evidence: `.cache/seeded-run/{main,findings}/baseline/` (git-ignored). Total spend $0.240.

| Variant | Model | Wall | Cost | Stages (s) | Outcome |
|---|---|---|---|---|---|
| main | Luna | 80 s | $0.006 | plan 54 | **Asked**: allocate or exclude customer-period rebates (same question as the clean-pack baseline) |
| main | DeepSeek | 361 s | $0.103 | plan 14, analyst 324 | **Stopped at the $0.10 cap**. Draft handoff: 85123A, £158,138.12, so it fell for the **pence trap** (`price_in_pence` plants 85123A) |
| findings | Luna | 851 s | $0.068 | plan 17, analyst 787 | **Failed, time budget** (`verification/finalization reserve`). Draft at 06:46 held the claim and asked about `F-7946…` (repeated-row, the `day_loaded_twice` plant). Its base candidate was also 85123A |
| findings | DeepSeek | 851 s | $0.063 | plan 32, analyst 770 | **Failed, time budget**. Exploration only, no executed analysis; 6 of its 13 minutes were one slow cost-interval range join of its own |

Correct (22423, £139,548.15): none. The findings did not name both material findings in any run.

## What the runs show

1. **No performance gain: the findings branch was slower and produced no answer.** Both findings runs used the full time budget (about 14 minutes) against 80 s and 361 s on main. Spend per run was similar or lower only because the runs ended on time instead of money.
2. **The sweep missed the pence trap because of how the guide scopes it.** The guide says to sweep pending findings "on the sources and columns your answer uses". Luna computed gross profit from `line_value_gbp`, so it dropped findings on `unit_price_gbp`, including the `x1e2` ratio finding `F-bc97…` whose rows (85123A) also carry a 100x line value. Its sweep ran over 62 findings and returned only the repeated-row finding. The column filter is unsafe whenever one row-level error scales several columns.
3. **Luna had a usable held answer at 06:46 but lost it.** After its first successful execution (held, with a `definition` question naming `F-7946…`) it kept editing the script for 7 minutes and never re-ran it. The stage then hit the reserve and the run failed with no answer shown. This is existing controller behaviour, not the findings code, but the findings guide added the work that filled the time.
4. **DeepSeek on main reached a wrong draft quickly**; with findings it spent its time reading `data_findings.py` and exploring, and never reached a calculation.

With one run per cell this shows large effects only: the extra sweep work does not fit the stage time budget as written, and the column-scoped sweep cannot catch a trap whose finding sits on a sibling column.

## Suggested fixes (not approved)

1. Guide: sweep pending findings on the **sources** the answer uses, not sources and columns.
2. Pre-filter in code: pass the analyst only findings whose flagged rows intersect the rows its calculation reads, or run one code-side sweep over the finding IDs, so the model does not write sweep plumbing.
3. When a stage hits the reserve, return its last successful handoff as a held answer instead of failing.

---

# Experiment 4: code-owned findings check (partial: seeded pack, Luna only)

Date: 2026-10-14. Plan `2026-10-14-code-owned-findings-check.md`, Task 8, narrowed by the user to Luna only (DeepSeek and the clean pack are held until this works). `feat/data-findings` at `a8b4d7f` (check built, plus the claim-value comparison the user asked for). Seeded pack, same question, high reasoning, $0.10 cap. Evidence: `.cache/seeded-run-v2/findings/baseline/` (git-ignored). Spend $0.049.

| Variant | Model | Wall | Cost | Stages (s) | Outcome |
|---|---|---|---|---|---|
| findings v1 (Exp. 3) | Luna | 851 s | $0.068 | plan 17, analyst 787 | Failed, time budget, no answer |
| code-owned check | Luna | 851 s | $0.049 | plan 37, analyst 768 | **Failed, time budget** (`verification/finalization reserve`), no answer |

Correct (22423): none. The traps were not named in any user-facing message because no handoff was produced.

## What the run shows

1. **The analyst did the right thing and the check never finished.** Luna read `data-analysis.md`, called `findings_views`, wrote `answer=` and ended the script with `emit_handoff`. Its first execution failed on its own f-string bug (35 s). Its second ran the check and was killed at exactly 120 s, the execution timeout. The tool result was only `Command failed:` with no stderr, so Luna could not tell why. It spent the next five minutes probing with `bash`, then hit the time budget.
2. **The cost is `calls x answer time`, and a model-written answer is slow.** Luna's `answer` is a 35 s query (regex money parsing, `row_number()`, a date-range cost join over the sales lines): 34.3 to 35.5 s over three timed calls. The claimed sources carried 82 unconfirmed findings (57 sales, 16 product master, 9 cost history; 7 fixable). The sweep makes about 3 + 2x82 + 2x7 = 181 calls: roughly 105 minutes against a 120 s limit. Even the three fixed calls (base, keep, every) take 105 s.
3. **The Task 6 acceptance was unrepresentative.** It used a hand-written 0.08 s query, so 13 s looked cheap. The prototype's 12.4 s had the same shape. Neither measured an analyst-written query on the full pack.
4. **The first claim in `answer` was the pence trap.** Luna's base answer was `85123A`, the planted `price_in_pence` SKU, so the check would have held it had it finished.

With one run this shows a large effect only: with a realistic `answer`, the per-finding sweep does not fit the stage.

## Options (not approved)

1. **Fail fast and say why.** After the base call, time it. If the projected sweep exceeds the remaining execution budget, raise at once naming `answer()` seconds, pending findings and calls needed. Saves minutes of confusion; does not produce an answer.
2. **Bound the sweep by count, outside `execute_analysis`.** Check only the N highest value-at-stake findings, in the order the analyst already sees, with its own timeout. At 35 s per call even N=3 is about 5 minutes. Hold the claim and say "N of M findings checked" when findings remain unchecked.
3. **Make `answer` cheap by contract.** Findings views materialised as typed tables so analysts need no per-call regex or casting. Not controllable from code: the heavy part here was the analyst's own join.
4. **Ask once on the largest findings without attribution.** Two calls (keep, every): if every-finding exclusion changes any claim, hold it and ask about the highest value-at-stake findings.

---

# Experiment 5: thin harness (one session, plugin as method)

Date: 2026-10-14. Same seeded pack, question, context, Luna/high, warm data cache, 840 s deadline, $0.10 cap. Runner `.cache/thin-run-2026-10-14/run-thin.ts` (git-ignored, evidence beside it): one Pi session through `createPricingSession`, a 17 KB plain-text prompt (question, context, source list, a 10-line data-access snippet, profiles as a file path, the same compact findings inline with one rule: if a finding could change the answer, name it and ask), plugin skills, `read/write/edit/bash/execute_analysis`. No coordinator, controller, verifier, diagnostics contract, `answer=` or sweep. No harness code changed.

| Variant | Wall | Cost | Calls | First execution | Outcome |
|---|---|---|---|---|---|
| Exp. 4 code-owned check | 851 s | $0.049 | 27 | 5 m 27 s | Failed, no answer |
| Thin harness | **583 s** | $0.065 | 47 | 76 s (first success 165 s) | **Answered and asked** |

Reply: provisional leader 85123A £158,138.12, runner-up 22423 £139,328.17. It names finding `F-bc…` (x1e2 price ratio, the pence trap): six 85123A rows contribute £64,868.72, more than its £18,809.95 lead, and asks whether to hold for price validation. It also names `F-0ca`/`F-9e59` (unmapped `TOTAL`), POST missing costs and unallocated `ALL` adjustments. It avoided the duplicate-key trap. All seven reply numbers appear in executed stdout. Against the key (22423 £139,548.15, or a figure that differs only by named findings): the pence trap is caught and the right question asked; the £220 gap on 22423 is the trailing-space rows (`F-9e59`, which it described only as the `TOTAL` record).

Where the time went: 12 of 16 executions failed on DuckDB reserved words used as aliases (`rows`, `names`, `types`, `all`, `name`), each a model turn; the old guide's one line "quote identifiers or avoid reserved words in aliases" was left out of the thin prompt. After the first success (165 s) it spent about 7 minutes on cost checks and bounds that the plugin's "bound before holding" asks for.

---

# Experiment 6: thin harness with and without the workspace index

Date: 2026-10-14, Luna/high, $0.10 cap each, run in parallel. Clean pack (`workspace/northbridge-test`), because `build_index.py` is hand-wired to the clean pack's types and crashes on the seeded pack (`Could not convert string "(5.04)" to DECIMAL`). Same runner as Experiment 5, plus the reserved-word line in both prompts. The index variant inlines `index-facts.md` (5.6 KB): the prototype's `index.md` without `--prepared-view`/`--code-checks` and with every `default:` treatment and the "apply each default" line removed, so it states facts only. Profiles and findings computed before the clock. Evidence `.cache/thin-run-2026-10-14/ws-clean-{thin,index}/`.

| Variant | Wall | Cost | Calls | Cache-read tokens | Reads | Executions (ok) | First success | Answer |
|---|---|---|---|---|---|---|---|---|
| thin | 828 s | $0.063 | 50 | 2.39 M | 18 | 13 (5) | 165 s | 22423 £139,548.15 among costed SKUs; asks about POST and other cost gaps |
| thin + index | **518 s** | **$0.033** | 26 | 0.90 M | 8 | 9 (6) | **37 s** | 22423 £139,548.15 among costed SKUs; asks whether POST is excluded or costed |

Both match the reference and ask the known legitimate POST question; all reply figures trace to executed stdout (thin printed 139548.1458 and rounded). The index run skipped the company documents and the harness source (thin read `data_findings.py` twice), succeeded on its first execution, and cited the index issue `I-cost-coverage`. The thin run's eight failures were its own SQL (one reserved word, ambiguous columns, a wrong file path), and it finished 12 s before the deadline.

One run each: accuracy unchanged, speed and cost better with the index, but the thin run's 828 s here against 583 s on the harder seeded pack (Experiment 5) shows run-to-run spread of the same order as the gain. The index as built is not general: it is hand-written for this pack and fails on messy data.

---

# Experiment 7: continuous session and agent-written data notes

Date: 2026-10-14, Luna/high, clean pack, thin prompt (Experiment 6, no index). Runner `.cache/thin-run-2026-10-14/run-multi.ts`, launcher `launch-multi.sh`. Q1 = "what sku had the highest absolute gross margin", Q2 = "what were the top 10 skus by revenue over the full period?". With `NOTES=1` the prompt asks the agent to create or update `.pricing/data-notes.md` before each answer (data facts only, under 80 lines) and inlines existing notes. Spend $0.116.

| Run | Session | Notes | Q | Wall | Cost | Calls | Reads | Exec (ok) | Outcome |
|---|---|---|---|---|---|---|---|---|---|
| A1 | fresh | write | Q1 | 659 s | $0.063 | 32 | 11 | 11 (5) | 22423 £139,548.15 among costed SKUs; asks about POST |
| A2 | **continued** | update | Q2 | 372 s | $0.027 | 7 | **0** | 2 (2) | **Top 10 table** on merchandise recorded line sales (22423 £327,813.65 first, matches reference revenue); asks which basis to use going forward |
| B | fresh | read A1's | Q2 | 144 s | $0.014 | 13 | 16 | 1 (1) | Held: asks merchandise-only vs all product types |
| C | fresh | off | Q2 | 103 s | $0.011 | 10 | 11 | 2 (2) | Held: asks merchandise line sales vs net after adjustments |

Findings:
1. **The continued session reused everything.** A2 made no reads, wrote two scripts that both ran first time, and carried Q1's basis. Its analysis took about 130 s; each call was slow because the context was about 140 k tokens (984 k cache-read over 7 calls).
2. **Notes upkeep costs time and saved none here.** A2 spent about 180 of its 372 s editing the notes and finishing; B spent about 50 of 144 s on notes edits. B read the skills and company documents before it opened the notes (already inline), so the notes did not cut reads (16 against C's 11).
3. **Fresh sessions treated "revenue" as an unresolved definition and asked; the continued session answered on the basis it had used for Q1 and asked going forward.** Under shared rules §3 the fresh behaviour is the stricter one; in real use the user would have answered Q1's question first.
4. A1's 40-line notes were accurate data facts (keys, the 21790 duplicate, as-of cost join convention, cost-match counts, rollup tables, POST classification), with no answers; one workspace-specific path in the snippet.

One run per cell. Q2 resolved to a question in both fresh runs, so it measured the notes poorly; a calculation-heavy follow-up would test them better.
