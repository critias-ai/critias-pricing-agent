"""Independent evaluator arithmetic. Never distributed with the application."""
from collections import defaultdict
from decimal import Decimal
from fractions import Fraction


def compute_margin_oracle(rows):
    products = defaultdict(lambda: [Decimal(0), Decimal(0)])
    groups = defaultdict(lambda: [Decimal(0), Decimal(0)])
    for row in rows:
        if not row.get("cogs"):
            raise ValueError("missing cost: confirm coverage before calculating margin")
        revenue, cost = Decimal(row["revenue"]), Decimal(row["cogs"])
        for totals in (products[(row["year"], row["group"], row["product"])], groups[(row["year"], row["group"])]):
            totals[0] += revenue
            totals[1] += cost
    result = []
    for (year, group, product), (revenue, cost) in sorted(products.items()):
        group_revenue, group_cost = groups[(year, group)]
        if revenue <= 0 or group_revenue <= 0:
            raise ValueError("non-positive denominator: treatment needs confirmation")
        margin = (revenue - cost) / revenue
        benchmark = (group_revenue - group_cost) / group_revenue
        bps = (margin - benchmark) * Decimal(10000)
        result.append(dict(year=year, group=group, product=product, revenue=revenue,
                           cogs=cost, margin=margin, group_margin=benchmark,
                           deviation_bps=bps, outlier=abs(Fraction(revenue-cost)/Fraction(revenue)-Fraction(group_revenue-group_cost)/Fraction(group_revenue))*10000 >= 500,
                           detail_needed=revenue > 50000))
    return result
