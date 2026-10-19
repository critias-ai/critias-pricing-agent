# 03. Semantic and metric layers; text-to-SQL

Date: 2026-10-13. Workstream 3 of the messy-data determinism research. Sources are primary documentation, papers and vendor engineering posts; vendor claims are labelled as such.

## 1. Summary

- **Letting the model choose metrics, dimensions, filters and periods, with a deterministic engine compiling the query, is the best-supported way to make results consistent.** The cleanest recent test (dbt Labs, April 2026, 11 questions x 20 runs, Sonnet 4.6 and GPT-5.3-Codex) found a semantic layer scored 100% on questions inside its scope, versus 51-63% for raw text-to-SQL on the same questions ([dbt blog](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026)). It is a vendor-run test on one small dataset, so read it as directional.
- **Most of the gain comes from modelling the data, not from the metric API.** In the same dbt study, adding three LLM-generated dbt models lifted raw text-to-SQL from 64.5% to 90.0% (Sonnet) and 84.1% (Codex). The semantic layer then added about 8-16 points on top (98.2% and 100%). The takeaway for us is that a prepared, clean, join-safe view matters more than the query language.
- **The failure mode changes from "plausible wrong number" to "error message".** dbt reports that questions outside the layer's reach return an error rather than a guess. The cost is coverage: on questions needing too many entity hops, the semantic layer scored 0% while text-to-SQL scored 70-100%. Any adoption needs an escape hatch.
- **Semantic layers solve join fan-out by declaring grain and keys, then refusing or compensating.** MetricFlow disallows primary-to-foreign fan-out joins; Cube requires a primary key and deduplicates by key; Looker uses symmetric aggregates; Malloy navigates the declared join graph so each sum is computed at its own grain. All of them depend on the declarations being true.
- **Semantic layers do not clean dirty data.** None of the systems examined detects duplicate source rows, blank costs, PACK or EUR values in GBP fields, or non-tying ledgers. They assume modelled, clean tables. Cleaning lives in the dbt-model or view-building step, which is where the harness has a gap.
- **Effective-dated lookups are supported but fragile.** MetricFlow's SCD Type II support (`validity_params`) requires non-overlapping windows and exactly one match per point in time ([dbt dimensions docs](https://docs.getdbt.com/docs/build/dimensions)). DuckDB `ASOF JOIN` returns at most one match ([DuckDB](https://duckdb.org/docs/current/guides/sql_features/asof_join.html)). Overlapping cost intervals break the "one match" precondition, and the layers say so only by failing, not by resolving it.
- **Auto-drafted semantic models are now mainstream, always with a human confirm step.** Snowflake's Semantic View Autopilot, Cortex Analyst's generator and Cube D3's AI Data Engineer all draft from profiles, query history or BI assets and ask a person to curate. This matches the harness's `pricing-intake` direction.
- **For dirty schemas, text-to-SQL research converges on schema pruning, value retrieval and execution feedback.** These help (CHESS ablations: -4.8 to -6.8 points when removed) but are heavy, and public results on real enterprise schemas stay low (Spider 2.0 agents: 21.3% at launch).

## 2. Systems and sources examined

