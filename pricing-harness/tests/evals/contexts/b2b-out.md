# Pricing context: Halden Supply (fictional test data)
Scope: all files in this folder
Last updated: 2026-10-01

## Data
- Halden Supply is a fictional industrial distributor; this data is synthetic. All amounts are in GBP. [confirmed 2026-10-01; finance]
- invoices.csv has one row per invoice line. quantity counts the unit in unit_of_measure: each, case (products.case_size eaches) or pack24 (24 eaches); unit_price is per unit of measure. Dates are invoice dates; years and quarters are calendar ones. [confirmed 2026-10-01; finance]
- List value = quantity in eaches × list_price. Invoiced value = line_value. Tier discount = list value × tier_discount_pct / 100. Invoice discount = list value − tier discount − invoiced value. [confirmed 2026-10-01; finance]
- Pocket value = invoiced value − freight_cost − terms_discount − the line's share of its customer's rebate for that quarter (rebates.csv, shared across the customer's lines in the quarter in proportion to invoiced value). Pocket price = pocket value ÷ quantity. [confirmed 2026-10-01; finance]
- Total discount on a line = tier_discount_pct + invoice_discount_pct. policy.md holds the approval limits and the floor. [confirmed 2026-10-01; finance]
- An invoice line repeated exactly (every column the same) is a duplicate and counts once. [confirmed 2026-10-01; finance]
- A customer's price index = invoiced value ÷ list value over all their lines. Customers are compared with size-matched peers: the median price index of the other customers in the same size_band. The gap in GBP = (index − peer median) × the customer's list value. A customer counts as out of line when its index is at least 10 points from its peers' median. [confirmed 2026-10-01; finance]

## Change log
- 2026-10-01: added the data facts.
