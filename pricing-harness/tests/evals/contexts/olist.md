# Pricing context: Olist marketplace (public Olist e-commerce data)
Scope: all files in this folder
Last updated: 2026-10-01

## Data
- The files are the public Olist dataset of a Brazilian online marketplace, used here as our exports. All amounts are in BRL. [confirmed 2026-10-01; finance]
- olist_order_items_dataset.csv has one row per item sold. price is the item's price; freight_value is the freight charged to the customer for that item, which we pass on to the carrier. An order's payments cover its items' price and freight. [confirmed 2026-10-01; finance]
- Sales are items on orders whose order_status is neither canceled nor unavailable. Orders are dated by order_purchase_timestamp. [confirmed 2026-10-01; finance]
- Regions are Brazil's five, by state: North AC, AP, AM, PA, RO, RR, TO; Northeast AL, BA, CE, MA, PB, PE, PI, RN, SE; Centre-West DF, GO, MT, MS; Southeast ES, MG, RJ, SP; South PR, RS, SC. A customer's region comes from customer_state. [confirmed 2026-10-01; finance]
- A seller's price index in a product category = its average item price in that category ÷ the median item price of all sales in that category by sellers in the same seller_state. A seller charges well above its peers in a category when the index is 2.0 or more on at least 10 items sold. [confirmed 2026-10-01; pricing]
- We have no product cost data. [confirmed 2026-10-01; finance]

## Change log
- 2026-10-01: added the data facts.
