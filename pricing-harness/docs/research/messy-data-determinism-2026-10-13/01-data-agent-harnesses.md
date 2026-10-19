# 01 Data-agent harness survey

Date: 2026-10-13. Workstream 1 of `PLAN.md`. External sources only; no harness code or data was read.

Evidence labels used below: **[vendor]** = vendor blog/doc claim with no public method; **[measured]** = published benchmark, ablation or paper with a stated protocol; **[secondary]** = third-party write-up of a primary source I could not open.

## 1. Summary

- **Every serious system moves the hard part out of the per-question prompt and into pre-built, curated context.** Hex says agent performance depends more on "rich context stores" than on system prompts or models [vendor]. OpenAI's internal data agent uses a nightly job to describe each table, then retrieves those descriptions at runtime [vendor/secondary]. Databricks, Snowflake, Google and Hex all ship a knowledge layer (instructions, example SQL, synonyms, join keys, value dictionaries) that the model reads and does not re-derive.
- **The only quantified ablation on what helps is Databricks' tuning walkthrough.** Going from 0/13 correct benchmark questions: naming, descriptions, keys and value sampling gave 54%; example SQL defining custom metrics gave 77%; text instructions gave 100% [vendor, but a stepwise ablation on one space]. Defined metrics and keys beat prose instructions on first contribution.
- **Free code versus governed query is the main action-space split.** Code-interpreter style products (ChatGPT, Claude code execution, Julius, PandasAI, Data Interpreter, LIDA) give the model Python and rely on retry loops. Warehouse products (Cortex Analyst, Genie, Looker, Wren, Omni) constrain the model to SQL over a semantic layer and compile or validate before execution. Omni states its AI writes semantic queries and not raw SQL, citing determinism [secondary]. No source gives a clean A/B of the two on identical data.
- **Dirty data is mostly handled by humans curating context, not by automatic detection.** I found no production system that runs an automatic, generic profile-to-issue-register step before the model. Closest: Cortex Analyst's literal lookup and Semantic View Autopilot's column-cardinality analysis [vendor], Genie "knowledge mining" of keys and value dictionaries [vendor], PandasAI's head-of-frame sample [vendor docs]. This is a gap the pricing harness can occupy.
- **Models do not detect silent data defects by themselves, and a bigger model does not fix it.** SARC-DQ measured a ~60% silent-failure rate on injected metadata defects, flat across four model tiers with ~15x price difference [measured, 2026 preprint]. DiscRun-Bench found that prompting Claude Haiku 4.5 to hunt hazards raised caveat-surfacing from ~0.74 to ~0.90 and let it match bare Sonnet 4.6 at ~4x lower cost [measured, workshop-grade paper, text not fully verified]. DCA-Bench: best agent found ~30% of real dataset issues unprompted [measured, via secondary search summary].
- **Over-exploration is a known failure of the best harnesses too.** Hex reports runs of 20+ minutes, up to 50 ephemeral queries on ill-posed questions, and ~30 minutes of second-guessing when context conflicted [secondary]. OpenAI found about 40 tools gave conflicting answers and 13 worked, and that step-by-step prescriptive prompts did worse than goal-level prompts [secondary]. Both match the "chases its own diagnostics" symptom.
- **Ambiguity is handled by rejecting or asking, not guessing.** Cortex Analyst's classifier rejects ambiguous questions with suggested alternatives [vendor]; Genie asks follow-ups when it cannot produce SQL [vendor]; Databricks says unanswerable questions should be surfaced [vendor].
- **Small-model evidence is thin and mixed.** DAB: GPT-5-mini (30%) beat GPT-5.2 (25%) at about a fifth of the cost; Gemini-2.5-Flash scored 9% [measured]. Databricks ships a "Flash" agent mode with less reasoning for simple questions [vendor doc]. Nobody publishes a Flash-class ablation of harness choices.

## 2. Systems and sources examined

