# 02 - Demand and competition (2026-10-18)

Mandate: does anyone want this, and what do they use today?

## 0. Method and limits (read first)

- Tools: web search and fetch only. **reddit.com is blocked** for the search tool, so no Reddit threads were read. LinkedIn, G2 and Capterra review text were also not retrievable. Demand evidence therefore comes from: one primary survey (Datarails, Oct 2026), Hacker News comments (via the Algolia API), vendor pages, and review/blog sites.
- Many search results are vendor marketing. Each finding carries a strength tag. Items marked "(pk)" are from prior knowledge and were not re-verified this session.
- Strength scale: strong = quantified, survey or primary source; weak = single practitioner or vendor-authored; anecdotal = one comment.

## 1. Demand signals

| # | Signal (short quote or paraphrase) | Source | Date | Strength |
|---|---|---|---|---|
| D1 | Finance teams spend ~26% of the working week checking or correcting AI output (270 CFOs, all AI users). | https://cpapracticeadvisor.com/2026/10/07/fact-checking-ai-is-taking-up-more-of-cfos-and-finance-teams-time/191230 | 2026-10-07 | strong (vendor-run survey; Datarails sells FP&A AI) |
| D2 | Top AI hesitations: lack of auditability 75%, accuracy/hallucination 71%, compliance 54%. | same | 2026-10 | strong (same caveat) |
| D3 | 65% name "confident answers built on the wrong data" as the most common frustration. | same | 2026-10 | strong |
| D4 | 56% saw team members get materially different outputs from the same prompt and data (reproducibility). | same | 2026-10 | strong |
| D5 | Only 5% trust AI for board-ready reports without review; 4% for month-end close. | same | 2026-10 | strong |
| D6 | 1 in 4 finance executives reported AI errors reaching boards or external audiences (Workiva midyear benchmark). | https://www.comparethecloud.net/news/a-quarter-of-finance-executives-have-watched-ai-errors-reach-their-boards-workiva-survey-finds | 2026 | medium (snippet only) |
| D7 | 93% of 1,600 finance professionals (ACCA / CA ANZ) have concerns about AI outputs. | https://www.itpro.com/business/business-strategy/finance-teams-are-wasting-a-quarter-of-their-week-checking-ai-slop | 2026 | medium (snippet only) |
| D8 | CFO wish list: auditable outputs and consistent answers; buyer quote: "How am I going to most effectively check its work?" | cpapracticeadvisor link | 2026-10 | strong |
| D9 | Only 4% have a single source of truth for finance/operational data; 23% rely on disconnected systems and manual reconciliation. | same | 2026-10 | strong. Implication: file exports remain the real input path |
| D10 | 84% of B2B companies still price with spreadsheets/manual methods; 61% exploring AI (Zilliant survey, 500+ pricing pros). | https://sapinsider.org/map/majority-of-enterprises-still-rely-on-manual-pricing-tools-zilliant-survey-finds/ | 2025 | medium (vendor survey) |
| D11 | Microsoft's own Copilot warning: avoid COPILOT() for "any task requiring accuracy or reproducibility". | HN comment by otter0, https://news.ycombinator.com/item?id=48541460 | 2026-06-15 | anecdotal (quotes Microsoft doc) |
| D12 | Independent test: Excel COPILOT() facts frequently wrong, from subtle omissions to fabrications. | https://office-watch.com/2025/facts-are-slippery-copilot-excel/ | 2025 | weak-medium (trade press) |
| D13 | Copilot in Excel struggles with merged cells, blank rows, several datasets per sheet; tables up to 2M cells; files must be on OneDrive/SharePoint. | https://support.microsoft.com/office/7a13758f-d61e-4a56-8440-f2c9a07802ec ; https://gptprompts.ai/ai-errors-and-fixes/copilot-in-excel-not-working | 2025-26 | medium |
| D14 | HN: copilot in excel "next to useless" (rdedev); "i can't even use CSV files with Copilot" (arbitrary_name). | https://news.ycombinator.com/item?id=47794172 | 2026-04 | anecdotal |
| D15 | HN: "Claude is more useful in Excel than Copilot.. how?" (seemaze) | https://news.ycombinator.com/item?id=47675670 | 2026-04-07 | anecdotal |
| D16 | Practitioner test: ChatGPT Data Analyst on a LinkedIn export gave wrong results; another saw a sum omit one cell. | https://freshvanroot.com/blog/data-analysis-chatgpt-learnings/ ; https://www.conferencesthatwork.com/index.php/tag/reliability/ | 2024-25 | weak |
| D17 | ChatGPT Advanced Data Analysis: 512 MB hard file cap, spreadsheets practically ~50 MB. | https://help.openai.com/en/articles/8555545-file-uploads-faq-advanced-data-analysis | current | strong (OpenAI doc). Pricing Harness accepts 2 GiB: a real edge for big transaction files |
| D18 | Confidentiality: uploading CIMs or client files to consumer AI is generally not allowed without an approved enterprise plan; CFA Institute blog describes local "private GPT" for analysts. | https://blogs.cfainstitute.org/investor/2025/07/14/rethinking-research-private-gpts-for-investment-analysis ; https://uplevered.com/can-you-upload-a-cim-to-chatgpt/ | 2025-26 | weak-medium (mostly vendor advocacy; CFA piece independent) |
| D19 | 53% of CFOs plan to expand AI licences; 32% overran AI budgets by 10%+. | cpapracticeadvisor link | 2026-10 | strong. Budget exists but goes to enterprise tools |
| D20 | Zilliant markets to firms "that still rely on spreadsheets or find pricing software too complex or costly" and shipped agents plus a pricing MCP server (Q1 2026 availability). | https://zilliant.com/press-releases/zilliant-launches-agentic-ai-with-industry-first-mcp-server-to-end-spreadsheet-pricing | 2025-10 | strong as vendor intent. Incumbents are moving down-market |

