# Data findings execution record

Recorded **2026-10-14**. Plan/research directory dates remain 2026-10-13. Local research record: **do not stage or commit this file or its research directory**.

## Outcome and scope

D1 parse, D2 shape, D3 domain, D4 uniqueness and D7 peer ratio are implemented on `feat/data-findings`, based on `main` at `4ae523f`, final code HEAD `1f8054e`, cache VERSION **5**. Tasks 0–12 and the four final runtime-fix checkpoints are complete; Tasks 9–12 have spec PASS and quality approval. Final scoped spec review is **PASS**, final scoped quality re-review **Approved**: all original and residual reproduced review findings are addressed. Task 14 records this deterministic outcome. **Task 13 awaits explicit user approval; no Task 13 steps or paid/live calls have run.** The subsequent guide-only commit is `b5a53f5`; final branch HEAD is `b5a53f5`, with final production code unchanged from `1f8054e`.

The deterministic acceptance meets the agreed minimum: **30/37 plant types**, including both answer-changing traps; **133 seeded / 93 clean / 0 unexplained findings**. Final checkpoint 4 records **343 Vitest tests across 74 files, 48 Python tests, typecheck and formatting passing**. Python is **215 lines**, the TypeScript adapter **59 lines**, and the production feature diff **297 changed lines**. Ponytail ultra is **PASS for minimality and budgets with the explicit remaining limits below**. These results do not certify live model adherence or business-answer correctness.

D5 identities, D6 time and D8 labels were deliberately excluded. The application supports XLSX elsewhere, but findings are CSV only. Treatments reuse the existing `definition` → ask-user → `confirmedDefinitions` path; no new policy store or UI was added. Early catalogue references to `.pricing/policies.json`, signature inheritance and an exhaustive certification bound are design concepts, superseded for this implementation by the narrower [plan](../../superpowers/plans/2026-10-13-data-findings.md) and [analyst guide](../../../bundled/harness-tools/data-analysis.md). Code does not choose business treatments.

## All current branch commits

Read directly from `git log --reverse main..HEAD` at `b5a53f5`: **27 commits**, including 17 inherited Tasks 0–8 commits, five Tasks 9–12 commits, four final runtime-fix commits and the Task 14 guide-only commit. No push or PR was made.

| Commit | Subject |
|---|---|
| `2351b08` | docs: plan data findings detectors |
| `109991e` | feat: add data findings module core with content-hash cache |
| `0c52ffa` | fix: key findings cache on source paths and ignore non-finite values |
| `e24f64a` | feat: detect values failing a column's dominant parse |
| `b2e0f01` | fix: offer a parse fix only when it makes every flagged value parse |
| `4b20f83` | feat: detect code variants and rare shapes in code-like columns |
| `15831ae` | fix: evaluate parse fixes only on the rows they apply to |
| `e7748cf` | feat: detect missing keys and the column they really come from |
| `a58bb9a` | fix: stop small and empty sources becoming keys; make findings deterministic |
| `bf5ecb5` | feat: detect repeated rows, conflicting keys and re-keyed documents |
| `d3e15f5` | fix: stop flagging single-line and content-free groups as repeated documents |
| `4d2c8ae` | feat: detect scale and sign errors against key-group medians |
| `d08d44e` | fix: check small-group keys properly, emit x12, ignore non-finite values |
| `9ce7f1d` | feat: apply confirmed treatments and test which findings matter |
| `65275e8` | fix: let sweep take any iterable of finding ids |
| `5f9be48` | feat: run data findings from the harness and bound them for prompts |
| `69f80b5` | fix: keep every detector's findings in the prompt bound and surface detector errors |
| `ff770a9` | feat: give every stage the run's data findings |
| `77ea3b4` | docs: tell analyst and verifier how to treat data findings |
| `956bfa0` | docs: preserve confirmed treatments in data finding probes |
| `a8a7f0c` | test: seeded anomaly pack generator and findings scorer |
| `a618dc3` | refactor: ponytail ultra pass on data findings |
| `7ff11a6` | fix: prevent finding ID collisions across sources |
| `d3e85b2` | fix: avoid identity merges in data finding treatments |
| `2220123` | fix: exclude non-finite values from peer baselines |
| `1f8054e` | fix: encode finding signatures unambiguously |
| `b5a53f5` | docs: record data findings scope and verification status |

