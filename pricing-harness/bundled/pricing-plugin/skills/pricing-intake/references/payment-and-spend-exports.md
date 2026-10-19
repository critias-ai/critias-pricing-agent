# Payment and spend exports: what to download

Use when a founder wants MRR, cash, CAC or payback from their payment processor, ad platforms and card. Ask only for the files the question needs. For each file, say why it is needed and what is lost without it. Menu names change: if a path is not where it is described, ask the user what they see rather than guessing.

| Need | File | Why | Without it |
|---|---|---|---|
| Cash | Payment processor: itemised balance change from activity, the whole period | Every charge, refund, dispute and fee, with net settled | No gross-to-net bridge |
| Cash tie | Payment processor: itemised payouts; better, bank deposits | An independent figure to tie net settled to | The bridge cannot be tied |
| MRR | Payment processor: invoices export, or subscriptions export | Billing interval and service period | No MRR, only cash |
| Spend | Each ad platform: spend by day or month and campaign | Accrued spend for CAC | Only card charges, which lag spend |
| Other acquisition cost, spend tie | Card or bank statement | Tools, agencies and freelancers; ties ad spend to what was charged | CAC covers ads only |

**Payment processor (Stripe paths).**
- Balance activity: Reports → Balance → "Balance change from activity" → Download → Itemized. Under Columns, add `customer_id`, `charge_id`, `invoice_id` and any acquisition metadata such as `payment_metadata[utm_source]`. The default columns cannot join to customers.
- Payouts: the same report page → "Payouts" → Download → Itemized.
- Invoices: Billing → Invoices → Export, all columns, the whole period. Subscriptions: Billing → Subscriptions → Export. Dashboard exports can use the account's locale (decimal commas) and UTC; Reports use the chosen time zone. Confirm both.
- Set the same date range on every file.

**Ad platforms.** Ask for the smallest report: date (Day, or Month), campaign, spend and currency. Nothing else is needed for CAC.
- Meta Ads Manager: Reports → Export, with Breakdown → By time → Day (or Month). The default has one row for the whole range, which cannot give monthly CAC.
- Google Ads: Reports → a campaign report segmented by Day, downloaded as CSV. These downloads can carry a title row, a date-range row and total rows, and may be UTF-16 encoded.
- Platform conversions and results are not customers; the customer count comes from the payment processor.

**Card or bank.** The statement CSV for the same period. The agent proposes which merchant lines are ad-platform charges, other acquisition costs or neither; the user confirms the list once.

**Customer-to-channel link.** Per-channel CAC needs a channel on each customer's first payment, such as a UTM source in payment metadata. If none exists, report blended CAC and recommend capturing it at checkout.

Save each confirmed mapping (file → fields, time zone, number format, spend source per platform, merchant list, definition of a new customer) under [context format](context-format.md).
