# Pricing context: Halden Supply (fictional test data)
Scope: all files in this folder
Last updated: 2026-10-01

## Data
- Halden Supply is a fictional industrial distributor; this data is synthetic. All amounts are in GBP. [confirmed 2026-10-01; finance]
- invoices.csv has one row per invoice line; quantities are in eaches and unit_price is the invoiced price per each. Dates are invoice dates; years and half-years are calendar ones. [confirmed 2026-10-01; finance]
- price_list.csv holds our list prices: each row applies from effective_from until the sku's next row. [confirmed 2026-10-01; finance]
- List value = quantity × list price. Invoiced value = line_value. Discount depth = 1 − invoiced value ÷ list value. [confirmed 2026-10-01; finance]

## Change log
- 2026-10-01: added the data facts.