## Task 11 complete score table

Copied from the completed Task 11 report, without detector or threshold tuning. A plant is caught when a finding covers at least 90% of its planted key rows; rows are source-qualified and deduplicated. The detector-evidence column retains the scorer's printed text (220-character cap); it is not an exhaustive per-row explanation. The invisible character in the zero-width plant's rare-shape evidence is present in the original output.

| Plant | Result | Covered / planted | Printed detector evidence |
|---|---|---:|---|
| `cost_dates_reversed` | missed | 0/5 | — |
| `cost_interval_overlap` | missed | 0/1 | — |
| `date_future_year` | missed | 0/5 | — |
| `quantity_extra_zeros` | missed | 0/5 | — |
| `silent_currency` | missed | 0/25 | — |
| `value_not_quantity_times_price` | missed | 0/30 | — |
| `price_decimal_shift` | missed | 11/15 | ratio:x1e-1 vs product_id median |
| `quantity_in_packs` | CAUGHT | 19/20 | ratio:x1e1 vs product_id median; ratio:x12 vs product_id median |
| `columns_shifted` | CAUGHT | 3/3 | parse:mixed-text; parse:text; parse:invalid-date; parse:non-integer; domain:missing-from files/data/customer_master.csv |
| `cost_decimal_shift` | CAUGHT | 1/1 | ratio:x1e-1 vs product_id median |
| `cost_in_pence` | CAUGHT | 10/10 | shape:variant-of-common-value; ratio:x1e2 vs product_id median |
| `customer_duplicate_key` | CAUGHT | 5/5 | shape:rare-shape AA-99999-9; uniqueness:repeated-document; uniqueness:duplicate-key conflicting |
| `customer_id_as_float` | CAUGHT | 30/30 | parse:float-formatted; parse:mixed-text; domain:missing-from files/data/customer_master.csv |
| `customer_id_is_product_id` | CAUGHT | 15/15 | domain:missing-from files/data/customer_master.csv |
| `customer_name_in_id` | CAUGHT | 40/40 | parse:text; domain:value-of files/data/customer_master.csv:customer_name |
| `customer_placeholder` | CAUGHT | 25/25 | domain:missing-from files/data/customer_master.csv; parse:text; parse:mixed-text |
| `date_excel_serial` | CAUGHT | 10/10 | parse:serial-date |
| `date_impossible` | CAUGHT | 5/5 | parse:invalid-date |
| `date_month_first` | CAUGHT | 40/40 | parse:slash-date; parse:mixed-text; ratio:x12 vs product_id median |
| `day_loaded_twice` | CAUGHT | 1941/1941 | parse:mixed-text; uniqueness:repeated-row; ratio:x1e1 vs product_id median; shape:rare-shape A9; ratio:x1e-1 vs product_id median; ratio:x12 vs product_id median |
| `header_row_repeated` | CAUGHT | 1/1 | domain:missing-from files/data/customer_master.csv; shape:rare-shape AAAA_AA; domain:missing-from files/data/invoice_headers.csv; parse:header-text; shape:rare-shape AAAAAAA_A |
| `invoice_rekeyed_duplicate` | CAUGHT | 44/44 | domain:missing-from files/data/invoice_headers.csv; uniqueness:repeated-document |
| `price_currency_symbol` | CAUGHT | 20/20 | parse:mixed-text; parse:currency-symbol |
| `price_decimal_comma` | CAUGHT | 30/30 | parse:decimal-comma |
| `price_in_pence` | CAUGHT | 6/6 | ratio:x1e2 vs product_id median |
| `product_duplicate_key` | CAUGHT | 1/1 | uniqueness:duplicate-key conflicting |
| `product_id_lowercase` | CAUGHT | 40/40 | shape:variant-of-common-value |
| `product_id_trailing_space` | CAUGHT | 30/30 | parse:mixed-text; shape:variant-of-common-value; domain:missing-from files/data/product_master.csv; shape:rare-shape 99999  |
| `product_id_unknown` | CAUGHT | 20/20 | shape:rare-shape 999999; domain:missing-from files/data/product_master.csv |
| `product_id_zero_width_char` | CAUGHT | 20/20 | domain:missing-from files/data/product_master.csv; shape:rare-shape 99999​; shape:variant-of-common-value |
| `quantity_price_swapped` | CAUGHT | 15/15 | ratio:x12 vs product_id median; parse:non-integer; ratio:x1e1 vs product_id median |
| `quantity_with_unit_text` | CAUGHT | 25/25 | parse:unit-text; parse:mixed-text |
| `sign_flipped_sale` | CAUGHT | 20/20 | ratio:negative vs product_id median |
| `test_record` | CAUGHT | 10/10 | domain:missing-from files/data/customer_master.csv; domain:missing-from files/data/product_master.csv; parse:text; ratio:x1e1 vs product_id median |
| `total_row` | CAUGHT | 1/1 | shape:rare-shape AAAAA; domain:missing-from files/data/product_master.csv |
| `value_parenthesised_negative` | CAUGHT | 15/15 | parse:parenthesised-negative; parse:mixed-text |
| `value_thousands_separator` | CAUGHT | 15/15 | parse:thousands-separator |

