---
name: recurring-metrics
description: "Knowledge card. Use for MRR, ARR, retention (NRR, GRR), cohorts and lifecycle movements of subscriptions, commitments and the recurring part of hybrid offers, and for cash-to-revenue bridges, payout and spend ties, and blended or per-channel CAC and payback."
---

# Recurring revenue, retention and lifecycle measures

- Use for recurring subscriptions, contractual commitments and the recurring portion of hybrid offers.

## Select the recipe

- Establish the shared recipe elements through [metric verification](metric-verification.md).
- Also establish treatment of discounts, tax, free or trial periods, past-due accounts, pauses, cancellation requests, expiry and reactivation.

**MRR**

- MRR is the monthly normalized eligible recurring amount under that recipe.
- An annual 1,200 recurring item contributes 100 per month. Its prepayment is cash or invoicing, not MRR.
- MRR at a month end is a point in time: the instant the month ends, in the confirmed time zone given by its name, not a fixed offset (daylight saving moves it). Count a period that starts at or before that instant and ends after it. Comparing dates double-counts a renewal on the last day.
- Setup, hardware and other one-time charges stay separate, unless a differently named company measure intentionally includes them.

**ARR**

- For a comparable monthly run rate, ARR may be defined as 12 × MRR.
- Distinguish it from forward contracted annual value, bookings, recognized revenue and trailing actual revenue.
- Use supplied finance policy for recognized amounts. Cadence normalization is not revenue recognition.

**Usage and commitments**

- Show separately: contracted minimums or commitments, consumed usage, rated or billed usage, and named trailing usage run rates.
- Metered revenue is not automatically included in, or excluded from, every provider's MRR.
- Reconcile recipe differences; never standardize them silently.

**Cash, billing and revenue**

- The [export checklist](../pricing-intake/references/payment-and-spend-exports.md) says which files to ask for.
- Processor payouts are cash, net of fees, refunds, dispute withdrawals and reserves. They are not revenue and not MRR.
- Show the gross-to-net bridge as separate lines: gross charges, refunds, disputes and reversals, processor fees, other adjustments, net settled. The user confirms which line their "revenue" means; a column or report name never settles it.
- Net settled ties to payouts only against an independent figure, such as a payouts report or bank deposits. Summing one ledger by its own payout key is not a tie.
- Rows not linked to any payout, and payouts not linked to any rows (such as instant payouts), are counted and valued, never dropped.
- An invoice and its charge are one sale. Count it once, by business key ([metric verification](metric-verification.md)).
- Ledger cash cannot give the billing interval. MRR needs the subscription or invoice-period record (see **MRR** above). Annual prepayments make cash run ahead of MRR.
- Confirm whether gross includes tax collected, and which time zone sets the month boundary.

## Opening-cohort retention

For a declared retention grain, horizon and policy, let C be the eligible opening cohort, b_i its opening recurring amount, e_i its eligible ending amount and B = sum(b_i) > 0:

```text
NRR = sum(e_i for i in C) / B
GRR = sum(min(b_i, e_i) for i in C) / B
```

- This endpoint recipe applies only when every included opening and ending amount is nonnegative.
- A negative credit balance makes it inapplicable until its treatment is confirmed or another applicable company recipe is selected. Never silently clamp accounting credits.
- Confirm grain and treatment of reactivation, replacements and FX.
- Account-level and item-level GRR can differ. Apply the chosen grain consistently.
- Exclude new customers outside C.
- A zero denominator gives an undefined result, not zero retention.

**Movement bridge**

- Reconcile opening to closing under the same recipe: new, expansion, contraction, churn, reactivation and other explicit movements.
- Document classification and netting conventions.
- Movement totals are not inherently interchangeable with endpoint GRR.

**Churn**

- Logo churn uses opening customers or accounts and a stated loss policy.
- Cancellation intent, paid-through service, payment failure and entitlement cessation are different events.
- Repeat retail purchase is a different measure.
- Short-horizon rates cannot become observed annual retention through automatic compounding.

## Supporting economics

- Separate observed cohort revenue or contribution from modeled lifetime value.
- For cohort acquisition cost (CAC), payback and lifetime economics, define:
  - the acquired cohort and acquisition window
  - included acquisition costs
  - contribution basis and timing
  - a finite observation or model horizon
- Payback is the time until cumulative cohort contribution on that basis recovers the applicable acquisition cost.
- Finite-horizon lifetime contribution sums the cohort's supported contribution over the declared horizon. Show acquisition cost separately or net it explicitly.
- Match cohort membership, costs and timing.
- This recipe applies to recurring and one-time offers. It does not need MRR, ARR or subscription churn.
- Incomplete outcomes or costs support a conditional estimate, not a precise observed lifetime value.
- Simple ARPA × margin / churn lifetime formulas need explicit stable-process assumptions.
- Acquisition spend has two records: the platform's spend report (accrued daily) and the card or bank charge (billed in batches, with lag, FX and possibly tax). Use one per platform for CAC and the other only as a tie. Counting both double-counts. Spend not yet billed at the export date is an expected tie residual; size it before tracing ([metric verification](metric-verification.md)).
- Confirm what makes a customer new. Zero-value trial invoices are not paid acquisitions.
- When costs carry no customer link, report blended CAC: included acquisition costs in a window ÷ new customers in the same window, with "new customer" and "included costs" confirmed. Paid-only and all-in versions are different measures; name them, and show both over time, because a growing unpaid share can hide rising paid CAC.
- Per-channel CAC needs a customer-level channel field, taken from the customer's first payment, since renewals may not carry it. Report it only for linked customers, and state the linked share. Never assign customers to channels from platform totals. Unlinked customers include organic and referral ones, so never split them across paid platforms. Linked-only CAC overstates every platform's true CAC; the ranking between platforms holds if they tag at similar rates, so state it with that condition rather than withholding it.
- Platform-reported conversions and revenue are not customer counts or billed revenue.
- Compare channels on payback or cohort contribution, not CAC alone. Retention differences can reverse a CAC ranking.
- Payback needs a confirmed contribution basis. Label a steady-state shortcut (CAC ÷ monthly contribution per new customer) as such, apart from observed cohort payback. A cohort that has not recovered its cost within the data has no observed payback; say so rather than extrapolating.
- Use [recurring scenarios](methods/recurring-scenarios.md) for rating, bridges and future cases.