**Demand NOT found:** no first-hand "I'd pay for X" quote from a pricing analyst, FP&A person or consultant; no Reddit or Professional Pricing Society thread; no finance practitioner asking for local analysis (only vendor advocacy and one CFA blog). Summary: the *pain* (trust, auditability, reproducibility) is strongly evidenced by surveys; the *specific want* (local + open-source + pricing-specific) has no practitioner voice I could reach. Confidence: high on pain, low on this product's specific appeal.

## 2. Competitor matrix

Prices come from third-party pages unless stated; verify before quoting.

### 2a. General AI data analysts

| Product | Target | Price | Connectors | Trust / verification | Local | OSS |
|---|---|---|---|---|---|---|
| ChatGPT Data Analysis / ChatGPT for Excel (add-in, beta Mar 2026) | everyone; finance workflows | Plus/Business/Pro plans (~$20+/mo; add-in included) | Excel/Sheets; Moody's, S&P, LSEG, Factiva | none beyond "check it"; code visible in ADA | no | no |
| Claude for Excel (GA 7 May 2026) | analysts, financial services | any paid Claude plan (~$17-20/mo Pro) | Excel; MCP connectors (S&P, LSEG, PitchBook, FactSet) | edits visible in the workbook | no | no |
| Copilot in Excel | M365 users | Premium tier / ~$30 per user | OneDrive/SharePoint files | Microsoft states output can be wrong | no | no |
| Julius AI | analysts, SMB | Free; Plus $35; Pro $45 (DB connectors); Max $200; Business $375 | Postgres, Snowflake, BigQuery, Sheets, Stripe, Ads (Pro+) | shows code; reviews say verify | no (VPC on Enterprise) | no |
| Hex (Magic) | data teams | Pro $36 / Team $75 per editor | warehouses | reviewable notebooks; SOC2; audit logs on Enterprise | no | no |
| Rows, Shortcut, Endex, Formula Bot | spreadsheet-native finance | Endex invite-only; others not retrieved | Excel/Sheets | Endex claims integrated citations to sources | no | no |
| Akkio, Powerdrill, DataChat, Fabi.ai, Zerve | SMB / data teams | not retrieved (Zerve, Fabi.ai have free tiers) | files, DBs | mostly code-visible | no | no |
| ThoughtSpot, Databricks Genie, Snowflake Cortex Analyst | enterprise warehouse users | enterprise contracts | own warehouse | strongest in class: Cortex "verified queries" are human-checked SQL with regression evals; Genie certified answers (pk) | no | no |

### 2b. FP&A AI

| Product | Target | Price | Notes |
|---|---|---|---|
| Datarails | mid-market Excel-based FP&A | ~$20k/yr + implementation (vendor guide) | governed data layer; its survey names auditability as the top gap |
| Cube, Mosaic, Runway, Abacum, Pigment | mid-market / enterprise | contact sales | planning models, not figure verification; no local option |

