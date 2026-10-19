"""Writes the fictional retail eval data: python3 -I make_retail.py <out dir> [seed, default 7] [--outliers | --ladder [--neutral] | --mix] [--until YYYY-MM-DD].
Two years of monthly sales for 26 SKUs with the traps the live runs tripped on: new and lost items,
loss-making SKUs, returns, a Q2 discount in Storage and one large June order.
--outliers (plan 3i) gives each group a tighter margin band, then plants a portfolio-wide low (K01), a Storage-only
high (S04), a Kitchen-only low (K05) and a tiny control (G10); the build fails if a plant is too small to count.
--ladder (plan 3e) makes the bases the context ladder asks about material: each line gets a list price beside its net
price, with discounts that differ by category and deepen in Kitchen in 2025, and K01, a large high-margin SKU, has
30% of its 2025 quantity returned. The build fails if either choice stops changing the category margins.
--neutral names the two prices price_a (list) and price_b (net), so neither name says which one margin uses.
--mix (plan 3j EC-13) holds every SKU at one price in both years and sells 60% more of the dearer half in 2025, so
the average price rises through mix alone; the build fails if it doesn't rise by at least 3%.
--until keeps only lines dated on or before that day, so the data can end part-way through a month."""
import csv
import random
import sys
from decimal import Decimal
from pathlib import Path

# Whole-history gross margin per SKU in the --outliers variant; S03 (promotion), G06 (cost rise) and K07 (loss) keep
# their traps. Margins hold across years, so each SKU's margin is one figure.
BANDS = {"S01": .38, "S02": .36, "S05": .37, "S06": .37, "S07": .38, "S08": .36, "S09": .39,
         "K02": .41, "K03": .40, "K04": .52, "K06": .42, "K08": .41,
         "G01": .50, "G02": .28, "G03": .45, "G04": .45, "G05": .55, "G07": .27, "G08": .44, "G09": .53}
PLANTS = {"K01": .15, "S04": .55, "K05": .27}
DISCOUNT = {("Storage", "2024"): Decimal("0.05"), ("Storage", "2025"): Decimal("0.05"),
            ("Kitchen", "2024"): Decimal("0.10"), ("Kitchen", "2025"): Decimal("0.18"),
            ("Garden", "2024"): Decimal("0.20"), ("Garden", "2025"): Decimal("0.20")}
LADDER_HEADER = ["invoice", "date", "sku", "category", "customer", "quantity", "list_price", "net_price", "unit_cost"]
HEADER = ["invoice", "date", "sku", "category", "customer", "quantity", "unit_price", "unit_cost"]


