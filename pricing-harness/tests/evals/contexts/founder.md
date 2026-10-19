# Pricing context: Kiezly (fictional test data)
Scope: all files in this folder
Last updated: 2026-10-19

## Data
- Kiezly is a fictional Berlin SaaS company; this data is synthetic. Amounts are in EUR unless a file says otherwise. [confirmed 2026-10-19; founder]
- Months follow Europe/Berlin time. The balance and payout files are in Berlin time; the invoices and subscriptions exports are in UTC and use decimal commas. [confirmed 2026-10-19; founder]
- Cash bridge lines come from the balance activity file: charges, refunds and disputes (with reversals) at their gross amounts; processor fees are the whole fee column (dispute fees included) plus the usage-fee rows; then net settled. Payouts come from the payouts file: the amount sent to the bank is the gross column, shown as a positive amount; an instant payout's fee is a separate cost. [confirmed 2026-10-19; founder]
- MRR at a month end = for each paid invoice whose line-item period covers the instant the month ends (midnight, Berlin time), its subtotal less discounts (before tax), spread evenly over the months the period covers. USD invoices count at the EUR amount their charge settled for. [confirmed 2026-10-19; founder]
- A new customer is counted in the month of their first charge with a positive amount. Their channel is the utm_source on that charge; none means unknown. [confirmed 2026-10-19; founder]
- Ad spend comes from the Meta and Google exports. The Amex card is only a check on those; its Meta and Google charges are not counted again. Other acquisition costs are the card lines for APOLLO.IO, CLAY LABS and UPWORK. [confirmed 2026-10-19; founder]
- Blended CAC for a month = Meta and Google spend plus other acquisition costs in that month ÷ new customers that month. A platform's CAC = its spend in the period ÷ new customers whose channel is that platform. [confirmed 2026-10-19; founder]
- Payback contribution = each paid invoice's subtotal less discounts (EUR, before tax) less the processor fee on its charge, spread evenly over the months it covers. A cohort's payback month is the first month, counting the customer's first paid month as 1, in which cumulative contribution per customer reaches the cohort's CAC. [confirmed 2026-10-19; founder]

## Change log
- 2026-10-19: added the data facts.
