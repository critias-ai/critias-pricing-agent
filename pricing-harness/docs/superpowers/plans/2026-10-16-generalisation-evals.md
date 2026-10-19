# Generalisation evals: data sources, synthetic data and test design

Date: 2026-10-16. Branch: feat/thin-analyst. Status: design draft. Nothing is built or downloaded, and no live runs have happened.

Input: the brainstorm pack `pricing_harness_evaluation_design.md`, which was written without knowledge of the harness. This doc filters that pack against what the harness actually is.

## What we are testing, and what we are not

The harness is a chat analyst for pricing and gross margin:
- it works on uploaded CSV and XLSX files, locally, with DuckDB and Python;
- its seven skills are intake, triage, scan, analyze, recommend, design and execute;
- it has 17 knowledge cards;
- every figure it gives must come from code that ran.

So the eval must answer two questions:

1. **Data generality:** does it still work when the data is from another industry, has another shape (wide, multi-table, multi-sheet, subscription, quote/deal) or another level of mess?
2. **Question generality:** does it handle the whole range of pricing questions, from "what is our margin" to "redesign our tiers"? Today the evals touch at most 4 of the 17 cards.

**Out of scope for now:**
- The brainstorm's three-arm comparison (Pi vs custom harness vs Claude Code). The case format below doesn't stop us adding it later, but first we need to know what the harness itself gets right.
- Coding, SQL-engine and spreadsheet-editing benchmarks (Spider 2.0, SWE-bench, SpreadsheetBench, Terminal-Bench, TPC-H). They test a different product.

This plan comes after the realistic-evals plan (`2026-10-16-realistic-evals.md`): natural prompts plus the save turn (step 1), held-out data (step 2), messy multi-file data (step 3) and the rubric judge (step 4). Everything below relies on those four mechanisms, plus a few small grader changes described in 3b.

---

## Part 1. Which sources to keep

### Fit criteria

A source is kept only if it meets all five:

1. **Realistic input:** it looks like an export a pricing or commercial analyst would actually receive, at transaction, price-list or quote grain. Filings and macro series are not what the harness is for.
2. **Loads locally as CSV or XLSX** after a one-off fetch. The harness has no network, API or database connectors at run time.
3. **Has price, plus cost or discounts,** or can carry a synthetic overlay that doesn't distort the real structure.
4. **Licence allows local research use.** Nothing third-party gets committed (project rule: committed fixtures are synthetic). Fetch scripts and checksums go into Git; the data goes into `.cache/eval-data/`, which is already gitignored.
5. **Adds something new:** an industry, a data shape or a set of cards the other kept sources don't cover.

### Verdicts

| # | Source | Verdict | Why |
|---|---|---|---|
| 5 | **UCI Online Retail II** | **Keep (pilot)** | Real, messy, UK retail in GBP, and it ships as a **two-sheet XLSX** of about 1.07M rows. It has `C`-prefixed cancellations, negative quantities and non-product codes (POST, M manual, D discount, AMAZONFEE, BANK CHARGES, "Adjust bad debt"). It tests the XLSX path, scale and the returns/credits rules on real data. No cost column, so it needs an overlay. CC BY 4.0. |
| 6 | **AdventureWorks (OLTP)** | **Keep (pilot)**, as CSV exports, without the SQL Server or stored-procedure tasks | The only public source with **list price, unit price discount, special-offer rules, cost history and list-price history** together. It also has reseller vs internet channels, freight and tax per order, and territories. That makes it the B2B waterfall, discount-governance and as-of cost-join source. The install scripts in `microsoft/sql-server-samples` ship the tables as delimited text files with an unusual delimiter and encoding, which is a useful parsing test in itself. Verify the exact format when fetching. MIT. |
| 1 | **Dunnhumby, The Complete Journey** | **Keep (pilot)** | Real grocery data: 2,500 households over 2 years, about 2.6M lines. It has `RETAIL_DISC`, `COUPON_DISC` and `COUPON_MATCH_DISC` per line, plus campaigns, coupon redemptions, display/mailer causal data and household demographics. This is the promotions, coupons, realization and segmentation source. No cost column. It needs registration, and its terms forbid redistribution: fetch script only. |
| 3 | **Olist Brazilian e-commerce** | **Keep (pilot)** | A marketplace with nine related tables. It has freight per item, payment types (vouchers, installments), cancellations, reviews and BRL currency. It tests multi-table joins, fan-out hazards, cost-to-serve and a non-GBP currency. No product cost. CC BY-NC-SA 4.0. |
| 2 | **Walmart M5** | **Keep (second wave)**, subsampled to one state or category | Weekly `sell_prices` that really change, a daily **wide** sales matrix (`d_1 … d_1941`), events and SNAP days. This is the real price-change source: it tests unpivoting, joining weekly prices to daily sales, price-change detection. Elasticity is parked (see Parked). No cost. Kaggle terms: fetch script only. |
| 8 | **Inside Airbnb** | **Keep (second wave)**, one pinned city and snapshot | A different industry (accommodation) and the only source with **dynamic/seasonal prices**. It tests peer comparison by neighbourhood and room type, segmentation and per-night normalisation. It has no transactions (calendar availability is not bookings), which makes it a good test of whether the harness says what the data *can't* show. Verify that the chosen snapshot still fills `calendar.price`, since some recent ones don't. CC BY 4.0. |
| 12 | **Iowa liquor sales** | **Keep (second wave)**, one year, filtered | Real **cost and price** (`state_bottle_cost`, `state_bottle_retail`), pack sizes and bottle volumes. It tests per-litre normalisation and cost pass-through. Markup is set by statute, so margin % is nearly constant. A good analyst should notice this and not invent "margin drivers". Public. |
| 4 | **TheLook e-commerce** | **Maybe (cheap baseline)**, exported once from BigQuery | Synthetic, with product cost and retail price, returns and order statuses. Easy to grade. But it is regenerated daily (pin the export date), and `sale_price` may always equal `retail_price`. If it does, there is nothing to analyse beyond arithmetic. Check that first; drop it if true. |
| 10 | **Open Prices** | **Adjunct only** | Too sparse and crowd-sourced to be a main source. Some of it can be used as a "competitor price" file next to UCI or Dunnhumby, for product matching and unit-price normalisation. ODbL: needs attribution. |
| 13 | **World Bank indicators** | **Adjunct only** | One pinned CPI series as a small CSV, for "real vs nominal price change" questions. Not a source on its own. |
| 7 | **TPC-DS** | **Drop** (keep in mind for scale tests) | Its values are uniform random by design, so "why" and "what should we do" questions have no true answer. It only tests SQL, which is not the product. If we ever need a 10M-row scale test, generate SF1 locally and ask one waterfall question. |
| 9 | **NYC taxi** | **Drop** | Parquet only, and the work is fare-component arithmetic at huge scale. One interesting idea (the 2025 congestion surcharge as a tariff change) is better done as synthetic usage data with a known answer. |
| 11 | **SEC EDGAR** | **Drop** | Company-level filings through an API. No transactional pricing. |
| §3 | Public benchmarks (DSBench, FinQA, FinanceBench, Spider 2.0, …) | **Drop** | They test different tools: SQL, code, filing QA. A score on them says nothing about this harness. |

### What no public source covers

Six of the 17 cards have **no** suitable public data: recurring metrics, recurring scenarios, renewals and migration, hybrid offers, offer architecture and value estimation. Discount governance is only partly covered (AdventureWorks has offer rules but no approvals). Price optimisation can't be graded on any historical data, because history doesn't contain the counterfactual (the brainstorm is right on this).

These gaps get synthetic datasets (Part 2b). Two public subscription sets may be worth a look, but **verify their licences and columns before relying on them**:
- the Kaggle KKBox churn transactions (plan list price, amount paid, auto-renew, cancel flags);
- the IBM Telco churn sample (contract type, monthly charges, tenure).

---

## Part 2. How to expand the data

### 2a. On the real sources

Every real source gets the same four additions, built by one script per source. That script is the solution script's sibling, so its output is reproducible from the pinned raw files plus a seed.

1. **`context.md` in two versions.**
   - *Confirmed:* definitions written the way a company would (what counts as net sales, how returns are treated, currency, fiscal calendar).
   - *Bare:* "These are our exports." This version tests whether the harness asks about the treatments that change the result.
2. **Synthetic cost overlay** where the source has none (UCI, Dunnhumby, Olist, M5).
   - Each product gets a standard cost from a seeded draw around its category's margin. Costs change on dated steps, written to a separate `unit_costs.csv` (`sku, effective_from, unit_cost`), so an as-of join is needed.
   - Planted events have known answers:
     - a supplier cost rise on one category;
     - a product sold below cost after a promotion;
     - a quarter of missing cost for two products.
   - Because the overlay lives in its own file and is labelled in `context.md`, the real sales stay untouched.
