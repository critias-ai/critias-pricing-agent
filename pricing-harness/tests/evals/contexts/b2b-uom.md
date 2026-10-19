# Pricing context: Halden Supply (fictional test data)
Scope: all files in this folder
Last updated: 2026-10-01

## Data
- Halden Supply is a fictional industrial distributor; this data is synthetic. All amounts are in GBP. [confirmed 2026-10-01; finance]
- invoices.csv has one row per invoice line. quantity counts the unit in unit_of_measure: each, or case (products.case_size eaches); unit_price is per unit of measure, and line_value = quantity × unit_price. Dates are invoice dates; years are calendar years. [confirmed 2026-10-01; finance]
- Revenue = line_value. [confirmed 2026-10-01; finance]

## Change log
- 2026-10-01: added the data facts.
