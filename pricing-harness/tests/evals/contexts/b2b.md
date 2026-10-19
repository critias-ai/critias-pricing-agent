# Pricing context: Halden Supply (fictional test data)
Scope: all files in this folder
Last updated: 2026-10-01

## Data
- Halden Supply is a fictional industrial distributor; this data is synthetic. All amounts are in GBP. [confirmed 2026-10-01; finance]
- invoices.csv has one row per invoice line; quantities are in eaches and prices are per each. Dates are invoice dates; years and quarters are calendar ones. [confirmed 2026-10-01; finance]
- List value = quantity × list_price. Invoiced value = line_value. Tier discount = list value × tier_discount_pct / 100. Invoice discount = list value − tier discount − invoiced value. [confirmed 2026-10-01; finance]
- Pocket value = invoiced value − freight_cost − terms_discount − the line's share of its customer's rebate for that quarter (rebates.csv, shared across the customer's lines in the quarter in proportion to invoiced value). Pocket price = pocket value ÷ quantity. [confirmed 2026-10-01; finance]
- Total discount on a line = tier_discount_pct + invoice_discount_pct. policy.md holds the approval limits and the floor. [confirmed 2026-10-01; finance]

## Change log
- 2026-10-01: added the data facts.
