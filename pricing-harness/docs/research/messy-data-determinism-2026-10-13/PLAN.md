# Research plan: messy data and deterministic work

Date: 2026-10-13. Status: **complete** (see SYNTHESIS.md). Approved 2026-10-13 with one addition (workspace onboarding, in workstream 5). Two waves of 3. Outputs are not committed for now.

## Problem

The Northbridge sample pack is deliberately messy: missing customer IDs, duplicate master keys, overlapping cost intervals, blank cost values, PACK/EUR units in GBP fields, `POST` classified as merchandise, ledgers that do not tie to `finance_monthly`. The harness handles this badly. The 2026-10-13 slow-run diagnosis showed 96 % of wall time is model inference. The analyst rediscovers the same defects in every run, writes ad hoc Python to diagnose them, makes different judgements on the same data across runs (85123A's blank UoM), and chases its own diagnostics after a correct first answer.

A Luna, Sonnet or DeepSeek-4.1-Flash class model should answer these questions quickly. Today the model does work that code could do.

## Research question

How do the best data-analysis harnesses (a) handle messy real-world tabular data and (b) move work from the LLM into deterministic code, while staying general-purpose (no Northbridge-specific rules)?

Sub-questions:

1. Which data defects can be detected deterministically and generically, before the model sees the question, and in what compact form should they reach the model?
2. What should the model's action space be? Free-form Python, SQL, a typed operation IR or a metric layer? What do leading harnesses choose and why?
3. How do harnesses turn a detected defect into a decision (apply a default rule, bound it, ask the user) without the model re-deriving it every run?
4. How do harnesses verify figures deterministically, so that a second LLM pass is the exception?
5. Does a short setup interview when the harness enters a new workspace (at the level of `pricing-intake`) pay off? The agent would build a basic knowledge map of sources, keys, definitions and known defects, so later queries touch only the relevant information instead of relearning from scratch.
6. What specifically makes small or fast models succeed or fail on data-analysis tasks (benchmarks, ablations), and what harness choices close the gap?

## Workstreams (6 Sonnet agents, 2 waves of 3)

Each agent does web research with primary sources (papers, official docs, source code, engineering blogs) and writes one file in this folder using the output template below.

### Wave 1

| # | Workstream | Scope |
|---|---|---|
| 1 | **Data-agent harness survey** | How production and open-source data agents split LLM work from deterministic work, and how they cope with dirty data. Candidates: ChatGPT data analysis, Claude analysis tool, Julius, Hex Magic, Databricks Genie / AI/BI, Snowflake Cortex Analyst, BigQuery data agents, PandasAI, Vanna, LIDA, MetaGPT Data Interpreter, DS-Agent, Wren AI, Jupyter AI. For each: action space, pre-computed context, error recovery, ambiguity handling, verification. |
| 2 | **Deterministic profiling and data-quality layers** | Generic, automatic detection of the defect classes in our pack: key uniqueness and join fan-out, duplicate events, interval overlap in effective-dated tables, null/blank values in required fields, unit and currency inconsistencies, sign conventions, partial periods, cross-table referential gaps, non-tying aggregates. Sources: DuckDB `SUMMARIZE`, ydata-profiling, Great Expectations, Soda, Pandera, Deequ, dbt tests, Frictionless, cleanlab, data-contract specs. Output: what a generic "issue register" looks like and how to present it to a model compactly. |
| 3 | **Semantic and metric layers; text-to-SQL** | Whether the model should pick metrics, dimensions and filters while a deterministic engine compiles and executes them. Sources: dbt Semantic Layer / MetricFlow, Cube, LookML, Malloy, Cortex Analyst semantic models, Genie instructions. Text-to-SQL state of the art on dirty schemas (BIRD, Spider 2.0, schema linking, value retrieval). How these layers encode definitions, defaults and caveats, and how general-purpose they stay when no curated model exists (auto-inferred semantic models). |

### Wave 2

| # | Workstream | Scope |
|---|---|---|
| 4 | **Harness design for small and fast models** | What makes cheap models reliable and quick: tool and interface design (SWE-agent ACI, Anthropic "Building effective agents" and tool-writing guidance, Manus context engineering), structured outputs, plan-then-execute vs ReAct, typed operation DSLs vs free code, tool-result shaping, limiting reasoning and overthinking. Benchmarks with small-model results and ablations: DABstep, DSBench, InfiAgent-DABench, DA-Code, BLADE, TableBench, Spider 2.0. |
| 5 | **Workspace onboarding, defects as decisions, bounded answers** | (a) Onboarding: whether a quick setup interview in a new workspace pays off. How products build and maintain a workspace knowledge map (Genie knowledge store and instructions, Cortex Analyst semantic model generator, Hex/Julius workspace context, Cursor/Claude Code project memory and `CLAUDE.md`, Devin knowledge, data catalogs with LLM-generated docs). What the map holds (source inventory, grain, keys, joins, field-to-measure mappings, known defects with their agreed handling), how much is inferred by code vs asked of the user, how it is used to route each query to only the relevant sources and notes, and how it is kept fresh when files change. Compare with the existing `pricing-intake` skill and `.pricing/context.md`. (b) How systems turn data defects into explicit, reusable decisions: assumption registers, default policies, data contracts, clarification policies (when to ask vs assume vs bound), partial-identification and interval bounds for missing data (Manski-style), abstention research, provenance. Focus on making the same defect produce the same handling every run. |
| 6 | **Deterministic verification of analysis results** | Checking numbers without a second LLM: invariants and identities, independent query plans, property-based and metamorphic checks, reconciliation with tolerances, program-of-thought and execution-based verification, table-QA verification research, how BI tools and finance systems validate figures. When an LLM verifier is still worth it. |

Agents are general-purpose type on `model: sonnet`, at most 3 running at once (as in earlier sessions). Wave 2 starts when wave 1 finishes, so I can pass wave-1 file paths to wave 2 to avoid duplicate coverage.

## Grounding each agent

Every brief includes the same short context block:

- The architecture summary (coordinator → analyst writing Python via `execute_analysis` on DuckDB → controller → verifier → delivery).
- The defect list from `docs/sample-data-1-readiness-2026-10-07.md`.
- Findings 1–5 of `docs/reviews/2026-10-13-slow-run-diagnosis.md`.
- The constraint: answers must stay general-purpose and work for any uploaded CSV/XLSX pack, not just Northbridge.
- The user's preference for the simplest viable design.

Agents research externally. They do not read or change harness code, and they get no business data.

## Output template (one file per agent)

`NN-<slug>.md`, 1,500–3,000 words:

1. **Summary**: 5–8 bullet findings.
2. **Systems and sources examined**: each with link, date and what it shows.
3. **Patterns**: each pattern with what it moves from LLM to code, evidence it works (benchmark, ablation, production report or "claimed only"), cost and complexity.
4. **Relevance to the pricing harness**: which defect or slow-run finding each pattern addresses.
5. **Recommendations**: ranked, simplest first, each marked *adopt*, *try* or *skip*.
6. **Open questions and weak evidence**: what remains unverified.

Rules: cite every claim; separate vendor claims from measured results; no copied long passages.

## Synthesis (me, after wave 2)

`SYNTHESIS.md` in this folder:

- A matrix of defect class × pattern × where it lives (ingest-time profiling, prompt context, tool, verifier, skill text).
- A proposed target split: what runs deterministically at upload, at plan time and at check time; what the model still decides.
- A ranked change list for the harness, simplest first, each with expected effect on wall time and on run-to-run consistency, and how to measure it (same Luna run plus one Sonnet-class and one Flash-class model on the six-turn Lighting & Candles conversation).
- Disagreements between workstreams and evidence gaps.

No code changes come out of this research. Implementation needs a separate approval.

## Where outputs are saved

`pricing-harness/docs/research/messy-data-determinism-2026-10-13/`:

```
PLAN.md
01-data-agent-harnesses.md
02-deterministic-profiling.md
03-semantic-layers-text-to-sql.md
04-small-model-harness-design.md
05-onboarding-and-bounded-answers.md
06-deterministic-verification.md
SYNTHESIS.md
```

The folder is not git-ignored, but it stays uncommitted for now. A memory entry points to it.

## Cost and time

Six Sonnet research agents with web search, each roughly 20–40 tool calls. Expect about 10–20 minutes per wave.

## Decisions (2026-10-13)

1. Workstreams approved, plus the onboarding question, added to workstream 5.
2. Two waves of 3 agents.
3. Do not commit the research folder for now.
