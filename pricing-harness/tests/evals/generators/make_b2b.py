"""Writes the fictional B2B distributor eval data (plan 2b, S2): python3 -I make_b2b.py <out dir> [seed, default 21] [--clean] [--key CSV].
Two years of quotes, won and lost, and the invoices of the won ones, for 60 customers and 40 products, with the price
waterfall: list price, tier discount by size band, a rep-chosen invoice discount, freight, a payment-terms discount and
quarterly off-invoice rebates. policy.md holds the approval matrix and the floor.
Business truth, in every copy: approvals at the wrong level, discounts beyond policy, one rep (R04) with a wide
discount spread, lines below the floor, and three small customers paying less than large ones for different reasons
(C027 a legacy contract, C028 R04's deep discounts, C029 a unit-of-measure error in the trapped copy only).
Data faults, left out by --clean: C029's quantities in cases priced per each, repeated lines, ×10 prices, line values
that don't match, an unknown customer, a lower-case rep code, text freight, packs of 24, future dates, quotes valid
before they were made and a rebate quarter in another format.
--key writes every planted row: plant, tbl, row_no (1 = first data row), scope (data or business)."""
import csv
import math
import random
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

FAMILIES = {"Fasteners": "F", "Adhesives": "A", "Safety": "S", "Tools": "T"}
TIER = {"small": Decimal("0"), "mid": Decimal("0.05"), "large": Decimal("0.10")}
VOLUME = {"small": (2, 30), "mid": (20, 120), "large": (80, 400)}
QUOTES = {"small": 30, "mid": 55, "large": 90}  # quotes per customer per year
REPS = ["R01", "R02", "R03", "R04", "R05"]
FLOOR = Decimal("1.10")  # pocket price at least standard cost × 1.10
POLICY = """# Discount policy (fictional test data)

Total discount means tier discount plus invoice discount, as a share of list price.

| Total discount | Who approves |
| --- | --- |
| up to 10% | the account's rep |
| over 10% and up to 20% | sales manager (M01) |
| over 20% and up to 30% | sales director (D01) |
| over 30% | not allowed |

Floor: pocket price (invoice price less freight, payment-terms discount and rebates, per unit) must be at least
standard cost × 1.10.
Tier discounts: small 0%, mid 5%, large 10%. Rebates are paid quarterly: large customers 3% and mid 1% of the
quarter's invoiced sales. Payment terms 2/10 net 30 give 2% off the invoice when paid early.
"""
cents = lambda x: Decimal(x).quantize(Decimal("0.01"))


def approver(total, rep):
    return rep if total <= Decimal("0.10") else "M01" if total <= Decimal("0.20") else "D01"