### 2c. Pricing software

| Product | Target | Price | Notes |
|---|---|---|---|
| Pricefx | enterprise B2B | from ~$100k/yr (SelectHub, single source) | full optimisation |
| Zilliant | B2B mid/large | contact sales; 7-month implementation on G2 | Pricing Plus (Nov 2025) "beyond spreadsheets"; agentic AI and MCP server |
| PROS, Vendavo | enterprise | contact sales | heavy implementations |
| PriceEdge | mid-market | from EUR 1,490/mo (G2) | cheapest listed full tool |
| Shopify apps (PricePulse, Margin Insight) | micro-merchants | $9-$20/mo | shows the SMB self-serve ceiling |

### 2d. Open-source analogues

| Project | Licence / stars / status | Does | Local LLM | Verification |
|---|---|---|---|---|
| PandasAI | MIT (ee dir separate) / 23.9k | chat over CSV/SQL; Docker sandbox option | via LiteLLM | none |
| Vanna | MIT / 23.8k / **archived 29 Mar 2026** | text-to-SQL agents, audit logs, RLS | Ollama etc. | audit logs only |
| WrenAI | Apache-2.0 core / 17.9k; GenBI UI commercial | semantic layer (MDL) plus text-to-SQL validated before run; MCP server | not stated | semantic layer |
| Open Interpreter | Apache-2.0 / 68.6k; now a Rust Codex-based rewrite | general code agent | maybe, via OpenAI-compatible API | none |
| DB-GPT | MIT / 20.2k | NL-to-SQL, Python analysis, reports, sandbox | yes (vLLM, llama.cpp) | none specific |
| Lumen (HoloViz) | BSD-3 / 318 | chat with data, DuckDB, dashboards | unclear | outputs "inspectable" |
| LibreChat | MIT / 45.9k | chat UI, self-hosted code interpreter, MCP | via providers | none |
| Chat2DB | not fetched | AI SQL client | - | - |
| LakeMind, Tabloy AI, Spredly, DataOlllo | small, mostly commercial or unverified | local-first DuckDB / desktop analysts, LLM sees schema only | some | none documented |

## 3. Gap analysis

**Where Pricing Harness is genuinely differentiated:**
1. **Mechanical checking of reply prose against executed output.** No competitor found does this. Others show code (Julius, ADA, Hex), cite sources (Endex, claimed), or verify the query up front (Cortex verified queries, WrenAI semantic layer). Those check the query, not whether the prose quotes the result correctly. Maps to D3, D8. Caveat: Excel add-ons write results into cells, which sidesteps prose-number errors, and competitors may check internally without documenting it.
2. **Hash-recorded script runs and sealed handoff checkpoints** (answers D4). No analogue found; moderate confidence on absence.
3. **Local-first + open source + any model, combined**, with pricing method packaged as skills. Each piece exists elsewhere (DB-GPT, Lumen, LibreChat, Tabloy); the combination does not.
4. **2 GiB files** against ADA's ~50 MB practical spreadsheet cap.
5. **Persistent business context plus detector flags where code never applies treatments.** Maps to D3; competitors' semantic layers are the enterprise analogue.

**Where it is NOT differentiated:**
- **"Chat with a spreadsheet".** Claude for Excel, ChatGPT for Excel and Copilot live inside the tool analysts already use, from ~$20/mo, with finance data connectors. A separate local web app is a worse experience for "edit my model".
- **Local/private.** Only half-true while the model is reached through OpenRouter: summaries and script output still go to a cloud model. The claim holds only with a local model, and weak local models may do poorly at the pricing skills (untested). Tabloy and LakeMind make the same "schema only to cloud" claim.
- **Connectors.** Julius Pro ($45) has Postgres/Snowflake/BigQuery; Zilliant, Claude and WrenAI have MCP.
- **Pricing domain content.** Zilliant and Pricefx own enterprise pricing and Zilliant now targets the "spreadsheet pricing" crowd.
- **Governance** (SSO, RLS, audit UI): Hex, Julius Enterprise, Cortex have it; this product has none.

## 4. Feature candidates

Pi = the Pi agent SDK. (pk) = not verified this session.