3. **Planted traps on a copy.** Reuse `seed_anomalies.py` to insert, at seeded positions, the known faults the detectors and cards claim to catch: duplicate lines, an overlapping extract, a ×100 unit-price slip, a renamed SKU, a dropped month.
   - A ×1.17 currency slip on one customer is also planted, but is scored separately as a **stretch item**, not in the must-mention list. No ratio threshold can see it (open-items), so finding it needs a cross-customer comparison.
   - The dropped month needs a time detector (D6), which isn't built. It is a test of the analyst, not of the detectors. We inserted them, so the truth is exact even on real data. Every source gets a clean run *and* a trapped run, to tell "found the trap" apart from "got lucky on clean data".
4. **Policy and target files** that a pricing team would have:
   - `pricing_policy.md`: margin floor by category, maximum discount by customer tier, price endings, maximum price move per review;
   - for AdventureWorks, an approval matrix.

   These make guardrail questions gradable.

**Subsampling,** to keep runs cheap and repeatable:
- M5: one state, all three categories, the last two years;
- Iowa: one calendar year;
- Airbnb: one city and snapshot;
- Dunnhumby, UCI and Olist: full size. They are 0.1M to 2.6M rows, and scale is part of the test.

**Holdouts.**
- Synthetic sets and overlays: a second seed, as in realistic-evals step 2.
- Real data: a held-out slice, for example another M5 state, another Airbnb city or Dunnhumby weeks 53 to 102. The same questions run on it, and keys are computed by the solution script at grading time, so there are no stored answers to leak.

### 2b. New synthetic datasets for the gaps

Each one is generated from a clean, known truth and then written out as realistic exports, like the messy generator in realistic-evals step 3.

| Set | What it simulates | Planted truth | Cards it opens up |
|---|---|---|---|
| **S1 Pricing lab** (parked with elasticity) | Weekly price, volume and promo panel for 20 SKUs over 3 years, generated from a **known demand model**: constant elasticity per SKU, seasonality, promo uplift with pull-forward, one cannibalising pair. Plus one **randomised price test** file (cells × weeks). | The elasticities, promo incrementality and cannibalisation share. Optimal price under the stated constraints, found by exhaustive search over allowed price points. | price-change economics, experiments and promotions, evidence ranking, optimisation (graded by objective gap and constraint violations, as the brainstorm suggests) |
| **S2 B2B distributor** | Quotes, **won and lost**, and invoices with list price, tier discount, on-invoice discount, off-invoice rebates, freight, payment-terms discount, and the sales rep and approver. Plus `policy.md` with the approval matrix. Win probability is generated from a known function of quoted price relative to the segment reference. | Pocket price per deal. Out-of-policy discounts, including ones approved at the wrong level. One rep with high discount dispersion. Customers below the floor. Leakage by waterfall layer. **A planted set of small customers paying less than large ones** for the same items, with mixed reasons: legacy contract, one rep, data error. The true win-rate curve by segment. | price waterfall, discount governance, peer comparisons, segmentation |
| **S3 SaaS subscriptions** | Customers on good/better/best plans, seats, monthly/annual billing, sign-up discounts, upgrades, downgrades and churn. A **price increase mid-period** with grandfathering for one cohort. | MRR movements (new, expansion, contraction, churn). NRR and GRR. Cohort churn before and after the increase, with a hidden random subset so the true effect is known. | recurring metrics, recurring scenarios, renewals and migration, offer architecture |
| **S4 Usage and hybrid** | API usage with tiered rates, a minimum commit and overage, plus a hardware-plus-service bundle line. | The bill per customer under the current and a proposed tier schedule. Customers who cross breakpoints. The bundle's implied service price. | recurring scenarios, hybrid offers, value estimation |
| **S5 Messy retail** | Already planned as realistic-evals step 3. | | data competence, context capture |

**Adjunct files** to attach to real sources:
- a synthetic competitor price list for 200 UCI products, with near-miss product names and pack sizes, to test matching and unit-price normalisation;
- one pinned CPI series, to test real vs nominal price change.

---

## Part 3. Eval design, top down

### 3a. What a pricing tool must be able to do

This list doesn't depend on any dataset. The codes are used in the matrix in 3c.

**A. Data competence** (the prerequisite)
- A1 Discovery: grain, keys, units, currency, periods, sign conventions, what each file is.
- A2 Joins: multi-table, as-of (dated costs or prices), wide-to-long, and fan-out hazards.
- A3 Quality: duplicates, overlapping extracts, returns and credits, non-product lines, missing cost, mixed formats, outliers, renamed SKUs.
- A4 Scale and format: 1M+ rows, multi-sheet XLSX, odd delimiters and encodings.
- A5 Ask vs assume: asks when a treatment changes the answer materially, and doesn't ask when it doesn't.
- A6 Context level: behaves correctly with no `context.md`, a thin one, a full one, a stale or conflicting one, or another company's (section 3e).

**B. Price and margin arithmetic**
- B1 Revenue, gross profit, margin % vs markup %.
- B2 Weighted vs simple averages, and per-unit vs per-line.
- B3 Unit normalisation: per kg or litre, pack size, per night.
- B4 Currency, tax (VAT inclusive or exclusive), rounding, price endings.
- B5 Required price for a target margin, and floor checks.

**C. Price measurement**
- C1 Price realization: like-for-like, controlling for mix.
- C2 Price waterfall: list to invoice to pocket price, and leakage by layer.
- C3 Discount depth, frequency and dispersion.
- C4 Price-change events over time, and cost pass-through.

**D. Performance explanation**
- D1 Margin bridge: price, volume, mix, cost, new and lost.
- D2 Contribution by product, customer or segment; Pareto and tail.
- D3 Peer comparison: which differences are meaningful and which are noise.
- D4 Cost-to-serve and channel economics: freight, returns, payment fees.
- D5 Product outliers on margin, across the whole portfolio and within one product group. The peer set changes which products stand out (section 3i).

**E. Price-change economics**
- E1 Conditional impact of a change at fixed volume.
- E2 Cost pass-through scenarios.
- E3 Breakeven volume that holds absolute gross profit: per SKU and per group (mix held), for increases and cuts, and with cost changes. It says when breakeven is undefined, for example nonpositive unit contribution (section 3g).
- E5 Willingness to pay from history: revealed prices, quote win rates and retention after increases, presented as bounds rather than as WTP itself (section 3g).

**F. Promotions and experiments**
- F1 Promo uplift vs baseline: incremental vs subsidised volume, pull-forward, cannibalisation.
- F2 Reading a price test: effect size, sample, uncertainty.
- F3 Coupon and markdown effectiveness.

**G. Structure and design**
- G1 Segmentation and fences.
- G2 Price architecture: tiers, good/better/best, pack-price ladders.
- G3 Discount governance: rule compliance, approval breaches.
- G4 Offer architecture and value metric.
- G5 Value estimation against the alternative.

**H. Recurring and usage**
- H1 MRR/ARR, NRR/GRR, churn, ARPU, cohorts.
- H2 Price increase on the installed base: renewals, migration, grandfathering.
- H3 Usage tiers, commits and overage.

**I. Market context**
- I1 Competitor price index: matching products, positioning.
- I2 Real vs nominal (inflation-adjusted) change.
- I3 Seasonal and dynamic pricing.

**J. Decision support**
- J1 Recommendations ranked by evidence, conditional where they must be, and within the guardrails.
- J2 Rollout planning (the execute skill).
- J3 Presentation: a fitting chart, a small answer when a small answer was asked for.
- J4 Context capture: records confirmed definitions, and lets `context.md` override card defaults (open item, untested).
- J5 Multi-turn: follow-ups, a mid-conversation correction, consistency across turns.
- J6 Vague goals: triage to a workable question.
- J7 Skill routing: the right skill and cards fire for the request, including intake, scan, recommend, design and execute, not only analyze (section 3e and 3f).
- J8 Outlier to action: finds customers priced out of line, then recommends a sound, staged course of action (section 3h).

**K. Integrity** (cross-cutting, scored on every run)
- K1 Every reply figure traces to executed output. The harness already checks this.
- K2 Gives the strongest answer the data supports, and no stronger:
  - no basis at all means it says so (no cost means no margin; no bookings means no occupancy);
  - partial coverage means the figure on the covered records, with what was left out shown by count and value next to it (shared rules §6). A range is used only to judge whether the omission could change the conclusion;
  - asked how much volume would *actually* fall, it says it doesn't estimate demand response from this data, gives breakeven and suggests a test (elasticity is parked);
  - it never makes up a number to fill a gap.
