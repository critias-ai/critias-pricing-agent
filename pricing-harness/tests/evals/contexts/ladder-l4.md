# Pricing context: Fernhill Homewares (fictional test data)
Scope: all products and customers in sales.csv
Last updated: 2026-10-01

## Data
- Each row of sales.csv is one invoice line, in GBP. [scope: sales.csv; confirmed 2026-10-01; finance]
- Net sales = quantity × net_price. list_price is before discount and is not used for margin. [confirmed 2026-10-01; finance]
- Gross profit = quantity × (net_price − unit_cost). [confirmed 2026-10-01; finance]
- Returns (negative quantities) are left out of margin figures. [confirmed 2026-10-01; finance]
- Dates are invoice dates; quarters are calendar quarters. [confirmed 2026-10-01; finance]

## Change log
- 2026-10-01: added the data facts.