| Feature | Why | Priority | Effort | **Ease of integration** |
|---|---|---|---|---|
| Excel export of verified results (values + formulas + provenance sheet) | Every incumbent writes to Excel; CFOs must re-check in their own tools (D8). Output outside Excel is hard to use. | P0 | S-M | Python scripts already run: **XlsxWriter** (BSD-2, mature, formulas and native charts, Python only) or **openpyxl** (MIT (pk), read/write). Add an `export_xlsx` tool taking a result file and emitting sheets plus a provenance sheet carrying the run hash. Node option: ExcelJS (MIT (pk)). Avoid HyperFormula for recalculation: **GPLv3 or commercial** (https://github.com/handsontable/hyperformula) conflicts with Apache-2.0. For recalculation use LibreOffice headless (MPL (pk)) only if needed. |
| Audit view of checked figures (each number linked to script output and run hash) | The core promise (D2, D8); today only internal run records. Makes the differentiator visible to a buyer. | P0 | M | No library needed: hashes and matches already exist. Render as a panel in the React/assistant-ui app. No OSS reference found. |
| Re-runnable saved analyses ("recipes") on refreshed files | Answers D4 reproducibility (56% saw differing outputs). | P1 | M | Recorded scripts and hashes already exist; add replay + re-check. No OSS needed. Prerequisite for scheduling. |
| PDF / PPTX report export with bound figures | Consultants and pricing managers deliver decks; Datarails/Endex sell this. | P1 | M | **python-pptx** (MIT (pk)) or **PptxGenJS** (MIT (pk)) invoked from `execute_analysis` so figures stay script-sourced; PDF via browser print stylesheet or WeasyPrint (BSD (pk)). |
| Documented, evaluated local-model path (Ollama / LM Studio) | The privacy claim only holds with a local model. | P1 | S | OpenAI-compatible endpoint through Pi provider config; Ollama (MIT (pk)). Work is running the eval suite on small models. |
| Read-only database connectors via DuckDB | Julius Pro, Hex, WrenAI have them; real but secondary (D9). | P1 | S-M | **DuckDB's own extensions** (postgres, mysql, sqlite, httpfs/S3 (pk)) used from the existing `query` tool; attach read-only with a user-supplied connection string. No new dependency. |
| MCP client (use existing servers) | Owner priority; see verdict below. | P1 (not P0) | M | **Official TS SDK** https://github.com/modelcontextprotocol/typescript-sdk (Apache-2.0 for new code, MIT for old; 13.6k stars; v2 stable; client package `@modelcontextprotocol/client`). Pi: a third-party post says Pi 1.0 (1 Oct 2026) added MCP natively, **unverified** (https://yage.ai/share/mcp-demotion-survival-en-20261004.html); `pi-mcp-adapter` exists (https://github.com/nicobailon/pi-mcp-adapter, licence not checked) using one ~200-token proxy tool. Servers: Google **mcp-toolbox** https://github.com/googleapis/mcp-toolbox (Apache-2.0, 16.7k, v1.14, ~20 databases, `tools.yaml`, stdio/HTTP); **MotherDuck** https://github.com/motherduckdb/mcp-server-motherduck (MIT, 532 stars, read-only default, local .duckdb files); Snowflake-Labs/mcp is **deprecated**. Caveat: MCP results must be written to a recorded result file, or the figure check cannot see them. |
| Scheduled runs and margin alerts | Zilliant's Insights Agent sells proactive alerts; the product is session-based. | P2 | M-L | `node-cron` or OS scheduler launching a headless Pi session on a saved recipe (MIT (pk)); email via nodemailer (MIT (pk)). Needs recipes first. |
| Google Sheets link import | Julius free tier has it. | P2 | S | Published-CSV URL of a link-shared sheet, or `gspread` (MIT (pk)) with OAuth. |
| Semantic layer / metric definitions | Cortex and WrenAI use it for trust; `.pricing/context.md` already plays the role. | P2 | M | WrenAI MDL https://github.com/Canner/WrenAI (Apache-2.0 core) is a reference, not a drop-in (separate service). Do not adopt. |
| In-Excel add-in | What users praise (D14, D15) but head-on against Microsoft, OpenAI, Anthropic. | not recommended | L | Office.js; skip. |
| SSO / RLS / multi-user hosting | Enterprise only (Hex, Julius Enterprise). | P2 | L | Skip until a paying team asks. |

### MCP verdict (the owner assumption)

MCP is **useful but not the top priority, and not for the reason assumed.**
- For: pricing vendors and Claude clients are standardising on it; one TypeScript integration of mcp-toolbox covers ~20 databases; Pi appears to be gaining MCP.
- Against P0: (a) only 4% have a single source of truth and 23% reconcile manually, so analysts mostly start from exports (D9); (b) no practitioner in anything read asked for MCP; (c) DuckDB extensions give Postgres/MySQL/S3 with no new moving parts; (d) data arriving via MCP is not produced by a recorded script, so the figure check needs a wrapper; (e) Pi's author argued in Nov 2025 that MCP costs context and composes poorly.
- Recommendation: Excel export and the audit view first, DuckDB-attach connectors second, thin MCP client third with results landed as files.

## 5. Who would pay, and how much

Judgement from the evidence; no direct willingness-to-pay data found.

| Segment | Fit | Plausible spend | Basis |
|---|---|---|---|
| Independent pricing / margin consultants, fractional CFOs | Best: confidential client data, deliverables must be defensible, no IT department | $20-$100/mo for the tool plus own API cost | Claude/ChatGPT $20-$45, Julius $35-$45, Hex $36 |
| Analysts at PE portfolio companies or mid-size distributors with sensitive data and no pricing software | Good | $50-$500/mo per team if export and audit trail exist | upper anchors: PriceEdge EUR1,490/mo, Datarails ~$20k/yr |
| Mid-market teams already on Pricefx/Zilliant | Poor | little | $100k/yr tools in place |
| Enterprise FP&A | Poor | none | needs SSO, RLS, governed platforms |
| Shopify / SMB merchants | Weak | $9-$20/mo ceiling | Margin Insight, PricePulse |

Because the product is open source, revenue is likely support, hosted convenience or services rather than licences. Confidence: low.

## 6. Honest verdict on demand

- **Pain is real and large.** Auditability, reproducibility and "confidently wrong" top finance-AI complaints in a 270-CFO survey, alongside growing budgets (D1-D5, D19). The figure check targets exactly that.
- **The buyer evidence is enterprise finance from a vendor survey.** No practitioner was found asking for a local, open-source, pricing-specific analyst. Claude/ChatGPT in Excel are cheap, in-workflow and improving fast and will be the default. Zilliant is moving down-market.
- **Likely niche:** confidential, file-based pricing and margin work by consultants and small teams who need defensible numbers and cannot upload to a third party. Real but small and hard to reach. Demand is **plausible but unproven**. What would change confidence is 5-10 interviews with pricing consultants and a real-data trial, not more features.

## 7. Top 10 features, ranked

1. Excel export (values + formulas, provenance sheet).
2. Audit view of checked figures (number to script output to run hash).
3. Re-runnable saved analyses (replay and re-check on a refreshed file).
4. PDF/PPTX report export with bound figures.
5. Documented, evaluated local-model path (Ollama).
6. DuckDB-attach read-only connectors (Postgres/MySQL/S3).
7. Thin MCP client with results landed as recorded files.
8. Real-data validation with 3+ practitioners (a gate, not a feature).
9. Scheduled runs and margin alerts (after recipes).
10. Google Sheets link import.

## 8. Owner assumptions that are wrong or weak

1. **"MCP connector is a high priority."** Weak: no demand evidence; exports dominate input; DuckDB extensions cover most databases; MCP output bypasses the figure check unless wrapped. Keep it P1.
2. **"Local-first is a differentiator."** Weak as stated. With OpenRouter, data goes to a cloud model; the claim holds only with a local model, which is untested. Others (Tabloy, LakeMind, DB-GPT) claim it too.
3. **"Numbers you can audit" is unique.** Partly. The prose-vs-output check looks unique, but Cortex verified queries, Genie certified answers, WrenAI's semantic layer and Endex citations compete for the word "trust". Position it as "every number in the reply matched to a run".
4. **Roadmap gap: Excel output.** Absent from the plan, yet every incumbent lives in Excel. Bigger gap than connectors.
5. **Vanna / PandasAI as templates.** Vanna was archived 29 Mar 2026; PandasAI has no verification story and the stack already has DuckDB plus scripts.
6. **HyperFormula for recalculation** is GPLv3/commercial; incompatible with Apache-2.0 without buying a licence.
7. **Never validated on real data** is the biggest risk and outranks all feature work.
