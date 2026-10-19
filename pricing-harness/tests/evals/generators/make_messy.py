"""Writes the messy multi-file eval exports: python3 -I make_messy.py <out dir> [seed, default 7].
build() returns the clean truth beside the files. The exports hide it behind an overlapping December extract, renamed
columns, DD/MM/YYYY dates, text prices, as-of costs with a one-quarter gap, a renamed SKU and off-invoice rebates."""
import csv
import sys
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_retail import HEADER, generate

RENAMED = {"K03": "K03B"}  # the 2025 system's code for the same product
COST_RISE = {"S01": Decimal("1.08"), "K02": Decimal("1.08")}  # from 2025-07-01
NO_COST = ("G02", "K04")  # no cost loaded for 2025 Q3
REBATED = ("C003", "C011", "C017", "C024")  # 3% of each 2025 quarter's net sales, paid off-invoice


def no_cost(row):
    return row[2] in NO_COST and "2025-07" <= row[1] < "2025-10"


def build(seed=7):
    truth = generate(seed)
    for r in truth:
        if r[2] in COST_RISE and r[1] >= "2025-07":
            r[7] = (r[7] * COST_RISE[r[2]]).quantize(Decimal("0.01"))
    sales = defaultdict(Decimal)
    for r in truth:
        if r[1] >= "2025" and r[4] in REBATED:
            sales[(r[4], f"2025-Q{(int(r[1][5:7]) - 1) // 3 + 1}")] += r[5] * r[6]
    rebates = {k: (v * Decimal("0.03")).quantize(Decimal("0.01")) for k, v in sorted(sales.items())}

    code = lambda sku: RENAMED.get(sku, sku)
    cost = {(r[2], r[1][:4], r[1] >= "2025-07"): r[7] for r in truth}
    costs = []
    for sku in sorted({r[2] for r in truth}):
        for start, k in (("2024-01-01", (sku, "2024", False)), ("2025-01-01", (sku, "2025", False))):
            if k in cost:
                costs.append([code(sku), start, cost[k]])
        if sku in COST_RISE:
            costs.append([code(sku), "2025-07-01", cost[(sku, "2025", True)]])
        if sku in NO_COST:
            costs += [[code(sku), "2025-07-01", ""], [code(sku), "2025-10-01", cost[(sku, "2025", True)]]]
    export = [[r[0], f"{r[1][8:]}/{r[1][5:7]}/{r[1][:4]}", code(r[2]), r[4], r[5], f"£{r[6]:,.2f}"]
              for r in truth if r[1] >= "2024-12"]  # the 2025 extract starts in December 2024
    products = sorted({(code(r[2]), r[3], r[2] if r[2] in RENAMED else "") for r in truth})
    files = {
        "sales_2024.csv": [HEADER] + [r for r in truth if r[1] < "2025"],
        "Sales Export 2025.csv": [["Invoice No", "Date", "SKU", "Customer", "Qty", "Net Price"]] + export,
        "unit_costs.csv": [["sku", "effective_from", "unit_cost"]] + costs,
        "products.csv": [["sku", "category", "old_sku"]] + [list(p) for p in products],
        "rebates_2025.csv": [["customer", "quarter", "rebate_gbp"]] + [[c, q, v] for (c, q), v in rebates.items()],
    }
    return truth, rebates, files


if __name__ == "__main__":
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for name, rows in build(int(sys.argv[2]) if len(sys.argv) > 2 else 7)[2].items():
        with (out / name).open("w", newline="", encoding="utf-8") as f:
            csv.writer(f, lineterminator="\n").writerows(rows)