- K3 Same answer across repeats.
- K4 Time and cost per run, already in `RunMetrics`.

**Question styles.** Each source should be tested in every style, because they are what "general" means from the user's side:

| Style | Example | Main grading |
|---|---|---|
| Closed | "What was gross margin by year?" | exact file and reply numbers |
| Why | "Storage feels weaker. What's going on?" | figures exact, plus a rubric |
| What should we do | "What would you change?" | rubric (must/must-not) |
| Vague | "Help me with pricing on this." | asks or proposes a scope; rubric |
| Can't answer | "What's our margin?" with no cost data | K2 rubric item; no fabricated number |
| Breakeven | "If we put S03 up 5%, how much volume could we lose and still make the same gross profit?" | exact file and reply numbers |
| Scenario | "What if costs rise 6% and we pass half on?" | exact file and reply numbers |
| Leading | "Show me the promo worked." | doesn't confirm without evidence; rubric |
| Correction | "No, exclude returns." on turn 4 | the next figures must change correctly |

### 3b. Grading

Mostly existing mechanisms. These grader changes are needed (all small, in `spec.ts`/`verify.ts`):
- `expectReads`: a routing check, scored over the whole conversation;
- `expectContext`: a check on what got written to `context.md`;
- labelled, signed `replyNumbers`;
- a three-tier outlier key;
- a no-NaN/Inf check on saved files;
- the hardening rules in "Grading hardening" below.

- **Exact:** `csvChecks` with a save turn, plus `replyNumbers`, against keys the solution scripts compute.
- **Behaviour:** `expectQuestion`, made stricter in realistic-evals step 1. It counts only **blocking questions about a basis**: definitions, treatments, mappings, scope. An offer such as "Want a chart?" is not a question for scoring, so it can't be marked as over-asking at L3.
- **Rubric:** the step 4 judge, for why, recommend, vague, can't-answer and leading styles. Every rubric item about a number is backed by an exact check, so the judge only grades reasoning.
- **Trap detection:** for trapped runs, a must-mention list of the planted faults.
- **Routing (new, `expectReads`):** the skill and card files that must be opened, and the ones that must not, scored **over the whole conversation**, because a skill loaded in turn 1 is not re-read in turn 3.
  - The data is already there: `analyses/<run>/events.jsonl` records every `SKILL.md`, `knowledge/…` and `references/…` file read. A live boundaries run shows `pricing-analyze`, `metric-verification`, `peer-comparisons` and so on.
  - A read is necessary, not sufficient: a card can be opened and ignored. So routing is scored separately from correctness, never instead of it.
  - **Must-not is the main assertion**, because a model that opens every card passes every must-read. Each must-read is also paired with an output only that card produces, for example the fixed-mix statement for group breakeven or the matched-basket flag for realization.
  - The number of distinct cards opened is reported per run, so bulk-reading shows up.
- **Context writes (new, `expectContext`):** after the run, `.pricing/context.md` must contain the facts the user confirmed, and must not contain anything unconfirmed. "Not stated" is allowed. This tests intake's "save nothing until confirmed" rule.
- **Outlier lists: a three-tier key** (sections 3h and 3i):
  - *required* planted outliers: recall;
  - *hard negatives*, items clearly inside their peer band (within ±5 pp of the peer median, say): each flagged one is a false positive;
  - *ambiguous* items, everything else: ignored.

  The key publishes the gap definition (weighted median of the peers, the item itself excluded). Answers using a simple median or mean are also accepted, if their output says so. Gaps are checked against whichever definition the answer states.

### Grading hardening

- **Reply numbers are labelled and signed.** A key number matches only if it appears within a few words of its label (for example "gross profit", "S03", "2025") and with the right sign. This stops accidental matches on small numbers (5, 10, 2025), passes from a dumped table, and loss/profit sign errors.
- **Clean runs carry a must-not-claim check.** On the clean copy of each source, the reply must not report any of the planted fault types as present. That makes "found the trap" distinguishable from "always says there are traps".
- **The query path is recorded.** The peer-ratio and returns notes only fire on SQL. Each run records whether the figures came from SQL or Python. Trap detection is reported for both paths, so the credit doesn't depend on which route the model took.
- **No business convention hidden in an oracle.** Where a case needs a convention, either the prompt or `context.md` states it, or the key accepts each valid variant and checks the answer against the one it states. Known spots:
  - SC-2 group breakeven: uniform volume scale with mix held;
  - UCI-3 realization: the matching basis;
  - L6: where the 4% freight is applied.
- **The judge is hardened:**
  - it gets the answer key, including the planted truth, alongside the context file;
  - every pass must quote the reply;
  - must-not items need specific evidence, so a generic hedge ("this may not be causal") doesn't pass them;
  - the judge model is from a different family than the analyst;
  - it is spot-checked with deliberately wrong replies, as in realistic-evals step 4.
- **No NaN or Inf in saved files.** Any `nan`, `inf` or `#DIV/0` cell fails the file. An undefined value must be written as blank, with the reason in the reply.
- **Holdouts are independent.**
  - Besides a second seed, one holdout has a different shape: an S2-style generator for a different industry (hospitality supplies instead of a distributor), and a second Airbnb city.
  - Dunnhumby has no independent holdout, since weeks 53 to 102 share households with weeks 1 to 52, so no improvement claim rests on it.
  - Holdout prompt wording lives in `keys/`, not in this plan.


### 3c. Which subset each source tests

● main focus, ○ some coverage, blank = not tested on this source.

| Area | UCI | AdvW | Dunn | Olist | M5 | Airbnb | Iowa | S2 B2B | S3 SaaS | S4 usage |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 discovery | ● | ● | ● | ● | ● | ● | ○ | ○ | ○ | ○ |
| A2 joins / as-of / wide | ○ | ● | ● | ● | ● | ○ | | ○ | ○ | |
| A3 quality | ● | ○ | ○ | ● | ○ | ● | ○ | ○ | | |
| A4 scale / format | ● | ● | ● | | ● | | ○ | | | |
| A5 ask vs assume | ● | ○ | ○ | ○ | | ○ | | ○ | ○ | |
| B1–B2 margin arithmetic | ● | ● | ○ | ○ | | | ● | ○ | | |
| B3 unit normalisation | ○ | | ○ | | | ● | ● | | | |
| B4 currency / tax / rounding | ○ | ● | | ● | | ○ | | ○ | | |
| B5 target-margin price | ○ | ● | | | | | ○ | | | |
| C1 realization | ● | ○ | ● | ○ | | | ○ | | | |
| C2 waterfall | | ● | ● | ○ | | | | ● | | |
| C3 discount analysis | ○ | ● | ● | | | | | ● | ○ | |
| C4 price changes / pass-through | | ● | | | ● | | ● | | | |
| D1 margin bridge | ● | ● | ○ | | | | ○ | ○ | | |
| D2 contribution / tail | ● | ○ | ○ | ● | ○ | | ○ | | | |
| D3 peer comparison | ○ | ○ | | ● | | ● | ○ | ● | | |
| D4 cost-to-serve / channel | ○ | ● | | ● | | | | ○ | | |
| D5 product outliers | ● | ○ | | ○ | | | | ● | | |
| E1 change impact (fixed volume) | ● | ○ | | | ○ | | ○ | ○ | ○ | ○ |
| E2 pass-through scenario | | ○ | | | | | ● | | | |
| E3 breakeven volume (hold GP) | ● | | | | ● | | ○ | | | |
| F1 promo uplift | | ○ | ● | | ● | | | | | |
| F2 price test | | | | | | | | | ● | |
| F3 coupons / markdowns | | | ● | ○ | | | | | | |
| G1 segmentation | ○ | ○ | ● | ○ | | ● | | ● | ○ | |
| G2 price architecture | | ○ | | | | ○ | ○ | | ● | ● |
| G3 governance | | ● | | | | | | ● | | |
| G4 offer architecture | | | | | | | | | ● | ● |
| G5 value estimation | | | | | | | | | | ● |
| H1 recurring metrics | | | | | | | | | ● | ○ |
| H2 renewals / migration | | | | | | | | | ● | |
| H3 usage tiers | | | | | | | | | | ● |
| I1 competitor index | ○ adj | | ○ adj | | | | | | | |
| I2 real vs nominal | ○ adj | | | | | | ● adj | | | |
| I3 seasonal / dynamic | ○ | | | | ○ | ● | | | | |
| J1 recommend | ● | ● | ● | ● | ○ | ● | ○ | ● | ● | ● |
| J2 rollout | | ○ | | | | | | ● | ● | |
| J3 presentation | ● | ○ | ○ | ○ | ○ | | ○ | ○ | ○ | |
| J4 context capture | ● | ○ | | ● | | | | ● | ○ | |
| J5 multi-turn / correction | ● | ● | ● | ● | ○ | ○ | ○ | ● | ● | |
| J6 vague goal | ○ | | ● | | | | | | ○ | ○ |
| E5 willingness to pay | | | ● | | | ○ | | ● | ● | |
| J8 outlier to action | ● trapped | ● | | ○ | | | | ● | | |
| K2 strongest supported answer | ● (no cost in bare) | | ● (causal) | ● (no cost) | ● (no demand estimate) | ● (no bookings) | ● (fixed markup) | | ● | |

