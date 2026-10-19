# Confirmed context (fictional test data)

Fernhill Homewares is a fictional retailer; this data is synthetic. Each row of sales.csv is an invoice line in GBP.
Net sales = quantity × unit_price, and gross profit = quantity × (unit_price − unit_cost). Negative quantities are
returns and stay in every total. Dates are invoice dates; quarters are calendar quarters.
When we compare a product's margin with its peers, the reference is the peers' sales-weighted median gross margin over
the whole history, the product itself excluded: sort the peers by margin and take the margin of the first one at which
cumulative net sales reach half of the peers' total. The gap in GBP is (product margin − reference) × the product's net
sales. Peers are the whole range unless a question names a category.
