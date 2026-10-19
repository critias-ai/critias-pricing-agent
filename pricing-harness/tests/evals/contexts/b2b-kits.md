# Pricing context: Halden Supply (fictional test data)
Scope: all files in this folder
Last updated: 2026-10-01

## Data
- Halden Supply is a fictional industrial distributor; this data is synthetic. All amounts are in GBP. [confirmed 2026-10-01; finance]
- invoices.csv has one row per invoice line (invoice_id with line_no). Revenue = line_value. Cost of goods = quantity × products.standard_cost. Gross profit = revenue − cost of goods; margin = gross profit ÷ revenue. Years are calendar years. [confirmed 2026-10-01; finance]
- Kits (family Kits) are made of the products in kit_components.csv. A kit is invoiced either as one line, or as a line carrying the kit's price followed, on the same invoice, by its components at zero price. A kit's cost is the standard cost of its components. [confirmed 2026-10-01; finance]

## Change log
- 2026-10-01: added the data facts.