| System | Sources | What it shows |
|---|---|---|
| OpenAI internal data agent (Jan 2026) | [OpenAI post](https://openai.com/index/inside-our-in-house-data-agent/) (403 on fetch); [ByteByteGo](https://blog.bytebytego.com/p/how-openai-built-its-data-agent) and [VentureBeat](https://venturebeat.com/technology/openais-ai-data-agent-built-by-two-engineers-now-serves-4-000-employees-and) used as [secondary] | Single LLM, tool loop, 13 tools, six context layers, no fine-tune |
| Snowflake Cortex Analyst | [Behind the scenes](https://www.snowflake.com/en/blog/engineering/snowflake-cortex-analyst-behind-the-scenes/); [docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst); [Autopilot](https://www.snowflake.com/en/blog/semantic-view-autopilot/); [Agentic Optimize](https://www.snowflake.com/en/engineering-blog/using-ai-improving-ai/) | Multi-agent text-to-SQL pipeline over a semantic model; compiler-based fix loop; verified queries |
| Snowflake Cortex Agents / Intelligence | [Inside Snowflake Intelligence](https://snowflake.com/en/engineering-blog/inside-snowflake-intelligence-enterprise-agentic-ai); [best practices guide](https://snowflake.com/en/developers/guides/best-practices-to-building-cortex-agents/) | Orchestrator plus tools, reflection after each tool call, data-level defaults live in the semantic view |
| Databricks Genie | [Knowledge store](https://docs.databricks.com/en/genie/knowledge-store); [Trusted assets](https://docs.databricks.com/aws/en/genie/trusted-assets); [Production-ready spaces](https://www.databricks.com/en/blog/how-build-production-ready-genie-spaces-and-build-trust-along-way); [Pushing the frontier](https://www.databricks.com/blog/pushing-frontier-data-agents-genie) (May 2026); [Agent mode](https://docs.databricks.com/aws/en/genie/agent-mode) | Knowledge store, benchmark-driven tuning, parallel thinking, multi-LLM, Flash mode |
| Google conversational analytics (BigQuery, Looker) | [BigQuery overview](https://docs.cloud.google.com/bigquery/docs/conversational-analytics); [Looker API blog](https://cloud.google.com/blog/products/data-analytics/understanding-lookers-conversational-analytics-api); [code interpreter](https://cloud.google.com/looker/docs/studio/conversational-analytics-code-interpreter) | Data agents with generated context, verified queries, glossary; Python code interpreter as a separate tool |
| Hex Threads and notebook agent | [Threads](https://hex.tech/blog/introducing-threads/); [Evaluating data agents](https://hex.tech/blog/evaluate-data-agents/); [ZenML summary of Hex engineering](https://www.zenml.io/llmops-database/building-production-data-agents-with-long-running-context-and-iterative-workflows) [secondary] | Endorsed data, semantic models, workspace guides, eval lab with a deliberately messy synthetic business |
| Claude (analysis tool, code execution) | [Analysis tool launch](https://claude.com/blog/analysis-tool); [Code execution docs](https://docs.claude.com/en/docs/agents-and-tools/tool-use/code-execution-tool) | Free-code sandbox (JS REPL replaced Nov 2025 by Python/Bash sandbox with Files API). Nothing public on built-in profiling or data-quality logic |
| ChatGPT data analysis | [Help article](https://help.openai.com/en/articles/8437071-data-analysis-with-chatgpt) (403) | Not examined: no usable public technical detail retrieved. Skipped |
| Julius AI | Third-party reviews only (e.g. [DataCamp guide](https://www.datacamp.com/tutorial/julius-ai-guide)) | Generate-run-inspect-retry on Python/SQL; a "learning sub agent" for schema relationships is reported [secondary]. No primary detail on cleaning. Marginal |
| PandasAI, Vanna, Wren AI | [PandasAI repo](https://github.com/Sinaptik-AI/pandas-ai), [v3 docs](https://docs.pandas-ai.com/v3/semantic-layer); [Vanna](https://github.com/vanna-ai/vanna), [docs](https://vanna.ai/docs/); [Wren AI](https://getwren.ai/post/why-the-semantic-layer-is-essential-for-reliable-text-to-sql-and-how-wren-ai-brings-it-to-life) | Open-source reference designs: head-of-frame prompt and optional semantic layer (PandasAI); RAG over DDL/docs/SQL and tool memory (Vanna 2.0); MDL semantic layer with dry-plan validation (Wren) |
| LIDA, Data Interpreter, DS-Agent | [LIDA](https://arxiv.org/abs/2303.02927); [Data Interpreter, ACL Findings 2025](https://aclanthology.org/2025.findings-acl.1016/); [DS-Agent](https://arxiv.org/abs/2402.17453) | Research agents: compact data summary; task graph with per-node verify/refine; case-based reasoning |
| Jupyter AI | [Docs index](https://docsearch.algolia.com/mcp/docs/repo/jupyterlab/jupyter-ai) | Chat plus magics; generic LLM assistant with optional RAG over local files. No data-aware design. Skipped |
| Benchmarks and dirty-data studies | [DAB, arXiv 2603.20576](https://arxiv.org/html/2603.20576v1); [DABstep, arXiv 2506.23719](https://arxiv.org/pdf/2506.23719); [SARC-DQ, arXiv 2607.26313](https://arxiv.org/abs/2607.26313); [DiscRun-Bench PDF](https://arifuzzaman.faculty.unlv.edu/paper/icmla26-llm.pdf) | Measured evidence on messy data and model size |

Not found with usable technical depth: Omni (only [secondary] summaries), ThoughtSpot, Tableau. Not covered: MetaGPT repo internals, Wren source code.

## 3. Patterns

### P1. Offline "table cards" built by code plus an LLM, retrieved at runtime
- **Moves from LLM to code:** discovery of what each source is, its grain, keys, derivation and similar-source disambiguation. OpenAI runs a nightly Codex job over pipeline code and merges usage metadata, human notes and the derived description into one embedded description per table [secondary]. Genie auto-applies format assistance and entity matching and "mines" Unity Catalog keys into join relationships [vendor doc]. Autopilot analyses column cardinality to infer relationship types [vendor].
- **Evidence:** OpenAI: fewer, curated context inputs beat dumping everything, found via evals, no numbers published [vendor]. Hex: context stores dominate prompts and models [vendor]. Databricks: metadata and keys moved 0 to 54% on a 13-question space [vendor ablation].
- **Cost/complexity:** moderate; needs a build step and a freshness story. Works from code alone if no LLM is used for the description.

### P2. Curated metric definitions and example queries as first-class objects
- **Moves from LLM to code:** metric formulas, mandatory filters, default date windows. Genie: example SQL defining custom metrics had the largest single impact (+23 points in the walkthrough); text instructions are for rules like "exclude test campaigns" and fiscal calendars and "shouldn't be the only source" [vendor]. Snowflake's guide puts data-specific defaults (always add a date filter, exclude internal accounts) in the semantic view, not the agent prompt [vendor]. Genie trusted assets answer with parameterised SQL or functions and label the result "Trusted" [vendor doc]. Cortex verified queries are retrieved by similarity [vendor].
- **Evidence:** Databricks walkthrough above; Snowflake reports "close to 2x" over single-prompt GPT-4o and ">90%" on an internal set with no protocol given [vendor]; Looker claims up to two-thirds fewer errors [vendor, no method].
- **Cost/complexity:** low per item, but it is human-authored. Autopilot and Genie both auto-suggest entries for human approval.

### P3. Compile/validate before run, then a bounded fix loop
- **Moves from LLM to code:** syntax, hallucinated columns, join-key checks. Cortex's error-correction agent uses the SQL compiler [vendor]; Wren describes dry-plan validation with structured errors [secondary]; Genie "Inspect" reviews filters, date ranges and joins on generated SQL [vendor doc]. Data Interpreter verifies each task-graph node and refines code [measured, abstract only].
- **Evidence:** Data Interpreter 75.9% to 94.9% on InfiAgent-DABench; the abstract gives no ablation of what drives it and no token cost [measured, authors' own].
- **Cost/complexity:** cheap when the action space is SQL (a compiler exists); harder for free Python.

### P4. Literal / value matching done before generation
- **Moves from LLM to code:** mapping user words to stored values. Cortex does a semantic literal lookup and names wrong literals as a common failure [vendor]. Genie entity matching stores up to 1,024 values per column over up to 120 columns [vendor doc]. Looker uses RAG for "NYC" to New York City [vendor].
- **Evidence:** claimed only.
- **Cost/complexity:** low; a distinct-value index.

### P5. Few tools, goal-level prompts, endorsed sources
- **Moves from LLM to design:** removing choices the model can get wrong. OpenAI: 40 overlapping tools gave conflicting answers; about 13 fixed it; embedding all history failed but ranking queries by trust worked; prescriptive step lists underperformed [secondary]. Hex: merged redundant tools, tool search, progressive-disclosure "guides"; endorsed tables and models are prioritised [secondary/vendor].
- **Evidence:** reported lessons, no ablation numbers.
- **Cost/complexity:** low; this is a pruning exercise.

### P6. Clarify or reject ambiguity up front
- **Moves from LLM to routing:** a classifier step decides answerable/ambiguous/out of scope before generation. Cortex: ambiguous questions rejected with suggestions [vendor]. Genie: asks follow-ups when it cannot generate SQL; Databricks says to surface unanswerable questions rather than guess [vendor]. Databricks also says undefined terms ("high CTR") needed an explicit definition [vendor].
- **Evidence:** claimed only.
- **Cost/complexity:** low if the classifier is a prompt; risk of over-asking.

### P7. Benchmark-driven context tuning and a feedback loop
- **Moves from LLM to process:** Genie benchmarks are used to measure, not to teach, and the post recommends 10-20 SME questions with validated SQL, re-run after every change, with ~80% as the bar before user acceptance [vendor]. Snowflake's Agentic Optimize scores generated SQL against verified queries with an LLM judge and patches the semantic view (first-iteration runs took 1-2 hours) [vendor]. Vanna 2.0 stores successful tool uses as memory [vendor docs]. OpenAI stores corrections as memory [secondary].
- **Evidence:** Databricks stepwise table above. Hex notes LLM judges are harsh and accepted a 2.04% vs 2.03% near-miss only 35% of the time [vendor, but a concrete measurement of judge error].
- **Cost/complexity:** a regression harness is cheap; self-updating memory risks stale or conflicting guidance. Hex keeps user memory separate from team-curated context for that reason [secondary].

### P8. Parallel samples and multi-model routing (heavy)
- Genie samples multiple trajectories and aggregates them, uses different LLMs for planning, search, code and judging, and reports 32% to over 90% on an internal benchmark versus a leading coding agent, with unspecified cost and latency reduction. Parallel thinking raised accuracy for both GPT-5.4 and Opus-4.6 but costs latency and tokens, by the authors' own statement [vendor; no task count]. Cortex runs several SQL generators and a synthesizer [vendor].
- **Relevance:** the opposite of a fast, simple loop. Note for later only.

### P9. Elicit hazard-finding in the loop, but deterministically where possible
- **Evidence:** SARC-DQ: models gave no doubt signals on metadata defects (AUC at or below 0.50) and failure was flat across a 15x price range; a deterministic pre-action gate recovered losses only for signals its predicates covered [measured, single-author preprint]. DiscRun-Bench: a plan-run-verify-resolve scaffold with a hazard question in planning lifted Haiku 4.5 caveat-surfacing 0.74 to 0.90, credited to the preventive planning stage, not reactive self-critique [measured, details from search summary]. Berkeley's DAB: 85% of wrong runs were bad planning (40%) or bad implementation (45%), only 15% wrong data selection [measured]; more iterations did not help on hard queries.
- **Cost/complexity:** a gate is code; the scaffold is one extra planning prompt.

## 4. Relevance to the pricing harness

| Pricing-harness problem | Patterns that address it | Notes |
|---|---|---|
| Analyst rediscovers the same defects every run (slow-run finding) | P1, P2 | Nobody ships an automatic generic issue register. Genie knowledge mining and Autopilot cardinality analysis are the nearest, and cover keys and relationships only. The pack's defects (fan-out, overlapping intervals, PACK/EUR, missing cost) would need workstream 2's profiler. |
| Different judgements on the same data (85123A blank UoM) | P2, P9 | Production systems fix this by encoding the decision once (instruction, trusted asset, endorsed definition) and retrieving it. That is what `.pricing/context.md` already is; the gap is that detected defects do not yet become entries with agreed handling. |
| Chasing reconciliation residuals and own failed diagnostics | P5, P7 | OpenAI's "guide the goal, not the path" and Hex's conflicting-context stalls are the same failure. The fix in both is fewer, non-overlapping sources and narrower tools, not a stricter prompt. |
| Planner adds unrequested validation | P5, P6 | A fixed classification step (answerable / ambiguous / out of scope; depth) before planning is how Cortex bounds work. The WorkOrder already approximates this. |
| 96% of wall time is model inference; 37 KB of profile in every prompt | P1, P5 | OpenAI and Hex both retrieve only relevant table descriptions and use progressive disclosure. Genie's Flash mode shows a vendor accepting reduced reasoning for simple questions [vendor doc]. No source measures time-to-first-token effects of prompt size. |
| Fast/small model must be consistent | P3, P9 | Evidence that small models can do this exists only for scaffolded tasks (Haiku with hazard prompting). Raw benchmark ranking is not monotonic in model size (DAB). |
| Held provable answers instead of bounding uncovered population | P6 | Databricks and Cortex say unanswerable or ambiguous questions should be surfaced; neither describes bounded partial answers. Out of scope here (workstream 5). |

Main contrast: the surveyed systems mostly query governed warehouse tables where a data team already fixed keys, units and grain. The pricing harness receives raw uploads, so it sits closer to Julius or ChatGPT in input quality but wants Genie-like consistency. The surveyed literature covers curated consistency far better than automatic cleaning.

## 5. Recommendations (simplest first)

1. **Adopt: prune and deduplicate the context and tool surface.** Retrieve only the profile slices and notes relevant to the work order; stop re-sending the same reference docs. Prefer goal-level instructions to procedures. Backed by OpenAI's and Hex's lessons [secondary] and consistent with Hex's stall report. Expected effect: time to first token and fewer self-inflicted diagnostics. Measure on the six-turn conversation.
2. **Adopt: turn every settled handling into a stored, retrievable entry** (the Genie instruction/trusted-asset and Snowflake semantic-view-default pattern), so the same defect gets the same treatment. Entries should be few, non-overlapping, and trust-ranked, not an accumulating log. Workstream 5 owns the format.
3. **Adopt: a small benchmark harness of 10-20 questions with validated answers, re-run after each change.** This is the one practice with a published stepwise payoff (0 to 100% over six iterations, vendor) and the cheapest way to compare Luna, a Sonnet class model and a Flash class model. Keep any LLM judge calibrated, since Hex measured judge harshness.
4. **Try: a deterministic pre-answer gate that checks the profiler's issue register against the columns and tables a work order touches** and passes only matching issues to the analyst, with the default handling attached. Supported by SARC-DQ (models do not self-detect; gating helps within its coverage) and DiscRun-Bench (preventive planning, not retry-style critique). Coverage is only as wide as the profiler (workstream 2).
5. **Try: one preventive "what could invalidate this answer" planning step for fast models,** replacing open-ended post-hoc verification. Evidence is a single workshop paper on one small model; run on the Flash-class model first.
6. **Try: a pre-generation classifier for ambiguous / unanswerable / answerable,** with canned clarification options. Cortex and Genie do this, but no accuracy figure exists for the step alone.
7. **Try: value and distinct-value index for categorical columns** (entity matching), only if literal-matching errors appear in trials.
8. **Skip for now: parallel trajectories, multi-LLM committees, LLM-driven semantic-model optimisation (Agentic Optimize).** They add latency and cost, contrary to the stated goal. Genie itself concedes the latency cost of parallel thinking.
9. **Skip: self-updating agent memory.** Conflicting memory is a stall risk (Hex separates it from curated context); the user's chosen design of confirmed facts in `.pricing/context.md` is the safer variant.
10. **Skip: adopting a vendor's semantic-layer product or text-to-SQL stack wholesale.** The surveyed systems solve a curated-warehouse problem; workstream 3 covers whether a thin metric layer fits.

## 6. Open questions and weak evidence

- **Almost every accuracy number is a vendor claim with no protocol:** Snowflake ">90%" and "2x", Looker "two-thirds", Genie "32% to over 90%" and "84.5% vs 52.4%" (reported only by third parties, 28 questions), Julius, Wren. Only the DAB, DABstep and Data Interpreter figures come with public protocols, and Data Interpreter's are self-reported with no cost.
- **OpenAI's primary post and ChatGPT's help page returned 403.** The OpenAI details come from ByteByteGo and VentureBeat; they disagree on model version (GPT-5.2 vs 5.5) and dataset scale, so use them for design shape only.
- **Hex engineering details are from a ZenML summary of a Hex write-up,** not read in the original. The "Metric City" simulation (about 4% at day zero, 24% at day 90 for Sonnet 4.6) is a prototype figure from that summary.
- **DiscRun-Bench and SARC-DQ are 2026 preprints.** SARC-DQ is single-author and about metadata-borne defects in a replenishment benchmark, not tabular analysis; I read only the abstract. DiscRun-Bench's PDF could not be parsed, so its numbers come from a search summary of the abstract. The DCA-Bench ~30% figure is also search-summary only.
- **No source tests a typed-operation action space against free Python on dirty data.** Omni's claim that semantic queries are more deterministic is from [secondary] posts and a dbt-attributed 98-100% vs 84-90% figure I could not trace.
- **No source reports the effect of a long profile in the prompt on latency.** Genie's "costs and latency also fell" and Cortex's latency are unquantified.
- **Small-model evidence is limited to DAB (GPT-5-mini 30%, Gemini-2.5-Flash 9%, total cost $67 vs $1,355 for the best model across 2,700 trials each), DABstep and the Haiku result above.** The DAB per-model result for ill-formatted keys was not broken out.
- **PandasAI and Vanna internals:** retry loop and prompt contents were not confirmed from source; PandasAI v3 docs say it sends the question, headers and 5-10 rows [secondary], and 2.x privacy notes differ.
- **Not examined:** Jupyter AI beyond docs, MetaGPT source, Wren source, ThoughtSpot, Omni first-party docs, Anthropic or OpenAI first-party statements on dirty-data handling (none found).