**Totals: 30/37 plants caught; 133 seeded, 93 clean, 0 unexplained.** The seven missed types are the first seven table rows. `price_decimal_shift` is partially covered at 11/15; `quantity_in_packs` is caught at 19/20. Both benchmark traps pass: `price_in_pence` 6/6 and `product_duplicate_key` 1/1. Zero unexplained means every new seeded finding overlaps at least one planted row or has a clean-pack ID; it is not proof that every row in each finding is erroneous.

### Final VERSION 5 timings, compaction and materiality

Final checkpoint 4 supersedes earlier code/cache evidence. The complete score table is unchanged from Task 11; IDs and candidate-fix availability changed as described below.

| Final run | Seeded seconds | Clean seconds | Findings |
|---|---:|---:|---|
| Cold, cache absent and empty before use | 26.158986 | 19.154717 | 133 / 93 |
| Warm, same VERSION 5 cache | 0.097236 | 0.074119 | 133 / 93 |

Both cold runs are below 60 seconds. Cache: `pricing-harness/.cache/final-fix-4-version5-c3be03eae31340d3a39f26da42cb654d`. Runs are sequential, with isolated Python, workspace cwd and 15 relative sources. Warm results equal cold results entirely. Full command/cwd/stdout/stderr records: `pricing-harness/.cache/final-fix-4-smoke.json`. Earlier Task 11 cold 26.417/23.500 and warm 0.166/0.110 seconds are historical, superseded for current-code acceptance by this table.

The real exported adapter's default 12,000-character bound retains **38 of 133 findings / 11,919 serialized findings characters**, including both benchmark traps. The previous 37-retained prefix changed to 38 because JSON-tuple IDs changed equal-value tie ordering; there was no fixed retained-count criterion, and no tuning. Record: `pricing-harness/.cache/final-fix-4-compaction.json`.

The original agreed gross-margin ranking query was rerun against the final VERSION 5 artifact, changing only its input artifact name, and reports exactly:

```text
kept: 47566 | both excluded: 22423 | material: True
```

The two trap exclusions change the top SKU to 22423. `sweep` returns exactly the duplicate-key and pence findings when also given the negative-price control. Record: `pricing-harness/.cache/final-fix-4-materiality.json`. This is deterministic query materiality evidence, not a live agent answer or certification of every amount. Task 14 reused the final cache for warm smokes; it did not repeat suites, cold detection or materiality.

The 95-line generator is byte-identical to the research prototype and reproduces all 15 CSV hashes and the answer key: 37 plants, 2,544 planted rows. The 32-line scorer matches the plan. Its meaningful synthetic self-check covered the inclusive 90% threshold, an 80% miss, duplicate flags, source qualification, clean-ID suppression and one unexplained finding. Generator execution took 2.453356 seconds. Records: `pricing-harness/.cache/task11-generator-selfcheck.json` and the Task 11 report.

## Final size, verification and Ponytail

| Production file | Additions vs main | Deletions vs main | Changed lines |
|---|---:|---:|---:|
| bundled/harness-tools/data_findings.py | 215 | 0 | 215 |
| src/agent/runs.ts | 2 | 0 | 2 |
| src/agent/workflow/data-findings.ts | 59 | 0 | 59 |
| src/agent/workflow/orchestrator.ts | 14 | 0 | 14 |
| src/agent/workflow/role-prompts.ts | 2 | 2 | 4 |
| src/agent/workflow/stage-prompt.ts | 3 | 0 | 3 |
| **Total** | **295** | **2** | **297 < 300** |