def generate(seed=7, outliers=False):
    rng = random.Random(seed)
    cents = lambda x: Decimal(x).quantize(Decimal("0.01"))
    skus = {}
    for category, prefix in (("Storage", "S"), ("Kitchen", "K"), ("Garden", "G")):
        for n in range(1, 10):
            price = rng.uniform(5, 40)
            skus[f"{prefix}{n:02d}"] = dict(
                category=category,
                price=price,
                cost=price * rng.uniform(0.45, 0.75),
                qty=rng.randint(20, 200),
                price_change=rng.uniform(0.95, 1.10),
                cost_change=rng.uniform(0.98, 1.08),
                qty_change=rng.uniform(0.8, 1.2),
            )
    skus["K07"]["cost"] = skus["K07"]["price"] * 1.1  # sold at a loss in both years
    skus["G06"]["cost_change"] = 1.6  # cost rises above price in 2025
    lost, new = {"S08", "K08"}, {"S09", "G09"}
    del skus["K09"]
    if outliers:
        for sku, margin in {**BANDS, **PLANTS}.items():
            s = skus[sku]
            s["cost"], s["cost_change"] = s["price"] * (1 - margin), s["price_change"]
        for sku, k in {"K02": 4, "K03": 4, "K04": 4, "K06": 4, "K08": 4, "K07": 3, "K05": 1.5}.items():
            skus[sku]["qty"] *= k  # Kitchen's ordinary SKUs outweigh its plants, so they set its median
        skus["G10"] = dict(category="Garden", price=20.0, cost=19.0, qty=6, price_change=1.0, cost_change=1.0,
                           qty_change=1.0)  # about 0.2% of sales at 5%: immaterial
    customers = [f"C{n:03d}" for n in range(1, 31)]
    rows, invoice = [], 100000
    for year in (2024, 2025):
        for month in range(1, 13):
            for sku, s in skus.items():
                if (year == 2025 and sku in lost) or (year == 2024 and sku in new):
                    continue
                later = year == 2025
                price = s["price"] * (s["price_change"] if later else 1)
                cost = s["cost"] * (s["cost_change"] if later else 1)
                qty = s["qty"] * (s["qty_change"] if later else 1) * rng.uniform(0.85, 1.15)
                if later and sku == "S03" and month in (4, 5, 6):
                    price, qty = price * 0.7, qty * 1.6  # Q2 promotion
                lines = [round(qty * 0.6), round(qty * 0.4)]
                if later and month == 6 and sku == "S01":
                    lines.append(400)  # one large order
                for i, q in enumerate(lines):
                    invoice += 1
                    customer = "C017" if i == 2 else rng.choice(customers)
                    rows.append([invoice, f"{year}-{month:02d}-{rng.randint(1, 28):02d}", sku, s["category"], customer,
                                 q, cents(price), cents(cost)])
                    if rng.random() < 0.02:  # a later return of part of the line
                        invoice += 1
                        rows.append([invoice, f"{year}-{month:02d}-28", sku, s["category"], customer,
                                     -max(1, q // 10), cents(price), cents(cost)])
    if outliers:
        check_outliers(rows)
    return rows


def mix(rows):
    first = {}
    for r in rows:
        first.setdefault(r[2], r[6])
    dear = sorted(first, key=lambda k: first[k])[len(first) // 2:]
    for r in rows:
        r[6] = first[r[2]]
        if r[1] >= "2025" and r[2] in dear:
            r[5] = round(r[5] * 1.6)
    asp = lambda y: sum(r[5] * r[6] for r in rows if r[1][:4] == y) / sum(r[5] for r in rows if r[1][:4] == y)
    assert asp("2025") >= asp("2024") * Decimal("1.03"), (asp("2024"), asp("2025"))
    return rows


def ladder(rows):
    """The --ladder columns, with K01's 2025 returns; rows are the seed's ordinary lines."""
    invoice = max(r[0] for r in rows)
    for r in [r for r in rows if r[2] == "K01" and r[1] >= "2025" and r[5] > 0]:
        invoice += 1
        rows.append([invoice, r[1][:8] + "28", *r[2:5], -round(r[5] * 0.3), *r[6:]])
    out = [[*r[:6], (r[6] / (1 - DISCOUNT[(r[3], r[1][:4])])).quantize(Decimal("0.01")), *r[6:]] for r in rows]

    def margins(net=True, returns=True):
        s, g = {}, {}
        for r in out:
            if r[5] < 0 and not returns:
                continue
            k, price = (r[3], r[1][:4]), r[7] if net else r[6]
            s[k] = s.get(k, 0) + r[5] * price
            g[k] = g.get(k, 0) + r[5] * (price - r[8])
        return {k: g[k] / s[k] for k in s}

    base, listed, kept = margins(), margins(net=False), margins(returns=False)
    change = lambda m, c: m[(c, "2025")] - m[(c, "2024")]
    assert max(abs(change(base, c) - change(listed, c)) for c in ("Kitchen",)) >= Decimal("0.02")
    assert abs(base[("Kitchen", "2025")] - kept[("Kitchen", "2025")]) >= Decimal("0.01")
    return out


def weighted_median(items):  # (value, weight, name): the item at which cumulative weight reaches half the total
    items, half, run = sorted(items), sum(w for _, w, _ in items) / 2, 0
    for item in items:
        run += item[1]
        if run >= half:
            return item


def check_outliers(rows):
    """Each required plant: at least 3% of sales and 10% of its group's, and a gross-profit gap to its peers'
    sales-weighted median margin (itself excluded) of at least 1% of total gross profit, with that median set by an
    ordinary SKU rather than another plant."""
    sales, gp, group = {}, {}, {}
    for r in rows:
        sales[r[2]] = sales.get(r[2], 0) + r[5] * r[6]
        gp[r[2]] = gp.get(r[2], 0) + r[5] * (r[6] - r[7])
        group[r[2]] = r[3]
    total, total_gp = sum(sales.values()), sum(gp.values())
    for sku, peer_sets in {"K01": ("all", "group"), "K07": ("all", "group"), "S04": ("group",), "K05": ("group",)}.items():
        in_group = sum(v for k, v in sales.items() if group[k] == group[sku])
        assert sales[sku] >= total * Decimal("0.03") and sales[sku] >= in_group * Decimal("0.10"), sku
        for peers in peer_sets:
            ref, _, by = weighted_median([(gp[k] / sales[k], sales[k], k) for k in sales
                                          if k != sku and (peers == "all" or group[k] == group[sku])])
            assert by not in {*PLANTS, "K07"}, (sku, peers, by)
            assert abs(ref - gp[sku] / sales[sku]) * sales[sku] >= total_gp * Decimal("0.01"), (sku, peers)
    assert sales["G10"] < total * Decimal("0.005")


if __name__ == "__main__":
    out = Path(sys.argv[1])
    until = sys.argv[sys.argv.index("--until") + 1] if "--until" in sys.argv else None
    args = [a for a in sys.argv[2:] if not a.startswith("--") and a != until]
    rows = generate(int(args[0]) if args else 7, "--outliers" in sys.argv)
    if "--ladder" in sys.argv:
        rows = ladder(rows)
    if "--mix" in sys.argv:
        rows = mix(rows)
    if until:
        rows = [r for r in rows if r[1] <= until]
    out.mkdir(parents=True, exist_ok=True)
    with (out / "sales.csv").open("w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        header = LADDER_HEADER if "--ladder" in sys.argv else HEADER
        if "--neutral" in sys.argv:
            header = [{"list_price": "price_a", "net_price": "price_b"}.get(c, c) for c in header]
        w.writerow(header)
        w.writerows(rows)
