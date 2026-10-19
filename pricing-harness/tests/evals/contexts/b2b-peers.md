# Pricing context: Halden Supply (fictional test data)
Scope: all files in this folder
Last updated: 2026-10-01

## Data
- Halden Supply is a fictional industrial distributor; this data is synthetic. All amounts are in GBP. [confirmed 2026-10-01; finance]
- invoices.csv has one row per invoice line; quantities are in eaches and prices are per each. List value = quantity × list_price; invoiced value = line_value. [confirmed 2026-10-01; finance]
- A customer's price index = invoiced value ÷ list value over all their lines. Its peers are the other customers in the same segment (customers.segment). The peer reference is the peers' median index weighted by list value: sort the peers by index and take the index of the first one at which cumulative list value reaches half of the peers' total. The gap in GBP = (index − reference) × the customer's list value. A customer is out of line when its index is at least 10 points from its reference. [confirmed 2026-10-01; finance]
- Product margin = (invoiced value − quantity × standard_cost) ÷ invoiced value, over all of the product's lines. [confirmed 2026-10-01; finance]

## Change log
- 2026-10-01: added the data facts.