Physical limits: Python **215 ≤ 215**, adapter **59 ≤ 60**. Budget conservatively counts additions plus deletions and excludes Markdown/tests. Before Task 12, adapter 63 and production diff 301 exceeded the budget. The script-path expression reduced formatting overhead without altering subprocess behavior. Subsequent runtime fixes retain all budgets; final Python SHA-256 is `c3e54f7013578098a2cc671aec6b2abd0e9ba393a5e5219a4bc9f30b40105dca`.

| Final checkpoint 4 check | Result | Wall seconds |
|---|---|---:|
| npm run typecheck | PASS | 3.636933 |
| npm test | 74 files / 343 tests PASS | 9.405049 |
| npm run test:python | 48 PASS | 5.374664 |
| npm run format:check | PASS | 1.366382 |

These commands ran once sequentially after final checkpoint-4 production edits and pack timing/scoring; no production edits followed. All exit 0, empty stderr, no skips/failures reported. Full records: `pricing-harness/.cache/final-fix-4-suites.json`; focused source-isolation/module tests: `final-fix-4-focused.json` (both ID cases green, findings module 30 passed). These supersede Task 12's historical 343/43 evidence; they are not Task 14 suite reruns. Final pack/scorer artifacts are `final-fix-4-northbridge-{seeded,test}.json` and `final-fix-4-score.json` under the same `.cache/`.

**Ponytail ultra: PASS for minimal implementation, the compactness pass and the final corrections, with explicit remaining limits.** The assessment covered all production feature code, staging/quoting/attachment reuse, existing profiler convention, orchestration/prompt callers, user-confirmation path, findings tests, fixtures, scorer/generator, packaging/config and documentation. No extra detector, dependency, wrapper or abstraction was justified. Final fixes use existing JSON/hash/cache/query mechanisms, delete an unsafe candidate and filter existing aggregate inputs. All have concrete RED/GREEN regressions and separate commits. This verdict does not certify generic completeness, universal business-losslessness or live model adherence.

## Deviations and execution rulings

All eight inherited reviewer-driven deviation commits are retained below. They were recorded in inherited memory; they are not newly discovered Task 14 fixes.

| Commit | Recorded deviation |
|---|---|
| `0c52ffa` | Include source paths in the findings cache key; ignore NaN/inf in sums; assert cache misses as well as hits. |
| `b2e0f01` | Tighten D1 regexes: no leading zero for thousands/serial-date forms; parenthesised negatives require a numeric body. Offer a fix only when every flagged value becomes parseable. |
| `15831ae` | CASE-guard that fix check so it evaluates only applicable rows; the preceding guard had crashed on the seeded pack. |
| `a58bb9a` | D3 noise guard (distinct missing at most half of distinct values), no self-reference (`oc != c`), non-null found values, deterministic master/id/example tie-breaks; test helper accepts extra source. |
| `d3e15f5` | Require multi-line documents and meaningful comparable content before `repeated-document`. |
| `d08d44e` | D7 keys require at least three values per group on average; move x12 before powers of ten; filter non-finite inputs and emit null for infinite value at stake. |
| `65275e8` | Accept any iterable in `sweep`. |
| `69f80b5` | Interleave detectors in bounded prompts so the product-master duplicate trap survives; clip long strings; surface detector stderr; value columns must be mostly decimal to avoid summing customer IDs. |

New reviewer-driven deviation: **`956bfa0`, preserve confirmed treatments in every pending probe.** The authoritative Task 10 override initially rebuilt `probe` from raw rows with only pending treatments. Actual DuckDB repro A100/B10/A1 with confirmed exclusion of A100 and pending exclusion of B10 returned no material finding under that guidance, although the confirmed-basis ranking changes B→A. The narrow guide correction names the per-source confirmed map and merges it into both exclusion and fix probes. A 23-line parametrized regression covers confirmed exclude/fix crossed with pending exclude/fix: four failures before, four passes after; total Python tests became 43. No runtime detector/helper change. Spec re-review addressed the P1; quality approved.

### Final review corrections after the paused wrap-up