| System | Source and date | What it shows |
|---|---|---|
| dbt Semantic Layer / MetricFlow | [Benchmark post, 2026-04-07](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026); [join logic](https://docs.getdbt.com/docs/build/join-logic); [dimensions / SCD II](https://docs.getdbt.com/docs/build/dimensions); [benchmark repo](https://github.com/dbt-labs/semantic-layer-llm-benchmarking) | Vendor-run measured benchmark (see section 3). Entity types (primary, unique, foreign, natural) drive join types; fan-out joins are not allowed. SCD II validity windows must not overlap. SCD II models cannot hold metrics. |
| data.world benchmark | [Sequeda et al., arXiv 2311.07509, Nov 2023](https://arxiv.org/pdf/2311.07509) | Academic-style preprint, 43 questions, GPT-4, insurance schema. Zero-shot SQL 16%, knowledge-graph route 54%. Both high-schema-complexity SQL cells scored 0%. dbt's 2023 replication reported 32.7% text-to-SQL and 60.5% via the semantic layer on its question subset. |
| Cube | [Joins reference](https://docs.cube.dev/reference/data-modeling/joins); [D3 launch, June 2025](https://cube.dev/blog/announcing-cube-d3) | Joins need a primary key so Cube can handle fan and chasm traps (selects distinct primary keys first, then joins back). All joins are LEFT; fact cube declares `many_to_one` toward dimensions. D3 agents generate semantic SQL from the model; claims only, no published accuracy. I did not find a documented Cube "AI API" query format. |
| LookML / Looker Conversational Analytics | [Google Cloud blog](https://cloud.google.com/blog/products/business-intelligence/how-lookers-semantic-layer-enhances-gen-ai-trustworthiness); [symmetric aggregates reference](https://docs.cloud.google.com/looker/docs/reference/param-explore-symmetric-aggregates) | Vendor claim: internal tests show the semantic layer reduces errors in gen-AI natural-language queries by up to two thirds (no data published). Symmetric aggregates are on by default and need declared primary keys. The assistant is limited to five Explores per conversation. |
| Malloy | [Join docs](https://docs.malloydata.dev/documentation/language/join); [Troubleshooting](https://docs.malloydata.dev/documentation/user_guides/troubleshooting) | `join_one` / `join_many` declarations let aggregates compute at the right grain. A wrongly declared `join_one` silently multiplies rows, and the documented diagnostic is a manual row-count check. |
| Snowflake Cortex Analyst | [Accuracy post, Aug 2024](https://snowflake.com/en/engineering-blog/cortex-analyst-text-to-sql-accuracy-bi); [Behind the scenes](https://snowflake.com/engineering-blog/snowflake-cortex-analyst-behind-the-scenes); [Verified query repository](https://docs.snowflake.com/en/user-guide/views-semantic/verified-query-repository); [Semantic View Autopilot](https://docs.snowflake.com/user-guide/views-semantic/autopilot) | Vendor claim: 90%+ on an internal 150-question set, about 2x GPT-4o single-prompt (51%); the set is unpublished. The post names the failure causes of raw SQL: unstated date assumptions, window logic on non-consecutive dates, filters applied before rolling windows, and missing metric definitions. Multiple LLM agents; routing prunes semantic models before the expensive call. Verified queries capture complex logic that column and measure mappings cannot. Autopilot drafts semantic views from query history and BI files. |
| Databricks Genie and metric views | [Genie best practices](https://docs.databricks.com/aws/genie/best-practices); [Metric views](https://docs.databricks.com/aws/en/business-semantics/metric-views); [Trusted assets](https://docs.databricks.com/aws/en/genie/trusted-assets) | Guidance only, no accuracy data. Start small (five or fewer tables), keep text instructions short, put business logic in example SQL. Parameterized example queries and UC SQL functions become "trusted assets". Metric views define source, joins, filter, dimensions and measures in YAML; measures are called with `MEASURE()` and query-time joins are not allowed. |
| AtScale | [BigDATAwire, Aug 2024](https://bigdatawire.com/2024/08/15/atscale-claims-text-to-sql-breakthrough-with-semantic-layer); [leaderboard](https://atscale.com/?p=24977) | Vendor test: 40 TPC-DS questions, Gemini Pro 1.5, 20% without versus 92.5% with the semantic layer. Small and vendor-run. |
| Wren AI MDL | [Wren blog](https://getwren.ai/post/why-the-semantic-layer-is-essential-for-reliable-text-to-sql-and-how-wren-ai-brings-it-to-life) | JSON model of tables, columns, relationships and metrics; undeclared columns are invisible to the agent. Engine (Rust, DataFusion) expands semantics before SQL reaches the database. No measured accuracy found. |
| BIRD | [Li et al., arXiv 2305.03111](https://arxiv.org/abs/2305.03111) | 12,751 pairs, 95 databases, emphasises dirty values and external-knowledge evidence; ChatGPT 40% versus humans 93% at publication. |
| Spider 2.0 | [arXiv 2411.07763](https://arxiv.org/abs/2411.07763) (error analysis from [HTML version](https://arxiv.org/html/2411.07763)) | Measured. 632 enterprise tasks, often over 1,000 columns. Best agent at launch 21.3%. Of 300 sampled failures: 35.5% data analysis and planning, 27.6% schema linking (column linking 16.6%), 8.3% join errors where no foreign keys exist. Tasks needing external documents succeeded 11.5% versus 26.6% without. |
| CHESS | [arXiv 2405.16755](https://arxiv.org/html/2405.16755v1) | Measured ablations on BIRD dev. Removing entity and context retrieval: -4.8 points; table selection: -6.1; final column selection: -5.4; revision: -6.8. Value retrieval uses keyword extraction, locality-sensitive hashing, embedding similarity and edit distance to match user phrases to stored values. Cutting tokens let an open Llama-3-70B pipeline reach 54.4 versus 55.8 for GPT-4-turbo on the same subsample. |
| CHASE-SQL | [arXiv 2410.01943](https://arxiv.org/abs/2410.01943v1) | 73.0% on the BIRD test set from multiple candidate generators and a learned selector. I did not verify an ablation for schema linking in this source. |
| BIRD-Interact | [arXiv 2510.05318](https://arxiv.org/pdf/2510.05318) | Measured error analysis: over 80% of failures came from incomplete ambiguity resolution. Tasks average about four ambiguities; models asked about one. |
| Cocoon, COLSQL | [Cocoon](https://arxiv.org/html/2404.12552v1); [COLSQL](https://arxiv.org/pdf/2408.04691v1) | LLMs add meaning to statistical profiles; users confirm rather than write. COLSQL treats LLM-written column descriptions as a semantic layer; LLMs often match human descriptions, but the LLM judge aligned poorly with humans. |

## 3. Patterns

### P1. Typed metric query instead of free-form code

**Moves from LLM to code:** join selection, aggregation grain, fan-out avoidance, metric formula, time-spine handling. The model emits something like `{metrics, group_by, filters, period}`; code compiles SQL.

**Evidence:** Measured, vendor-run. dbt 2026: 100% inside scope across both models, versus 51.2-62.5% raw text-to-SQL on the same questions, and zero-effect or negative effect from more reasoning (GPT latency over 20 s at `xhigh` versus about 8 s at `high`, no accuracy gain). Cortex Analyst and AtScale report 2x-4x gains, unpublished sets. The 2023 data.world study (GPT-4) points the same way.

**Cost:** the layer must exist and be right. Out-of-scope questions fail hard (0% for "too many hops").

### P2. Model the data first (prepared views)

**Moves from LLM to code:** cleaning, pre-joining, deduplication and column semantics.

**Evidence:** Measured, vendor-run. The dbt study's single largest jump was 64.5% to 90.0% for raw text-to-SQL after adding three LLM-generated dbt models, with no semantic layer involved. The dbt post itself recommends text-to-SQL for ad hoc work only after checking whether a small modelling change could close the gap. I could not confirm from the post alone how much human review the three generated models received.

**Cost:** low for a generic builder (views), moderate for correctness.

### P3. Declared grain and keys for fan-out safety

**Moves to code:** join-multiplication protection. MetricFlow classifies joins by entity type and forbids primary-to-foreign fan-out ([join logic](https://docs.getdbt.com/docs/build/join-logic)); Cube dedups by primary key; Looker uses symmetric aggregates and needs primary keys; Malloy computes each aggregate at its declared locality.

**Evidence:** Documented mechanisms; no head-to-head accuracy measurement found. Malloy's own troubleshooting page admits a wrong declaration "explodes silently", so the guard is only as good as the declared keys.

**Implication:** declarations need an automatic check (key uniqueness on the real data) before being trusted. That is a profiling job (workstream 2), not a modelling job.

### P4. Definitions, defaults and caveats stored as data

**Moves to code:** the choice of what "revenue" or "margin" means, default filters, synonyms. Snowflake semantic models carry measures, named filters and synonyms; Genie keeps short text instructions plus parameterized example SQL; Looker uses labels, descriptions and synonyms; metric views embed a `filter`.

**Evidence:** Snowflake's post attributes specific failures (a missing "average absolute error" definition; assumed years) to the absence of definitions (vendor). Databricks warns that too many text instructions reduce effectiveness, and tells authors to put query logic in example SQL instead (guidance, no data). Caveats such as "known defect, handling X" have no first-class slot in any system I found; they go into descriptions or comments.

### P5. Verified, parameterized queries ("trusted assets")

**Moves to code:** recurring questions are answered by a stored, reviewed query with parameters. Genie marks answers produced from an exact stored query as trusted; Cortex Analyst's verified query repository does the same.

**Evidence:** Claimed only. No ablation published for verified-query hit rate.

### P6. Schema pruning, value retrieval and execution feedback (dirty or large schemas)

**Moves to code:** deciding which tables and columns to show, and mapping user phrases to stored values ("Lighting & Candles" to its exact label).

**Evidence:** Measured on BIRD (CHESS ablations above). Spider 2.0 shows the problem is unsolved at scale: schema linking and planning are about 63% of sampled failures. For our scale (15 tables), pruning matters less than on those benchmarks, but value matching for filters is directly relevant. The VLDB 2026 AIDB workshop paper adds that sampling several SQL candidates and using disagreement as an ambiguity signal improves recall of clarification needs, using three LLM calls ([preprint](https://www.vldb.org/2026/Workshops/VLDB-Workshops-2026/AIDB/aidb26_10.pdf)). That is more machinery than we need now.

### P7. Draft the semantic model from the data, confirm with the user

**Moves to code:** inventory, keys, candidate joins, candidate measures; the person only confirms.

**Evidence:** Product claims only. Snowflake Autopilot ("curation instead of coding"), Cortex generator, Cube D3 AI Data Engineer, Tellius Kaiya Architect. Academically, Cocoon shows the profile-then-LLM-then-human-review pattern with a user study on anomaly judgement, not on semantic-model accuracy. I found no published measurement of draft-model accuracy against hand-built models.

### P8. Effective-dated (as-of) lookups

**Moves to code:** picking the one cost row valid on the sale date. MetricFlow expresses this as validity-window joins (`valid_from` inclusive, `valid_to` exclusive or null) with a hard rule that windows must not overlap, and a rule that the coarser period uses the value valid at the period start. DuckDB `ASOF JOIN` gives the latest row at or before the date but says nothing about validity end, so it will silently use an expired cost.

**Evidence:** Documentation only.

## 4. Relevance to the pricing harness

| Defect or finding (CONTEXT.md) | Pattern | What it would change |
|---|---|---|
| Analyst rediscovers defects each run; different judgements across runs | P2, P4 | A prepared view fixes the handling once at upload (dedup rule, fan-out guard, flags), so the analyst never re-derives it. Judgement calls such as "blank UoM treated as EA" become declared defaults, not per-run choices. |
| 96% of time in inference; 746-1008 s for a simple question | P1 | The model emits a short structured query rather than writing and debugging pages of Python. dbt saw no accuracy benefit and higher latency from more reasoning in the layer setup. |
| Duplicate master keys fanning out joins | P3 | Declared keys with an automatic uniqueness check; the prepared view picks a deterministic survivor or refuses and flags. |
| 34k repeated source rows, duplicate adjustment events and service keys | P2 | Not handled by any semantic layer. Needs an ingest-time rule in the view builder (exact-duplicate removal with a count reported). |
| 2,138 lines with no effective cost; overlapping cost intervals; one SKU twice | P8, P3 | An as-of join with validity windows returns `NULL` cost for gaps (visible, countable) and, for overlaps, must be resolved by a deterministic tie rule or flagged. MetricFlow's approach (forbid overlap) would fail the whole model for that SKU. |
| PACK or EUR in a GBP field; blank unit costs | P4 | Normalisation or exclusion has to be done and recorded in the view, with a "usable cost" flag. No external layer does this for us. |
| `POST` and `TEST001` classified as merchandise | P4 | A confirmed definition ("merchandise = excluding these SKUs") stored once, applied by the compiler. |
| Rebates at customer-period level with `product_id=ALL` | P3 | This is a grain mismatch. A grain-aware engine would report rebates only at customer-period grain, or require an allocation rule, rather than silently spreading them. Malloy's per-grain aggregation is the closest pattern. |
| 243k missing customer IDs; credits as negative quantity | P4, P1 | Defaults declared as part of the measure (credits included in net revenue; missing-ID rows kept but excluded from customer views). |
| Partial current quarter; "last five complete quarters" | P1 | A period resolver in code ("complete quarters", as-of date from data max) removes a whole class of model arithmetic. |
| Ledgers do not tie to `finance_monthly`; chasing a £2.5k residual | P4, P5 | Store a tolerance and a "known non-tying" note with the definition so the model does not chase it. None of the systems provides this; it comes from the verification workstream. |
| Planner adds unrequested validation | P1 | A fixed compile path removes the open-ended planning step for covered questions. |
| Large profile prompts (37 KB) | P6, P4 | A pruned semantic summary (Cortex routing prunes models before the big LLM call; Genie advises five or fewer tables) replaces full column stats. |

## 5. Recommendations (simplest first)

1. **Adopt: build a prepared analysis view at upload, in code, with no LLM in the loop.** Deterministic exact-duplicate removal, key uniqueness checks, unit and currency flags, an as-of-joined cost column with a status (`ok`, `no_cost`, `overlap`, `unusable_unit`), and a row-count ledger. This is the equivalent of the dbt "modelled schema" step, which produced the largest measured gain. It stays general because it is built from profiling results, not from Northbridge rules. Complexity: low to moderate. Uses DuckDB `ASOF JOIN` plus an explicit end-date check.
2. **Adopt: a small, typed query object for common asks.** Fields: measure (from the confirmed list), group-by, filters, period spec, basis. Code compiles it against the prepared view and returns the result plus the standard diagnostics (coverage, excluded counts). Fan-out protection comes from the view's declared grain. Keep it to a handful of measures (revenue, cost, margin, margin %, quantity, credits) so it stays simple. Keep a free-SQL fallback over the same view for unsupported questions, because the dbt benchmark shows hard failures outside scope (0% on multi-hop questions) are a real cost. Evidence: measured, vendor-run (P1).
3. **Adopt: semantic model as a drafted, user-confirmed file.** Code drafts keys, joins, candidate measures and units from profiles; an LLM proposes names and descriptions; `pricing-intake` confirms and writes the result to `.pricing/context.md` or a YAML sibling. Store, per measure: definition, default filters, known caveats with their agreed handling, and tolerance. Matches Autopilot and Cocoon (claimed or small studies). Keep the file small: Cortex Analyst caps semantic models at 32K tokens after samples and verified queries, and Databricks advises few tables and short instructions.
4. **Try: value matching for filters.** A small deterministic matcher (exact, case-insensitive, then edit distance) from user phrases to stored category and SKU values, with the candidates shown to the model. CHESS's retrieval ablation (-4.8 points) supports it, but our category lists are small enough that a plain list in the prompt may suffice.
5. **Try: parameterized verified queries for recurring questions.** Store a reviewed query once the user accepts an answer, reuse it with parameters (Genie trusted assets, Cortex verified queries). No ablation exists; gain is consistency, not accuracy.
6. **Try: period resolver in code.** "Last five complete quarters", partial-period labelling, as-of date derived from data. Small, deterministic, removes a recurring source of drift.
7. **Skip for now: adopting dbt, Cube, Looker, Malloy or Wren as a dependency.** They assume curated, clean, modelled sources and a server-side deployment; none handles our defect classes. Borrow the ideas (declared grain and keys, symmetric aggregation, validity windows, refuse-instead-of-guess) rather than the products.
8. **Skip: CHASE-SQL-style multi-candidate generation and fine-tuning.** The benefit is on very hard benchmarks, with higher latency and cost. Our bottleneck is time, and the compiled path should be deterministic.

## 6. Open questions and weak evidence

- **Most accuracy numbers are vendor-run and small.** dbt: 11 questions; AtScale: 40; data.world: 43; Snowflake and Google: unpublished internal sets. Treat all as directional. Only Spider 2.0, BIRD, BIRD-Interact and the CHESS ablations are public benchmark results, and they measure text-to-SQL rather than semantic layers.
- **No published test covers our shape.** Nothing tests effective-dated cost lookups, mid-month period ends, credits, rebates without product allocation, or non-tying ledgers over a metric layer. Whether a typed query object would cut our 746 s is untested; the reasoning is that output length and rework shrink, but the dbt latencies (8-20 s) are for single-call agents on clean data.
- **dbt's gain from "three LLM-generated dbt models" is under-specified.** The post does not describe the review the models got, so we cannot tell how much was automatic. It is also unclear which of the "minimal" and "modeled" configurations produced the headline figures.
- **Auto-inferred models are unmeasured.** No source reports accuracy of draft semantic models versus curated ones. Snowflake's clustering of query history needs history that a fresh upload does not have.
- **Grain-mismatched measures (rebates at ALL) have no standard treatment** in the systems examined. This probably needs a bound or an explicit allocation rule from workstream 5.
- **Ambiguity handling is weak everywhere.** BIRD-Interact found models asked for clarification about once per task against about four ambiguities. A code-side check for ambiguity (several candidate columns for one measure word) is a better bet than relying on the model to ask.
- **I could not retrieve:** Cube's AI API query format, the Looker conversational API internals, and Snowflake's Figure 1 per-system values (image only).
