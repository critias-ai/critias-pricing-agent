# Pricing context: UK online giftware retailer (public UCI Online Retail II data)
Scope: all files in this folder
Last updated: 2026-10-01

## Data
- The sales files are the public UCI Online Retail II dataset, used here as our sales export; unit_costs.csv is our cost file. All amounts are in GBP. [confirmed 2026-10-01; finance]
- The sales export is one workbook with two sheets, Year 2009-2010 and Year 2010-2011 (saved as CSV, online_retail_2009_2010.csv and online_retail_2010_2011.csv), one row per invoice line; Price is the unit price per item and line value = Quantity × Price. The sheets overlap for 2010-12-01 to 2010-12-09: take those days from the Year 2009-2010 sheet only. [confirmed 2026-10-01; finance]
- Rows repeated exactly (every column the same) within a sheet are export duplicates: count each once. [confirmed 2026-10-01; finance]
- Products have a StockCode of five digits followed by up to two letters, and StockCode is not case-sensitive (85123a is 85123A). Every other code is not a product sale: POST and DOT are carriage we charge customers; the rest (M, D, S, B, C2, AMAZONFEE, BANK CHARGES, ADJUST, gift vouchers, DCGS and TEST codes) are adjustments, fees and tests. [confirmed 2026-10-01; finance]
- Invoices starting with C are cancellations, refunded in full and with the goods back in stock. Product net revenue = product lines on ordinary invoices with a positive quantity, plus product lines on cancellation invoices. Negative quantities on ordinary invoices are stock write-offs, not sales: leave them out. Lines priced at zero are free items. [confirmed 2026-10-01; finance]
- unit_costs.csv gives each product's unit cost from its effective_from date until the next one; cost a line at the cost in force on its invoice date. Cost of goods = quantity × unit cost on the lines counted in net revenue. Gross profit = net revenue − cost of goods; margin = gross profit ÷ net revenue. [confirmed 2026-10-01; finance]
- Years are calendar years. The data runs from 2009-12-01 to 2011-12-09. A blank Customer ID is a guest order. [confirmed 2026-10-01; finance]
- Picking and shipping costs us £8.00 per ordinary invoice that has product lines. [confirmed 2026-10-01; operations]
- Like-for-like price change compares January to November 2011 with January to November 2010, on products sold in both: each product's average selling price (revenue ÷ quantity over its product lines on ordinary invoices with a positive quantity and a price above zero), weighted by its 2011 quantity. [confirmed 2026-10-01; finance]
- accounts.csv lists our customers with their size_band, account_manager and terms. [confirmed 2026-10-01; sales]
- A product's reference price is the median Price of its 2011 product lines on ordinary invoices with a positive quantity and a price above zero. A customer's price index = what they paid ÷ the same quantities at reference prices, over those lines in 2011. Customers are compared with size-matched peers: the median index of the other customers in the same size_band. The gap in GBP = (index − peer median) × the customer's value at reference prices. A customer counts as out of line when its index is at least 10 points from its peers' median. [confirmed 2026-10-01; finance]

## Change log
- 2026-10-01: added the data facts.
