# Pricing context: Halden Supply (fictional test data)
Scope: all files in this folder
Last updated: 2026-10-01

## Data
- Halden Supply is a fictional industrial distributor; this data is synthetic. All amounts are in GBP. [confirmed 2026-10-01; finance]
- invoices.csv has one row per invoice line; quantities are in eaches. list_price is our list price per each when the line was invoiced; unit_price and line_value are what we invoiced. msrp is the shelf price we recommend to resellers. Years are calendar years. [confirmed 2026-10-01; finance]
- Price realization = invoiced value ÷ list value, where list value = quantity × list_price. Margin = (invoiced value − quantity × unit cost) ÷ invoiced value. [confirmed 2026-10-01; finance]
- cost_history.csv holds unit costs: each row applies from effective_from until the sku's next row. [confirmed 2026-10-01; finance]

## Change log
- 2026-10-01: added the data facts.
