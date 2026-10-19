# 01 - Practitioner needs: what a professional needs before relying on Pricing Harness

Date: 2026-10-18. Mandate: practitioner needs. Method: ~20 web searches/fetches (budget-limited, so many persona claims rest on aggregated job-post snippets and vendor/practitioner blogs, not primary interviews). Confidence is tagged per finding. No code modified.

## 0. Bottom line

1. The owner's belief "MCP connector is top priority" is **weak**. Practitioners hand over Excel/decks/memos that a reviewer can re-check; they are rarely blocked by "the agent can't reach Salesforce". The data they live in is already exported to Excel/CSV every week (confidence: medium; see section 5). MCP matters for "no manual export" and for scheduled refresh, which are P1, not P0.
2. The real P0 gap is the **output side**: an Excel workbook with live formulas (or at least a values+formulas workbook with a visible method sheet), a methodology/assumptions page, and a reproducible "run record" a reviewer can open. The product's best differentiator (checked figures, hash-bound runs) currently has no artefact the reviewer can hold.
3. Cheapest strong integration route for connectors is **not MCP at all**: DuckDB ATTACH/ADBC for databases, plus "paste/upload the export" for SaaS. MCP is a good fit mainly for HubSpot/Stripe/Salesforce where the vendor ships a hosted server, but see the trust problem in section 5.
4. Nobody in these personas is served by a chat answer alone. Everything ends in a file someone else reviews.

## 1. Personas (realistic working week)

