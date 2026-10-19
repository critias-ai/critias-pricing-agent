# Founder unit economics: design (draft v3, 2026-10-19)

Roadmap build-order item 2 (`docs/research/roadmap-2026-10-18/ROADMAP.md`, section 3b), widened by the owner on 2026-10-18 to three goals:

1. Work from Stripe exports.
2. Join payments to acquisition spend, wherever it lives: Meta, Google or LinkedIn ad exports, or a card or bank statement.
3. Produce a detailed report that explains, to a founder with no finance background, how the numbers reconcile and what is working.

Thought through at ponytail ultra. Nothing is built. The schema evidence comes from two sub-agent research passes on 2026-10-18, summarised in the appendix.

## The environment we are building for

A founder's money story is spread across files that were never meant to agree:

| File | What it really is | Why it disagrees with the others |
|---|---|---|
| Stripe balance report | Ledger of cash movements: charges, refunds, disputes, fees, payouts | Cash, not revenue. No billing interval. UTC. |
| Stripe subscriptions export | What each customer is on: plan, interval, amount, status | The only source of true MRR. Headers unverified. |
| Stripe payouts report, or bank | What actually reached the bank | Net of everything. Instant payouts are unlinked. |
| Meta / Google / LinkedIn exports | Spend per day per campaign, in the ad account's currency and time zone | Accrual spend. Platform "conversions" are not customers. Google CSVs are UTF-16 with title and total rows. |
| Card or bank statement | When the ad platforms charged the card | Lumpy, threshold-billed charges with lag, FX and maybe VAT. Never equals daily spend. Also holds tools, agencies and freelancers. |
| Customer-to-channel link | UTM in Stripe metadata, or a "how did you hear" field, or nothing | Usually missing for most customers; lost on renewals if only set on the checkout session. |

Every number the founder asks about crosses two or more of these files. The value of the tool is the join, plus a plain explanation of each gap.

## Pushback (ultra)

1. **No new metric card.** `knowledge/recurring-metrics.md` already defines MRR, ARR, NRR, GRR, churn, cohort CAC, payback and the LTV caveat. The confirm step already exists (shared rules section 1, intake writes `.pricing/context.md`). We add sections to that card, not a new card.
2. **The single-file reconciliation checks are circular.** `gross − fee = net` is Stripe's own arithmetic. Summing `net` by payout ID *is* the payout. The real ties need an independent second file: payouts report or bank for cash, card statement for spend.
3. **No new harness detector in v1.** Duplicate transactions (`uniqueness`) and payout IDs missing from the payouts file (`domain`) are already flagged by `data_findings.py` once both files are loaded. The rest is a SQL template the agent runs, and those figures are sealed like any other. Promote it to a detector only if the evals show the model skipping or garbling the checks.
4. **"What is working" is limited by the data, and the report must say so.** Without a customer-to-channel link, the honest answer is blended CAC plus per-platform spend trends. Per-channel CAC and payback appear only for customers that carry a channel, with their coverage stated. We never allocate customers to channels from platform-reported conversions.
5. **One spend source per platform.** The same Meta spend sits in the Meta export *and* on the card. Use the ad export for spend by month, because it is accrual. Use the card statement only as a tie and for non-ad spend. The user confirms the choice. This is the commonest way to double-count CAC.
6. **Synthetic data must not pretend to be verified.** Most ad and bank headers are third-party or guesses. The generator labels each schema's confidence, and real exports replace the guesses as soon as we have them.

## Feature set

### Goal 1: Stripe

- **Inputs:** balance report (or payout reconciliation report), subscriptions export, payouts report or bank CSV.
- **Outputs:**
  - gross-to-net bridge (the user picks which line is "revenue")
  - payout tie, against the second file
  - MRR from the subscriptions export, with annual plans normalised
  - movement bridge: new, expansion, contraction, churn
- **Flags:**
  - rows with no payout (pending balance or instant payouts), counted and valued
  - mixed currency in one payout
  - charges that move month when converted from UTC to the founder's time zone
  - invoice and charge counted twice
  - tax inside `gross`, if the user says tax is charged

### Goal 2: spend join