def generate(seed=21, clean=False):
    rng = random.Random(seed)
    products = []
    for family, p in FAMILIES.items():
        for i in range(1, 11):
            price = cents(rng.uniform(2, 80))
            products.append({"sku": f"{p}{100 + i}", "description": f"{family} item {i}", "family": family,
                             "case_size": 24 if family == "Safety" else 12, "list_price": price,
                             "standard_cost": cents(price * Decimal(str(round(rng.uniform(0.55, 0.72), 3))))})
    customers = []
    for n in range(1, 61):
        size = "small" if n <= 30 else "mid" if n <= 50 else "large"
        customers.append({"customer_id": f"C{n:03d}", "name": f"Customer {n:03d}", "size_band": size,
                          "rep": REPS[(n - 1) % 5], "contract_type": "standard",
                          "contract_start": str(date(2020 + n % 5, 1 + n % 12, 1)),
                          "payment_terms": "2/10 net 30" if n % 3 == 0 else "net 30"})
    legacy = customers[26]
    legacy.update(contract_type="legacy", contract_start="2018-03-01", rep="R02")
    customers[27]["rep"] = "R04"
    by_id = {c["customer_id"]: c for c in customers}

    quotes, invoices, plants = [], [], []
    start = date(2024, 1, 1)
    for c in customers:
        size, rep = c["size_band"], c["rep"]
        for _ in range(QUOTES[size] * 2):
            day = start + timedelta(days=rng.randrange(731))
            p = rng.choice(products)
            qty = rng.randint(*VOLUME[size])
            if c is legacy:
                disc = Decimal("0.22")
            elif rep == "R04":
                disc = Decimal(str(round(rng.uniform(0, 0.22), 3)))
            else:
                disc = Decimal(str(round(min(max(rng.gauss(0.04, 0.02), 0), 0.12), 3)))
            total = TIER[size] + disc
            who = "D01" if c is legacy else approver(total, rep)
            if c["customer_id"] == "C028" or (rep != "R04" and c is not legacy and rng.random() < 0.01):
                disc = Decimal(str(round(rng.uniform(0.21, 0.28), 3))) - TIER[size]
                total, who = TIER[size] + disc, rep  # beyond the rep's limit, approved by the rep
            elif c is not legacy and rep != "R04" and rng.random() < 0.004:
                disc = Decimal(str(round(rng.uniform(0.31, 0.36), 3))) - TIER[size]
                total, who = TIER[size] + disc, "D01"  # beyond policy
            unit = cents(p["list_price"] * (1 - total))
            # Win probability falls with price against the segment's usual price (list less tier less 4%).
            ref = p["list_price"] * (1 - TIER[size] - Decimal("0.04"))
            won = rng.random() < 1 / (1 + math.exp(12 * (float(unit / ref) - 1) - 0.4))
            qid = f"Q{len(quotes) + 1:05d}"
            quotes.append({"quote_id": qid, "quote_date": str(day), "valid_to": str(day + timedelta(days=30)),
                           "customer_id": c["customer_id"], "sku": p["sku"], "quantity": qty, "list_price": p["list_price"],
                           "discount_pct": f"{total * 100:.1f}", "quoted_price": unit, "rep": rep, "approver": who,
                           "status": "won" if won else "lost"})
            if not won:
                continue
            inv_day = day + timedelta(days=rng.randint(1, 14))
            value = cents(unit * qty)
            freight = cents(value * Decimal("0.03" if size == "small" else "0.02" if size == "mid" else "0.01"))
            terms = cents(value * Decimal("0.02")) if c["payment_terms"] == "2/10 net 30" else Decimal("0.00")
            invoices.append({"invoice_id": "", "invoice_date": str(inv_day), "customer_id": c["customer_id"], "sku": p["sku"],
                             "quote_id": qid, "quantity": qty, "unit_of_measure": "each", "list_price": p["list_price"],
                             "tier_discount_pct": f"{TIER[size] * 100:.1f}", "invoice_discount_pct": f"{disc * 100:.1f}",
                             "unit_price": unit, "line_value": value, "freight_cost": freight, "terms_discount": terms,
                             "rep": rep, "approver": who})
    quotes.sort(key=lambda r: (r["quote_date"], r["quote_id"]))
    invoices.sort(key=lambda r: (r["invoice_date"], r["quote_id"]))
    for i, r in enumerate(invoices):
        r["invoice_id"] = f"INV{100001 + i}"

    rebates, sales = [], {}
    for r in invoices:
        d = date.fromisoformat(r["invoice_date"])
        k = (r["customer_id"], f"{d.year}-Q{(d.month - 1) // 3 + 1}")
        sales[k] = sales.get(k, 0) + r["line_value"]
    for (cid, quarter), v in sorted(sales.items()):
        rate = {"large": Decimal("0.03"), "mid": Decimal("0.01")}.get(by_id[cid]["size_band"])
        if rate and quarter <= "2025-Q4":
            rebates.append({"customer_id": cid, "quarter": quarter, "rebate_amount": cents(v * rate)})

    # Business plants: the row sets an analysis should find.
    cost = {p["sku"]: p["standard_cost"] for p in products}
    rebate_rate = lambda cid: {"large": Decimal("0.03"), "mid": Decimal("0.01")}.get(by_id[cid]["size_band"], Decimal(0))
    for i, r in enumerate(invoices, 1):
        total = Decimal(r["tier_discount_pct"]) + Decimal(r["invoice_discount_pct"])
        limit = {"M01": 20, "D01": 30}.get(r["approver"], 10)
        if total > 30:
            plants.append(("biz_beyond_policy", "invoices", i, "business"))
        elif total > limit:
            plants.append(("biz_wrong_level_approval", "invoices", i, "business"))
        pocket = (r["line_value"] * (1 - rebate_rate(r["customer_id"])) - r["freight_cost"] - r["terms_discount"]) / r["quantity"]
        if pocket < cost[r["sku"]] * FLOOR:
            plants.append(("biz_below_floor", "invoices", i, "business"))
        if r["rep"] == "R04" and Decimal(r["invoice_discount_pct"]) > 15:
            plants.append(("biz_rep_r04_deep_discount", "invoices", i, "business"))
        if r["customer_id"] == "C027":
            plants.append(("biz_legacy_contract", "invoices", i, "business"))
    if not clean:
        invoices, quotes, rebates = trap(rng, invoices, quotes, rebates, products, plants)
    plants.sort(key=lambda p: (p[1], p[2], p[0]))
    return products, customers, quotes, invoices, rebates, plants