Evidence base for all personas: job descriptions and practitioner pages surfaced by search (examples: pricing analyst postings citing waterfall/gross-to-net, Excel + Power BI, ERP pricing records [WayUp posting](https://www.wayup.com/i-j-Pricing-Analyst-HYDRA-POWER-SYSTEMS-INC-580934346456546/), [The Muse systems pricing analyst](https://www.themuse.com/jobs/crh/systems-pricing-analyst-entry-level), [Umbrex pricing analytics](https://umbrex.com/services/marketing/pricing/pricing-analytics/); deal desk job post summarised via [Greenhouse listing](https://job-boards.eu.greenhouse.io/eonio/jobs/4749554101), [Rework deal desk guide](https://resources.rework.com/fr/libraries/pipeline-management/deal-desk)). These are small samples; weekly schedules below are **inferred composites**, labelled as such. Confidence: medium-low on the exact weekly split, medium-high on duties/tools.

### (a) Pricing analyst / pricing manager (B2B manufacturing/distribution; SaaS variant)

- **Week (inferred):** Mon: pull last week/month invoice lines from ERP/BI (SAP, NetSuite, Dynamics) into Excel. Tue-Wed: price-down / leakage investigations ("why is this customer's net price 4% under last year"), waterfall (list - discount - rebate - freight - terms = pocket price), outlier lists for sales. Thu: price-change tracking (did the January increase stick; realisation by segment), scenario model for a proposed increase. Fri: dashboard refresh and a one-page memo/deck to the commercial director.
- **Data:** ERP invoice/order lines, rebate accruals, price lists (Excel), CRM for customer segmentation, BI (Power BI). SaaS variant: Stripe/Chargebee/Zuora exports, Salesforce opportunities.
- **Deliverables:** Excel model with formulas (the reviewing manager clicks into cells), PowerPoint, Power BI dashboard, short memo.
- **Reviewer asks:** "tie it to the P&L / GL", "which invoices are in this number", "what is the treatment of credit notes/returns", same answer next month.
- **Recurring:** monthly price realisation/waterfall refresh; price-increase tracking; leakage alerts; quarterly price-list review.
- **Core analyses:** waterfall/gross-to-net ([Vendavo waterfall](https://www.vendavo.com/all/the-power-of-the-price-waterfall/), [Pricefx waterfall](https://pricefx.com/learning-center/what-is-a-pricing-waterfall-a-complete-overview)), leakage, discount discipline by rep/customer, customer/product margin, PVM, elasticity (less often than vendors suggest).

### (b) RevOps / deal desk

- **Week (inferred):** Daily queue of non-standard quotes (discount above rep authority, payment terms, multi-year), check margin vs approval matrix, approve/modify/deny, log rationale on the opportunity. Weekly: discount trend by rep/segment, approval turnaround, win/loss drivers. Monthly: approval-matrix tuning ([Rework](https://resources.rework.com/fr/libraries/pipeline-management/deal-desk), [Tray.ai deal-desk approvals](https://tray.ai/automate/deal-desk-approvals/)).
- **Data:** Salesforce/HubSpot opportunities and quotes, CPQ (Salesforce CPQ, DealHub, etc.), billing (Stripe/Zuora/Chargebee), Sheets.
- **Deliverables:** approval decisions inside CRM/CPQ (system of record), weekly discount dashboard, matrix proposal memo.
- **Reviewer asks:** every approval tied to exact terms, decider + rationale stored on the record (auditability is the core requirement in the sources above).
- **Fit to Pricing Harness:** weak for the daily queue (needs in-CRM workflow, a different product); decent for the weekly/monthly analysis on exported opportunity data.

### (c) PE value-creation / pricing consultant

- **Week (inferred):** Project mode. Receive a data room extract (transaction cube, customer list, price lists, often messy Excel/CSV) on day 1-3; clean and reconcile to reported revenue; build price-volume-mix bridge, price realisation vs list, discount distribution, customer concentration, price-increase history ([FTI on pricing in due diligence](https://www.fticonsulting.com/ja-jp/japan/insights/articles/identifying-value-creation-levers-due-diligence), [Umbrex CDD playbook](https://umbrex.com/resources/commercial-due-diligence-playbook-2025/)). Output deck for investment committee in 2-4 weeks.
- **Data:** one-off file dumps, VDR (virtual data rooms); rarely live connections. Strict confidentiality: often cannot send data to a third-party cloud model (strong local-first fit).
- **Deliverables:** PowerPoint (primary), Excel backup with formulas, sometimes a memo. Numbers on slides must tie to an Excel appendix.
- **Reviewer asks:** every slide number traceable to a backup; reconciliation to audited revenue; defensible methodology; version history across draft decks.
- **Recurring:** little; per-project. Portfolio monitoring for PE value creation teams is recurring (monthly KPI packs).
- **Fit:** the best fit for the current product (files in, one-off analysis, local, auditable) - **if** it can export to PPTX/Excel.

### (d) FP&A analyst

- **Week (inferred):** Month-end close support Mon-Wed; PVM / revenue and margin variance commentary vs budget and prior year Thu; ad hoc requests Fri. Source = GL/ERP extract, budget in Excel, BI.
- **Deliverables:** Excel (formulas, tie-out checks), variance commentary in the monthly pack (PowerPoint/PDF), sometimes Power BI.
- **Reviewer asks:** bridge bars sum to total variance (the main tie-out check, [Maven PVM bridge](https://maven.com/p/16196c/build-a-price-volume-mix-bridge-in-15-mins-with-claude-excel)); documented PVM convention because the price/volume/mix split changes with the method ([Zebra BI](https://zebrabi.com/template/bridge-price-volume-mix/), [Coefficient](https://coefficient.io/cfo-resources/price-volume-mix-analysis-excel) use different formulas); reproducibility month to month.
- **Recurring:** monthly. This persona is the most recurring-heavy.
- Note: audit-trail/sign-off norms for FP&A were NOT found in searches (gap); statements about reviewer controls here come from general finance practice (confidence: low-medium).

## 2. Incumbent software: what is table stakes

Source quality is poor: the search returned mostly aggregators ([G2 comparison](https://g2.com/compare/pricefx-vs-zilliant), [Fitgap](https://us.fitgap.com/search/pricing-software/online)) and vendor marketing; no Gartner/Forrester material was reached. Treat as medium-low confidence.

| Capability | PROS | Pricefx | Zilliant | Vendavo | Competera | SaaS tools (Monetizely, Stripe/Chargebee analytics) |
|---|---|---|---|---|---|---|
| Price waterfall / pocket price | yes (assumed) | yes | partial | yes (explicit) | n/a (retail) | no |
| Deal/quote guidance, approval workflow | yes | yes (CPQ module) | yes (deal guidance) | yes (Pricepoint, deal scoring) | no | partial (Monetizely: packaging/value) |
| Optimisation / elasticity | yes | yes | yes | yes | yes (core) | basic |
| Margin/PVM bridge | yes | yes | yes | yes (Margin Bridge Analyzer, [Vendavo](https://www.vendavo.com/?p=35939)) | no | no |
| Direct ERP/CRM integration | core | core | core | core | retail feeds | billing-native |
| Role-based governance, approvals, versioned price lists | core | core | core | core | yes | partial |
| Scheduled data refresh and alerts | core | core | core | core | core (competitor price tracking) | dashboards |

**Table stakes in the category** (everyone has them): live ERP/CRM integration, role-based workflow and approvals with audit log, versioned price lists, waterfall + PVM dashboards on schedule, alerts. Pricing Harness has none of these. It cannot and should not try to replicate them for a solo dev. Its angle is the **analyst's ad hoc work that these suites do poorly** (messy exports, one-off diligence, "why did margin move") plus verified numbers. Confidence: medium.

## 3. Cross-persona needs

| Dimension | Findings |
|---|---|
| Real data sources | ERP exports (SAP/NetSuite/Dynamics) and BI extracts, as Excel/CSV, are the dominant input for analyst, PE and FP&A. CRM/billing live-connect matters most for RevOps and SaaS pricing. Evidence: job posts require "Excel required; Power BI preferred" and ERP familiarity (see links in section 1). Confidence: medium. |
| Deliverables | Excel with formulas (all four), PowerPoint (analyst, PE), memo (analyst), dashboard (analyst, RevOps, FP&A). Chat text alone is a draft, never the deliverable. |
| Reviewer/auditor demands | lineage to source rows, reproducibility (same inputs -> same numbers), documented conventions (PVM), tie-out to P&L/GL, sign-off, version history, per-approval rationale (deal desk). |
| Recurring | monthly refresh (analyst, FP&A), price-change tracking (analyst, PE portfolio), discount-trend/approval KPI (RevOps), alerts (analyst, RevOps). |
| Core analyses | waterfall, leakage, discount discipline, customer/cohort margin, PVM bridge, win-loss (RevOps), elasticity (lower frequency; vendors over-weight it). |

## 4. Feature x persona matrix

TS = table stakes (blocks use), D = differentiator, N = nice-to-have, - = not relevant.

| Feature | Pricing analyst | RevOps/deal desk | PE/consultant | FP&A |
|---|---|---|---|---|
| Excel export with live formulas | TS | N | TS | TS |
| PPTX export (charts + tables bound to checked results) | D | N | TS | D |
| PDF/memo export with methodology + data-quality appendix | D | N | D | D |
| Audit trail / run record viewable and exportable (inputs hash, queries, scripts, treatments) | D | D | D | TS |
| Reproducible re-run on a refreshed file ("monthly rerun") | TS | D | N | TS |
| PVM bridge with tie-out check built in | TS | N | TS | TS |
| Standard waterfall (list to pocket) from user column mapping | TS | D | TS | N |
| Scheduled refresh + alerts | D | D | N | D |
| Direct DB/warehouse connection (Postgres, Snowflake) | D | N | - | D |
| MCP connectors to SaaS (Salesforce/HubSpot/Stripe) | N | D | - | N |
| Google Sheets / Drive input | N | D | N | N |
| Sign-off / versioned reports | D | D | N | D |
| Approval workflow in CRM | - | TS | - | - |
| Multi-user sharing | N | D | N | N |
| Elasticity / optimisation | N | N | N | - |

Confidence: medium; the TS/D labels are my judgement from the sources, not survey data.

## 5. MCP connector verdict

**Verdict: the owner's priority is mis-ordered. MCP is P1 at best, behind Excel/PPTX export and a reviewable audit artefact. Connectors that matter most are DuckDB-native database attach and a "refresh from file" re-run, not SaaS MCP.**

Reasoning:

1. **Demand evidence points to files.** Every persona's inputs and outputs are files (Excel, CSV, PPTX). Job posts require Excel/ERP/BI skills, not "agent connects to CRM". PE/consulting data arrives in data rooms. Finance users cannot get live credentials to ERP for an unvetted desktop tool without IT review, which defeats "solo dev, local first" adoption. (medium)
2. **Trust model conflict.** The product's promise is that every number comes from a script that ran on data with a recorded hash. A live API/MCP tool call returns data that is not reproducible next week and not hashable unless the harness snapshots the result to a file first. So any connector must be "fetch -> write a snapshot file/table -> analyse the snapshot", which is just an exporter. Calling an MCP tool and letting the model summarise inline would break checked figures. This is the strongest argument against raw MCP passthrough. (high, reasoning-based)
3. **Quality of what MCP gives you.** Stripe's hosted MCP exposes generic API read tools (`stripe_api_read`, list invoices/subscriptions/prices) plus a preview `stripe_analytics`; pagination of large lists via an LLM tool loop is poor for analytics at volume ([Stripe MCP docs](https://docs.stripe.com/mcp)). NetSuite's AI Connector (SuiteApp, OAuth2+PKCE, read-only SuiteQL) is genuinely useful but needs a NetSuite admin to install, and is described mostly by third-party blogs ([search results](https://epiqinfo.com/netsuite-mcp-and-ai-connector-the-complete-guide-for-us-businesses-2026/)) (low-medium). Salesforce's local DX MCP server has `run_soql_query` but is a developer tool and its README says it reaches end of life on 2026-11-02 ([salesforcecli/mcp](https://github.com/salesforcecli/mcp)); hosted Salesforce MCP exists per secondary sources (unverified). Snowflake-Labs/mcp is deprecated in favour of an official Snowflake server ([repo](https://github.com/snowflake-labs/mcp)). HubSpot has a remote MCP at mcp.hubspot.com needing a developer-platform app ([HubSpot](https://developers.hubspot.com/mcp)). Official reference servers for Postgres, SQLite and Google Drive are archived and described as reference, not production ([modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)). The ecosystem is fragmenting fast; a solo dev would own a moving target. (medium-high)
4. **Pi SDK status uncertain.** Pi historically had "no MCP"; a secondary source claims Pi 1.0 (Oct 2026) added MCP, and an adapter extension (pi-mcp-adapter) existed ([search snippet](https://yage.ai/share/mcp-demotion-survival-en-20261004.html), [Composio](https://composio.dev/blog/top-pi-extensions)). I could not confirm on the Pi repo ([earendil-works/pi](https://github.com/earendil-works/pi), MIT). Verify before planning. (low)
5. **Where MCP is right:** (i) one generic MCP client inside the Node server gives the user "bring your own connector" cheaply, **if** every tool result is auto-saved as a snapshot file that enters the normal hash/view pipeline; (ii) HubSpot/Stripe/NetSuite for the RevOps and SaaS persona. Effort S-M for the generic client + snapshot wrapper; do not hand-write per-vendor connectors.
6. **Better alternatives, ranked for professional readiness:** Excel/PPTX export > audit/run record export > rerun on refreshed file > DuckDB native DB attach (Postgres/ADBC) > scheduled refresh > SaaS MCP.

## 6. Feature candidates (with Ease of integration)

Stack reminder: Node/TS Fastify server, Python scripts via `execute_analysis`, DuckDB, Pi SDK skills. Licence checks are from repo pages fetched 2026-10-18 unless marked.

### F1. Excel export with live formulas

| Field | Value |
|---|---|
| Feature | Export results as .xlsx where bridges, waterfalls and totals are formulas over a data sheet, plus a "Method" and "Checks" sheet |
| Why | All four personas hand over Excel; reviewers click into cells. PVM tie-out check must be visible. Evidence: section 1, [Coefficient PVM](https://coefficient.io/cfo-resources/price-volume-mix-analysis-excel) |
| Priority | P0 |
| Effort | M |
| Ease of integration | **XlsxWriter** (BSD-2-Clause, 4.0k stars, mature; writes formulas, charts; cannot read) https://github.com/jmcnamara/XlsxWriter - use from a Python script in `execute_analysis`; write the cached value alongside each formula (its `write_formula(..., value=)` argument; verified from memory, not on the fetched page) so non-recalculating viewers show the checked number. **openpyxl** (MIT, mature, reads+writes, formulas as strings, no recalculation) https://openpyxl.readthedocs.io for round-trip edit. Recalculation check: LibreOffice headless (MPL-2.0, `soffice --convert-to xlsx`) or **formulas** (EUPL-1.1, v1.3.4 Mar 2026, 483/536 functions, https://github.com/vinci1it2000/formulas) to recompute and diff against script output. Avoid **pycel** (GPL-3.0, no releases listed, https://github.com/dgorissen/pycel) because of GPL in an Apache-2.0 project (only a dependency call, but it is a licence risk). EUPL-1.1 is also copyleft; use as an optional tool, not a bundled dependency. Plug-in: a skill "export-xlsx" with a template script; the checked-figures validator compares recomputed cell values to the printed result. |

### F2. PPTX deck export (charts and tables bound to executed results)

| Field | Value |
|---|---|
| Feature | One-click deck from selected checked charts/tables with source footers |
| Why | PE/consultant (TS) and analyst; slides must tie to Excel backup |
| Priority | P0 for PE persona, P1 overall |
| Effort | M |
| Ease of integration | **python-pptx** (MIT, 3.6k stars, 2.1k commits, mature but slow release cadence; native charts/tables) https://github.com/scanny/python-pptx; or **PptxGenJS** (MIT, 6.3k stars, charts/tables/images, runs in Node, so can sit in the Fastify server directly) https://github.com/gitbrent/PptxGenJS. Plotly figures: export PNG with kaleido (Python) for images, or rebuild as native charts so numbers stay editable. Plug-in: server route that takes result-file IDs and a template; "source: run hash" in each footer. |

### F3. PDF / memo export

| Field | Value |
|---|---|
| Feature | PDF with narrative, checked tables, methodology and data-quality appendix |
| Why | Analyst memos; auditors want a static record |
| Priority | P1 |
| Effort | S-M |
| Ease of integration | **WeasyPrint** (BSD-3-Clause, mature; needs Pango system libs, awkward on Windows) https://github.com/Kozea/WeasyPrint (licence from memory; verify). Alternative with no native deps: print-to-PDF from the existing browser UI (Chromium `page.pdf()` via Playwright, Apache-2.0) or Markdown -> docx via pandoc (GPL, call as a separate binary only). Given Windows support, prefer browser print-to-PDF. |

### F4. Exportable audit trail / run record

| Field | Value |
|---|---|
| Feature | Per-report "run record": input file hashes, queries, scripts, treatments from `.pricing/context.md`, figure-to-output match table, model ID, timestamps |
| Why | FP&A and PE reviewers need lineage and reproducibility. Strongest link to the product's differentiator (checked figures). Deal desk sources stress storing decider and rationale ([Rework](https://resources.rework.com/fr/libraries/pipeline-management/deal-desk)) |
| Priority | P0 |
| Effort | S-M (data already recorded internally) |
| Ease of integration | Mostly internal. Render as a "Run record" sheet in the xlsx (F1), an appendix slide (F2) and an HTML/JSON file. Optional: sign the JSON with a hash chain (Node `crypto`); no new library needed. Reference format: W3C PROV or OpenLineage (Apache-2.0, https://openlineage.io) are overkill; mimic their field names only. |

### F5. Rerun on refreshed data ("monthly refresh")

| Field | Value |
|---|---|
| Feature | Save a finished analysis as a parameterised script bundle; rerun against a new file with the same column mapping and diff vs last period |
| Why | Analyst and FP&A recurring monthly work; incumbents' main value. Without it the tool is one-off |
| Priority | P0/P1 |
| Effort | M |
| Ease of integration | Scripts already exist in run records; need a "re-execute with new input path" runner plus schema-fingerprint check (matches the owner's persistent-source-views idea). DuckDB for schema diff. Scheduling later via OS scheduler: Windows Task Scheduler / macOS launchd, or in-process **node-cron** (ISC, mature) https://github.com/node-cron/node-cron; keep manual "rerun" first. |

### F6. Standard analysis templates: PVM bridge with tie-out, pocket-price waterfall

| Field | Value |
|---|---|
| Feature | Deterministic, tested scripts (not model-improvised) with documented conventions and a sums-to-total assertion |
| Why | Methods differ by source ([Zebra BI](https://zebrabi.com/template/bridge-price-volume-mix/) vs [Coefficient](https://coefficient.io/cfo-resources/price-volume-mix-analysis-excel)); reviewers reject unspecified conventions. Differences between runs by different models (noted in project memory) harm trust |
| Priority | P0 |
| Effort | M |
| Ease of integration | Plain pandas/DuckDB SQL in skills; no library needed. Plotly waterfall trace (MIT) already available for charts. Test against published Excel templates above as oracle. |

### F7. Direct database connectors (Postgres, MySQL, Snowflake, others)

| Field | Value |
|---|---|
| Feature | Attach a read-only database and snapshot selected tables into DuckDB |
| Why | Analyst and FP&A where BI/warehouse exists; avoids manual export |
| Priority | P1 |
| Effort | S |
| Ease of integration | DuckDB **postgres** extension (official; `ATTACH ... (TYPE postgres, READ_ONLY)`) https://duckdb.org/docs/stable/extensions/postgres ; **MySQL** extension; **ADBC** community extension for Snowflake/BigQuery/Databricks (`INSTALL adbc FROM community`) https://duckdb.org/community_extensions/extensions/adbc (maturity uncertain; verify driver install on Windows). DuckDB core is MIT. Plug-in: server-side connection form + credentials in OS keychain (`keytar`/Node `safeStorage` equivalents), CREATE TABLE AS snapshot then hash. |

### F8. MCP client (generic) with snapshot wrapper

| Field | Value |
|---|---|
| Feature | Let the user add MCP servers; tool results auto-saved as files and registered as views |
| Why | RevOps/SaaS persona; "bring your own connector" |
| Priority | P1 |
| Effort | M (plus unknown Pi support) |
| Ease of integration | Official TypeScript SDK **@modelcontextprotocol/sdk** (MIT) https://github.com/modelcontextprotocol/typescript-sdk gives a client in the Node server. Pi: check for native MCP (claimed in Pi 1.0, unverified) or the pi-mcp-adapter extension. Vendor servers: Stripe remote https://mcp.stripe.com (OAuth or agent API key; vendor-official; generic read tool, `stripe_analytics` preview) https://docs.stripe.com/mcp ; HubSpot remote https://developers.hubspot.com/mcp (OAuth, developer-platform app required); NetSuite AI Connector via MCP Standard Tools SuiteApp (OAuth2+PKCE, read-only SuiteQL, admin install; official but documentation not verified on Oracle site); Salesforce `@salesforce/mcp` (Apache-2.0, `run_soql_query`, local dev-oriented, EOL 2026-11-02) https://github.com/salesforcecli/mcp ; Snowflake-Labs/mcp (Apache-2.0, deprecated) https://github.com/snowflake-labs/mcp ; Google Sheets community server xing5/mcp-google-sheets (MIT, ~850 stars, community) via https://enterprisedna.co/directories/mcp/xing5-mcp-google-sheets ; reference Postgres/SQLite/Drive servers are archived https://github.com/modelcontextprotocol/servers . Caution: prompt-injection through tool results; Stripe's own docs warn about it. Use read-only scopes only. |

### F9. Scheduled refresh and alerts

| Field | Value |
|---|---|
| Feature | Timer runs F5 and notifies on threshold breaches |
| Why | Table stakes in incumbents; D for analyst/RevOps/FP&A |
| Priority | P2 |
| Effort | M-L (a desktop-browser app is not always running; needs a background process) |
| Ease of integration | node-cron in the server for "while running"; OS scheduler for headless runs (Windows Task Scheduler, launchd). Notification: email via nodemailer (MIT) or a webhook. Do after F5. |

### F10. Sign-off and report versioning

| Field | Value |
|---|---|
| Feature | "Approve" a report version (name, date, comment) and keep a version list |
| Why | Reviewers want sign-off and version history; deal desk wants approval records |
| Priority | P1 |
| Effort | S |
| Ease of integration | Local JSON/SQLite records next to run records; git-style content hash. Optional git (`isomorphic-git`, MIT) for real history. No team auth needed for single-user: sign-off is a stamp, not a control; be honest in UI that it is not tamper-proof. |

### F11. Google Sheets / Excel online input

| Field | Value |
|---|---|
| Feature | Import from a Sheets URL |
| Why | RevOps and startups live in Sheets |
| Priority | P2 |
| Effort | S |
| Ease of integration | Export-as-xlsx URL download if shared, or Google Sheets API (Apache-2.0 client libs); or the MCP route in F8. Simplest: tell users to download. |

### F12. Elasticity / optimisation modelling

| Field | Value |
|---|---|
| Feature | Price elasticity estimates, optimisation |
| Why | Vendors headline it; practitioners need good data and rarely get defensible elasticities from transactional exports. Risky for "checked figures" credibility |
| Priority | P2 |
| Effort | L |
| Ease of integration | statsmodels (BSD-3), scikit-learn (BSD-3) in Python scripts; do not promise causal estimates. |

### F13. CPQ / approval-workflow integration (deal desk)

| Field | Value |
|---|---|
| Feature | Approve/deny quotes in Salesforce CPQ etc. |
| Why | The deal desk daily job lives in CRM/CPQ |
| Priority | P2 (do not build) |
| Effort | L |
| Ease of integration | Out of scope for a local analyst; competes with CPQ vendors. Offer only discount-trend analysis from CRM exports. |

## 7. Minimum professional-ready feature set

To let a pricing analyst, PE consultant or FP&A analyst hand something to a reviewer:

1. Excel export with live formulas + Method + Checks sheets (F1).
2. Exportable run record / lineage appendix (F4).
3. Tested PVM and pocket-price waterfall templates with tie-out assertions and stated conventions (F6).
4. PPTX export of checked charts/tables (F2) for the consulting persona.
5. Rerun on a refreshed file with period diff (F5).
6. Validation on at least a few real or realistic messy datasets from practitioners (not a feature, but P0: the briefing says the product was never validated on real business data).

Connectors are not in the minimum set.

## 8. Top 10 ranked

1. Excel export with live formulas (F1)
2. Run record / audit appendix export (F4)
3. Standard PVM + waterfall templates with tie-out (F6)
4. PPTX export (F2)
5. Rerun on refreshed data with period diff (F5)
6. Direct DB attach via DuckDB extensions (F7)
7. Generic MCP client with snapshot-to-file wrapper (F8)
8. Sign-off / report versions (F10)
9. PDF/memo export (F3)
10. Scheduled refresh and alerts (F9)

(Below the line: Sheets input F11, elasticity F12, CPQ integration F13.)

## 9. Owner assumptions that are wrong or weak

- **"MCP connector is the top priority" - weak.** See section 5: persona work is file-in/file-out; MCP data is not reproducible unless snapshotted; the ecosystem is churning (Snowflake and Salesforce servers deprecated/EOL; reference servers archived); Pi's MCP support unconfirmed.
- **"Checked figures" alone is a differentiator - weak without a handover artefact.** The reviewer cannot see a chat badge; it must appear in an exported file with lineage.
- **"Local-first" is a differentiator - true, but mainly for PE/consulting and finance teams with confidentiality limits.** It has a cost: no sharing, no scheduling. Confidence: medium.
- **Competing with PROS/Pricefx/Zilliant/Vendavo on features - wrong frame.** Their table stakes are ERP integration, workflow and governance; position as the analyst's workbench, and for companies that cannot afford those suites (SMBs, diligence teams). Mid-market buyers' needs not verified.
- **Elasticity/optimisation matter - weak.** Vendors lead with it; practitioner duties in the job posts found centre on waterfall, leakage, discounts, margin reporting.
- **Deal desk is a target persona - weak.** Their core is in-CRM approval; only their analysis slice fits.
- **Gaps in this research (be honest):** no direct practitioner interviews; incumbent capability tables rest on aggregator pages; FP&A audit-trail norms and Simon-Kucher/McKinsey playbooks were not retrieved (search returned vendor/Umbrex pages instead); library licence details for WeasyPrint, openpyxl, node-cron, LibreOffice, nodemailer, isomorphic-git, statsmodels are from background knowledge, not fetched in this session (verify before adoption). Recommend 5 short interviews with real analysts before committing roadmap beyond P0.