The whole-feature review found three concrete defects and the scoped ID re-review found one residual encoding defect. Documentation was paused while each runtime correction received a focused real-data RED/GREEN regression, a separate controller commit and fresh versioned pack/scorer checks. Final scoped spec PASS (`task-12-final-spec.md`) and quality Approved (`final-review-rereview.md`) close all reproduced findings.

| Commit | Root cause and minimal correction | Regression / cache progression |
|---|---|---|
| `7ff11a6` | Six-hex truncated IDs let two source signatures collide and mix shared flag row IDs. Retain the full SHA-1 digest. | Exact s890.csv/s2908.csv sources; source-owned flags and flagged-row-only exclusion. VERSION 2. |
| `d3e85b2` | D2 normalization could merge payload-distinct case variants. Withdraw the candidate rewrite while retaining detection/flags; existing missing-fix validation rejects unsupported fixes. | A00/a00 distinct records, thirteen identities retained, fix null, attempted fix rejected. VERSION 3. |
| `2220123` | Non-finite values could poison the peer median before row filtering. Filter finite aggregate inputs so median and minimum-three count see finite values. | Constant-price 300-row pack, six inf/NaN peers; no spurious ratio finding. VERSION 4. |
| `1f8054e` | Delimiter-joined signature fields could serialize different tuples identically even with a full hash. Hash `json.dumps([detector, path, column, issue])`. | Parameterized existing source-isolation regression adds exact delimiter source/column pairs, verifies both source exclusions. VERSION 5. |

**Resolved historical D2 risk:** inherited memory recorded 174 case-distinct clean-master pairs. No D2 normalization candidate is now offered; flags remain and attempted `fix` is rejected. Do not treat this historical rewrite risk as unresolved. Both reproduced ID encodings and non-finite peer-baseline poisoning are also resolved.

**Compatibility:** full IDs and JSON-tuple encoding change finding IDs. Older ID-based confirmations require reconfirmation; no automatic migration is provided. VERSION 5 invalidates older cache artifacts, and existing unknown-finding validation rejects stale IDs. Full SHA-1 IDs are not a mathematical proof that all digest collisions are impossible.

Other authorized differences and process rulings:

- Task 10 used the authoritative local `prototype/task10-guide-section.md` instead of the stale guide text in plan lines 1013–1042; the confirmed-probe correction above narrowly supersedes that prototype where necessary.
- Use actual clean findings **93**, replacing the plan's approximate 90. Acceptance remains 30/37, both traps caught and zero unexplained. No pack-specific tuning.
- Stale plan test totals are superseded: inherited baseline 341 Vitest/39 Python; Task 9 adds two Vitest cases (343), the confirmed-probe regression adds four Python cases (43), and final runtime regressions bring Python to 48. Task 10's exact prompt words are coordinator 109, analyst 109, verifier 92, shared 59; predicted analyst/verifier totals were one word too high, and all original caps remain.
- Task 11 used a genuinely absent cold cache instead of assuming a reusable example cache was cold. Smoke calls deliberately reuse `.cache/findings-smoke` and are described accordingly.
- Conservative under-300 budget counts additions plus deletions (297), rather than net additions. Task 12's four-line adapter reduction is behavior-preserving.
- Inherited experiment workspace-index patch is **113 lines**, rather than the plan's roughly 60; it remains a local research artifact, unapplied in this wrap-up.
- Retained the existing branch/checkout with ignored packs/dependencies. Initial Claude CLI authentication failed with no feature changes and reported $0 model cost; user switched delegated seats to Codex gpt-6.1-sol/high. Sandboxed Git writes stalled, so the controller owns exact-file commits. No worker Git mutations are needed here. The user supplied Ponytail ultra text; it remains the binding compactness source.
- Task 12's temporary smoke driver initially asserted the wrong argument count (37 vs 35) and stopped before subprocess execution. Corrected to the actual 15-source invariant; both completed smokes passed. No product change.
- Read-only whole-feature review ran alongside Task 14 draft authoring; documentation paused for sequential runtime fixes, then resumed with final evidence. A necessary `tsx` compaction check hit IPC restrictions and was retried with approval; that retry exposed CommonJS/ESM loading, so the controller used proper ESM module mode. This supersedes the worker's premature alternate-loader attempt, transparently retained as a process deviation rather than accepted evidence. Final checkpoint-4 compaction uses the correct ESM mode successfully.
- Temporary verification-driver assertions were corrected without product changes: the Task 12 argument count above; checkpoint 3's overly specific pytest-display assertion; and Task 14's trailing-newline comparison. Product regressions and smoke outcomes remain directly evidenced.
- Task 13 is skipped pending explicit approval ($0.20 per variant / $0.40 total). Task 14 records the pending outcome without spending money, pushing, opening a PR or staging research.