def trap(rng, invoices, quotes, rebates, products, plants):
    """Data faults on top of the truth. Rows are edited in place or appended, so row numbers stay meaningful."""
    rows = lambda pred: [i for i, r in enumerate(invoices) if pred(r)]
    plant = lambda name, tbl, idx: plants.extend((name, tbl, i + 1, "data") for i in idx)
    case = {p["sku"]: p["case_size"] for p in products}
    c029 = rows(lambda r: r["customer_id"] == "C029")
    for i in c029:  # quantity counted in cases, still priced per each: billed a twelfth of the goods
        r = invoices[i]
        r.update(unit_of_measure="case", quantity=max(1, r["quantity"] // case[r["sku"]]))
        r["line_value"] = cents(r["unit_price"] * r["quantity"])
    plant("data_uom_case_priced_each", "invoices", c029)
    free = rows(lambda r: r["customer_id"] != "C029")
    used = set()
    pick = lambda n, pool: [i for i in rng.sample([i for i in pool if i not in used], n) if not used.add(i)]
    shifted = pick(12, free)
    for i in shifted:
        r = invoices[i]
        r["unit_price"] = r["unit_price"] * 10
        r["line_value"] = cents(r["unit_price"] * r["quantity"])
    plant("data_price_x10", "invoices", shifted)
    wrong = pick(12, free)
    for i in wrong:
        invoices[i]["line_value"] = cents(invoices[i]["line_value"] * Decimal("1.1"))
    plant("data_line_value_mismatch", "invoices", wrong)
    unknown = pick(10, free)
    for i in unknown:
        invoices[i]["customer_id"] = "C099"
    plant("data_unknown_customer", "invoices", unknown)
    lower = pick(20, rows(lambda r: r["rep"] == "R03"))
    for i in lower:
        invoices[i]["rep"] = "r03"
    plant("data_rep_lowercase", "invoices", lower)
    text = pick(15, free)
    for i in text:
        invoices[i]["freight_cost"] = f"£{invoices[i]['freight_cost']}"
    plant("data_freight_as_text", "invoices", text)
    packs = pick(8, rows(lambda r: r["sku"].startswith("S") and r["quantity"] >= 48 and r["customer_id"] != "C029"))
    for i in packs:  # one branch books Safety items in packs of 24: quantity ÷ 24, price × 24
        r = invoices[i]
        r.update(unit_of_measure="pack24", quantity=r["quantity"] // 24, unit_price=r["unit_price"] * 24)
        r["line_value"] = cents(r["unit_price"] * r["quantity"])
    plant("data_pack_of_24", "invoices", packs)
    future = pick(5, free)
    for i in future:
        invoices[i]["invoice_date"] = "2027" + invoices[i]["invoice_date"][4:]
    plant("data_future_date", "invoices", future)
    repeats = pick(15, free)
    start = len(invoices)
    invoices.extend(dict(invoices[i]) for i in repeats)
    plant("data_repeated_line", "invoices", range(start, len(invoices)))
    reversed_ = rng.sample(range(len(quotes)), 8)
    for i in reversed_:
        q = quotes[i]
        q["valid_to"] = str(date.fromisoformat(q["quote_date"]) - timedelta(days=30))
    plant("data_quote_valid_before_made", "quotes", reversed_)
    odd = rng.sample(range(len(rebates)), 4)
    for i in odd:
        y, qn = rebates[i]["quarter"].split("-")
        rebates[i]["quarter"] = f"{qn} {y}"
    plant("data_rebate_quarter_format", "rebates", odd)
    return invoices, quotes, rebates


def write(path, rows):
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    out = Path(sys.argv[1])
    key = sys.argv[sys.argv.index("--key") + 1] if "--key" in sys.argv else None
    args = [a for a in sys.argv[2:] if not a.startswith("--") and a != key]
    products, customers, quotes, invoices, rebates, plants = generate(int(args[0]) if args else 21, "--clean" in sys.argv)
    out.mkdir(parents=True, exist_ok=True)
    for name, rows in [("products", products), ("customers", customers), ("quotes", quotes), ("invoices", invoices), ("rebates", rebates)]:
        write(out / f"{name}.csv", rows)
    (out / "policy.md").write_text(POLICY, encoding="utf-8", newline="\n")
    if key:
        write(Path(key), [dict(zip(["plant", "tbl", "row_no", "scope"], p)) for p in plants])
