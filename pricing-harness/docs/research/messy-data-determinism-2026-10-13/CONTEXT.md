# Shared context for research agents

## The harness

A local-first pricing and gross-margin analysis app. A user uploads CSV/XLSX files and markdown notes into a workspace and asks questions in chat ("which SKU had the highest absolute gross margin?", "review how Lighting & Candles performed over the last five complete quarters"). An agent (Pi SDK, models via OpenRouter, e.g. GPT-6 Luna, Claude Sonnet, DeepSeek 4.1 Flash) answers with checked tables and charts.

Pipeline for one question:

1. **Coordinator** (LLM) reads the question, confirmed business context (`.pricing/context.md`), source profiles and a cache index, and writes a `WorkOrder` (scope, depth, operations).
2. **Analyst** (LLM) writes Python that queries the files with DuckDB, runs it through an `execute_analysis` tool that records hashes and file reads, and prints self-check JSON (claims plus diagnostics such as reconciliation, coverage, eligibility).
3. **Controller** (code) validates the evidence and routes: none / note / repair / targeted verification / full verification / ask the user.
4. **Verifier** (LLM) recomputes claims from raw sources with its own script.
5. **Delivery** (code) builds the reply from a sealed checkpoint; figures bind to approved claim IDs.

Source profiles (column stats per file, about 37 KB) are put into every stage prompt. Seven bundled "pricing skills" (markdown instructions) are available; `pricing-intake` is the skill that interviews the user to confirm reusable business facts (field-to-measure mappings, currency, units, accounting treatment) and writes them to `.pricing/context.md`. Each stage is a cold LLM session.

## The data (synthetic but realistic, ~236 MiB, 15 CSVs)

Sales lines (1.07 M), product and customer masters, dated cost and list-price histories, agreements, rebates, service costs, approval logs, open orders, monthly finance rollup, plus company/finance/policy notes and a data dictionary. Deliberate defects:

- Period ends mid-month; the current quarter is partial.
- 243 k missing customer IDs; 34 k identical repeated source rows; 23 k negative-quantity (credit) lines.
- Duplicate master keys (one product, one customer) that fan out joins.
- 2,138 sales lines without an effective cost (mostly a `POST` postage SKU classified as merchandise, a `TEST001` SKU, one gap).
- Blank unit-cost values on current cost records; one SKU with overlapping effective cost intervals.
- Cost records with `cost_uom=PACK` or `currency=EUR` in a `unit_cost_gbp` field; service costs in EUR in a GBP field.
- Duplicate adjustment event; duplicate service business keys.
- Rebates at customer-period level with `product_id=ALL` (no product allocation).
- Source ledgers do not fully tie to `finance_monthly`.

## What goes wrong today (2026-10-13 diagnosis)

- 96 % of wall time is model inference; tool execution is 3 %. A simple "highest gross margin SKU" question took 746–1008 s.
- The analyst rediscovers the same defects every run with ad hoc Python, and makes different judgements on the same data in different runs (one run accepted a blank unit of measure as EA, another treated all that SKU's costs as unusable).
- It held provable answers instead of bounding the uncovered population (now patched in skill text).
- It chased reconciliation residuals (£2.5 k on £8.35 M) and its own failed diagnostics for minutes after a correct first answer.
- The planner nondeterministically adds unrequested validation and reconciliation work.
- Large prompts (profiles, re-reading the same reference docs every stage) raise time to first token.

## Goal of the research

Make the harness do more deterministic work while staying **general-purpose** (any uploaded pack, not Northbridge-specific rules), so a Luna/Sonnet/Flash-class model answers quickly and consistently without overthinking. The user prefers the simplest viable design; list richer options only as later upgrades.

## Rules for research agents

- Research external, primary sources: papers, official docs, source code, engineering blogs. Do not read or modify the harness code or the data.
- Cite every claim with a link. Separate vendor claims from measured results (benchmarks, ablations, production reports).
- Do not copy long passages; summarise.
- Write your output file in this folder using the template in `PLAN.md` ("Output template"), 1,500–3,000 words.