- **Spend by platform and month,** from the ad exports.
- **Card tie per platform:** total ad-export spend over a window against card charges matched by merchant string (`GOOGLE *ADS…`, Meta's descriptor). The residual is explained as billing lag, threshold timing, FX and VAT. This shows the founder their spend data is complete.
- **Non-ad acquisition spend** (tools, agencies, freelancers) comes from card lines. The agent proposes a merchant-to-category list; the user confirms it, and intake stores it, so next month needs no re-asking.
- **New customers** are counted from first paid charges, by a confirmed definition of "new".
- **CAC:**
  - blended paid CAC = paid ad spend ÷ new customers
  - blended full CAC = all confirmed acquisition spend ÷ new customers
  - per-channel CAC only for UTM-linked customers, with the linked share shown
- **Payback** on a confirmed contribution basis. The steady-state shortcut is labelled as such.

### Goal 3: the report

Built on the existing HTML reporting reference (`skills/references/html-reporting.md`). Sections, each with a two-line "what this means" for a non-expert:

1. **Does the money add up?** Bridge from charges to bank, with every gap sized.
2. **Revenue and MRR.** MRR against cash collected, and why they differ (annual plans, refunds, timing).
3. **Growth movements.** New, expansion, churn.
4. **What did customers cost?** Blended CAC paid and full; per-channel CAC only where linked.
5. **Is spend paying back?** Payback, with the basis stated.
6. **What is working.** Platform spend trend against new customers; channel comparison only where linked.
7. **What we could not check, and what to capture next.** For example: "38% of customers have no channel. Add UTM capture to your checkout to fix this."

The last section is where the tool helps a founder most: it turns gaps into next steps.

## Additions to the existing knowledge cards (v3, 2026-10-19)

Revised after the real exports and the synthetic build. Everything stays vendor-neutral: Stripe, Meta and Google column names go in the SQL template, not in the cards. In total this is about 40 lines across three files, and no new card.

| # | File | Change | Lines |
|---|---|---|---|
| A1 | `knowledge/recurring-metrics.md` | New section **Cash, billing and revenue**, after "Usage and commitments" | +10 |
| A2 | same | **Supporting economics**: add acquisition-cost bullets | +9 |
| A3 | same, and `knowledge/index.md` | Description and index row | 2 edited |
| A4 | `knowledge/metric-verification.md` | **Parsing** and **Structure and timing**: report furniture, time zone | +2 |

Changes since v2, and what drove them:

- **Instant payouts** have no linked transactions (real Stripe export) → A1 names them.
- **Trial zero-value invoices** and **the UTM lost on renewal** (synthetic build) → A2 defines "new" on the first *paid* charge and takes the channel from the first payment.
- **Google looks expensive but pays back; Meta is cheap but never does** (planted truth) → A2: never rank channels on CAC alone.
- **Blended CAC flat while paid CAC rises about 70%** (planted truth) → A2: show both over time.
- **Card versus ad-spend residual at the export date** (the only tie gap in the build) → A2 points to "Size a difference before tracing it".
- **Title, date-range and `Total:` rows** in ad exports → A4, as a general parsing check.
- **Berlin-time balance report against UTC dashboard exports** → A4 generalises the time-zone check. A1 keeps the user-facing confirmation.

**A1. `recurring-metrics.md`, new section after "Usage and commitments":**

```markdown
**Cash, billing and revenue**

- Processor payouts are cash, net of fees, refunds, dispute withdrawals and reserves. They are not revenue and not MRR.
- Show the gross-to-net bridge as separate lines: gross charges, refunds, disputes and reversals, processor fees, other adjustments, net settled. The user confirms which line their "revenue" means; a column or report name never settles it.
- Net settled ties to payouts only against an independent figure, such as a payouts report or bank deposits. Summing one ledger by its own payout key is not a tie.
- Rows not linked to any payout, and payouts not linked to any rows (such as instant payouts), are counted and valued, never dropped.
- An invoice and its charge are one sale. Count it once, by business key ([metric verification](metric-verification.md)).
- Ledger cash cannot give the billing interval. MRR needs the subscription or invoice-period record (see **MRR** above). Annual prepayments make cash run ahead of MRR.
- Confirm whether gross includes tax collected, and which time zone sets the month boundary.
```

**A2. Same card, append to "Supporting economics":**

```markdown
- Acquisition spend has two records: the platform's spend report (accrued daily) and the card or bank charge (billed in batches, with lag, FX and possibly tax). Use one per platform for CAC and the other only as a tie. Counting both double-counts. Spend not yet billed at the export date is an expected tie residual; size it before tracing ([metric verification](metric-verification.md)).
- Confirm what makes a customer new. Zero-value trial invoices are not paid acquisitions.
- When costs carry no customer link, report blended CAC: included acquisition costs in a window ÷ new customers in the same window, with "new customer" and "included costs" confirmed. Paid-only and all-in versions are different measures; name them, and show both over time, because a growing unpaid share can hide rising paid CAC.
- Per-channel CAC needs a customer-level channel field, taken from the customer's first payment, since renewals may not carry it. Report it only for linked customers, and state the linked share. Never assign customers to channels from platform totals.
- Platform-reported conversions and revenue are not customer counts or billed revenue.
- Compare channels on payback or cohort contribution, not CAC alone. Retention differences can reverse a CAC ranking.
- Payback needs a confirmed contribution basis. Label a steady-state shortcut (CAC ÷ monthly contribution per new customer) as such, apart from observed cohort payback. A cohort that has not recovered its cost within the data has no observed payback; say so rather than extrapolating.
```

**A3. Metadata.**

- Card `description`: "Knowledge card. Use for MRR, ARR, retention (NRR, GRR), cohorts and lifecycle movements of subscriptions, commitments and the recurring part of hybrid offers, **and for cash-to-revenue bridges, payout and spend ties, and blended or per-channel CAC and payback**."
- Index row: "What recurring revenue, cohort, lifecycle **or acquisition-cost** measure applies, **and does cash tie to it**?"

**A4. `metric-verification.md`.**

- Under **Parsing**: "Exports can carry title, date-range, subtotal and total rows around the data. Exclude them from calculations, and use any totals as a check."
- Under **Structure and timing**, add to the "check" list: "the time zone of each source's timestamps, where sources set month boundaries differently".

**Not cards, but needed with them** (step 3): the intake "which exports" checklist in `pricing-intake/references/`, and `unit-economics-checks.sql`.

**Confirmations, as `.pricing/context.md` would hold them:**

```text
- Net revenue = gross charges − refunds − disputes, before processor fees; tax excluded. [scope: Stripe acct; confirmed 2026-10-20; founder]
- Month boundary = Europe/London. [scope: all reporting; confirmed 2026-10-20; founder]
- Ad spend source = platform exports; card used as a tie only. [scope: Meta, Google; confirmed 2026-10-20; founder]
- Acquisition costs also include: Apollo, Clay, "Growth Freelance Ltd". [scope: full CAC; confirmed 2026-10-20; founder]
- New customer = first successful paid charge. [scope: all; confirmed 2026-10-20; founder]
```

## Plugin content (no harness code)

- **Intake addition:** a short "which exports" checklist, with the click path for each file and why it's needed. This is the "explain it" piece. Founders don't know which Stripe report to download.
- **`unit-economics-checks.sql` template:**
  - row arithmetic
  - gross-to-net bridge
  - payout tie against the second file
  - unlinked rows
  - mixed currency
  - UTC month shift
  - ad-export spend by platform and month, with total rows excluded
  - card charges by merchant pattern, and the tie against ad spend
  - new customers by month
  - CAC blended and linked

  Flags and counts only, as the v1 SQL showed.

## One small harness change

`data_workspace.py:89` refuses non-UTF-8 CSVs ("convert explicitly before import"). Google Ads UI exports are reportedly UTF-16 (third-party source; check against a real file first). If confirmed, accept UTF-16 by decoding into the cache as UTF-8. That's a few lines plus a fixture test. Title rows are already handled by `header_row`. Totals rows are left to the template and the evals.

## Synthetic data: same technique as `make_saas.py`

`tests/evals/generators/make_saas.py` writes a seeded fictional company with planted hidden truths, a `--clean` copy, a trapped copy and a `--key` file of every planted row. A new `make_founder.py` keeps that pattern, but simulates **events** and writes them in **export shapes**:

**World (seeded):**
- About 300 customers over 18 months.
- Monthly and annual plans; a coupon.
- Channels: Meta, Google, organic, referral. UTM metadata on about 60% of customers, and only on the first charge for some, mimicking a link lost on renewal.
- Daily ad spend per platform; a card with threshold billing and a rising threshold.
- Refunds, a dispute and its reversal, two currencies, one instant payout.
- Tools and a freelancer paid on the same card.

**Hidden truths (the build fails if they stop showing):**
- Google brings customers at twice Meta's CAC but with half the churn, so its payback is better. This answers "what is working".
- Blended CAC looks flat while paid CAC rises.

**Rendered exports, each with a confidence tag in the README:**

| File | Schema source | Confidence |
|---|---|---|
| `stripe_balance.csv` (itemised) | Stripe docs column list | High |
| `stripe_payout_reconciliation.csv` | Stripe docs | High |
| `stripe_subscriptions.csv` | Third-party guides | Low |
| `stripe_payouts.csv` / `bank.csv` | Not found / guessed | Low |
| `meta_ads.csv` (day breakdown, `Amount spent (GBP)`) | Third-party | Medium |
| `google_ads.csv` (UTF-16, title rows, `Total:` row) | Guess, partly third-party | Low |
| `amex.csv`, `ramp.csv`, `wise.csv` | Third-party parsers; Ramp docs | Medium |

**Traps (trapped copy, listed in the key):**
- annual cash in a single month
- a UTC month shift
- an invoice and charge for the same sale
- tax inside `gross` for one country
- a card charge with FX fee
- Meta threshold charges not matching monthly spend
- a Google `Total:` row
- duplicate rows from overlapping exports
- a test-mode row
- spend present in both the ad export and the card

**Expected answers by construction:**
- MRR by month
- the net revenue bridge
- the payout tie residual (zero, except one planted gap)
- the card-versus-ad tie residual by cause
- blended CAC, paid and full
- linked per-channel CAC and payback
- the linked share

**Cases** (following `tests/evals/cases`):
- the payout tie
- MRR with annual plans
- revenue versus cash explained
- blended CAC with the double-count avoided
- the refusal of per-channel CAC for unlinked customers
- "what is working"
- the full report

Oracle first, at no cost; live runs need approval.

## Build order

| Step | What | Size | Gate |
|---|---|---|---|
| 0 | Get one real export each: Stripe test mode (balance, subscriptions, payouts), Meta, Google Ads, one card or bank | Done for Stripe and Meta (2026-10-19); Google is customisable | none |
| 1 | Card additions A1–A4 | ~40 lines | none |
| 2 | `make_founder.py` plus clean and trapped inputs, schemas from step 0 where available | Done, merged in PR #4 | none |
| 3 | SQL template plus intake checklist | Done on `feat/founder-sql` (2026-10-19): `references/unit-economics-checks.sql` (C1–C13), `pricing-intake/references/payment-and-spend-exports.md`, tested against the answer key | none |
| 4 | Cases, then oracle | Done on `feat/founder-sql` (2026-10-19): fo-1 to fo-6 with `contexts/founder.md`, `solutions/founder.py`; oracle 90/90. The full report case was left out (the six cover its sections) | none |
| 5 | UTF-16 import, if step 0 confirms it | Done on `feat/founder-sql` (2026-10-19): a UTF-16 byte-order mark is detected and decoded into the cache (data tool 0.1.2). Title and date-range rows above the header are now skipped too (`data_workspace.header_row`, used by the query server and data findings, findings VERSION 11), with a note to the agent; total rows stay as data for the checks to exclude | step 0 |
| 6 | Live run (Haiku high) | none | budget approval |
| 7 | Harness detector, only if step 6 shows the model failing the checks | S–M | step 6 |

The five-founder niche test (ROADMAP 3b) can run in parallel with steps 1–4. It decides whether we go past step 6.

## Open questions for the owner

1. Can you produce the step 0 real exports? Even one Meta file and one Stripe test-mode account would replace most of the low-confidence schemas.
2. Is three Stripe files acceptable friction for founders (balance, subscriptions, payouts)? Without the subscriptions export there is no true MRR; without payouts there is no cash tie.
3. Should the report be the HTML report from the existing reference, or a new single-page "founder report" layout?

## Appendix: real exports (2026-10-19)

The owner pulled real files from Stripe (EUR account) and a Meta template into `docs/references/`. They contain personal data (name, email, address). They are not git-ignored, so keep them out of the public repo.

**Headers confirmed.** These replace guesses in the generator:
- **Balance change from activity, itemised:** `balance_transaction_id, created, available_on, currency, gross, fee, net, reporting_category, description`.
  - The date columns are `created` and `available_on`, not `*_utc`. This version applies the chosen time zone.
  - Only the default columns came through. A founder must add `customer_id`, `customer_email`, `invoice_id`, `subscription_id` and `charge_id` under Columns, so the intake checklist has to say so.
- **Payouts, itemised:** `payout_id, effective_at, currency, gross, fee, net, reporting_category, balance_transaction_id, description, payout_expected_arrival_date, payout_status`.
- **Balance summary:** `category, description, net_amount, currency`. Categories run from `starting_balance` through `activity_gross`, `activity_fee`, `activity`, `payouts_gross`, `payouts_fee`, `payouts` to `ending_balance`.
  - This is the founder's one-glance cash bridge, and it is cheap to tie the itemised files to.
- **Subscriptions export** (Dashboard):
  - Title-case headers: `Customer ID`, `Customer Email`, `Plan` (a price ID), `Product`, `Quantity`, `Currency`, `Interval`, `Amount`, `Status`.
  - Date columns: `Created (UTC)`, `Start (UTC)`, `Current Period Start/End (UTC)`, `Trial Start/End (UTC)`, `Canceled At (UTC)`, `Ended At (UTC)`.
  - Other columns: `Cancel At Period End`, `Coupon`, `Inclusive/Exclusive Tax Rate`, `Automatic Tax Enabled`.
  - **This export confirms MRR is possible:** `Interval` + `Amount` + `Quantity`.
- **Invoices export** (Dashboard): 50+ columns.
  - Useful ones: `Subscription`, `Period Start/End (UTC)`, `Minimum Line Item Period Start`, `Maximum Line Item Period End`, `Subtotal`, `Total Discount Amount`, `Tax`, `Inclusive/Exclusive Tax Amount`, `Total`, `Amount Paid`, `Status`, `Customer Address Country`.
  - It also carries full customer addresses (personal data).
- **Meta Ads (campaign level, no day breakdown):**
  - Delivery and attribution: `Reporting starts, Reporting ends, Campaign name, Campaign delivery, Attribution setting`.
  - Results: `Results, Result indicator, Cost per results`.
  - Budget: `Ad set budget, Ad set budget type`.
  - Spend and reach: `Amount spent (EUR), Impressions, Reach, Ends`.
  - Initial results: `Results (initial), Results (initial) indicator`.

**Surprises that matter:**
1. **Dashboard exports use locale number formats.** `Amount` is `"500,00"` and the invoice total is `"1000,00"`, with a decimal comma. The Reports exports use a decimal point. A founder in Germany gets mixed formats in one bundle. The harness already flags mixed separators (metric verification, Parsing), and the generator must plant this trap.
2. **Two date styles.** Dashboard exports use `YYYY-MM-DD HH:MM` with no seconds and `(UTC)` in the header. Reports use the chosen time zone.
3. **The Meta default has no daily rows.** Without a Day breakdown, one row spans the whole range, so monthly CAC needs either a Day/Month breakdown or one export per month. The intake checklist must say "add Breakdown → By time → Month".
4. **The test-mode data is too thin to test anything.** One annual subscription (500/year) and a draft invoice. The invoice's `Total` of 1000 against a 500/year plan, with line items spanning 2026-10-19 to 2028-10-19, is unexplained (two periods?). The ledger and payouts files are empty. The headers are all we get; the generator supplies the volume.

## Synthetic data: built (2026-10-19)

`tests/evals/generators/make_founder.py` (uncommitted) builds the data described under "Synthetic data", using the real headers above.

**Range and growth:** April 2022 to September 2026.
- 200 sign-ups in the launch month, growing about 6.5% a month to about 5,800 a month.
- Seasons: a January surge (+35%), a summer trough (−30% in August) and a quiet December.
- Random month-to-month swings, plus two shocks: a press feature in March 2023 and a Meta account suspension in October 2024.
- Ad budgets follow the planned trend and season, not the swings, so CAC is volatile month to month.

**Scale:** `--scale X` multiplies every month.

| Build | Scale | Customers | Rows | Size | Time and memory |
|---|---|---|---|---|---|
| Committed eval sets (`inputs/founder`, `inputs/founder-clean`) | 0.02 | 1,651 | about 10k ledger rows | about 9 MB each | under 1 s |
| Full build (`.cache/eval-data/founder-full`, `founder-full-clean`) | 1 | 86,882 | 514k ledger, 554k invoices, 1.17M in all | 429 MB | 43 s, 2.6 GB |

At full scale, paying customers grow from 136 to 43,180, and MRR from €9k to €3.09M.

**Checked on the full clean build and the committed set:**
- Ledger rows hold net = gross − fee.
- The summary ties to the ledger and payouts, and the ending balance is not negative.
- Invoice numbers are unique, and every charge has its invoice with the same total.
- Nothing falls after the end date.
- The ad exports equal the truth spend.
- Card ad charges equal ad spend, apart from Meta spend in the last days that has not yet reached Meta's billing threshold.
- Truth charges equal ledger charges, and both copies give identical truth.
- The byte-for-byte rebuild test passes (22/22).

**Planted truths, asserted at build** (1 failure in 60 seeded runs, at scale 0.02 only):
- Google CAC is at least 1.5 times Meta's, yet only Google pays back: about 15 months at full scale, while Meta never pays back.
- Paid CAC rises at least 20%, and blended CAC hides at least 25 points of that rise.

**Assumptions still unverified,** to replace when real files exist:
- the sign of payout rows
- the date format in the Reports exports
- the Google layout
- Amex columns and date format
- Meta's `FACEBK *` descriptor
- Meta's result-indicator name

## Customisable exports (Google Ads, and Meta too)

Google Ads lets the user pick any columns, so no fixed schema exists. Meta is customisable too. The design must not depend on column positions or names. The smallest approach that works:

1. **Ask for a minimal report.** The intake checklist tells the founder exactly what to pick: Day (or Month), Campaign, Cost, Currency code. Fewer columns mean fewer surprises.
2. **Map by meaning, confirm once.** The agent reads whatever headers arrive and proposes a mapping, for example `Cost → spend`, `Day → date`, account currency → EUR. The user confirms it, and intake stores it in `.pricing/context.md` per platform. This reuses the existing confirm flow, so it needs no new code.
3. **Flag what the mapping can't settle:** a missing date grain, a missing currency, total or title rows, UTF-16 encoding. The SQL template excludes rows whose campaign starts with `Total`, and counts them.
4. **The generator renders each platform in 2–3 variants:** different column sets and orders, with or without title and total rows, by day or by month. The evals then test the mapping, not one fixed layout.

## Appendix: schema evidence (2026-10-18 research)

**Stripe** (official docs; no sample files exist):
- Balance and payout reconciliation itemised reports, with column lists. Amounts are in major units.
- Payouts appear as rows in the balance report.
- `automatic_payout_id` is set only on automatic payouts.
- No interval or plan column in the balance report.
- `withheld_tax` (tax on fees) sits inside `fee`.
- `tax_collected` is an optional column; whether `gross` includes customer VAT is unknown.
- Test-mode report availability is unconfirmed.
- The nearest public data is the `fivetran/dbt_stripe` seeds (Apache-2.0): API-shaped, minor units, partly filler.

**Ads:**
- **Meta:** headers per a third-party importer; currency is in the header name; a day breakdown is needed for daily rows; attribution windows changed in 2025–26.
- **Google:** the UI CSV is UTF-16 per a related Google help page; title and total rows unverified. The API's `cost_micros` divides by 10⁶, in the account currency.
- **LinkedIn:** CSV only (official), headers not listed.
- **TikTok:** day breakdown; field names come from connectors.
- No public real UI exports were found; Kaggle has one Facebook clicks set (licence unchecked).

**Card and bank:**
- **Amex** and **Wise** columns come from parser repos.
- **Ramp** default columns are official, including original currency and conversion rate.
- **Chase** sign convention is disputed.
- **Mercury**, **Brex** and **Revolut** headers were not found.
- **Merchant strings:**
  - Google `GOOGLE *ADS<id>` is official.
  - Meta's `FACEBK *` is unverified.
- **Billing:**
  - Meta: threshold billing (rising threshold) plus a monthly bill date; manual accounts have none.
  - Google: 30 days or threshold, whichever comes first.
- **Ad VAT:** reverse charge applies when a VAT number is on the account (third-party UK sources).

**Linking:**
- Payment Links accept UTMs; invalid ones are dropped silently (official).
- `client_reference_id` is a free string.
- A channel set only on the Checkout session is lost on renewals unless it is copied to the Customer.
