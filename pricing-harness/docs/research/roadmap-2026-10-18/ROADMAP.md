# Feature roadmap: Pricing Harness (2026-10-18)

This roadmap combines four research reports:

- [01 practitioner needs](01-practitioner-needs.md)
- [02 demand and competition](02-demand-and-competition.md)
- [03 architecture reuse](03-architecture-reuse.md)
- [04 niche and gaps](04-niche-and-gaps.md)

**Updated 2026-10-18:**
- Excel with formulas is replaced by a full CSV download (#1).
- Added document import with a conversion check (#1b), using MarkItDown for every format, PDFs included.
- Added workbook review (#9b).
- PDF/PPTX report output moved to P2.
- Added a scope principle (a lightweight personal tool). New P0 items: model and provider in `.env` (#0a), Anthropic and Gemini providers (#0b), and local models (#0c).
- Procurement and FP&A delayed.
- Added the startup unit-economics niche test (section 3b, from report 04).
- Set the build order: workbook review, then the MRR reconciliation workflow, then document import, then everything else. The local-model evaluation is deferred.

## Build order (owner decision, 2026-10-18)

This overrides the P0/P1/P2 labels below wherever they disagree.

1. **Excel input with a correctness check:** workbook review (#9b). The user hands over a workbook; the agent reads formulas and values, flags problems with cell addresses, and recomputes key totals as checked figures. It never produces a corrected file.
2. **MRR reconciliation workflow** (section 3b):
   - Stripe balance-report loader.
   - Payout reconciliation detector (gross − fees − refunds − disputes = net; net per payout = payout).
   - Metric definitions card with a confirm step.
   - MRR, cohort, CAC and payback templates.
   - Synthetic starter pack for evals.
3. **Document import with MarkItDown,** including the conversion check (#1b).
4. **Everything else,** in the order listed below: CSV download (#1), `.env` model and provider selection (#0a), Anthropic and Gemini providers (#0b), audit view, and the rest.

**Later:** the local-model evaluation (#0c) is deferred. The bet on local models stands, but the evaluation waits.

## Scope principle (owner decision, 2026-10-18)

**A lightweight, straightforward tool, not another Claude or Codex.** It is the owner's own analyst, published open-source in case others find it useful. Every roadmap item must:
- stay small (S, or M at most)
- reuse what Pi, DuckDB and the existing engine already do
- leave the harness no closer to a general agent platform

Revenue is secondary to real use.

**Bet on local models.** The owner expects local models on an ordinary 32 GB MacBook to reach roughly Haiku 5.5-level results. If they do:
- each analysis costs nothing to run, which may drive uptake
- "data never leaves the laptop" becomes fully true

The local-model path stays on the roadmap, but its evaluation is deferred (see Build order).

It also takes into account the **separately distributed Pricing Plugin** ([Schadenfreunde/Pricing-plugin](https://github.com/Schadenfreunde/Pricing-plugin), MIT, 0.4.11). Shared context is in [BRIEFING.md](BRIEFING.md).

## 1. What we concluded

1. **The pain is real, but nobody has yet asked for this exact product.** Finance teams' main complaints about AI are lack of auditability, confident answers built on wrong data, and different answers to the same prompt. In a 270-CFO survey (vendor-run, Oct 2026), 26% of the week went to checking AI output. Report 02 found no practitioner asking for a local, open-source pricing analyst. The likely niche is confidential, file-based work by pricing and margin consultants, fractional CFOs and PE portfolio teams.
2. **The biggest gap is the output, not the input.** All four personas work from a file and hand over a file: Excel with formulas, a deck or a memo. A reviewer never sees a chat badge. So checked figures only count if they appear in a document that can be handed over and that shows its lineage. All three reports rank output above connectors.
3. **The MCP connector is not the first job.** All three reports reached this independently, and the plugin channel strengthens it (section 2). The MCP client is cheap to add, because Pi 1.0.4 (already installed) has `createMcpExtension()` and `session.ts` already accepts `stage.extensions`. Both facts were checked in the repo. But an MCP tool result never lands in the recorded `execution-*` outputs, so a raw MCP connector would undercut checked figures. Every MCP result has to go through a wrapper that saves it to a recorded file. The MCP server landscape is also shifting: Snowflake-Labs/mcp is deprecated, the Salesforce DX MCP server reaches end of life on 2026-11-02, and the reference Postgres, SQLite and Drive servers are archived.
4. **Checked figures prove where a number came from, not that it is right.** A wrong join or a wrong definition still passes. On text-to-SQL benchmarks, models score about 50% on Spider 2.0 and about 80% on BIRD (humans score 93%). We should show the SQL beside each figure, guard against row fan-out (reusing `same_rows.py`), and describe the product as "every number traceable to a run", not "correct numbers".
5. **"Local-first" only holds with a local or approved model endpoint.** Through OpenRouter, data still goes to a cloud model. For regulated data that is the real enterprise blocker, more than missing SSO.
6. **About 85% of the engine is domain-neutral.** Pricing-specific code is limited to the skills, `analystPrompt`, `PRELOADED` and one prompt in `session.ts`. A new vertical is mostly skills plus evals.
7. **The largest risk is not a missing feature.** The product has never been validated on real data, and every report says this outranks all feature work.

## 2. What the plugin already covers, and what only the harness adds

The plugin runs inside Claude and other hosts that take agent skills. A plugin user in Claude already has several things the harness would otherwise need to build:

| Need | Plugin in a host like Claude | Harness today | Roadmap consequence |
|---|---|---|---|
| Pricing method (intake, analyse, scan, recommend, design, execute) | ✅ the same skills | ✅ bundled | Improve the method **in the plugin**. Both channels benefit. |
| SaaS and database connectors | ✅ the host's MCP connectors (Stripe, HubSpot, Salesforce, warehouses) | ❌ | **Don't race the host on connectors.** The MCP client moves to P2. |
| Excel, PPTX and PDF files | ✅ host file skills (xlsx/pptx/pdf) and Claude/Copilot in Excel | ❌ | Only *checked* exports, with a run record, set the harness apart. The first step is a sealed CSV download (#1). |
| Reading PDF, PPTX and DOCX context | ✅ hosts read these natively | ❌ (CSV, XLSX, TXT, MD only) | Document import (#1b) closes the gap cheaply. |
| Numbers matched to executed output, sealed checkpoints | ❌ | ✅ | This is the core. Make it visible and exportable. |
| Data-quality detectors that never apply treatments themselves | ❌ | ✅ | Core. Keep it. |
| Local DuckDB on files up to 2 GiB | ❌ (host file limits) | ✅ | Core. Extend it with snapshots. |
| Any model, including local or approved endpoints | ❌ (tied to the host's model) | ✅ in theory, not evaluated | Evaluate and document it: this is what makes the confidentiality claim true. |
| Persistent confirmed business context | Partly (host memory) | ✅ `.pricing/context.md` | Keep it. |

**The strategic consequence:** the two channels should split the work instead of duplicating it.

- **The plugin** is the low-friction channel: method plus host connectors and host exports, with no verification.
- **The harness** is the channel for "auditable and confidential": verification, detectors, local data, local models and a handover package.
- **The MCP server** (exposing the verifier and query tools; shape B in report 03) is the bridge. It gives plugin users in Claude checked figures and detectors without the web app. This makes it a stronger bet than the MCP client.

## 3. Roadmap

Effort is for a solo developer: S, M or L.

### Gate 0: validate before building (now, alongside P0)

| Item | Why | How |
|---|---|---|
| Interview 5–10 practitioners (pricing consultants, PE value-creation, FP&A) | All three reports found the demand evidence thin, with no interviews behind it | Use 30-minute calls: show the harness, ask what they would need in order to hand the output to a reviewer |
| A real-data trial with 3 or more practitioners | It has never been validated on real data | Run their anonymised exports through the harness and compare with their own Excel results |

### Now: P0, the minimum a professional needs to rely on it

| # | Feature | Effort | Ease of integration |
|---|---|---|---|
| 1 | **Full CSV download of every table.** A "Download CSV" button serves the sealed result file byte for byte: every row and column, not the capped on-screen view (1,000 rows, 12 columns). It adds a UTF-8 byte-order mark so Excel shows accented names correctly, and puts the run hash in the filename. Also tell the analyst to save tables "for Excel" in the shape the user asks for (wide or long, clear headers). | S | Internal. `query` `save` already writes the CSV, and checkpoints already copy it with its hash (`checkpoints.ts`). Add one route, one button in `ResultTable.tsx` and a lookup from table to checkpoint file. No dependencies. **Decision (2026-10-18):** values first. Excel with live formulas is deferred: the work is moving away from Excel, and formulas would make the harness heavy. |
| 1b | **Document import: PDF, PPTX, DOCX (and HTML), with a conversion check.** Company decks, memos, policies and business PDFs become readable context. The user is told when a conversion is bad, and the agent never relies on a botched one silently. | S–M | Convert on upload, harness-side, with **MarkItDown** for every format it supports (Microsoft, MIT, ~191k stars; extras `[pdf,docx,pptx]`). Call `convert_local()`, not `convert()`, which also fetches URLs, and leave plugins off. Keep the hashed original and register the Markdown copy as documentation. Today uploads accept only CSV, XLSX, TXT and MD (`files.ts:12`). **Quality by format (2026 reviews, blog-grade evidence):** Office files are reliable. PDFs are weak (pdfminer text extraction): headings are lost, multi-column pages get scrambled, table columns collapse, and scanned pages come out empty. **Conversion check:** a deterministic Python scan after conversion, following the detector rule that code flags and the user decides. See the conversion-check section below. |
| 0a | **Model and provider chosen in `.env`, not `harness.config.json`.** `.env` holds `PRICING_PROVIDER`, `PRICING_MODEL` and `PRICING_THINKING_LEVEL`, plus the provider's key and a local base URL when needed. `harness.config.json` keeps only budgets and evaluation settings. Clean break, with no fallback between the two places. | S | These variables already exist as overrides (`settings.ts:88`, `runtime.ts:50`). Remove the `model` block from the settings schema and `harness.config.json`, and update `.env.example`, the README and the launch scripts. The optional second launcher argument for the model can stay or go. |
| 0b | **Anthropic and Gemini (AI Studio) providers**, alongside OpenRouter and OpenAI | S | Pi supports both natively: `ANTHROPIC_API_KEY` and `GEMINI_API_KEY` (Pi `docs/providers.md`). Add them to `PROVIDERS` (`defaults.ts:2`, currently `openrouter` and `openai`). Check Pi's exact provider IDs and the thinking-level mapping, and run one live smoke test per provider. |
| 0c | **Local models: Ollama and LM Studio, evaluated on a 32 GB Mac.** **Deferred to later (2026-10-18 build order).** Zero marginal cost and full privacy remain the reasons to do it. | S–M | Pi talks to Ollama, LM Studio, vLLM and llama.cpp through an OpenAI-compatible endpoint configured in `models.json` (Pi `docs/models.md`, `docs/llama-cpp.md`). The harness creates the runtime with `modelsPath: null`, so it needs a `local` provider whose base URL comes from `.env`. **The real work is the evaluation:** run the existing eval suite on 2–3 local models that fit 32 GB (for example Qwen3 14B and gpt-oss-20b, per report 04) and compare against Haiku 5.5. **Risks:** reliable tool calling, and context length: the first-turn prompt carries profiles, findings and skills, and the KV cache is limited on 32 GB. The hypothesis is unproven until the evals run. |
| 2 | **Audit view and run-record export.** Each figure links to its script output, run hash, input hashes, confirmed treatments and model ID. | S–M | Internal: checkpoints, `events.jsonl` and `run.json` already hold the data. Add a React panel and a JSON/HTML export. Borrow field names from OpenLineage or W3C PROV but don't adopt either. |
| 3 | **Tested PVM bridge and pocket-price waterfall templates** with sums-to-total checks and stated conventions | M | **Ship these in the plugin** as script templates, so both channels get them. Plain pandas or DuckDB. Plotly waterfall charts are already available. Use published Excel templates (Zebra BI, Coefficient) as the test oracle. |
| 4 | **SQL beside each checked figure, plus a join fan-out guard** | S–M | Add `sql_hash` and the SQL text to the handoff/present specs. Reuse `same_rows.py`. No dependencies. |

#### Conversion check for document import (#1b)

The goal: a bad conversion is visible to the user at upload, and the agent knows which parts it can't rely on.

**Signals computed per page or slide.** All are deterministic, with no model calls:

| Signal | What it catches | How |
|---|---|---|
| Pages with no or very little text | Scanned or image-only pages | Characters per page against a threshold. Per-page text comes from pdfminer, which MarkItDown's PDF extra already installs (verify). |
| `(cid:NNN)` tokens, U+FFFD replacement characters, or a high share of non-printable characters | Font-encoding failure: garbled text | Count per page |
| Many very short lines, or a high one-word-per-line ratio | Scrambled multi-column layouts | Line-length distribution per page |
| Number-dense lines with no table markup | Tables whose columns collapsed: the numbers are there but unaligned | Share of numeric tokens on lines outside a Markdown table |
| Slides or pages holding pictures or charts with no matching text | Chart data and images not extracted | Shape and picture counts from python-pptx (MarkItDown's PPTX dependency) against extracted text. Check whether MarkItDown already carries chart series through. |
| Converted text much shorter than expected for the file size or page count | Silent partial failure | Characters per page across the whole document |

**Three outcomes, shown in the Sources panel at upload:**

- **OK:** registered as documentation.
- **Converted with warnings:** registered, but the user sees what failed, for example "pages 4–7 have no readable text (likely scanned); 3 tables may have lost their columns". The warnings are also written into the Markdown copy at the affected pages, so the agent sees them where it reads.
- **Not usable:** for example, most pages empty or garbled. *Not* registered as context. The user is told why and can either accept it anyway or upload a better source (the original Word or PowerPoint file, or the Excel behind the table).

**What the agent is told:** the prompt carries the per-document flags, the same way the data findings are capped and summarised. The analyst must name an unreadable section rather than guess at it. It must not quote numbers from a flagged table without saying so. Facts still reach `context.md` only after the user confirms them.

**Tests:** fixtures for each signal, all synthetic: a clean text PDF, a scanned image PDF, a two-column PDF, a PDF with a price table, a CID-garbled PDF, and a deck with a chart. Each fixture must produce its expected flag.

**Not included:** OCR and vision fallback. Vision reading stays at P2, and would be offered as the fix for a "not usable" scanned document.

### Next: P1, the differentiators

| # | Feature | Effort | Ease of integration |
|---|---|---|---|
| 5 | **Re-run a saved analysis on a refreshed file**, with a check that the schema still matches and a diff against last period | M | Recorded scripts and hashes already exist. Add replay and re-check. Same idea as the earlier "persistent source views" note. Prerequisite for scheduling. |
| 6 | **Approved enterprise endpoints** (Bedrock, Azure OpenAI, Vertex). Local models moved to P0 #0c. | S each | Pi supports all three natively (Pi `docs/providers.md`). Add each to `PROVIDERS` only when someone asks for it. |
| 7 | **MCP server exposing primitives:** `query`, `run_script`, `verify_figures`, `seal`, `data_findings`, context read/append. Pairs with the plugin. | S–M | `@modelcontextprotocol/server` v2 (Apache-2.0/MIT). Reuse `reply-figures.ts`, `checkpoints.ts` and `query_server.py` unchanged. Package as `.mcpb` (`@anthropic-ai/mcpb`) plus `npx`. **Sticking point:** bundling Python and DuckDB for each OS. **Limitation:** the host may skip `verify_figures`, so the check is offered but not enforced. Treat it as a distribution experiment and measure installs. |
| 8 | **Database snapshot connector:** Postgres and MySQL attached read-only, saved as Parquet, plus Parquet as a source type | M | DuckDB core `postgres` and `mysql` extensions (MIT). Attach on the harness side, because `query_server.py`'s `ALLOWED` correctly refuses ATTACH, INSTALL and LOAD from the agent. Write `files/snap-*.parquet` with a JSON record of query, time, rows and sha256. The session key then hashes the snapshot. Store credentials in the OS keychain (`@napi-rs/keyring`; licence to verify). |
| 9b | **Workbook review: check a user's Excel model without fixing it.** Flags formula-pattern breaks (a typed number in a formula column), numbers buried in formulas (`=B4*1.2`), ranges that stop short, error values, links to other workbooks, hidden sheets, rows and columns, and numbers stored as text. The agent explains each finding, asks about intent, and recomputes key totals in DuckDB to compare with the workbook (the comparisons are checked figures). Output: findings with cell addresses. No corrected file. | S–M | A deterministic scanner using **openpyxl** (MIT, already a dependency), opening the workbook twice: formulas and saved values. Today the harness reads only saved values (`data_only=True`, `data_workspace.py:95`), so formulas are invisible. Plus a short "workbook review" skill. Fits the rule that code flags and the user decides. **Limits:** no recalculation (stale values need LibreOffice, left out); no `.xls`/`.xlsb`; LAMBDA and dynamic arrays are flagged but not interpreted. **Market (from memory):** PerfectXL, Operis OAK and Excel Inquire exist; we add a local, deterministic review with checked figures. Fits the audit/QoE niche. |
| 10 | **Vertical pack mechanism:** config selects the skill bundle, prompts and `PRELOADED` | S | An internal refactor of `role-prompts.ts`, `stage-prompt.ts` and `session.ts`. The existing bundle inventory check already enforces integrity. |

### Later: P2, build only when users ask

- **MCP client** through Pi's built-in `createMcpExtension()`, available **only** through a `fetch_to_file` wrapper (S–M). Build it for named SaaS sources that have no good export. Stripe's `https://mcp.stripe.com` and Google `genai-toolbox` (Apache-2.0) are the viable servers. Plugin users already get connectors in their host.
- **Scheduled refresh and margin alerts** after re-runs (#5) exist (M–L). Use `node-cron` (ISC) or the OS scheduler, plus email or a webhook.
- **Sign-off and report versions** (S). This is a stamp, not a control; the UI must say so honestly.
- **Snowflake, BigQuery and Databricks export connectors** (M each). Vendor Python connectors write Parquet snapshots.
- **Iceberg, Delta and DuckLake sources** through DuckDB core extensions (S–M).
- **Google Sheets link import** (S), through the CSV export URL.
- **Excel export with live formulas** (M), deferred on 2026-10-18 in favour of the CSV download. If it comes back: XlsxWriter (BSD-2) for formulas with cached values, LibreOffice headless for a recalculation check, and only fixed templates (PVM, waterfall, segment margin) or filling a user template's defined input tab. Avoid pycel (GPL-3.0) and HyperFormula (GPLv3).
- **Print-to-PDF report view** (S), moved to P2 on 2026-10-18. A print stylesheet over one answer (checked reply text plus sealed tables and charts), saved with the browser's own "Save as PDF". Build it from sealed results, never from HTML the agent writes freely, which could carry unchecked numbers. No server-side Chromium.
- **PPTX export** (S–M for a basic deck, M–L for consultant quality), P2 since 2026-10-18. Use PptxGenJS (MIT, Node) or python-pptx (MIT; the only one of the two that opens a corporate `.pptx` template). The hard parts: client master slides, text overflow (neither library can measure text), and waterfalls, which aren't native in PptxGenJS. The CSV download covers most of the need, because users can chart the data in their own template.
- **Vision reading of charts in decks** (S–M): send page images to a vision-capable model. This sends images to the provider.

### Don't build

- Anything that turns the harness into a general agent platform: general coding or browsing tools, multi-agent orchestration, a plugin marketplace, an IDE. This follows the scope principle.
- An in-Excel add-in: it competes head-on with Microsoft, OpenAI and Anthropic.
- CPQ or deal-approval workflow.
- Elasticity optimisation sold as causal.
- SSO, SCIM or multi-user hosting until a paying team asks.
- Insurance or actuarial pricing.
- Building on Vanna (archived 2026-03-29) or Snowflake-Labs/mcp (deprecated).

## 3b. Niche test: startup unit economics (report 04)

**Verdict: worth testing as the first niche, not a commitment.**
- **The pain is real.** Founders see different MRR in every tool, and confuse cash with revenue.
- **Nobody has asked for this exact product,** and MRR dashboards are free or cheap (ChartMogul free up to $120K ARR).
- **The gap is the join.** Gross-to-net revenue, reconciled to payouts, divided by ad spend: no billing tool joins ad spend.
- **Ad exports carry no customer IDs.** So the honest output is blended or per-channel CAC, not cohort attribution.
- **CSV exports are enough.** The Stripe balance report already carries customer email, subscription, invoice and payout IDs. No live connectors are needed.

Long-term, diligence/consultant work (score 26/35) and distributors (25) fit better. Founders (24) are the easiest to reach and the cheapest to serve.

**Step 1, no code:** five founders, one week. Ask each for an anonymised Stripe balance report and a Google or Meta spend CSV. Run them through the plugin or harness by hand.
- **Kill signal:** fewer than 2 of 5 send files, or all say a free dashboard is enough.
- **Only "comes back next month" counts as use.**

**If it holds, the additions are small:**

| Item | Where | Effort |
|---|---|---|
| Metric definitions card (MRR, net revenue, per-channel CAC, payback on gross margin, LTV caveat) with a user confirm step | Plugin | S |
| Non-expert intake and "explain it" skill (which exports, are UTMs captured, which accounts and currencies) | Plugin | S |
| Cohort, retention, CAC and payback SQL templates | Plugin script templates | S |
| Stripe and ad-export loaders (typed views, Google/Meta header and footer cleanup, spend only, never platform-reported conversions) | Plugin template, run in the harness | S–M |
| **Reconciliation detector:** per-payout `net` sums match payouts; gross − fees − refunds − disputes = net; unlinked instant payouts listed | **Harness** (data-findings detector; code flags, user decides). Cross-check the logic against fivetran/dbt_stripe (Apache-2.0) as a reference only | S–M |
| Synthetic starter pack (refunds, disputes, annual plans, multi-currency, two ad exports, expected answers) | Harness evals | M |
| Currency rate-table rule (user-supplied or ECB CSV, rate and date stated) | Plugin card plus a DuckDB join | S, P2 |

**Out of scope:** live Stripe or ads connectors, attribution modelling, a revenue-recognition engine (a warning card is enough), forecasting, dashboards.

**Local models for #0c:** report 04 names Qwen3 14B and gpt-oss-20b as fitting 32 GB comfortably; ~30B models at Q4 are tight. Low confidence, and no tool-calling benchmark was found. Include both in the eval.

## 4. Reusing the architecture

**Status (2026-10-18): delayed.** Procurement and FP&A are for later. When they're picked up, the approach agreed in discussion is:

- **Packaging:** one plugin per domain, not part of the pricing plugin. The general method (shared rules, intake, metric verification) is copied into each plugin now and extracted into a shared core only alongside #10. In the harness, each workspace has one domain.
- **Procurement first:**
  - 5 skills: triage, intake, spend cube, spend scan, savings sizing.
  - Cards for PPV, index-linked pricing, duplicate invoices, tail spend, and cost reduction vs cost avoidance.
  - Spend classification: GL and supplier rules first; then the agent proposes a mapping, the user confirms it, and code applies it.
  - New detectors for duplicate invoices, supplier name variants and split purchase orders.
- **FP&A second, and narrow:**
  - Variance analysis and commentary only, with each explanation labelled "explained by data" or "needs business input".
  - Detectors for sign conventions, trial balance not netting to zero, budget and actual account mismatches, and missing periods.
  - Depends on #1 and #9b.
- **Interviews:** run the interview script with at least one procurement analyst and one FP&A analyst before building either.

| Rank | Option | Verdict | First step |
|---|---|---|---|
| 1 | **Procurement and spend analysis** (purchase price variance, duplicate invoices, supplier price creep) | Best fit for the effort. Unit-price-by-supplier is the same peer-ratio logic, and 3 of 5 detectors transfer. | Test demand by shipping a **procurement skill set as a plugin**. Build a harness pack after #10. |
| 2 | **SaaS billing metrics** (Stripe exports, MRR, churn, discounting) | Strong. The knowledge cards (`recurring-metrics.md`, `price-waterfall.md`) already exist. Small-company buyers pay little. | Mostly plugin content. Stripe CSV exports for the harness. |
| 3 | **FP&A variance commentary and budget vs actual** | Biggest pull and most crowded (Cube, Abacum, Pigment, Datarails, Claude/Copilot in Excel). Excel with live formulas is now deferred, so the credible way in is workbook review (#9b) plus CSV download (#1). | Needs #1, #9b and #10. |
| 4 | **Audit, quality-of-earnings and due diligence** | Strongest moat: confidential data, sealed evidence and full-population testing match the core. Buyers are regulated and sales are slow. | An evidence-pack export of checkpoints and hashes, built on #2. |
| 5 | **Deep analysis on a company data lake** | A channel into options 1–4, not a product. Snowflake Cortex, Databricks Genie and Hex already serve it with native governance. | #8 snapshots, then vendor exports. Make SQL visibility (#4) mandatory. |
| ✗ | Insurance and actuarial | Poor fit (model fitting, rate filings) | — |

## 5. Assumptions to change

| Assumption | Verdict |
|---|---|
| "MCP connector is the top priority" | **Weak.** The client is a cheap add-on (Pi has it) but needs a wrapper that saves results to files. Plugin users already have connectors. The *server* direction is the better MCP bet. |
| "Checked figures means correct numbers" | **Wrong.** It means the number can be traced to a run. Add SQL visibility and fan-out guards, and adjust the messaging. |
| "Local-first means private" | **Half true** while using OpenRouter. It needs an evaluated local or approved endpoint. |
| "Compete with PROS, Pricefx and Zilliant" | **Wrong frame.** Position it as the analyst's workbench for teams without those suites, and for diligence work. |
| "Deal desk is a target persona" | **Weak.** Only their analysis work fits. |
| "Pricing is the only wedge" | The code allows more. Test adjacent verticals cheaply as plugins before building harness packs. |

## 6. Research limits

- No practitioner interviews were done.
- Reddit, LinkedIn, G2 and Capterra were unreachable for the demand agent, so demand evidence comes from HN, vendor pages and a vendor-run survey.
- Several licences (WeasyPrint, node-cron, nodemailer, `@napi-rs/keyring`, vendor connectors) and some vendor MCP GA statuses come from background knowledge, flagged in the reports. Verify them before adoption.
- Checked in the repo for this synthesis:
  - Pi 1.0.4 ships `createMcpExtension`.
  - `session.ts` passes `stage.extensions` into `extensionFactories`.
  - `query_server.py` refuses ATTACH, INSTALL and LOAD.
  - `openpyxl` is already a dependency; XLSX is read with `data_only=True` (saved values only).
  - Uploads accept CSV, XLSX, TXT and MD only.
- MarkItDown details (GitHub page, 2026-10-18): MIT, about 191k stars, Python 3.10–3.14. The PDF-quality verdict comes from blog comparisons (danilchenko.dev, thunderbit, file2markdown), not an independent benchmark.