A6 and J7 (context levels and routing) run on the retail set, S2 and UCI. They are listed in sections 3e and 3f, not in this matrix. The retail set also carries most of the 3g breakeven and 3i product-outlier cases.

K1, K3 and K4 apply to every run. Every mark in the matrix was checked against the case lists in 3d to 3j. A ● or ○ without a case behind it was removed, so every mark now has a named case.

### 3d. Questions per source

Each source gets 6 to 9 cases. Most are multi-turn conversations, so one case covers several areas. Each has a solution script, and rubric items where the style needs them. The cases below are the intended set; wording is refined when each case is built. Tags are taxonomy codes, then style.

**UCI Online Retail II** (bare and confirmed context; clean and trapped)
1. "Here's our sales export. What's our revenue and margin by year?" Bare context, so it should ask about cancellations, non-product codes and the missing cost file. A1 A3 A5 B1 K2, closed and vague.
2. Same question with the cost overlay and confirmed context, as a multi-sheet XLSX. A4 B1 B2, closed.
3. "Did we raise prices in 2011 or is it mix?" C1, closed.
4. "What drove the gross profit change by country?" D1 D2, why.
5. "Which customers are we losing money on once returns and postage are counted?" D2 D4 A3, closed.
6. "Put the top 50 SKUs up 4%. What's it worth, and how much volume can we lose and still keep gross profit?" E1 E3, closed.
7. Competitor adjunct: "How do we sit against this competitor list per unit?" I1 B3, closed.
8. Conversation: correction on turn 3 ("exclude wholesale customers over 1,000 units"), then a chart. J3 J4 J5.

**AdventureWorks** (B2B, reseller vs internet)
1. "Walk me from list price to what we actually got paid, by channel." C2 B4 D4, closed.
2. "Were any discounts outside the special-offer rules?" G3 C3, closed.
3. "Product costs changed. What did that do to margin by subcategory?" A2 as-of, C4 D1, why.
4. "Which resellers get unusually deep discounts for their size?" Then: "What's the best course of action?" D3 C3 J8, why and recommend. Real data, so there are no planted outliers. The rubric grades the course of action only, as in 3h.
5. "What price do we need on each bike model for a 40% margin at standard cost?" B5 B4, closed.
6. "Plan a 3% list increase for resellers: impact, who's hit hardest, how to roll it out." E1 J1 J2, recommend.
7. Parse test: the raw delimited files, no help given. A1 A4, closed.

**Dunnhumby**
1. "Which coupons and campaigns actually paid off?" Then: "Which would you run again?" F1 F3 K2 J1, why and recommend. The rubric requires the baseline method to be stated, and no causal claim from redemptions alone.
2. "Split the discount we give into shelf, coupon and match, by department." C2 C3, closed.
3. "Real price change year 2 vs year 1, like-for-like." C1, closed.
4. "Do households that mostly buy on promotion or coupon look different? Is that a workable segment?" G1 D2, recommend. This is behaviour observed in the data, not price sensitivity: the rubric bans elasticity language.
5. "Help me with promotions." J6, vague. It should triage to a scope.
6. "Prove the mailer drove sales." K2 F1, leading.

**Olist**
1. "What's net revenue per seller after cancellations, with freight shown separately?" A2 (fan-out across items and payments), A3 B4 D4, closed.
2. "Are some sellers charging well above peers for the same category and region?" D3, why.
3. "Is freight eating our marketplace economics in the north?" D4 D2, why.
4. "What's our margin?" No cost data, so K2: it must say what is missing. Can't-answer.
5. Conversation: confirms vouchers are a discount, then asks for realized price by category. J4 J5 C1.

**M5** (subsample)
1. "Turn this into weekly revenue by store and category." A2 wide-to-long and weekly price join, A4, closed.
2. "Which items had real price changes, and what happened to their volume?" C4 K2, why. Descriptive only: the rubric bans arc or other elasticity figures. The rubric requires naming confounders: events, SNAP, seasonality.
3. "If we put FOODS_3 prices up 5%, how much volume can we lose and still keep gross profit?" E3, closed, using the cost overlay.
4. "Did event weeks get discounted or just sell more?" F1 I3, why.

**Inside Airbnb** (one city)
1. "How are we priced versus comparable listings in our neighbourhood?" Given one listing ID as "ours". D3 B3, why.
2. "Which segments justify different price levels?" G1 G2, recommend.
3. "What's occupancy and revenue per listing?" K2: calendar availability isn't bookings. Can't-answer.
4. "How much do prices move with season and weekends?" I3, closed.

**Iowa liquor** (one year)
1. "Which categories have the best margin, and why?" K2: markup is statutory, so it should notice margin % barely varies. Why.
2. "Price per litre by category and pack size." B3, closed.
3. "If supplier costs rise 6%, what happens to retail prices and revenue?" E2 C4 I2 (CPI adjunct), closed.

**S2 B2B distributor**
1. "Where are we leaking price between list and pocket?" C2, closed.
2. "Which deals broke policy, and who approved them?" G3, closed.
3. "Which reps discount out of line?" D3 C3, why.
4. "Propose a discount policy that cuts leakage without losing big accounts, with a rollout." G1 G3 J1 J2, recommend.
5. Conversation with context: the policy floor is confirmed in turn 1, then a correction in turn 3. J4 J5.

**S3 SaaS**
1. "Build the MRR bridge for last year, plus NRR and GRR." H1, closed.
2. "Did the price increase raise churn?" F2 H2 K2. It should use the random subset and say what the rest can't show.
3. "How should we move the grandfathered customers?" H2 J2, recommend.
4. "Should Better have more seats or a lower price?" G2 G4, recommend.

**S4 Usage and hybrid**
1. "What does each customer pay under the proposed tiers, and who's worse off?" H3 E1, closed.
2. "Is the bundle's service part priced right?" G5 hybrid, why.
3. "Design a tier schedule that keeps 95% of customers within 10% of today's bill." G2 G4, closed with a constraint check.

**Count by source:** 8 + 7 + 6 + 5 + 4 + 4 + 3 + 5 + 4 + 3 = 49 cases (S1 is parked). Sections 3e to 3j add 57 more, for **106 in all**, plus clean/trapped and holdout variants of the closed ones.

### 3e. Context levels and intake

**Why:** every current case ships a full, confirmed `context.md` (`run.ts` copies `contextFile` into `.pricing/context.md`), so intake has never been tested. The real risks are:
- with too little context, the harness assumes or hallucinates definitions;
- with plenty of context, it asks anyway or ignores what's there.

**The ladder.** The same two-turn conversation runs on the retail set at each level:
- turn 1: "What's our margin by category, and how did it change in 2025?";
- turn 2 answers whatever it asked.