## All inherited known limitations and remaining shortcuts

The resolved historical D2 candidate merge risk is recorded above; the following inherited limitations remain.

Detection and normalization:

1. D2's code gate admits mostly-numeric columns containing junk.
2. Rare-shape detection is off below roughly 1,000 rows.
3. D1 can label date-shaped values in numeric columns `invalid-date`.
4. Float-formatted/non-integer detection needs at least 1,000 numeric values.
5. Unit-text and currency-symbol fixes discard units/symbols; design permits these offered candidates only with user choice.
6. Single-line re-keyed documents are not flagged.
7. `repeated-document` key regex recognizes only underscore separators.
8. `duplicate-key conflicting` can fire on near-unique non-key columns.
9. D3 text-column probes are quadratic in the number of text columns.
10. D7 skips groups with nonpositive medians and cannot report one error in a column with fewer than 51 values.
11. D7 treats numeric code columns as measures.
12. Tier/pack pricing produces natural ratio findings; a finding is evidence, not a business decision.

Treatments and operations:

13. `sweep` tests only the treatments applied by its callback. The guide requires separate exclusion and fix sweeps and retains confirmed treatments in both.
14. `sweep` compares each finding alone and with all others excluded; it does not enumerate arbitrary combinations, mixed fixes/exclusions or prove an exhaustive bound. Upgrade if interaction coverage is required.
15. `treated_view` has no stale-data guard. Pass exactly the same `source` string used for detection and keep its source version consistent with findings; source identity alone does not validate freshness.
16. One unreadable CSV disables findings for all sources; orchestration logs the advisory failure and continues.
17. Detector timeout is 600 seconds versus the profiler's 300 seconds.
18. Cache `VERSION` is bumped manually.
19. `findings.json` writes are non-atomic.
20. A literal column named `rowid` breaks detectors.
21. Existing `prepare_source` has a rename race on concurrent cold runs.
22. CSV only; XLSX support needs an adapter upgrade.
23. D3 offers no automatic fix for name-to-key remapping (`fix` is null); a confirmed manual step is required.

D5/D6/D8, loader-specific anomaly tests, broader false-alarm rates, scale/real-data validation and exhaustive treatment interactions remain outside the completed work. Seven planted types fail the 90% criterion; partial row coverage is retained explicitly above. Deterministic acceptance and zero unexplained findings on this pack do not establish generalized detection accuracy or live model correctness.

## Task 14 fresh VERSION 5 smoke evidence and handoff

Required warm real-pack smokes ran sequentially on **2026-10-14** after the final fix handoff, using subprocess argument lists, absolute project `.venv/bin/python -I`, each pack's workspace cwd and all 15 sorted `files/data/<file>.csv` source strings. They reuse the exact final checkpoint-4 VERSION 5 cache: `pricing-harness/.cache/final-fix-4-version5-c3be03eae31340d3a39f26da42cb654d`.

| Pack | Findings | Seconds | Exit | stderr | Entire JSON result vs final checkpoint 4 |
|---|---:|---:|---:|---|---|
| northbridge-seeded | 133 | 0.149199 | 0 | empty | identical |
| northbridge-test | 93 | 0.075170 | 0 | empty | identical |

Seeded breakdown: domain 14, parse 25, ratio 27, shape 59, uniqueness 8. Clean: domain 10, parse 1, ratio 24, shape 52, uniqueness 6. Reused findings directories: `findings-47b68276cdec5ffb` and `findings-4773ca3755d27a6a`. Both emit VERSION 5; their entire JSON results equal final checkpoint-4 artifacts. Full exact command arrays/cwd/timings and assertions: `pricing-harness/.cache/task14-final-smoke-record.json`. Cached timings do not replace final cold evidence. The earlier Task 14 VERSION 1 draft smokes are historical and superseded.

