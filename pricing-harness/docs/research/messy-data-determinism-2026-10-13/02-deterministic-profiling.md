# 02 - Deterministic profiling and data-quality layers

Date: 2026-10-13. Workstream 2. Question: which defects can be detected deterministically and generically, before the model sees the question, and in what compact form should the findings reach it?

## 1. Summary

- **The existing DQ tools give us checks, not a register.** dbt tests, dbt-expectations, Soda, ODCS and Frictionless all express a check as a rule that someone writes (unique, not_null, relationships, duplicate_count, missing_count). Only Deequ and the older Great Expectations profilers *suggest* rules from the data, and GX removed its profilers in 1.0 ([GX migration guide](https://docs.greatexpectations.io/docs/reference/learn/migration_guide/)). None of them ranks findings by value at stake or attaches a default handling. We would build that layer ourselves; the checks underneath are standard.
- **Every defect class in the pack reduces to a short SQL shape that runs on 1 M rows in DuckDB.** Single-column profile (one scan), key uniqueness (GROUP BY), exact containment (anti-join), interval overlap (window function per key), monthly tie-out (GROUP BY month). None needs sampling at 1 M rows. Cost numbers below are estimates from published DuckDB figures, not my own measurements (see section 6).
- **Key and FK inference must tolerate dirty keys.** HoPF, Auto-BI and Deequ all assume that a key is *exactly or almost exactly* unique. A master table with one duplicated key breaks that assumption. The inference should score a column as "key-like, 99.9 % unique" and then report the violators as a defect, not discard the candidate.
- **Deterministic detection beat LLM detection in the one controlled study I found.** An agentic cleaning study with 126 runs found the plain profiling baseline reached detection F1 0.561 against 0.421 for the best LLM configuration ([arXiv 2608.14765](https://arxiv.org/abs/2608.14765)). It is a single-author preprint on injected corruption, so treat it as supporting, not decisive.
- **The register should be small, ranked and addressable.** One line per issue with a stable ID, severity from value at stake, and a default handling from a fixed vocabulary. About 1-3 KB for a pack like ours, against 37 KB of column stats today. Detail (sample rows, full counts) stays behind a lookup tool.
- **Weakest areas, by evidence:** unit/currency mismatches and non-tying aggregates. I found no primary source that detects them generically; they are heuristic checks of our own design and should ship as "try", flagged with lower confidence.
- **Do not take a runtime dependency on ydata-profiling, GX, Soda, Pandera or cleanlab.** They are pandas-bound or rule-authoring frameworks, and DuckDB SQL covers what we need. Borrow their vocabularies (severity, dimension names, metrics).

## 2. Systems and sources examined

| Source | Date / link | What it shows | Claim type |
|---|---|---|---|
| DuckDB `SUMMARIZE` | [docs](https://duckdb.org/docs/current/guides/meta/summarize.html) | Per-column min, max, approx_unique, avg, std, q25/q50/q75, count, null_percentage in one call; quantiles approximate | Official docs |
| DuckDB aggregates | [docs](https://duckdb.org/docs/current/sql/functions/aggregates.html) | `approx_count_distinct` (HyperLogLog), `approx_top_k`, `histogram`, `entropy`, `mode`, `countif`, `arg_min`, `regr_*` | Official docs |
| DuckDB IEJoin | [blog 2022-05-27](https://duckdb.org/2022/05/27/iejoin.html) | Two-inequality (interval-overlap) joins: 100 K-row self-join 0.28 s vs 21 s nested loop; 30 K-row overlap join 0.23 s | Vendor, self-run |
| DuckDB scale | [blog 2025-05-19](https://duckdb.org/2025/05/19/the-lost-decade-of-small-data.html) | TPC-H SF1000 (6 B rows) on an M3 Max: geometric mean 12 s over 22 queries | Vendor, published code |
| Deequ (Schelter et al.) | [VLDB 2018](https://www.vldb.org/pvldb/vol11/p1781-schelter.pdf) | Constraint suggestion from 3 shared scans (type, completeness, HLL distinct; numeric stats; low-cardinality histograms). Rules: complete, consistent type, unique if ratio within HLL error, range, categorical set | Peer-reviewed, measured on 2 public datasets |
| Auto-BI (Lin, He, Chaudhuri) | [VLDB 2023](https://arxiv.org/pdf/2306.12515) | Join (FK) prediction: 21 features (name similarity, value Jaccard/containment) plus global graph optimisation. Edge precision 0.98 and recall 0.879 vs best baseline 0.846/0.77 on 1,000 real BI models | Peer-reviewed, authors' own benchmark |
| HoPF (Jiang, Naumann) | [JIIS 2020](https://hpi.de/oldsite/fileadmin/user_upload/fachgebiete/naumann/publications/PDFs/2020_jiang_holistic.pdf) | Joint PK/FK detection by scoring unique column combinations and inclusion dependencies (cardinality, value length, position, name; FK coverage and distribution). 88 % PK and 91 % FK recall average | Peer-reviewed |
| HyUCC | [BTW 2017](https://hpi.de/oldsite/fileadmin/user_upload/fachgebiete/naumann/publications/PDFs/2017_papenbrock_a.pdf) | Composite-key (UCC) discovery; authors say earlier algorithms fail beyond about 50 columns and a million rows | Authors' claim |
| Scalable join inference | [arXiv 2603.04176](https://arxiv.org/pdf/2603.04176) | Recent join/PK inference for large context graphs; uses HoPF as baseline, recall about 88 % | Preprint |
| dbt data tests | [docs](https://docs.getdbt.com/docs/build/data-tests) | Four generic tests (unique, not_null, accepted_values, relationships), each a query returning violating rows; `severity`, `warn_if`/`error_if`, `store_failures` | Official docs |
| dbt-expectations | [repo](https://github.com/metaplane/dbt-expectations) | Compound-column uniqueness, row-count equality across tables, column sum between bounds, pair comparisons | Community package |
| Soda | [docs](https://docs.soda.io/soda-cl/metrics-and-checks.html) | duplicate_count, missing_count, reference checks, freshness, schema checks; all user-configured | Official docs |
| Great Expectations | [0.15 assistant how-to](https://legacy.017.docs.greatexpectations.io/docs/0.15.50/guides/expectations/data_assistants/how_to_create_an_expectation_suite_with_the_onboarding_data_assistant/), [1.0 migration](https://docs.greatexpectations.io/docs/reference/learn/migration_guide/) | Onboarding Data Assistant generated suites from profiles; profilers removed in 1.0 | Official docs |
| ODCS data-quality | [spec](https://bitol-io.github.io/open-data-contract-standard/latest/data-quality/) | Library metrics nullValues, missingValues, invalidValues, duplicateValues, rowCount; dimensions; `severity`; `unit` rows/percent | Spec |
| Frictionless | [validation guide](https://framework.frictionlessdata.io/docs/guides/validating-data.html) | Structural errors: duplicate-label, missing-cell, extra-cell, blank-row, type-error; a schema describes expected types | Official docs |
| ydata-profiling | [big data page](https://docs.profiling.ydata.ai/4.5/features/big_data) | Alerts are automatic suggestions; `minimal=True` is the advice for large data; pandas in memory | Official docs |
| cleanlab Datalab | [issue types](https://docs.cleanlab.ai/stable/cleanlab/datalab/guide/issue_type_description.html) | Label, outlier, near-duplicate, null, identifier-column issues, scored 0-1; needs numeric feature vectors or model predictions | Official docs |
| Pandera | [schema inference](https://pandera.readthedocs.io/en/stable/schema_inference.html) | `infer_schema` gives a draft schema, "rough draft"; no profile of nulls or cardinality | Official docs |
| ProfiliTable | [arXiv 2605.12376](https://arxiv.org/html/2605.12376) | LLM profiler agent returns a short JSON (about 200 characters per table) fed to a generator; removing it lowers all metrics, most on multi-step tasks | Preprint; numbers only in a figure |
| Reference-free cleaning study | [arXiv 2608.14765](https://arxiv.org/abs/2608.14765) | Profiling baseline detection F1 0.561 vs best LLM configuration 0.421 | Preprint, 126 runs |
| CleanAgent / AutoDCWorkflow | [2403.08291](https://arxiv.org/pdf/2403.08291), [2412.06724](https://arxiv.org/pdf/2412.06724) | LLM picks cleaning operations from fixed API libraries (Dataprep.Clean, OpenRefine); AutoDCWorkflow has the LLM write a per-column quality report | Papers; both let the LLM do the detection |

## 3. Patterns

### P1. One-scan column profile, computed at upload

- **Moves from LLM to code:** the model stops inspecting columns with ad hoc Python.
- **Mechanism:** DuckDB `SUMMARIZE` plus extras SUMMARIZE lacks: count of empty/whitespace strings, sentinel strings (`N/A`, `NULL`, `-`), distinct count (exact for small tables), negative/zero share, top-k values for low-cardinality columns, min/max date.
- **Evidence:** Deequ does the same in three shared scans and says it was designed to keep passes independent of column count ([VLDB 2018](https://www.vldb.org/pvldb/vol11/p1781-schelter.pdf), measured). ydata-profiling's own advice for big data is a minimal profile ([docs](https://docs.profiling.ydata.ai/4.5/features/big_data)).
- **Cost:** low. One scan per table.

### P2. Key and grain inference with violators reported

- **Moves:** "what is the key of this table, and is it really unique?"
- **Mechanism:** candidate key = column or small column set scoring high on uniqueness ratio, short values, name tokens (`id`, `code`, `key`, `no`), early position. This is the HoPF/Deequ heuristic family. Then `GROUP BY key HAVING count(*) > 1` gives the violators, the duplicate-row count and the rows at stake. For effective-dated tables, the grain is (key, start date).
- **Evidence:** HoPF reports 88 % PK recall on benchmarks and real data (authors' measurement). Deequ's suggestion rule is shown to be fragile: on a 10 % sample it suggested `isUnique` for a column that was only 64 % unique on the rest, and a name-and-type classifier gave 81 % vs 2 % probability for the true and false cases ([Deequ section 5.3](https://www.vldb.org/pvldb/vol11/p1781-schelter.pdf)). So: use exact GROUP BY at 1 M rows, not HyperLogLog, and let the name prior break ties.
- **Cost:** low for single columns. Composite keys: try only (id + date) style pairs, not the full lattice (HyUCC-style discovery exists but is designed for wide tables; skip).

### P3. FK inference with exact containment, then fan-out and referential gap

- **Moves:** "how do these tables join, and what breaks when they do?"
- **Mechanism:** for each (child column, parent key) pair with compatible type and either matching name or high containment, compute exact containment `|child ∩ parent| / |child distinct|`. Accept at >= 0.9 or name match plus >= 0.5. Then three outputs per accepted edge:
  1. **Referential gap:** rows in child with no parent (anti-join), and their share of the child's main measure.
  2. **Parent duplicates:** parent key with count > 1.
  3. **Fan-out:** `count(*)` of the join minus `count(*)` of the child; the inflated measure sum versus the plain sum.
- **Evidence:** dbt's `relationships` test is exactly the anti-join, shipped as a standard. Auto-BI shows name similarity plus value containment is the strong feature set, edge precision 0.98 against 0.846 for the best prior method, on 1,000 real models (authors' benchmark; Power BI-style schemas, so optimism is likely for ad hoc CSV packs). Its schema-only variant lost only 2-3 points and ran in 2-3 s on the largest cases.
- **Cost:** moderate but bounded. Candidate pairs are pruned by type and name first; containment is a hash semi-join on distinct values.

### P4. Duplicate rows and duplicate business events

- **Moves:** "are repeated rows real repeats?"
- **Mechanism:** (a) full-row duplicates: `GROUP BY ALL HAVING count(*)>1`, giving the surplus row count and its share of the measure; (b) near-key duplicates: duplicates on the inferred key or (entity, date, type) tuple where other columns *differ* (conflicting duplicates) versus *agree* (exact repeats). The two need different default handling.
- **Evidence:** dbt-expectations has `expect_compound_columns_to_be_unique`; Soda has `duplicate_count`; ODCS has `duplicateValues` at schema level. cleanlab's near-duplicate detection is numeric-embedding based and is not needed for exact repeats.
- **Cost:** low. A hash aggregate over all columns on 1 M rows.

### P5. Interval overlap and gaps in effective-dated tables

- **Moves:** the cost-history overlap and missing-cost defects.
- **Mechanism:** detect a table with a start/end date pair (names like `effective_from`/`valid_to`, or two date columns where start <= end on most rows). Per entity key: running `max(end)` over rows ordered by start; if a row's start is below the running max, it overlaps. `LEAD(start)` greater than `end` marks a gap. Open ends (null) become a sentinel date. A coverage check against a fact table (sales dated outside any interval) is the "line without effective cost" count.
- **Evidence:** the window-function pattern is standard SQL (I found it only in forum and blog sources, e.g. [this walkthrough](https://www.mssqltips.com/tutorial/sql-server-window-functions-gaps-and-islands-problem/)); DuckDB's range-join operator makes the pairwise form fast too: 100 K-row interval self-join 0.28 s (vendor measurement, [IEJoin blog](https://duckdb.org/2022/05/27/iejoin.html)). No data-quality framework ships this generically; dbt-expectations does not.
- **Cost:** low with the window form, linear per key.

### P6. Required-looking nulls and blanks

- **Moves:** blank unit cost, missing customer ID.
- **Mechanism:** a field "looks required" if it is a key, an FK child, a measure in a fact or history table, or has a null rate below some threshold (Deequ uses "complete in sample" for `isComplete` and a lower confidence bound for partial completeness). Count nulls, empty strings, whitespace-only and sentinel tokens. Report the rate, the rows, and the share of the measure behind them. Cross-reference: nulls concentrated on the *current* or *latest* rows are more serious than uniform nulls (check null rate by period and by status).
- **Evidence:** ODCS `nullValues`/`missingValues` and dbt `not_null` are the same primitive. The concentration cut is our addition, no source.
- **Cost:** low.

### P7. Unit and currency consistency (heuristic, weakest evidence)

- **Moves:** `cost_uom=PACK`, `currency=EUR` inside `unit_cost_gbp`, EUR service costs in a GBP field.
- **Mechanism:** (a) find sibling "unit-domain" columns: low-cardinality text columns whose name has `uom|unit|currency|ccy` or whose values match ISO 4217 codes or a UoM vocabulary; (b) from a measure column's name tokens (`gbp`, `usd`, `eur`, `per_unit`) derive the *expected* domain value; (c) report any rows where the sibling domain value differs from the expected one, with rows and measure share; (d) optionally report the magnitude shift (median of the measure per domain value).
- **Evidence:** none found in primary sources; DQ frameworks check formats and sets (`accepted_values`), not name-versus-value semantics. Auto-Validate learns value *patterns* from data lakes ([SIGMOD 2021](https://arxiv.org/pdf/2104.04659)) but not unit semantics. Mark as heuristic.
- **Cost:** low.

### P8. Sign conventions and partial periods

- **Mechanism:** (a) per numeric column, negative share and zero share; for a column with a few percent negatives, check whether negatives co-occur with a document-type or flag column (credits). (b) For each date column in a fact table: the last time bucket's days present versus days in the bucket, and its row count versus the median of the previous complete buckets; flag `partial` when days present < days in bucket.
- **Evidence:** ydata-profiling raises zeros and negative alerts automatically (per docs; I could not retrieve the alert list directly). The partial-period test resembles Soda/dbt freshness checks, but those test staleness, not completeness of the last bucket. Our design.
- **Cost:** low.

### P9. Aggregates that do not tie

- **Mechanism:** for each pair (detail table, rollup table) sharing a time column and a compatible entity key, compare per-bucket sums of numeric columns where the pair correlates highly; report the largest absolute and relative differences. Only compare pairs whose monthly series have correlation near 1 to avoid junk comparisons.
- **Evidence:** dbt-expectations has `expect_table_row_count_to_equal_other_table` and sum-between checks, so pairwise reconciliation is accepted practice, but *discovering* which pairs to reconcile is not in any source I found. Treat as an experiment.
- **Cost:** low for the comparison, moderate for pair search.

### P10. How the findings reach the model

- **Moves:** the model stops reading raw profiles and re-deriving defects.
- **Evidence for the shape:** ProfiliTable passes a profiler report of about 200 characters per table, and removing it hurts (preprint; the effect size is in a figure only). Soda, dbt and ODCS all return *counts plus failing-row samples on demand*, not full dumps. dbt's `store_failures` keeps full failing rows in a table, and the summary carries only a count.
- **Design:** three layers, sketched in section 5.

## 4. Relevance to the pricing harness

| Observed defect or finding | Patterns | What changes |
|---|---|---|
| 243 k missing customer IDs | P6, P3 | A register line with rows, measure share and "excluded from per-customer views; totals unaffected" default |
| 34 k repeated source rows; duplicate adjustment event; duplicate service keys | P4 | Distinguish exact repeats (default: dedupe) from conflicting duplicates (default: ask or keep latest) |
| 23 k negative-quantity lines | P8 | Record as credits, not errors; the default is "keep, net of credits" |
| Duplicate master keys that fan out joins | P2, P3 | Fan-out line states the inflation of the measure sum; the model never joins the raw master |
| 2,138 lines without an effective cost; one cost gap | P5, P3 | Coverage count and value share of uncovered sales, which feeds the "bound the uncovered population" rule |
| Blank unit-cost values on current records | P6 | Concentration cut shows they sit on current records |
| One SKU with overlapping intervals | P5 | One line naming the key and the overlap span |
| PACK/EUR units in GBP fields | P7 | A deterministic "unit conflict" line replaces the run-to-run judgement on 85123A |
| Rebates at `product_id=ALL` | P3 | The sentinel appears as an unmatched FK value with a named sentinel candidate; allocation stays a user decision |
| Ledgers do not tie to `finance_monthly` | P9 | Pre-computed residual and a stated tolerance, so the analyst does not chase a £2.5 k residual |
| Partial current quarter | P8 | `partial_period` line with the cut-off date |
| Slow-run findings: rediscovery, run-to-run variance | all | Same register in every stage, with stable IDs that the analyst cites instead of rediscovering |
| Large prompts | P10 | The register replaces most of the 37 KB profile in the prompt; full profiles move behind a lookup |

## 5. Sketch: the issue register and its compact form

### Fields (one record per issue)

| Field | Meaning |
|---|---|
| `id` | Stable, content-derived (hash of check type, table, columns); same data gives the same ID every run |
| `check` | From a fixed list: `key_dup`, `row_dup`, `fk_gap`, `fanout`, `interval_overlap`, `interval_gap`, `required_null`, `unit_conflict`, `sign_mix`, `partial_period`, `no_tie` |
| `where` | Table and columns (and key value for interval issues) |
| `rows` / `rows_pct` | Affected rows and share of the table |
| `at_stake` | Share of the main measure(s) affected, with the measure name; null when no measure applies |
| `severity` | `block` (can change a headline number: fan-out, conflicting duplicates, unit conflict in a measure), `material` (at_stake >= 1 %), `note` |
| `confidence` | `exact` (computed on all rows) or `heuristic` (inferred key, unit mapping, tie-out pair) |
| `default` | One of a fixed vocabulary: `dedupe_exact`, `dedupe_keep_latest`, `exclude_rows`, `bound_uncovered`, `use_dimension_unique`, `convert_unit_if_rate_known`, `report_only`, `ask_user` |
| `decision` | Empty until the user confirms; then the stored handling (workstream 5) |
| `sample_ref` | Pointer to a query that returns up to 20 example rows (not inlined) |

Severity is computed by rules in code (the thresholds above), never by the model.

### Prompt form (about 1-3 KB)

```
DATA ISSUES (computed at upload 2026-10-13; ids are stable; use defaults unless a decision is set)
[block] I-7f3a fanout   product_master.sku dup(3 keys) -> sales.sku join inflates revenue +0.4% | default: use_dimension_unique
[block] I-2c91 unit_conflict cost_hist.unit_cost_gbp: cost_uom=PACK 412 rows (0.2%), currency=EUR 88 rows | default: exclude_rows, bound
[mat]   I-91bd required_null sales.customer_id 22.7% rows, 9.1% revenue | default: report_only (excluded from per-customer views)
[mat]   I-aa05 row_dup  sales 34,102 exact repeats (3.2% rows, 3.1% revenue) | default: dedupe_exact
[mat]   I-30e2 interval_gap cost_hist: 2,138 sales lines (1.1% revenue) lack effective cost | default: bound_uncovered
[note]  I-5d44 partial_period sales: last quarter has 41/92 days (cut-off 2026-08-10)
[note]  I-b208 no_tie ledger_monthly vs finance_monthly: max monthly diff 0.03% (tolerance 0.5%) -> ok
Tables: sales(grain: line_id, 1.07M) -> product_master(sku, N:1) -> customer_master(cust_id, N:1) ...
Detail: call issue_detail(id) for 20 sample rows and the exact query.
```

The numbers in that sketch are illustrative, not computed from the pack. Three things matter in it: severity sorted first, value at stake on every line, and a tied-out check also listed as "ok" so the model does not recheck it.

Two further rules from the evidence:

- **List clean results for the checks the model would otherwise run** (reconciliation within tolerance). That directly targets the "chased a £2.5 k residual" finding.
- **Keep the register separate from the column profile.** Column profiles (types, ranges, top values) go in a file the analyst can open; only the register and a one-line-per-table grain/join map ride in every prompt.

## 6. Cost at about 1 M rows (evidence and gaps)

Everything here is an estimate from published figures. I did not run DuckDB; I did not install anything.

- DuckDB on TPC-H SF1000 (6 B rows lineitem) on an M3 Max: geometric mean 12 s across all 22 queries, which are joins and aggregates ([vendor blog](https://duckdb.org/2025/05/19/the-lost-decade-of-small-data.html)). 1 M rows is about four orders of magnitude fewer; single GROUP BYs over it should be in the tens of milliseconds, a full SUMMARIZE of a 15-column table in well under a second, per table. Treat as an expectation to confirm.
- Deequ's design point: grouping metrics (uniqueness, entropy) are costlier than single-pass metrics, because they repartition ([Deequ 5.2](https://www.vldb.org/pvldb/vol11/p1781-schelter.pdf)). In DuckDB that means exact uniqueness is a hash aggregate per candidate key; keep candidates to a handful per table.
- Auto-BI's latency breakdown says unique-column and inclusion-dependency discovery dominates for the larger methods; the schema-only variant ran in 2-3 s on the largest cases ([Auto-BI](https://arxiv.org/pdf/2306.12515)). With 15 tables the pair space is small, but cap candidate pairs by type and name before computing containment.
- Interval overlap: the window form is linear per key; the range-join form handled 100 K rows in 0.28 s ([IEJoin blog](https://duckdb.org/2022/05/27/iejoin.html), vendor).
- Memory: `list()` and `string_agg()` do not spill to disk ([DuckDB tuning docs](https://duckdb.org/docs/current/guides/performance/how_to_tune_workloads.html)); avoid them for profiling at scale. Not a concern at 1 M rows.

A total budget of a few seconds per upload at this scale looks safe. A 20-line benchmark on a synthetic 1 M-row pack would settle it.

## 7. Recommendations (ranked, simplest first)

1. **Adopt: single-scan column profile with blank/sentinel/sign counts (P1).** Replace the 37 KB profile in prompts with a pointer; the full profile stays on disk.
2. **Adopt: key/grain inference with exact uniqueness and a violators count (P2), plus exact-repeat and conflicting-duplicate counts (P4).** These are the cheapest and cover the most severe defects (fan-out, repeated rows).
3. **Adopt: exact-containment FK inference with referential gaps and fan-out inflation (P3).** Use name plus type plus containment, no learned model.
4. **Adopt: required-looking null/blank report with concentration by period (P6), sign mix and partial last period (P8).**
5. **Adopt: interval overlap and gap per entity for tables with start/end columns, with the coverage count against fact tables (P5).**
6. **Adopt: the register itself with stable IDs, computed severity, fixed default vocabulary, and the "ok" lines (section 5).** Store handling decisions in `.pricing/context.md` keyed by ID so they survive across runs (links to workstream 5).
7. **Try: unit/currency conflict check (P7) and aggregate tie-out discovery (P9).** Mark as `heuristic` in the register; track precision on a handful of packs before trusting the severity.
8. **Try later: Auto-BI-style global join graph and HyUCC composite keys.** Only if the simple pair-wise inference misjudges joins on other packs.
9. **Skip: ydata-profiling, Great Expectations, Soda, Pandera, cleanlab as dependencies; skip LLM-written DQ rules at runtime.** They add weight without a register, ranking or defaults. LLM-generated rules (e.g. [AutoDCWorkflow](https://arxiv.org/pdf/2412.06724), [LeDQeR](https://arxiv.org/abs/2609.06053)) put detection back into the model, which is what we are removing.

## 8. Open questions and weak evidence

- **No measured timings from me.** All 1 M-row cost figures are inferences from vendor numbers. Needs a short benchmark.
- **Auto-BI and HoPF benchmarks are designed schemas.** Neither tests dirty keys, EUR-in-GBP columns or sentinel values like `ALL`. Expect lower recall on ad hoc packs.
- **No primary source for generic unit/currency or tie-out detection.** P7 and P9 are my designs. False-positive rate is unknown.
- **Severity thresholds (1 % at stake, 0.5 % tolerance) are placeholders.** They need tuning against what actually changes an answer.
- **How the register interacts with the controller is unmeasured.** Whether a ranked register reduces the "chases residuals" behaviour is plausible (it removes the need to look) but untested; ProfiliTable's ablation is the closest evidence and its numbers are only in a figure.
- **The agentic-cleaning preprints (2608.14765, 2609.06053, 2605.12376) are unreviewed**, and 2609.06053 gave no quantitative results in the abstract.
- **I could not retrieve ydata-profiling's alert list or GX 0.15's rule list directly**; statements about them rest on search summaries of their docs.