| Level | `context.md` | Expected in turn 1 |
|---|---|---|
| L0 | none | Fires intake and proposes the field mappings. Per shared rules §3: when a basis changes the conclusion, it holds the headline and asks **one focused question**; where the candidates agree, it delivers. Saves nothing. |
| L1 | company name and currency only | Asks about the bases that are material here: returns treatment, and cost meaning if unclear. Must not ask about currency. |
| L2 | definitions, but nothing on returns | Asks about returns only. It doesn't ask when the question can't be affected, as in a variant asking about a category with no returns. |
| L3 | full (today's file) | Doesn't ask. Asking here is a fail for over-asking. |
| L4 | conflicts with the data or the user: it says EUR but the file has `£`, or it says "returns excluded" and the user then says "include returns" | Flags the conflict. Follows the user's explicit instruction for this turn and proposes a context update. Never rewrites silently: the append-only hook already enforces part of this. *Touches the open item on context.md precedence, so a failure may be that known gap rather than a regression.* |
| L5 | another company's file | Today's context-import case. Offers to reuse, but checks company and scope first. |
| L6 | long, mostly irrelevant facts, with one relevant one buried: "Storage unit costs exclude inbound freight; add 4% of unit cost to Storage unit cost" (the basis is now stated) | Applies the buried fact without being prompted. This is the "more context" test. *Touches the same open item.* |
| L7 | two facts in the file contradict each other, for example two different returns treatments with different dates | Names the conflict and asks which applies. Doesn't pick one silently. |
| L8 | a confirmed fact the data contradicts: "We have no returns", but credit notes exist | Flags the contradiction with counts and value, and asks. Doesn't silently follow the context or the data. |
| L9 | the user retracts a confirmation in turn 3: "Actually, returns shouldn't be netted" | Follows the retraction from then on, restates the moved figures, and records it in `context.md` as a new dated line (append-only), not as an edit. |

**Grading:**
- `expectQuestion` true or false per level;
- `expectReads` must include `pricing-intake` at L0, L4 and L5;
- `expectContext`: after turn 2, the confirmed facts are saved and nothing else is. At L3 the file is unchanged;
- rubric:
  - must: every definition used is in `context.md`, in the user's words, or labelled as an assumption. The judge gets the context file to check this;
  - must: provisional figures are labelled;
  - must_not: states an assumed treatment as the company's.

**Spread:** all ten levels on retail; L0, L2 and L4 on S2; L0 on S3; L0 and L3 on UCI. **16 cases.**

### 3f. Skill routing and card permutations

**Routing cases.** One short conversation per skill. Each has a must-read and, where it matters, a must-not-read. All run on the retail set with L3 context unless noted. **11 cases.**

| Id | Turn | Must read | Must not |
|---|---|---|---|
| RT-intake-setup | L0: "Here's our sales data. Get set up so we can work on it." Turn 2 explicitly accepts three of the proposed mappings by name, and leaves the rest unanswered. | pricing-intake | analysis-visualize. `expectContext`: exactly those three facts, the rest "not stated". An explicit acceptance of a proposed mapping counts as confirmation, as the intake skill says. Silence doesn't. |
| RT-intake-remember | Mid-conversation: "By the way, our financial year starts in April. Remember that." | pricing-intake | `context.md` gains the fiscal-year fact and loses nothing. |
| RT-intake-correct | "That's wrong: K07 is a clearance line, not a loss maker. Note it." | pricing-intake | Adds a scoped exception, and rewords nothing. |
| RT-intake-negative | A closed question with full context | — (no requirement) | No `context.md` write. |
| RT-triage-vague | "Our pricing feels like a mess. Where do we start?" | pricing-triage | No full analysis before scoping. |
| RT-triage-definition | "What's the difference between markup and margin?" | pricing-triage | No data query: a small answer. The rubric requires it to be **labelled as a general definition**, as the triage skill asks, unless `context.md` has a company one. |
| RT-scan | "Anything odd in this data I should know about?" | pricing-scan | |
| RT-recommend | "What should we do about Storage?" | pricing-recommend, evidence-ranking | |
| RT-design | "Redesign our volume discount bands." | pricing-design | |
| RT-execute | "We've agreed +5% on Storage from January. Plan the rollout." | pricing-execute | Doesn't re-run the decision analysis. |
| RT-visualize | "Show me that as a chart." | analysis-visualize | |

**Card × skill permutations.** Each card should be exercised under at least two different skills, and in at least one case that needs it alongside other cards.

**Most cards are reached through the knowledge index, not a direct skill link.** The "linked directly by" column comes from grepping the skill files on 2026-10-16. Four cards have no direct link from any skill: retail-economics, recurring-metrics, experiments-and-promotions and recurring-scenarios. price-waterfall is linked only from triage. Reaching a card through the index is legitimate, so a pairing counts when **the run shows the card was read during that skill's turn**, together with the output only that card produces (3b). The index route is the weaker one, and these cases are where it gets tested.

| Card | Linked directly by | Exercised under (case) |
|---|---|---|
| metric-verification | analyze, scan | analyze (every closed case), scan (RT-scan, OUT-1) |
| margin-drivers | analyze | analyze (UCI-4, AdvW-3, PO-1), recommend (`retail-storage-advice`, the realistic-evals step 4 case; PO-1 turn 2) |
| price-waterfall | triage | analyze (AdvW-1, S2-1, EC-2), design (S2-4), triage (RT-triage-vague, when the user mentions discounts) |
| price-realization | analyze, execute | analyze (UCI-3, Dunn-3, EC-13), execute (RT-execute: checking the realized rise after rollout) |
| price-change-economics | analyze, execute, scan, recommend | analyze (SC-1 to SC-5, M5-3, UCI-6), recommend (AdvW-6), execute (RT-execute), scan (RT-scan sizing) |
| peer-comparisons | analyze, scan | scan (OUT-1), analyze (Olist-2, Airbnb-1, PO-1 to PO-5, EC-6) |
| discount-governance | design, execute, scan | analyze (AdvW-2, S2-2), design (S2-4), scan (OUT-1), execute (OUT-1 turn 3) |
| evidence-ranking | scan, recommend | recommend (RT-recommend, OUT-1 turn 2, PO-1 turn 2), scan (RT-scan) |
| value-estimation | design | design (S4-2), recommend (WTP-1, WTP-3) |
| segmentation | design | design (Dunn-4, Airbnb-2), recommend (S2-4), analyze (WTP-2) |
| retail-economics | — (index only) | analyze (Olist-3, UCI-5), scan (RT-scan) |
| recurring-metrics | — (index only) | analyze (S3-1), intake (S3 at L0) |
| offer-architecture | design | design (S3-4, S4-3), analyze (S4-1) |
| experiments-and-promotions | — (index only) | analyze (Dunn-1, M5-4), recommend (Dunn-1 turn 2), the leading prompt (Dunn-6) |
| recurring-scenarios | — (index only) | analyze (S4-1), design (S4-3) |
| renewals-and-migration | execute | recommend and execute (S3-3), design (S3-4) |
| hybrid-offers | design | analyze (S4-2), design (S4-3) |

**Multi-card cases.** These are the hard permutations, where the answer is wrong unless the cards are combined:
- realization + margin-drivers + metric-verification: UCI-3 to 4;
- waterfall + governance + peer-comparisons: S2-1 to 3, OUT-1;
- price-change-economics + metric-verification + margin-drivers: SC-1 and SC-3, where a loss-making SKU and a cost change break the simple formula;
- peer-comparisons + margin-drivers + evidence-ranking: PO-1 to PO-3;
- segmentation + peer-comparisons + value-estimation: WTP-1, Dunn-4;
- recurring-metrics + renewals + experiments: S3-2 to 3;
- hybrid + offer-architecture + recurring-scenarios: S4-1 to 3;
- retail-economics + peer-comparisons: Olist-2 to 3.

### 3g. Scenarios, breakeven volume and willingness to pay

**Expected behaviour.** Asked "if we change X's price, how much volume can we lose (or must we gain) and keep gross profit the same?", it should:
- use the card's contribution-preserving formula, `Δq/q0 = −(Δp − Δc) / (CM0 + Δp − Δc)`, per SKU, on the same basket, currency and cost basis as the baseline;
- for a group, hold mix at baseline and say so;
- give the result both as a % and in units, next to the fixed-volume gross-profit change;
- say when the formula doesn't apply: nonpositive unit contribution, or a cost rise larger than the price rise, where volume must *grow* rather than fall.

Elasticity is parked (see Parked). The willingness-to-pay cases below report **observed rates only**, never a fitted response. Asked how much volume would *actually* fall, it should say it doesn't estimate demand response from this data, give breakeven, and suggest a test. The current cards already say this.

The existing retail-cards-conversation already asks for per-SKU breakeven on a Storage +5% increase. The cases below widen that.

**Cases.** 8 new cases; M5-3 and UCI-6 above are also part of this group.

| Id | Data | Question | Graded by |
|---|---|---|---|
| SC-1 | retail | "If we cut Kitchen prices 10%, how much extra volume do we need to keep gross profit the same?" | Per-SKU % and units, exact. For K07 (CM0 < 0) the expected answer: "holding gross profit" means nothing for a product that loses money on each unit. It gives K07's fixed-volume gross-profit change instead, with the cell blank and the reason stated. |
| SC-2 | retail | "For Storage as a whole, what's the breakeven volume on +5%?" | Category result, exact, with mix held. The rubric requires the fixed-mix assumption, and the per-SKU range next to it. |
| SC-3 | retail | "Costs go up 4% and we raise prices 3%. How much volume can we lose and still keep gross profit?" | Exact per SKU. SKUs where volume must grow are named as such, not reported as negative headroom without comment. For K07, where CM0 < 0 but the change could make proposed contribution positive, the formula returns a number with no meaning. Expected: no breakeven, with the cell blank, the reason stated, and the fixed-volume gross-profit change given. |
| SC-4 | retail | "Storage +5%, Kitchen −3%, costs +2%: what happens to gross profit, and what volume change in each category keeps it whole?" | Fixed-volume gross profit, exact. Breakeven per category, exact. |
| SC-5 | retail | "If we raise S03 by 5%, how much would volume actually fall?" | No invented volume number. Says demand response isn't estimated from this data, gives breakeven (exact) and suggests a test. |
| WTP-1 | S2 | "Can you work out what our customers are willing to pay from the quote history?" | **Observed only:** win rate by price band and segment, exact. No fitted curve and no "price at 50% win". Caveats: reps choose quote prices (selection), and revealed price is only a lower bound on WTP, for buyers only. The answer must say it is not a WTP or demand estimate. |
| WTP-2 | Dunnhumby | "What premium will households pay for national brands over private label?" | The price premium actually paid, and switching on promotion, split by segment. Says it's revealed preference, not WTP. |
| WTP-3 | S3 | "What would customers pay for the Best plan?" | **Observed only:** upgrade and churn rates for the randomly assigned subset, against the rest, exact. No price-response estimate. It says what a test would need to settle the question. |

### 3h. Outlier customers, then the course of action

**OUT-1, on S2,** with planted customers paying below **size-matched peers** (the same size band and the same items), so the comparison is like for like. S2 carries the columns that let the causes be found: `contract_start`, `rep`, `approver` and `unit_of_measure`. The data-error account is a case-vs-each unit mix-up visible in `unit_of_measure`. Three turns:

1. "Anything odd about what customers pay?"
   - It should fire pricing-scan and peer-comparisons.
   - The saved `outliers.csv` (customer, peer reference price, gap in GBP) is scored by precision and recall against the planted set, with the gap exact.
2. "What's the best course of action?" Graded by rubric:
   - must: checks the reason for each account before acting (contract, rep, data error), and spots the data-error account from the evidence;
   - must: sizes the gap against size-matched peers;
   - must: matches each action to its cause: fix the data error, reprice legacy contracts at renewal, fix approval governance for the rep;
   - must: stages the changes, weighing churn risk against the small revenue at stake;
   - must: orders the actions by evidence and value;
   - must_not: moves everyone to the median at once;
   - must_not: treats a low price as proof of low willingness to pay, or calls the leakage proven.
3. "OK, plan it." It should fire pricing-execute, giving timing per action, and either an owner or an explicit open decision on ownership, as the execute skill allows.

**OUT-2, on UCI trapped:** the same pattern planted on a real backbone. The first two turns only.

AdvW-4 is the real-data version, with no planted truth, so only the course of action is graded.

**2 new cases.**


### 3i. Outlier products: whole portfolio and within a group

**Why:** the same product can be an outlier against its group and ordinary against the whole range, or the other way round. The analyst has to use the peer set the question names, and say which one it used.

**Data:** a seeded variant of the retail set, `retail-outliers`, made by the same generator. Natural SKU margins there already spread from 24% to 55%, so planted outliers sit far outside that:

| Plant | Example | Should appear in |
|---|---|---|
| Portfolio low | a large Kitchen SKU (about 9% of sales) pushed to about 15% margin, against a portfolio median near 38% | portfolio and group lists |
| Group-only high | a Storage SKU at about 55%, against a Storage median near 37%. Unremarkable portfolio-wide, where Garden and Kitchen have SKUs at 50% or more. | the Storage list only. Allowed, not required, in the portfolio list. |
| Group-only low | a Kitchen SKU at about 27%, against a Kitchen median near 41%. Several SKUs in other groups sit near 27%. | the Kitchen list only |
| Existing | K07, loss-making | both |
| Immaterial control | a new planted SKU, G10, at about 0.2% of sales and a 5% margin. Below the 0.5% peer-ratio share; G09 at 0.9% was too big to be a control. | Must not lead either list. It may be mentioned as immaterial. Ambiguous tier, not penalised. |

**Materiality, so the real outliers aren't dropped:**
- every required plant carries at least 3% of portfolio net sales and at least 10% of its group's;
- its gross-profit gap to the peer median is at least 1% of total gross profit;
- that is well above the plugin's relative materiality test (a gap smaller than the smallest difference the answer relies on) and the harness's peer-ratio share (0.5%);
- planted outliers are real pricing differences, within 5× of their peers, so the data-error note doesn't fire on them;
- the solution script asserts all of this when the data is built, so a plant that is too small fails the oracle rather than the analyst.

**Cases.** 5 new cases. Each saves `outliers.csv` (sku, margin_pct, reference_pct, gp_gap_gbp, peer_set), scored with the three-tier key (3b), with the gaps exact.

The natural 24% to 55% spread means the group-only plants are hard negatives in the portfolio key only if they sit inside the portfolio band. The key builder computes the tiers from the generated data, rather than from this table.

| Id | Data | Turns |
|---|---|---|
| PO-1 | retail-outliers | 1. "Across the whole range, which products are out of line on margin, and what's it worth?" 2. "What should we do about them?" |
| PO-2 | retail-outliers | "Just within Storage, which products are out of line?" |
| PO-3 | retail-outliers | Portfolio first, then "Now only within Kitchen." The list must change to the Kitchen peer set: the group-only low SKU appears, K07 stays. |
| PO-4 | S2 | Products by pocket margin: the whole catalogue, then within one product family. Plants follow the same rules. |
| PO-5 | UCI with cost overlay | Plants sit in the cost overlay on a real backbone. The whole range, then within one category. |

**Rubric for "what should we do" (PO-1 turn 2):**
- must: separates the causes (low price, high cost, customer mix), using the data;
- must: sizes each gap in GBP and orders the actions by value and evidence;
- must: treats the high-margin outlier as a question (premium that's justified, or a mispricing), not a problem to fix;
- must: names the peer set it used;
- must_not: proposes dropping a product on margin % alone, without its gross-profit contribution;
- must_not: leads with the immaterial control.


### 3j. Business and data-logic edge cases

From the adversarial review (`docs/reviews/2026-10-16-generalisation-evals-adversarial-review.md`), filtered to tests of the harness's business, data and reasoning logic.

**Left out on purpose:**
- **Technical:** spreadsheet export hazards, wide files, chart mechanics, files changing mid-session.
- **Moral or legal:** antitrust prompts, requests to act beyond authority.
- **Injection in data:** to be tested, but in a later run.
- **Services and take-rate pricing:** would need a new synthetic set; noted for later.

**Cases.** 15 new cases. EC-13, EC-14 and EC-19 are extra turns on existing cases, not new cases.

| Id | Test | Host | Graded by |
|---|---|---|---|
| EC-1 | **Mixed currency and tax basis.** GBP, EUR and USD lines with a dated FX table, some lines with no currency, and VAT-inclusive B2C lines next to ex-VAT B2B lines. "What's our revenue and margin by customer group?" | S2 | Totals exact, using the FX table as of each invoice date. No sum across currencies before conversion. Lines with no currency are left out and shown by count and value. Asks the VAT basis if `context.md` doesn't give it. |
| EC-2 | **List basis changes mid-year.** A list price rise in July, a price-list file next to the invoices, and some invoices still on the old list. "Has our discounting got deeper this year?" | S2 | Discount depth measured against the list in force on each invoice date, exact. The rubric fails a "deepening" that is only the list moving. |
| EC-3 | **Zero-price and free lines.** Samples, free-of-charge replacements and zero-price promo lines. UCI has real ones. "What's our average selling price and margin?" | UCI, S2 | A recorded zero is a real value, never treated as missing (shared rules §6). The answer states whether free lines are in. The key accepts both treatments if the answer states which. Asks if the difference is material. |
| EC-4 | **Zero or absent base period.** New SKUs (S09, G09) and lost ones (S08, K08). "% change in sales by SKU, 2024 to 2025." | retail | Undefined % changes are blank with a reason, never Inf or NaN (3b check). New and lost SKUs are kept apart from price and volume. |
| EC-5 | **Fiscal-year and year-to-date alignment.** The context gains "Financial year starts 1 April", and the data ends mid-month. "How are we doing this year against last?" | retail | Fiscal YTD against the same span last year, exact. Not calendar 2025 against full 2024. The part month is named. Follows on from RT-intake-remember, so the saved fact is *used*. |
| EC-6 | **Thin peers, one dominant customer, ties.** One segment has 2 customers. In another, one customer is 65% of sales. Two SKUs tie for fifth by margin. "Who's out of line on price, and what are our top 5 products by margin?" | S2 | The thin peer group is flagged as weak evidence (peer-comparisons card). The dominant customer is named as a driver. The tie is reported, with no arbitrary cut. The lists are exact. |
| EC-8 | **The user pushes back on a correct answer.** Turn 2: "I'm sure margin was 45%. Use my figure." | retail | Holds its figure, shows the reconciliation (what would give 45%), and doesn't adopt the user's number. If the user insists on it as a scenario, labels it as user-supplied. |
| EC-9 | **A long conversation with stated assumptions.** 20 turns. Turn 2: "Assume costs rise 3% and we pass half on." Turn 18 asks for a figure that depends on it. | retail | The turn 18 figure is exact under the stated assumption. Measure names stay stable, and moved figures are restated. This covers the open compaction item. |
| EC-10 | **Unit of measure.** The same SKU sold per each and per case of 12, so the unit price jumps ×12. The detector labels it `x12`. | S2, UCI trapped | Normalises to one unit, and doesn't exclude the rows as errors. Per-unit price exact. Reads the detector note as a lead, not a verdict. |
| EC-11 | **Credits and rebate timing.** Credit notes with no matching invoice, partial credits, and Q4 rebates paid in the next Q1. "Net revenue by quarter." | S2 | Under the timing rule in context: exact. With no rule: asks one question, or gives both timings side by side. Unmatched credits are shown, not dropped. |
| EC-12 | **Bundles and kits.** A kit header line with zero-priced component lines, and a kit sold as a single SKU. "Margin by product." | S2 | Margin at kit level is exact. Asks the allocation basis before splitting a kit's price across its components, rather than inventing one. |
| EC-13 *(extra turn in PO-1)* | **A rise that comes from mix only.** Like-for-like prices are flat while the average price rises through mix. | retail-outliers | "No real price rise; mix moved." Realization exact. |
| EC-14 *(turns on AdvW-3 and S2-1)* | **Which column is price, and which is cost.** List, net and MSRP columns; standard and landed cost; a cost changing mid-period. | AdvW, S2 | Uses net price for realization. Asks which cost to use if context doesn't say. As-of join exact. |
| EC-16 | **Seasonal comparison.** "Q1 2025 margin fell against Q4 2024. Why?" There is also a promotion that overlaps a price change. | retail | Points out the seasonal comparison and offers same-quarter year on year, exact. Doesn't attribute the overlapping effects to one cause. |
| EC-17 | **Forecast request.** "What will margin be next year?" | retail | No forecast. Offers a scenario with stated assumptions, exact. The rubric bans any extrapolated "will be" figure. |
| EC-18 | **"Don't ask me anything, just do it"** at L0, with a material basis. | retail | No silent assumption. Either delivers both treatments side by side, or holds only the affected figure and asks once (shared rules §3). |
| EC-19 *(turn on AdvW-5)* | **Rounding and price endings.** Prices rounded up to .99 endings under a margin floor. Totals of rounded rows. | AdvW | Exact rounded prices that never breach the floor. Totals computed from unrounded values, with the difference named. |
| EC-20 | **Same question twice.** Turn 1 and turn 6 ask the same thing in different words. | retail | Identical figures. |

### 3k. Stress tests for the data-validation script

**Why:** `bundled/harness-tools/data_findings.py` was tuned on the synthetic seeded pack. It caught 30 of 37 plants, with no unexplained findings (Task 11). Reading the code shows choices that may not hold on the new sources:

| Risk in the code | Where it may break |
|---|---|
| **CSV only.** The findings call uses `format='csv'`, and the adapter accepts CSV only. | UCI ships as XLSX, so it gets no findings at all unless converted. |
| **UTF-8 only.** Delimiter sniffing covers only `, ; \t \|`, and `strict_mode` is on. | AdventureWorks' delimited exports (unusual delimiter and encoding): should fail with a clear message, not crash or misparse. |
| **One value column** for `valueAtStake`, picked as the largest-total decimal column that isn't key-like. | Olist (price vs freight), Dunnhumby (`SALES_VALUE` vs discount columns). M5 counts are integers, so no value column. Airbnb prices are text such as `$1,234.00`. A wrong pick ranks findings wrongly. |
| **D1 needs a dominant parse (95%).** A column that is wholly in one non-standard format is not "numeric", so nothing is flagged. The currency list is `£ $ €` only. | Airbnb `$1,234.00` throughout; BRL `R$`; a whole column of decimal commas; a whole column of DD/MM dates. |
| **D2 codes** must have at most 20 characters, no spaces, and at least 10 distinct values. | UCI `StockCode` case variants (`85123A`/`85123a`) and the rare non-product codes (POST, M, D): the first should be flagged, the second flagged as rare shapes. |
| **D3 needs the same column name** in two files, with one file holding it as a key. | AdventureWorks and Olist share names. A cost file with `sku` against sales with `StockCode` gets no domain check. |
| **D4 repeated-row** flags exact duplicate rows, and **repeated-document** needs a column named like `id`, `no` or `number`. | Dunnhumby may have legitimately identical lines (false positives at scale). UCI's `Invoice` doesn't match the name pattern, so repeated invoices are missed. UCI has thousands of real exact duplicates. |
| **D7 only groups by a key that is a master in another file.** It is also skipped when more than 2% of rows sit far from the median. | Single-file sources (UCI, Airbnb listings) get no peer-ratio check. Real dispersion (Airbnb, UCI quantity breaks) may switch it off silently. |
| **Cost at scale:** one query per column per detector. | M5's 1,941-column wide file; Dunnhumby's 2.6M rows. |
| **Not built:** D5 identities, D6 time and D8 labels. | A dropped month, `quantity × price ≠ line total`, renamed categories. |

**Two layers.**

1. **Deterministic, no model calls** (`tests/evals/findings/findings_stress.py`). It runs the script directly on every source in the plan: the 7 real ones, S2 to S5, and the retail variants, each clean and trapped. Per source it reports:
   - **recall** of planted faults, by detector, against the seeding manifest;
   - **findings on the clean copy**: each one labelled real, noise or unclear the first time, then stored as expected, so new noise shows up as a regression;
   - the **value column** chosen against the one the case expects, and the **peers** chosen for D7;
   - **"no coverage"**: sources or columns a detector silently skipped (XLSX not run, D7 skipped, no master key). These are listed explicitly, never just absent;
   - **runtime and peak memory**, with a budget per source.

   **Targeted plants** go in on top of the shared trap set, one per risk in the table above. For example: a full `R$` column, a full DD/MM column, a decimal-comma column, `sku` against `StockCode`, each-vs-case ×12 and ×24, a UTF-16 file, and the M5 wide file. Each has an expected outcome: "flagged", "reported as no coverage" or "clear error". A silent miss fails.

   This layer is free to run, so it runs on every change to the script. It is the test bed for the D0-2 rewrite (Part 4).
2. **Live: does the analyst use the findings well?** Covered by the trapped and clean variants already planned, with one more rubric item:
   - the analyst names detector-flagged issues that are material;
   - it does not present noise findings on clean data as errors;
   - where the stress layer showed *no coverage*, it still checks those risks itself.

**Done when:** every source has a stored stress report. Each "no coverage" line is either fixed or accepted, and recorded in `docs/open-items.md`. Recall and noise numbers are compared with Task 11's 30/37, to see whether the detectors generalise beyond the seeded pack.

---

## Part 4. Day-0 deliverables, before any live run

Nothing in Part 5 makes a model call until these two are done.

### D0-1. Link the cards directly from every skill

**Why:** every card is already registered as a Pi skill, since commit 7995d0f. But the skill files link cards directly only in places: triage links the price waterfall, and that link was tested and helped. Four cards are linked from no skill at all, and are reachable only through `knowledge/index.md`: retail-economics, recurring-metrics, experiments-and-promotions and recurring-scenarios. This makes the waterfall pattern universal.

**What:** each `SKILL.md` gets a short **Cards** block. It lists every card that skill can need, with a one-line "use when" for each, in the same style as the triage waterfall link. The map comes from the 3f table, with the gaps filled:

| Skill | Cards to link (★ = not linked today) |
|---|---|
| intake | metric-verification ★, retail-economics ★, recurring-metrics ★ |
| triage | price-waterfall, metric-verification ★, margin-drivers ★, price-realization ★, price-change-economics ★, recurring-metrics ★ |
| scan | metric-verification, peer-comparisons, discount-governance, evidence-ranking, price-change-economics, price-waterfall ★, price-realization ★, retail-economics ★, experiments-and-promotions ★, segmentation ★ |
| analyze | metric-verification, margin-drivers, price-realization, peer-comparisons, price-change-economics, price-waterfall ★, retail-economics ★, recurring-metrics ★, recurring-scenarios ★, experiments-and-promotions ★ |
| recommend | evidence-ranking, price-change-economics, margin-drivers ★, peer-comparisons ★, discount-governance ★, segmentation ★, value-estimation ★, experiments-and-promotions ★ |
| design | discount-governance, segmentation, value-estimation, offer-architecture, hybrid-offers, price-waterfall ★, peer-comparisons ★, price-change-economics ★, recurring-scenarios ★ |
| execute | price-realization, price-change-economics, discount-governance, renewals-and-migration, experiments-and-promotions ★, recurring-scenarios ★ |

- **Where:** made in `bundled/pricing-plugin/`, the same way 0.4.8 was released (3eac895). `plugin.json` and `versions.json` are both at 0.4.9.
  - The separate Pricing_Plugin repo is still at 0.4.7, so the 0.4.8 and 0.4.9 changes need back-porting there before it is pushed.
  - *Built 2026-10-16, not yet committed.* The links went inline, at the step where each card applies, in the style of the triage waterfall link. Each "pick from the knowledge index" sentence now names its cards and keeps the index as the fallback.
  - The test is in `tests/unit/bundle.test.ts`. All 186 vitest tests pass, and the typecheck is clean.
- **Test, deterministic:** a unit test that reads each `SKILL.md` and asserts every link in the map is present and resolves to a real card file. It also asserts every card is linked from at least two skills. No model calls.
- **Test, live:** the wave-0 routing cases (3f), run once on 0.4.8 and once on 0.4.9, give the before and after. This is the first live run, and it needs your approval.
- **Done when:** the unit test passes, the existing suites pass, and the plugin is at 0.4.9 in `bundled/`.

### D0-2. Rewrite and test `data_findings.py` on the new data tables (day-0 gate)

*Built 2026-10-16 as VERSION 7, in one release, and not yet committed.*
- Results are in `docs/reviews/2026-10-16-findings-stress-baseline.md`: Northbridge 33/37 caught, 0 unexplained, and all 14 targeted gaps closed.
- What is still open is the gate itself. Each new data table has to pass the stress run once it is built or fetched.

**Why:** the findings run before the analyst sees the data. They are the harness's deterministic guard, and they must work on day 0, before any model call. Section 3k shows the current script was tuned on the seeded pack, and is likely to miss or misread several of the new sources.

**When:** as soon as each source's tables are ready, meaning a fetched real source with its overlay and trapped copy, or a generated synthetic set. A source doesn't get a live case until its findings pass this gate.

**Scope of the rewrite**, driven by the 3k risk table:
- **Formats.**
  - Read XLSX (every sheet, or the chosen one) as well as CSV.
  - Non-UTF-8 files and multi-character delimiters give a clear "convert first" finding, never a crash or a misparse.
- **Value columns.** Report every monetary-looking column with its own value at stake, instead of guessing one. Integer-count measures (M5) are allowed.
- **D1 parse:** catches a column that is *entirely* in a non-standard format:
  - currency prefixes, including `R$`, and symbols combined with thousands separators;
  - whole-column decimal commas;
  - DD/MM vs MM/DD, decided by values with a day above 12, and reported as ambiguous otherwise.
- **D3 domain:** finds join keys by overlap of values, not only by matching column names, so `sku` against `StockCode` is caught.
- **D4 uniqueness:** finds repeated documents by structure, without needing a column named `id` or `no`. Exact duplicate rows are counted and reported, and never called errors: the user decides.
- **D7 peer ratio:**
  - works inside a single file, grouping by its own code-like columns;
  - when it can't run, it says so, instead of skipping silently;
  - ×12 and ×24 (pack size) get their own label next to ×12.
- **Coverage report.** Every detector reports, per source and per column, "ran", "skipped: reason" or "not built". A silent skip becomes impossible.
- **Scale:** one pass per table, not one query per column per detector. Budgets are 60 s and the existing 4 GB memory limit per source, at pilot sizes. M5's wide file is reshaped before checking.
- **D5 identities and D6 time:** decide whether to build them now in their simplest form (`qty × price` against line total where both exist; gaps in a date series) or keep them as "not built" in the coverage report. Either is fine. Silence is not.

**Rules kept:**
- facts only: code flags and counts, the user picks treatments (no business assumptions);
- cached by content;
- the bounded prompt summaries stay as they are;
- the smallest readable implementation, under the usual diff budget;
- `VERSION` bumped.

**Test:**
- `tests/evals/findings/findings_stress.py`, the deterministic layer in 3k, runs on every source, clean and trapped. It checks recall by detector, labelled clean-data noise, value columns, the coverage report and runtime.
- One pytest per targeted plant, each with an expected "flagged", "reported as no coverage" or "clear error".
- The existing pytest and vitest suites still pass.
- No LLM calls anywhere in this deliverable.

**Done when**, for each source:
- recall of planted faults is at least the Task 11 level (30/37 ≈ 80%) for the detectors that are built;
- every clean-data finding is labelled, and none is unexplained;
- the coverage report has no silent skips;
- runtime and memory are within budget;
- a stored stress report exists in `docs/reviews/` for each source;
- any remaining "not built" lines are recorded in `docs/open-items.md`.

## Part 5. Order and size

Each wave ends with the oracle passing (every solution script reproduces its key), and the first live tranche needs your approval as usual (5 runs at a time). **Gate:** no live case runs on a source until D0-2 has passed for it. D0-1 lands before wave 0's routing runs, after one baseline run on 0.4.8.

1. **Prerequisites, no model calls:**
   - D0-1 (except its live before and after);
   - D0-2 on the retail and existing synthetic data;
   - build the data tables for wave 0;
   - finish realistic-evals steps 1 to 4. The rubric judge is needed for about half of the cases above.
2. **Wave 0, the existing retail set:**
   - the context ladder on retail (10) and the routing cases (11);
   - SC-1 to SC-5, and PO-1 to PO-3 on the seeded `retail-outliers` variant;
   - EC-4, EC-5, EC-8, EC-9, EC-16, EC-17, EC-18 and EC-20.

   These need no downloads: just the grader changes in 3b and one generator option. They go first because they test what has been ignored so far (intake, triage, scan, recommend, design and execute).
3. **Wave 1, synthetic:** S2 B2B (including OUT-1, WTP-1, EC-1, EC-2, EC-6 and EC-10 to EC-12) and S3 SaaS, after D0-2 passes on each. They open the most cards that have never been tested, they're cheap, they have exact truth and they need no downloads.
4. **Wave 2, real pilot:** UCI, AdventureWorks, Dunnhumby, Olist, each with fetch script, checksum, overlay, two context versions and a trapped copy. D0-2 must pass on each source **before** any live case on it. About 26 cases.
5. **Wave 3:** M5, Airbnb, Iowa and S4, each after D0-2 passes on it.

**Run budget:**
- One pass of all 106 cases × 1 model × 3 repeats is about 320 runs, before variants. Clean/trapped, bare/confirmed and holdout copies make the real total **2 to 3 times that**, about 650 to 950 runs.
- At the recent cost of $0.07 to $0.30 per Haiku/Luna run, that's roughly $22 to $95 per model for the base pass, and roughly $45 to $290 with variants. This is a rough guess from recent run reports, not a measurement.
- Run the full pass only to confirm a finished change. While iterating, use one fixed representative subset of about 12 cases, one per source plus one per question style.

**Report:** per source and per taxonomy area, with an equal-weight average across sources so the large sources don't dominate. Failures are tagged with the brainstorm's failure taxonomy (wrong grain, join fan-out, unit error, calculation error, unwarranted claim, didn't ask, tool failure, timeout). Per our existing practice, each report also says how each model worked.

## Open decisions

1. Licences: confirm the Dunnhumby and Kaggle terms allow automated local download for internal evaluation. Every fetch script pins a checksum and has a documented **manual download path**, because Dunnhumby and Kaggle need a login and Airbnb snapshots move.
2. TheLook: check whether `sale_price` ever differs from `retail_price` before including it.
3. Recurring public data (KKBox, Telco): worth verifying, or is synthetic S3 enough?
4. Whether the three-arm harness comparison from the brainstorm comes after wave 2, or not at all.
5. Injection in data (instructions in a notes column): a later run, outside this plan.

## Parked: elasticity, a later feature

**Decision 2026-10-16:** no demand-response estimates for now. Every scenario case tests breakeven volume at constant absolute gross profit instead.

Parked with it:
- the S1 pricing lab dataset and its four cases;
- optimisation grading;
- rough-estimate range checks.

**When this is picked up:**
- The plugin needs a card change first. `price-change-economics.md` says "Historical price-volume association does not identify elasticity" and "This describes breakeven only", and `pricing-design` says not to invent demand response.
- The draft behaviour: a rough, labelled estimate when the data has real price variation, as a range with data-specific caveats, always next to breakeven.
- S1, with its known true elasticities, would be the calibration test.
- SC-5 shows today's behaviour and serves as the before-measure.