Task 14 changes only root `PROJECT_GUIDE.md`, catalogue status/verification appendix, and this execution record, plus its ignored administrative handoff report. No production code, new doc-only tests, Git writes, live calls or Task 13 steps. The controller committed **PROJECT_GUIDE.md only** as `b5a53f5`; this research folder stays untracked. The documentation author made no Git writes.

Evidence sources are the local ignored `.superpowers/sdd/2026-10-13-data-findings/` task reports/reviews/ledger (especially final-fix-report.md checkpoint 4, task-12-final-spec.md and final-review-rereview.md), the above ignored cache records, current read-only Git log/size inspection and the [catalogue](ANOMALIES.md). These local records are intentionally outside a standalone public checkout.

Final Task 14 documentation gates: spec **PASS**, quality **Approved**, with no findings (`task-14-spec.md`, `task-14-quality.md`). Final branch HEAD remains `b5a53f5`; the research record/catalogue remain uncommitted. The plan ledger is retained for Task 13's approval-gated continuation.

## Code-owned findings check (2026-10-14 plan)

Plan: `docs/superpowers/plans/2026-10-14-code-owned-findings-check.md` (committed `047d151`). Built on `feat/data-findings` by subagent-driven development (implementer, spec reviewer and quality reviewer per task, then a whole-change review). Nothing pushed; this research folder stays untracked. Tasks 1-7 are done. Tasks 8 and 9 (live runs) wait for budget approval; Task 10 follows them.

### What changed

`emit_handoff(conn=, answer=)` now runs the check. `check_findings` re-runs the analyst's `answer(views)` with each unconfirmed finding on the claims' `sourcePaths` excluded, and fixed where a fix exists. Claims that change are held, and the user gets one fixed-wording `definition` question naming the findings. The controller writes `data-findings.json` into every analyst and verifier stage folder and protects it as a controller ref. No "keep the last good answer" behaviour was added.

### Commits (oldest first)

| Commit | What |
|---|---|
| 578c9c9 | Task 1: `sweep` returns `{finding id: [result keys]}` |
| 30c67da | Task 2: `findings_views`, `check_findings` |
| 12de19b | Task 3: `emit_handoff` holds changed claims, adds question and coverage line |
| 624f00b | Task 4: `findingsContext`; orchestrator writes and protects `data-findings.json` |
| 102ea5c | Task 5: guide section and the analyst/verifier prompt sentences |

### Deviations from the plan (all review-driven, each with a regression test or a doc fix)

| # | Commit | Why |
|---|---|---|
| 1 | bf17dfa | Sweep test could not tell per-finding key attribution from one global key list. Test only. |
| 2 | c66bc7f | Mutation `('exclude',)` left all tests green: the `fix` half of the sweep was untested. Test only. |
| 3 | 6299d66 | **Contract change.** The plan let `answer()` omit claims; an omitted claim was approved unchecked, which made the enforcement bypassable. Now every approved claim whose sources have unconfirmed findings must be in `answer`. The `emit_handoff` docstring and the guide sentence were amended to match. |
| 4 | eed6681 | `check_findings` left `findings_s{i}_view` in the last sweep state (readable by name afterwards, persisted in a file-backed db). Views are rebuilt at the confirmed state in a `finally`. |
| 5 | 5a6da20 | Pre-existing on main: a `fromExecution` handoff's review reasons went into both `handoff.json` and the printed facts, so the user saw the question twice. TS now dedupes identical reasons. |
| 6 | 4eeca39 | Nothing told the coordinator the exact `Data finding <id>: keep\|exclude\|fix` wording, so an answer could be silently ignored and the question would repeat. One sentence in the contract description; the treatment parse is case-insensitive. (My instruction to lower-case the finding ID as well was wrong, because IDs are `F-` plus lowercase hex; the implementer lower-cased the treatment only.) |
| 7 | bea7209 | The stage-file test never ran a verifier stage. It now does (question 'Review revenue independently'). |
| 8 | 00afa69 | `docs/architecture.md` described the old model-side `treated_view`/`sweep` flow. One sentence. |
| 9 | ae87e90 | Guide: `answer` must not be given keys that are not claim ids; keep it side-effect free (it runs about 4 times per finding); do not read `.raw` for findings workspaces; import line in the example. |
| 10 | 491ac1e | A generator passed as `claims` was consumed by the check (zero checks emitted, or a misleading error). `claims=list(claims)`. |
| 11 | a784882 | The controller's `data-findings.json` was offered to the model as an available result file. Excluded in `handoffContext`. |
| 12 | 15cff5b | Guide: query `views[...]` inside `answer` on every call (a table or DataFrame built from them beforehand hid the pence trap and five other findings from the check); the example tolerates a treatment that leaves no rows. |
| 13 | 89484c5 | Test helper `staged(confirmed=None)` parameter was never used. Dropped. |

