# Pricing context: Fernhill Homewares (fictional test data)
Scope: all products and customers in sales.csv
Last updated: 2026-10-01

## Data
- Each row of sales.csv is one invoice line, in GBP. [scope: sales.csv; confirmed 2026-10-01; finance]
- Net sales = quantity × net_price. list_price is before discount and is not used for margin. [confirmed 2026-10-01; finance]
- Gross profit = quantity × (net_price − unit_cost). [confirmed 2026-10-01; finance]
- Negative quantities are returns and stay in every total. [confirmed 2026-10-01; finance]
- Dates are invoice dates; quarters are calendar quarters. [confirmed 2026-10-01; finance]

## Other company facts
- Head office is in Leeds. [confirmed 2026-01-10; operations]
- The financial year runs January to December. [confirmed 2026-02-11; operations]
- Payment terms are 30 days for trade customers. [confirmed 2026-03-12; operations]
- Customer C005 pays on 60-day terms by agreement. [confirmed 2026-04-13; operations]
- Warehouse stock counts happen every quarter. [confirmed 2026-05-14; operations]
- Prices are reviewed each February. [confirmed 2026-06-15; operations]
- Garden lines are seasonal, with peak sales from April to July. [confirmed 2026-07-16; operations]
- Kitchen SKUs K01 to K08 come from two suppliers. [confirmed 2026-08-17; operations]
- Storage unit costs exclude inbound freight; add 4% of unit cost to Storage unit cost. [confirmed 2026-09-18; operations]
- Marketing spend is budgeted by category but booked centrally. [confirmed 2026-01-10; operations]
- Gift cards are not in sales.csv. [confirmed 2026-02-11; operations]
- The online shop launched in 2019. [confirmed 2026-03-12; operations]
- Staff discounts are not recorded as sales. [confirmed 2026-04-13; operations]
- Delivery charges to customers are not in sales.csv. [confirmed 2026-05-14; operations]
- Customer IDs are stable across years. [confirmed 2026-06-15; operations]
- SKU codes are never reused. [confirmed 2026-07-16; operations]
- The Kitchen buyer changed in March 2025. [confirmed 2026-08-17; operations]
- Prices are set centrally for all customers. [confirmed 2026-09-18; operations]
- Promotions are approved by the commercial director. [confirmed 2026-01-10; operations]
- Damaged stock write-offs are booked outside sales.csv. [confirmed 2026-02-11; operations]

## Change log
- 2026-10-01: added the data facts.
- 2026-09-15: added the other company facts.
