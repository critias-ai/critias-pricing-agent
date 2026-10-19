# Pricing context: Adventure Works Cycles (Microsoft's fictional sample company)
Scope: all files in this folder
Last updated: 2026-10-01

## Data
- Adventure Works Cycles is Microsoft's fictional sample company; the files are exports of its sample database. All amounts are in USD. [confirmed 2026-10-01; finance]
- SalesOrderHeader.csv has one row per order and SalesOrderDetail.csv one row per order line. OnlineOrderFlag 1 is an internet order, 0 a reseller order. A reseller is a customer with a StoreID; its name is Store.Name where BusinessEntityID = StoreID. [confirmed 2026-10-01; finance]
- Fiscal years run July to June and are named by the year they end: FY2025 is 2024-07-01 to 2025-06-30. Orders are dated by OrderDate. [confirmed 2026-10-01; finance]
- A line's list price is the one in force on its order date: the ProductListPriceHistory row with the latest StartDate on or before the order date. List value = OrderQty × list price. Its standard cost is found the same way in ProductCostHistory. [confirmed 2026-10-01; finance]
- UnitPrice is the price charged before any special-offer discount, so channel concession = list value − OrderQty × UnitPrice. Offer discount = OrderQty × UnitPrice × UnitPriceDiscount. LineTotal is the line's net sales, and SubTotal is the sum of an order's LineTotals. [confirmed 2026-10-01; finance]
- Freight and TaxAmt are charged to the customer on top of SubTotal. Freight is ours; tax is passed on to the authorities. [confirmed 2026-10-01; finance]
- Gross margin = (net sales − OrderQty × standard cost) ÷ net sales. Products roll up to subcategories and categories through ProductSubcategoryID and ProductCategoryID. [confirmed 2026-10-01; finance]
- pricing_policy.md holds the margin floors, special-offer rules and how list price changes are made. [confirmed 2026-10-01; pricing]

## Change log
- 2026-10-01: added the data facts.
