# 04 - Niche and gaps (2026-10-18)

Mandate: (1) what important thing is missing that reports 01-03 and the roadmap did not cover; (2) is there a reachable niche where the product is clearly better than the alternatives. The owner's hypothesis (early-stage startups reconciling Stripe and ad spend into trustworthy unit economics) was tested, not assumed.

Scope rules applied (owner update, same day): the product stays small, mainly the owner's own tool, published in case others find it useful. It must not turn into a general agent platform. So every gap is scored for smallness, and anything that pushes towards a platform is marked OUT OF SCOPE. Revenue is secondary: "would people actually use it" outranks "would they pay".

## 0. Method and limits

- Tools: web search and fetch, Hacker News Algolia API, vendor pages, Stripe docs.
- **reddit.com is blocked** (fetch refused). r/startups, r/SaaS, Indie Hackers, Product Hunt threads and the Stripe community forum were **not read**. Demand evidence is therefore thin and leans on one strong HN thread, one Shopify community thread, vendor blogs and accountant guides. Vendor-authored items are tagged **[vendor]**.
- Price data from aggregators conflicts with vendor pages. Where I fetched the vendor page myself it is tagged **[page]**.
- Confidence: H/M/L.

## 1. Verdict on the startup hypothesis

**Partly right, and narrower than stated. Confidence: medium on the pain, low on the demand for this product.**

What holds:

1. **The metric-trust pain is real and documented by an insider-grade source.** A founder on HN: "every single tool that calculates MRR has had a different number" (sb8244, 2024-08-26, https://news.ycombinator.com/item?id=41353764). A reply says Stripe's MRR ran 10-20% over in their case, and quotes a Stripe support reply saying a fix is "extremely complex" with no timeline. (M-H, first-hand but one thread.)
2. **Cash is not revenue, and founders confuse the two.** An ex-Stripe revenue-recognition engineer open-sourced Book of Revenue on the premise that "cash collected isn't revenue, and MRR isn't an accounting metric" (https://news.ycombinator.com/item?id=49758181, 2026-09-18, 4 points, no comments). Accountant guides repeat the same traps: payouts are net settlements, annual plans distort months, invoice totals plus payout deposits double-count (beancount.io guides, 2026-10-11). (M; content is vendor/guide-grade.)
3. **CAC and payback are commonly computed wrongly**: revenue instead of gross margin, blended instead of per channel, fees and refunds forgotten, ad spend only (media-only CAC is said to be 40-70% of fully loaded CAC for D2C). Sources are blogs (DEV Community, SaaS Hero **[vendor, sells services]**, echai.ventures). Illustrative numbers, not surveys. (L-M)
4. **Investors ask for exactly these numbers** (cohorts, NRR, CAC payback, burn) and quietly cross-check them against bank statements and CRM (peony.ink, maxio.com **[vendor]**). A figure that does not reconcile can sink trust. (M)

What does not hold or is unproven:

1. **MRR/churn/cohort dashboards are already free or cheap.** ChartMogul Free covers up to $120K ARR; Starter from $69/mo, Pro from $119/mo [page]. Paddle's ProfitWell Metrics is still described as free (third-party sites; M). Baremetrics Launch $75/mo, Growth $255/mo, Scale $1,152/mo [page, with FAQ figures that disagree]. These cover MRR, churn and cohorts. The founder who only wants "my MRR" is served.
2. **The true gap is the join, not the metrics.** None of the vendor pages I fetched mention CAC or ad spend (ChartMogul, Baremetrics: "not mentioned"). Billing analytics tools stop at revenue; ad tools stop at ROAS. Nobody sells "gross-to-net revenue reconciled to payouts, then divided into ad spend." That is a real gap. (M)
3. **I found no founder asking for it.** No HN thread, no Indie Hackers post, no Reddit (blocked). Searches for "stripe reconciliation", "CAC payback" on HN comments returned nothing useful. The nearest signals are Show HN dashboards built because "Stripe's built-in dashboard doesn't show MRR, churn rate, or LTV" (solofoundr, 2026-03-07, https://news.ycombinator.com/item?id=47286883) and MRR-switching tools for multiple Stripe accounts. These show founders **build their own** rather than buy. (M)
4. **The hard part cannot be solved from CSVs.** Ad exports contain no customer identifiers. Joining ad spend to *cohorts* needs UTM or gclid captured into Stripe metadata or a CRM, which most early startups lack. From files you can honestly compute **blended** CAC per month and per channel when the user supplies a campaign-to-product mapping, not true per-customer attribution. This must be stated plainly in the product. (H, structural)
5. **"Little finance expertise" cuts both ways.** Those founders need the *explaining*, not an audit trail. Checked figures help them only as "the number was computed, not guessed". The data-quality detectors and confirmed definitions matter more to them than the hash chain. (M, judgement)
6. **Local-first matters less here.** Stripe and ad data already live in cloud tools the founder has authorised. Confidentiality is a weaker driver than for consultants or diligence work. What matters is **free to run and no account linking** (no OAuth to Stripe, no API keys pasted anywhere). That is a real benefit, but a smaller one. (M, judgement)

**Would the plugin plus Stripe MCP in Claude already cover it?** Largely yes for a founder who has Claude and is willing to connect Stripe: the Stripe MCP tools list balance transactions and invoices (third-party directories, M). What it lacks: no deterministic reconciliation check, no figure verification, balance-transaction pagination through a chat tool is slow and incomplete-prone, and no ad-spend join. So the harness is better only where a **file-based, checked, reproducible** run beats a chat session. For a lightweight owner-first tool that is a sufficient reason; for a market claim it is thin.

**Net verdict:** keep the startup/subscription-founder niche as the **test case and the first plugin content**, but do not build a product around it before 5 real conversations. It is a good fit for "small and useful" because the work is mostly SQL over two to four well-documented exports. It is a poor fit for any plan that needs this audience to pay.

## 2. Alternatives and where they fall short

| Alternative | Price | Covers | Falls short for this buyer | Evidence |
|---|---|---|---|---|
| Stripe Dashboard + reports (Balance report, Payout reconciliation) | free | Itemised transactions, fees, refunds, disputes, payout matching | No unit economics, no ads; MRR disputed by founders (HN) | Stripe docs (H) |
| Stripe Sigma | Tiered by monthly charge count: roughly $10-15/mo to ~250 charges up to $450/mo to 25,000 (third-party summary of Stripe page; M). Natural-language SQL assistant exists. | Your Stripe data in SQL | Stripe data only; needs SQL skill or trusting the assistant; no ads | support.stripe.com, stripe.com/sigma (M) |
| Stripe Revenue Recognition | EUR 20/mo up to EUR 8,800 monthly volume plus 0.25% beyond; annual tiers EUR 175-1,500/mo plus 0.2% [page; the last two rows look duplicated] | ASC 606 schedules, deferred revenue | Accounting-grade, not CAC/payback | stripe.com/revenue-recognition/pricing (H) |
| ChartMogul | Free to $120K ARR; $69 / $119 per month; Enterprise from $19,900/yr [page] | MRR, churn, LTV, cohorts, segments | No CAC or ad spend on pricing page; black-box MRR rules | chartmogul.com/pricing (H) |
| Baremetrics | $75 / $255 / $1,152 per month [page]; add-ons $129 | MRR, churn, trials, forecasts | No CAC or ad spend listed; priced above a seed founder's tolerance | baremetrics.com/pricing (H) |
| ProfitWell / Paddle Metrics | Described as free (M) | Subscription metrics on Stripe | Tied to Paddle's ecosystem; no ads join | gappsy.com, Paddle page (M) |
| Open-source: Book of Revenue | Self-host, licence not checked | Revenue recognition from Stripe | Accounting focus; needs deployment | GitHub tanin47/book-of-revenue (L-M) |
| Open-source: fivetran/dbt_stripe | Apache-2.0, 63 stars | 61 models: balance transactions, payout reconciliation, MRR report | Needs a warehouse and dbt | github.com/fivetran/dbt_stripe (H) |
| Fractional CFO / bookkeeper | CFO $3,000-12,000/mo typical, light retainers $1,400-3,000 (consultancy blogs **[vendor]**); productized bookkeeping $995-3,500/mo | Judgement, investor prep | Too expensive for pre-seed; slow | eightx.co, forecastr.co (M) |
| FP&A tools: Mosaic, Runway, Causal, Finmark | Mosaic undisclosed; Finmark is now part of BILL (custom) | Plans, budgets, runway | Planning, not reconciliation; weak joins | pricingsaas.com, help.finmark.com (L-M) |
| Spreadsheets | free | Everything, by hand | Errors, no audit, rebuilt monthly | all guides (M) |
| ChatGPT / Claude with uploaded CSV | $20/mo | Quick answers | No checks; ADA caps at 512 MB file / ~50 MB spreadsheet (report 02) | report 02 (H) |

No AI tool aimed squarely at "Stripe + ads -> unit economics for non-experts" surfaced in two searches. Absence of evidence only; there may be small Show HN tools (M-L).

## 3. Data reality (file-based input is enough)

**Stripe exports** (Balance report CSV, itemised; https://docs.stripe.com/reports/report-types/balance, H). Columns include `balance_transaction_id`, `created_utc`, `available_on_utc`, `currency`, `gross`, `fee`, `net`, `reporting_category`, `description`, plus joinable `customer_id`, `customer_email`, `customer_name`, `invoice_id`, `subscription_id`, `payment_intent_id`, `charge_id`, `automatic_payout_id`, `card_country`, `customer_facing_amount`, `customer_facing_currency`, `dispute_reason`, `fee_net_of_withheld_tax`. Amounts are in **major units** (not cents) in the report. So **one file already carries the customer email, the subscription and the payout id**. That removes most of the identity-mapping gap for Stripe-only startups. (H)

`reporting_category` collapses `charge`/`payment` to `charge`, `refund`/`payment_refund` to `refund`, `stripe_fee` to `fee`, and splits disputes and partial-capture reversals out of `adjustment` (https://docs.stripe.com/reports/reporting-categories, H). Payout reconciliation report matches deposits to the transactions they settle; **instant payouts are not linked** to transactions (docs, H).

**Common traps** (docs and accountant guides; M-H):

1. Payout is net of fees, refunds, dispute withdrawals, so payouts do not equal revenue.
2. Annual plans: cash lands once, revenue is earned monthly.
3. Dispute: funds withdrawn at dispute open, plus a dispute fee; may be returned later (separate `dispute_reversal` rows).
4. Partial captures create a reversal row typed as refund.
5. FX: balance report is in settlement currency; the customer-facing amount is separate; with multi-currency settlement the fee is charged when funds settle into a non-primary currency, not at payout (docs, H).
6. Timezone: report columns are UTC; a founder's month ends in local time.
7. Invoices vs charges: summing both double counts.
8. Free trials, coupons and credits appear in invoices, not balance transactions.
9. Taxes: VAT/sales tax collected is not revenue; whether it is in `gross` depends on how the account was set up. I found no clear doc on VAT applied to Stripe fees (gap; L).
10. Test-mode rows, multiple Stripe accounts (HN: founders running two accounts).

**Ad exports** (M; vendor-guide grade, not read from official docs):

- Meta Ads Manager export is a customised table; spend column is "Amount spent (<currency>)" in the ad account's currency; timezone is the account's creation timezone; default attribution window changes totals.
- Google Ads: account timezone and currency; the API reports cost in micros (**not verified this session**; L). The UI CSV carries a title and summary rows above the header and totals rows at the bottom (pk, L).
- LinkedIn Ads: campaign-level CSV, much smaller volumes; format not checked.
- Platform-reported conversions and revenue are **not** Stripe revenue. Use ad exports only for **spend**, never for conversions (this is a policy choice to build into the skill).

**Shopify** (for the alternative niche): payouts transactions export has Transaction Date, Type, Order, Card Brand, Payout Status, Payout Date, Available On, Amount, Fee, Net; the format has changed over time, and the payout-details export is limited to a single payout date (Shopify Community, M).

**Is CSV enough?** Yes for a first version. Everything above is downloadable by a founder in minutes, monthly cadence is enough for unit economics, and no OAuth means no credentials in the tool. Live connectors would add ongoing cost (tokens, pagination, rate limits) and push towards a platform. Connectors stay P2 or user-side (dlt, below).

## 4. Niche comparison

Scores 1-5 (5 best for us). "Zero-cost/local" = how much "free to run, data never leaves the laptop" matters (owner point 2). "Simple" = how little new machinery the niche needs. All scores are judgement. Confidence in the table overall: low-medium.

| Niche | Pain | Reachability | Would-use (revenue secondary) | Engine fit (checked figures, detectors, context) | Competition | Zero-cost/local matters | Simple | Total |
|---|---|---|---|---|---|---|---|---|
| **A. Early-stage SaaS/subscription founders (Stripe + ads + costs)** | 3 | 4 (HN, Indie Hackers, X, founder newsletters) | 3 | 4 | 3 (cheap MRR tools, no ads join) | 3 | 4 (2-3 exports, SQL) | **24** |
| **B. Shopify / e-commerce merchant margin** | 5 (clear, repeated pain, 2026 Shopify thread) | 4 (Shopify Community, subreddits, app store) | 3 | 3 | 1 (Lifetimely ~$149-749/mo, Triple Whale, Polar ~$300+/mo, free apps; third-party prices conflict) | 2 (data already in Shopify apps) | 2 (returns, COGS, SKU-level, many files) | 20 |
| **C. PE / search-fund / consultant diligence data packs** | 4 | 2 (private, relationship-led) | 4 | 5 (confidential, full-population, proof of cash) | 3 | 5 (cannot upload to cloud) | 3 | **26** (but slow to reach) |
| **D. Agencies/freelancers pricing their services** | 2 | 3 | 2 | 2 | 3 | 2 | 3 | 17 |
| **E. B2B distributors without pricing software** | 4 | 2 | 3 | 5 (core pricing method) | 4 (Zilliant moving down-market) | 4 | 3 | 25 |

Reading the table:

- **C and E score highest on fit but lowest on reach.** They are the roadmap's existing conclusion (consultants, PE, distributors). Reaching them needs relationships, not a landing page.
- **A scores highest on reachability and simplicity.** Founders gather in public places, share exports freely, and the data is well-documented. It is the best *testbed* even if it is not the best *market*.
- **B has the loudest, best-documented pain.** The Shopify thread (July-Sept 2026, ~21 replies): "nobody knows their break-even ROAS" (JamalSettah, 2026-09-03). Merchants see slow feedback, blunt attribution, drifting COGS. But it is the most crowded and needs the most data prep (COGS files, SKU mapping). It also pulls towards live ad connectors. (M)
- **D is weak**: no distinctive data, little pain.

**Recommendation:** run **A** as the first niche because it is the cheapest to reach, test and serve with what exists, and because it needs the smallest additions (section 6). Keep **C/E** as the real long-term home (they match the roadmap). Do **not** start with B unless an e-commerce owner is a user. If the owner's own workflow is not subscription finance, A should be a test, not a commitment.

**Zero-cost local models (owner point 2).** Zero marginal cost matters most where analysis is repeated and cheap per run: A (monthly rerun, small files) and B (weekly margin checks). It matters most for confidentiality in C/E. For founders it is mostly about removing a subscription and an account link. The benefit is real only if the local model can follow the skills; that is untested (report 01/02 flag the same).

Local runtime notes for a 32 GB machine (all **low-medium confidence**, general 2026 guides, no benchmark found for tool calling):

- Runtimes: Ollama (OpenAI-compatible endpoint on 11434), LM Studio (MLX on Mac), llama.cpp. Pi supports custom OpenAI-compatible providers (report 03). Any of the three can serve it.
- Fit: 14B-class models (Qwen3 14B, Gemma 3) sit comfortably; ~20B (gpt-oss-20b) fits with room; ~30B-class at Q4 is "tight" (32-40 GB cited by one guide). A mixture-of-experts ~30B at Q4 is plausible but leaves little room for context.
- Context is the real limit: the harness prompt, skills and tool output are long; KV cache grows with context. Nothing found on usable agentic context at 32 GB. Test it with the existing eval suite at several context sizes.
- Tool-calling edge cases (parallel calls, schema validation, streaming deltas) were flagged by a guide from a vendor selling an alternative **[vendor]**. Treat as a prompt to test, not as a fact.
- The owner's expectation of Haiku-level local models is a forecast; not evidence. The harness already accepts any model ID, so the experiment costs only eval time.

## 5. Is the harness missing something important?

Beyond the three reports and the roadmap, the gaps I found are **few and mostly content, not code**. In order of importance:

1. **Metric definitions the user can see and confirm.** (Highest value, smallest.) Founders get wrong or conflicting MRR/CAC/LTV/payback because definitions differ by tool. The harness already has `.pricing/context.md` for confirmed treatments and `recurring-metrics.md` cards. Missing: a short, explicit, versioned definitions card (what counts as MRR, net of what, per-channel CAC, payback on gross margin) which the analyst states and the user confirms before computing. This is the same pattern as the existing confirmed-treatment flow. M-H that it matters (HN thread; every guide).
2. **A reconciliation check that ties gross to net to payout.** A deterministic detector (code flags, user decides): per payout, sum of `net` over `automatic_payout_id` equals the payout; for the period, gross - fees - refunds - disputes = net; reporting-category totals present; unlinked instant payouts listed. This is the single "checked" artefact startups cannot get elsewhere, and it fits the detector rule. M-H.
3. **Export normalisers for known schemas** (Stripe balance report, Google Ads, Meta Ads, Shopify payouts). Minimal: typed views and header/footer cleanup in a Python loader; no connectors. Part of data prep the harness already does for parse findings. M.
4. **Currency handling.** Stripe already gives settlement-currency amounts; ad platforms spend in account currency. The product needs a small user-supplied rate table (or an ECB reference file) and a rule shown to the user, not a silent API call. M.
5. **A month/cohort template** (acquisition month by customer, retention by month, revenue retention). Plain SQL in DuckDB; no library needed. M.
6. **Plain-language onboarding for non-experts**: a short intake that asks which exports they have, how they fund acquisition, whether UTMs reach Stripe, which Stripe accounts and currencies. This is a skill file, not code. M.
7. **Cost list beyond ads.** Hosting, tools, payroll share. For non-experts: a single costs CSV template. M.

Not gaps (OUT OF SCOPE, platform drift):

- Live Stripe/ads connectors, OAuth flows, webhooks.
- Multi-touch attribution or marketing-mix modelling (PyMC-Marketing et al.).
- Revenue recognition engine (ASC 606 schedules). Book of Revenue and Stripe Revenue Recognition exist. A *warning card* is enough.
- Forecasting, budgeting, runway planning (Mosaic, Runway, Causal).
- Dashboards, alerts, scheduling, multi-user.
- Tax filing or VAT advice.

## 6. Feature candidates (briefing format)

Effort S/M/L for a solo dev. Priority is relative to niche A and the lightweight scope.

| Feature | Why | Priority | Effort | **Ease of integration** |
|---|---|---|---|---|
| **Billing-to-bank reconciliation detector** (gross, fee, refund, dispute, net, payout tie-outs; flags unlinked instant payouts and unmatched rows) | The unique "checked" artefact for founders; matches the detector rule | P1 | S-M | Internal. Python script beside the existing detectors. Schema from Stripe's balance and payout-reconciliation reports (https://docs.stripe.com/reports/report-types/balance, https://docs.stripe.com/reports/report-types/payout-reconciliation; docs, no licence concern for field names). Model logic can be cross-checked against fivetran/dbt_stripe (https://github.com/fivetran/dbt_stripe, Apache-2.0, 63 stars, 61 models, includes balance reconciliation and MRR models; read only as a reference, as it needs a warehouse). Plugs in as a data-findings detector and a DuckDB view. |
| **Subscription-metrics definitions card + confirm step** (MRR, net revenue, CAC by channel, payback on gross margin, LTV with churn caveat, cohort retention) | Conflicting MRR across tools is the documented pain | P1 | S | Markdown card in the **plugin** (reused by the harness bundle). Definitions from Stripe's SaaS metrics explainer (https://stripe.com/en-dk/resources/more/essential-saas-metrics, **[vendor]**) and ChartMogul/Baremetrics docs (URLs not verified this session; the ChartMogul MRR help URL I tried returned 404). No library. The existing `recurring-metrics.md` is the base. |
| **Stripe + ad-export loader** (typed views, Google/Meta header and footer cleanup, spend only) | Removes the first-hour friction | P1 | S-M | Python script / DuckDB `read_csv` options (already in stack). Optional reference only: **dlt** (https://github.com/dlt-hub/dlt, Apache-2.0, 6.0k stars) lists verified Stripe, Facebook Ads, Google Ads and Shopify sources and supports a DuckDB destination (docs, H). Using it would add a connector layer and credentials, so treat as a user-side script, not a harness dependency. |
| **Cohort and retention SQL templates** | Investor-requested; cheap | P1 | S | Plain SQL in DuckDB. Avoid `lifetimes` (https://github.com/CamDavidsonPilon/lifetimes; MIT, 1.5k stars, **archived 2024-06-28**); its successor PyMC-Marketing is heavy and out of scope. |
| **Currency/rate-table rule** (user supplies or imports an ECB reference-rate CSV; analyst states the rate and date used) | FX traps in both Stripe and ads | P2 | S | ECB euro reference rates CSV (free to download; licence terms not checked here, L). `Frankfurter` (open-source wrapper of ECB rates; MIT per memory, **unverified**) would be an online option; prefer the offline CSV. Internal DuckDB join. |
| **Non-expert intake and "explain it" skill** | Founders need explanation, not just numbers | P1 | S | Pi SDK skill (Markdown) / plugin. Mirror the existing question-triage skill. No dependency. |
| **Unit-economics starter pack** (synthetic Stripe export with refunds, disputes, annual plans, multi-currency, 2 ad exports, expected answers) | Lets evals and the 5-founder test run; tests the "traps" list | P1 | M | Internal. Generator follows the existing synthetic S1-S4 data and eval pattern. Seed traps from section 3. |
| Cost CSV template and prompt | Fully loaded CAC | P2 | S | A template file in the plugin. |
| Warnings (not engines) for rev-rec, VAT, platform-reported conversions | Prevents confident wrong answers without building engines | P2 | S | Knowledge cards; Book of Revenue (https://github.com/tanin47/book-of-revenue, licence **not checked**) only as a pointer for users. |
| Live Stripe/Ads connectors | Often asked for | **OUT OF SCOPE** | L | Platform drift: credentials, pagination, rate limits. The host's MCP already offers Stripe for plugin users. |

## 7. Plugin vs harness for this niche

| Item | Plugin | Harness |
|---|---|---|
| Definitions card, intake, "explain it" skill, cost template, rev-rec/VAT warning cards | Yes (pure Markdown; also bundled) | Bundled copy |
| Cohort SQL, payback and CAC script templates | Yes (script templates, as with PVM) | Bundled copy |
| Stripe/ad loaders and schema cleanup | Script template in plugin | Runs in `execute_analysis`; typed views |
| Reconciliation detector | Script template (flags only) | **Harness**, wired to data findings and the confirm-then-record flow |
| Figure check, sealed outputs, audit view, local model | No | **Harness** |
| Stripe access | Host's Stripe MCP, lightweight | CSV only |

The plugin is where the niche is *tested* first: no code to ship, and Claude's existing Stripe MCP plus uploaded CSVs make a first run possible. The harness earns its place only for the reconciliation detector and checked figures.

## 8. Cheapest way to test the niche

1. **Five founders, one week, no code.** Post a short offer in 2-3 places founders read (HN "Ask HN/Show HN", Indie Hackers, a founder Slack). Ask for a Stripe balance-report CSV and a Google/Meta spend CSV, anonymised; promise a one-page unit-economics sheet plus a list of reconciliation problems. Run it through the plugin or harness by hand. Track: do the numbers reconcile to payouts; what do they argue with; do they come back next month. (Only "come back next month" counts as use.)
2. **A downloadable template** (a spreadsheet or a CSV schema sheet naming the exact exports and clicks). Measures interest before any build.
3. **Run the synthetic starter pack** through Haiku-class and a local 14-20B model with the existing eval suite. Tells you whether the local-model story is credible for this niche.
4. Defer a landing page until step 1 shows two founders reply. A landing page without real exports tests only curiosity.

Kill signal: fewer than two of five founders supply files within a week, or all five say a free dashboard (ChartMogul/ProfitWell) was enough.

## 9. Owner's weak assumptions

| Assumption | Verdict |
|---|---|
| "Early-stage startups need this and will use it" | **Unproven.** The pain is documented, the request is not. They may be best served by a free dashboard and a template. Test with five founders first. |
| "Reconcile Stripe with ad spend to get CAC by cohort" | **Weak.** Ad exports carry no customer IDs; per-cohort attribution needs UTM/gclid in Stripe metadata that most startups do not capture. Honest deliverable is blended or per-channel CAC with stated limits. |
| "Checked figures are what this buyer wants" | **Half true.** Non-experts want explanations and a reconciliation that ties out. The hash chain matters to investors and accountants more than to the founder. |
| "Local-first is the draw" | **Weaker here than for diligence/consultant niches.** For founders the draw is zero cost and no account linking. |
| "Local models will be Haiku-level soon, so uptake follows" | **A forecast.** Untested. Context length and tool-calling reliability on 32 GB are the unknowns. Run the evals on small local models before relying on it. |
| "It needs live Stripe access" | **No.** Balance and payout CSVs already hold customer email, subscription, invoice and payout IDs. |
| "This is the same engine, just new skills" | **Mostly yes** (report 03: 85% domain-neutral), but this niche needs a reconciliation detector and schema loaders, which are new code (small). |
| "Competitors do not do this" | **Partly.** No vendor page I read mentions ad spend, but a founder with Claude + Stripe MCP can already get a rough answer; Julius lists Stripe and ad connectors on its Pro tier (report 02). Competition is thinner than the niche table suggests only for *checked reconciliation*. |

## 10. Sources

Demand and pain:

- HN, "Stripe Data vs. Open-Source Alternatives: A MRR Example" comment thread, 2024-08-26: https://news.ycombinator.com/item?id=41353764
- HN, Show HN: Book of Revenue, 2026-09-18: https://news.ycombinator.com/item?id=49758181 (repo https://github.com/tanin47/book-of-revenue)
- HN, Show HN: Simple Stripe analytics dashboard, 2026-03-07: https://news.ycombinator.com/item?id=47286883
- Shopify Community, profit/ad-spend tracking thread (2026): https://community.shopify.com/t/profit-ad-spend-tracking-on-shopify-whats-actually-broken-for-you/646399
- Beancount.io Stripe payout guides (2026-10-11), **[guide/vendor]**: https://beancount.io/blog/2026/10/11/stripe-payout-reconciliation-annual-billing-monthly-recognition-saas-guide
- DEV Community, CAC payback errors (illustrative figures): https://dev.to/insightlab/the-cac-payback-period-why-most-bootstrapped-saas-calculate-it-wrong-1b95
- SaaS Hero **[vendor]**: https://saashero.net/strategy/early-stage-gtm-pain-points/
- Series A diligence requests: https://www.peony.ink/blog/series-a-data-room ; https://www.maxio.com/blog/saas-due-diligence **[vendor]**

Alternatives and prices:

- ChartMogul pricing [page]: https://www.chartmogul.com/pricing/
- Baremetrics pricing [page]: https://baremetrics.com/pricing
- Stripe Revenue Recognition pricing [page]: https://stripe.com/revenue-recognition/pricing
- Stripe Sigma pricing support page: https://support.stripe.com/questions/understanding-stripe-sigma-pricing ; query assistant: https://docs.stripe.com/stripe-data/write-queries
- ProfitWell/Paddle Metrics free status (third-party): https://gappsy.com/tools/profitwell/
- Fractional CFO costs **[vendor]**: https://eightx.co/blog/fractional-cfo-cost-pricing-guide ; https://www.forecastr.co/blog/fractional-cfo-startups
- Finmark/BILL FAQ: https://help.finmark.com/en/articles/6711419-bill-acquisition-of-finmark-faq
- Shopify profit tools (third-party price comparisons, conflicting): https://attribuly.com/blogs/triple-whale-pricing-review/ ; https://eightx.co/blog/polar-vs-triple-whale-vs-northbeam
- QoE cost and proof of cash (forum/guides): https://searchfunder.com/post/quality-of-earnings-qoe-for-small-medium-deals

Data schemas:

- Stripe balance report: https://docs.stripe.com/reports/report-types/balance
- Stripe payout reconciliation: https://docs.stripe.com/reports/payout-reconciliation ; https://docs.stripe.com/reports/report-types/payout-reconciliation
- Stripe reporting categories: https://docs.stripe.com/reports/reporting-categories
- Stripe multi-currency settlement and conversions: https://docs.stripe.com/payouts/multi-currency-settlement ; https://stripe.com/th/docs/currencies/conversions
- Shopify payouts export: https://help.Shopify.com/en/manual/payments/shopify-payments/getting-paid-with-shopify-payments/view-payouts/view-details
- Ad export timezone, currency, attribution notes (marketing blogs): https://www.dataslayer.ai/blog/ad-spend-tracking-across-platforms ; https://docs.oursprivacy.com/docs/channels/import-meta-ads

Libraries and references:

- fivetran/dbt_stripe, Apache-2.0: https://github.com/fivetran/dbt_stripe
- dlt, Apache-2.0: https://github.com/dlt-hub/dlt ; verified sources: https://dlthub.com/docs/dlt-ecosystem/verified-sources/
- lifetimes, MIT, archived: https://github.com/CamDavidsonPilon/lifetimes
- Stripe SaaS metrics explainer **[vendor]**: https://stripe.com/en-dk/resources/more/essential-saas-metrics
- Stripe MCP tool coverage (third-party directories): https://stackone.com/connectors/stripe/mcp/ ; https://www.merge.dev/connectors/stripe

Local models:

- General guides (no tool-calling benchmark found): https://fungies.io/how-to-run-local-llms-2026-guide/ **[vendor of an alternative]** ; https://pasqualepillitteri.it/en/news/14005/best-local-llm-2026

## 11. Research limits for this report

- Reddit, Indie Hackers, Product Hunt and the Stripe community forum not read. HN Algolia hits for several queries were empty or off-topic, so absence there is weak evidence.
- Official docs for Google/Meta/LinkedIn exports not read; ad-export traps are from marketing-ops blogs.
- ChartMogul MRR definition page 404; definitions not captured from the vendor.
- Frankfurter and ECB licences, Book of Revenue licence, Stripe VAT-on-fees treatment: not verified.
- All niche scores are judgement and should change after the five-founder test.
