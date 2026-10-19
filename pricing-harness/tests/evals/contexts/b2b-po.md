# Pricing context: Halden Supply (fictional test data)
Scope: all files in this folder
Last updated: 2026-10-01

## Data
- Halden Supply is a fictional industrial distributor; this data is synthetic. All amounts are in GBP. [confirmed 2026-10-01; finance]
- invoices.csv has one row per invoice line; quantities are in eaches and prices are per each. Invoiced value = line_value. [confirmed 2026-10-01; finance]
- Pocket value = invoiced value − freight_cost − terms_discount − the line's share of its customer's rebate for that quarter (rebates.csv, shared across the customer's lines in the quarter in proportion to invoiced value; a customer with no rebates.csv row for a quarter had no rebate that quarter). Pocket margin = (pocket value − quantity × standard_cost) ÷ pocket value. [confirmed 2026-10-01; finance]
- When we compare a product's pocket margin with its peers, the reference is the median of the peer products' pocket margins (each product's margin over all its lines), weighted by their pocket value, the product itself excluded: sort the peer products by pocket margin and take the margin of the first one at which cumulative pocket value reaches half of the peers' total. The gap in GBP = (product's pocket margin − reference) × its pocket value. Peers are the whole catalogue unless a question names a family. [confirmed 2026-10-01; finance]

## Change log
- 2026-10-01: added the data facts.