### Known and deliberately not changed

1. A confirmed `fix` on a finding that has no fix makes `findings_views` raise on every call until `context.md` is corrected (pre-existing semantics; now applied automatically).
2. An answer that flips back (exclude, keep, exclude) is lost: `context-notes` dedupes the third line, and the parser takes the last match.
3. A NaN in `answer` compares as changed, which masks the `approved claims need a value` guard and asks a false question.
4. Keys that appear only in treated runs (not the untreated one) are not validated and can leak into the question's claim IDs.
5. The question separates findings with `\n`, which renders as a soft break in markdown. `\n- ` would fix the layout (changes the fixed wording).
6. A manual analyst packet without `fromExecution` bypasses `emit_handoff` and so the check. Rejecting such packets when `data-findings.json` exists would close it, but could break legitimate flows.
7. Approved claim values are never compared with `answer`'s result: a claim computed from raw rows with `answer` computed from views passes. A guard is about four lines but risks false refusals on rounding. The user should decide.
8. The check runs before the cheap validations in `emit_handoff`, so a script missing a diagnostic pays 13-21 s per refused attempt (the `execute_analysis` timeout is 120 s).
9. Coordinator history clips messages at 5,000 characters, so a question naming more than about 33 findings loses its trailing IDs.
10. The verifier and analyst prompt sentences are thin (they rely on the guide pointer). The live runs will show whether that matters.
11. Unrounded float answers can give false holds. The guide asks for rounded values.
12. Guide line 3 still presents `sales.raw` as the source table without a findings caveat; `HARNESS_TOOLS` in the examples is a placeholder (pre-existing).

### Verification

- `npm run typecheck` clean, `npm test` **349 passed** (343 baseline, plus 6), `npm run test:python` **59 passed** (48 baseline, plus 11), `npm run format:check` clean. No order dependence (reversed order and per-test reversed order also pass).
- Task 6 (deterministic acceptance, no model calls; script `.cache/findings-check-acceptance.py`, outputs `.cache/findings-check-seeded.json` and `findings-check-clean.json`), run twice (before and after the review fixes) with identical outcomes:
  - **Seeded pack:** base `{'top_sku': '47566', 'top_sku_gp': 165596.19}` (wrong because of the traps). `top_sku` held, naming `x1e2 vs product_id median` on `sales_transactions.csv unit_price_gbp` (83 rows) and `duplicate-key conflicting` on `product_master.csv product_id` (4 rows). `top_sku_gp` held by 7 findings. The question lists 7 findings. Check time 12.4 s, then 13.8 s.
  - **Clean pack:** base `{'top_sku': '22423', 'top_sku_gp': 139548.15}` (correct). `top_sku` approved. `top_sku_gp` held by one natural finding: `mixed-text` on `sales_transactions.csv invoice_id`, 19,500 rows (most likely credit notes). Check time 6.0 s, then 6.6 s.
- Real execution path: the whole-change reviewer ran a generated analyst script through `record_execution.py` (wrapped connection, CWD = stage folder) on the seeded pack and got the same holds and question; the check took 20.9 s under the wrapper (13.2 s without), against the 120 s execution timeout.

### Size

`data_findings.py` 215 to 266 lines; `harness_output.py` 86 to 99; TypeScript about +30 net (`data-findings.ts` +18, `orchestrator.ts` +8/-2, `checkpoints.ts` +3/-2, one line each in `handoff.ts`, `output-contract.ts`; `role-prompts.ts` two sentences). The plan estimated about 80 production lines.

### Not yet done

Task 8 (seeded live run, Luna and DeepSeek 4.1 Flash high, $0.20) and Task 9 (clean pack as-is and with the credit-note finding confirmed, $0.40) need the user's budget approval. Task 10 (Experiment 4 write-up) follows them.
