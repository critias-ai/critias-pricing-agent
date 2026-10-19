# Pricing context: Halden Supply (fictional test data)
Scope: all files in this folder
Last updated: 2026-10-01

## Data
- Halden Supply is a fictional industrial distributor; this data is synthetic. [confirmed 2026-10-01; finance]
- invoices.csv has one row per invoice line. unit_price and line_value are in the line's currency; prices_include_vat says whether they include VAT. Dates are invoice dates; years are calendar years. [confirmed 2026-10-01; finance]
- We report in GBP: convert a line at the latest fx_rates.csv rate (GBP per unit of currency) dated on or before its invoice date. [confirmed 2026-10-01; finance]
- Revenue is invoiced value in GBP before VAT. Cost of goods = quantity × products.standard_cost (GBP). Gross profit = revenue − cost of goods; margin = gross profit ÷ revenue. [confirmed 2026-10-01; finance]
- Customer groups are customers.customer_group. [confirmed 2026-10-01; finance]

## Change log
- 2026-10-01: added the data facts.
