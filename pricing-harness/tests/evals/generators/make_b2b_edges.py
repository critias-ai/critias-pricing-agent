"""Writes one S2 edge-case variant (plan 3i PO-4 and 3j): python3 -I make_b2b_edges.py <out dir> <variant>.
Each variant starts from the clean S2 data (make_b2b.py --clean) and changes only what its case tests:
- currency (EC-1): EUR and USD trade customers invoiced in their own currency, a dated fx_rates.csv, web-shop lines
  that include VAT (prices_include_vat), and 9 lines with no currency;
- list-change (EC-2): a 6% list rise on 2025-07-01 in price_list.csv, with a fifth of later lines still on the old list;
- peers (EC-6): segments, one of 2 customers (Marine), one where C041 is about 65% of sales at a deep discount
  (Rail), and a second product (T111) whose margin ties the fifth best exactly;
- uom (EC-10): some 2025 Fasteners and Adhesives lines invoiced in cases, priced per case;
- credits (EC-11): credit notes, partial and full, 8 of them matching no invoice, and rebates paid the quarter after
  the one they are for;
- kits (EC-12): a kit invoiced as a header line with zero-priced component lines (K201), and one sold as a single line
  (K202);
- po (PO-4): tight cost bands per family, with a portfolio-wide low (largest Tools SKU), a Safety-only high, an
  Adhesives-only low and a tiny control (F111); the build fails if a plant is too small to count;
- columns (EC-14): list, MSRP, standard and landed cost, with costs that change on 2025-04-01 in cost_history.csv."""
import csv
import random
import statistics
import sys
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I leaves the script's folder off the path
from make_b2b import TIER, cents, generate, write

D = Decimal
pick = lambda r, *cols: {c: r[c] for c in cols}
quarter = lambda d: f"{d[:4]}-Q{(int(d[5:7]) - 1) // 3 + 1}"


def currency(rng, products, customers, invoices, **_):
    group = lambda n: "Web shop" if n <= 8 else "EU trade" if 41 <= n <= 50 else "US trade" if n >= 56 else "UK trade"
    groups = {c["customer_id"]: group(int(c["customer_id"][1:])) for c in customers}
    cur = {"Web shop": "GBP", "UK trade": "GBP", "EU trade": "EUR", "US trade": "USD"}
    fx, rate = [], {"EUR": 0.85, "USD": 0.79}
    for y in (2024, 2025, 2026):
        for m in range(1, 13):
            for c in rate:
                rate[c] *= 1 + rng.gauss(0, 0.01)
                fx.append({"rate_date": f"{y}-{m:02d}-01", "currency": c, "gbp_per_unit": f"{rate[c]:.4f}"})
    asof = {(r["currency"], r["rate_date"][:7]): D(r["gbp_per_unit"]) for r in fx}
    out = []
    for r in invoices:
        g = groups[r["customer_id"]]
        unit = r["unit_price"] * D("1.2") if g == "Web shop" else r["unit_price"] / asof[cur[g], r["invoice_date"][:7]] if cur[g] != "GBP" else r["unit_price"]
        unit = cents(unit)
        out.append({**pick(r, "invoice_id", "invoice_date", "customer_id", "sku", "quantity"), "currency": cur[g],
                    "prices_include_vat": "yes" if g == "Web shop" else "no", "unit_price": unit, "line_value": cents(unit * r["quantity"])})
    for i in rng.sample([i for i, r in enumerate(out) if r["currency"] != "GBP" and r["invoice_date"].startswith("2025")], 9):
        out[i]["currency"] = ""
    return {"products": [pick(p, "sku", "description", "family", "standard_cost") for p in products],
            "customers": [{**pick(c, "customer_id", "name"), "customer_group": groups[c["customer_id"]]} for c in customers],
            "invoices": out, "fx_rates": fx}


def list_change(rng, products, invoices, **_):
    new = {p["sku"]: cents(p["list_price"] * D("1.06")) for p in products}
    prices = [{"sku": p["sku"], "effective_from": d, "list_price": v} for p in products
              for d, v in (("2024-01-01", p["list_price"]), ("2025-07-01", new[p["sku"]]))]
    out = []
    for r in invoices:
        unit = r["unit_price"]
        if r["invoice_date"] >= "2025-07-01" and rng.random() >= 0.2:  # a fifth stay on the old list
            unit = cents(new[r["sku"]] * (1 - (D(r["tier_discount_pct"]) + D(r["invoice_discount_pct"])) / 100))
        out.append({**pick(r, "invoice_id", "invoice_date", "customer_id", "sku", "quantity"), "unit_price": unit,
                    "line_value": cents(unit * r["quantity"]), "rep": r["rep"]})
    return {"products": [pick(p, "sku", "description", "family", "case_size", "standard_cost") for p in products],
            "price_list": prices, "invoices": out}


def peers(rng, products, customers, invoices, **_):
    seg = {"C013": "Marine", "C027": "Marine", "C041": "Rail", "C042": "Rail", "C043": "Rail", "C044": "Rail"}
    for c in customers:
        c["segment"] = seg.get(c["customer_id"], {"small": "Construction", "mid": "Manufacturing", "large": "Utilities"}[c["size_band"]])
    lst = {p["sku"]: p["list_price"] for p in products}
    for r in invoices:
        if r["customer_id"] == "C041":  # a deep-discount account
            r["unit_price"] = cents(lst[r["sku"]] * (1 - TIER["mid"] - D("0.15")))
            r["line_value"] = cents(r["unit_price"] * r["quantity"])
    rail = lambda c: sum(r["line_value"] for r in invoices if r["customer_id"] == c)
    k = round(D("0.65") * sum(rail(c) for c in ("C042", "C043", "C044")) / (D("0.35") * rail("C041")))
    for r in invoices:
        if r["customer_id"] == "C041":
            r["quantity"] *= k
            r["line_value"] = cents(r["unit_price"] * r["quantity"])
    share = rail("C041") / sum(rail(c) for c in ("C041", "C042", "C043", "C044"))
    assert D("0.6") <= share <= D("0.7"), share
    gp, rev = defaultdict(D), defaultdict(D)
    cost = {p["sku"]: p["standard_cost"] for p in products}
    for r in invoices:
        rev[r["sku"]] += r["line_value"]
        gp[r["sku"]] += r["line_value"] - r["quantity"] * cost[r["sku"]]
    fifth = sorted(rev, key=lambda s: -gp[s] / rev[s])[4]
    p5 = next(p for p in products if p["sku"] == fifth)  # T111: every line and price doubled, so its margin ties exactly
    products.append({**p5, "sku": "T111", "description": "Tools item 11", "family": "Tools", "list_price": p5["list_price"] * 2,
                     "standard_cost": p5["standard_cost"] * 2})
    twins = [{**r, "sku": "T111", "unit_price": r["unit_price"] * 2, "line_value": r["line_value"] * 2} for r in invoices if r["sku"] == fifth]
    invoices = sorted(invoices + twins, key=lambda r: (r["invoice_date"], r["invoice_id"], r["sku"]))
    for i, r in enumerate(invoices):
        r["invoice_id"] = f"INV{100001 + i}"
    return {"products": [pick(p, "sku", "description", "family", "list_price", "standard_cost") for p in products],
            "customers": [pick(c, "customer_id", "name", "size_band", "segment") for c in customers],
            "invoices": [pick(r, "invoice_id", "invoice_date", "customer_id", "sku", "quantity", "list_price", "unit_price", "line_value") for r in invoices]}


def uom(rng, products, invoices, **_):
    fam = {p["sku"]: p["family"] for p in products}
    for r in invoices:
        if r["invoice_date"].startswith("2025") and fam[r["sku"]] in ("Fasteners", "Adhesives") and r["customer_id"] > "C030" and rng.random() < 0.15:
            eaches = max(12, round(r["quantity"] / 12) * 12)
            r.update(unit_of_measure="case", quantity=eaches // 12, unit_price=r["unit_price"] * 12, line_value=cents(r["unit_price"] * eaches))
    return {"products": [pick(p, "sku", "description", "family", "case_size", "list_price") for p in products],
            "invoices": [pick(r, "invoice_id", "invoice_date", "customer_id", "sku", "quantity", "unit_of_measure", "unit_price", "line_value") for r in invoices]}


def credits(rng, customers, invoices, rebates, **_):
    invoices = [r for r in invoices if r["invoice_date"] < "2026"]
    day = lambda d, n: str(date.fromisoformat(d) + timedelta(days=n))
    early = [r for r in invoices if r["invoice_date"] <= "2025-11-15"]
    notes = []
    for r in rng.sample(early, 52):
        full = len(notes) >= 40
        notes.append({"credit_date": day(r["invoice_date"], rng.randint(5, 40)), "customer_id": r["customer_id"], "invoice_id": r["invoice_id"],
                      "amount": r["line_value"] if full else cents(r["line_value"] * D(str(round(rng.uniform(0.1, 0.5), 2))))})
    for n in range(8):  # no matching invoice: blank, or a number that isn't on file
        notes.append({"credit_date": day("2024-01-10", rng.randrange(700)), "customer_id": rng.choice(customers)["customer_id"],
                      "invoice_id": "" if n < 4 else f"INV0{rng.randrange(10000, 99999)}", "amount": cents(rng.uniform(50, 800))})
    notes.sort(key=lambda r: (r["credit_date"], r["customer_id"]))
    notes = [{"credit_id": f"CN{i + 1:04d}", **r} for i, r in enumerate(notes)]
    paid = []
    for r in rebates:  # paid on the 15th of the first month of the next quarter
        y, q = int(r["quarter"][:4]), int(r["quarter"][-1])
        y, q = (y + 1, 1) if q == 4 else (y, q + 1)
        paid.append({"customer_id": r["customer_id"], "period": f"Q{r['quarter'][-1]} {r['quarter'][:4]}",
                     "paid_date": f"{y}-{3 * q - 2:02d}-15", "rebate_amount": r["rebate_amount"]})
    return {"invoices": [pick(r, "invoice_id", "invoice_date", "customer_id", "sku", "quantity", "unit_price", "line_value") for r in invoices],
            "credit_notes": notes, "rebates": paid}


def kits(rng, products, customers, invoices, **_):
    by = {p["sku"]: p for p in products}
    recipe = {"K201": [("S101", 2), ("T103", 1), ("A105", 1)], "K202": [("F101", 10), ("T102", 1), ("A102", 1)]}
    for sku, name in (("K201", "Safety starter kit"), ("K202", "Workshop kit")):
        cost = sum(by[c]["standard_cost"] * n for c, n in recipe[sku])
        products.append({"sku": sku, "description": name, "family": "Kits", "list_price": cents(D("0.9") * sum(by[c]["list_price"] * n for c, n in recipe[sku])),
                         "standard_cost": "" if sku == "K201" else cost})  # K201's cost is its component lines
    by = {p["sku"]: p for p in products}
    out = [{**pick(r, "invoice_id", "invoice_date", "customer_id", "sku", "quantity", "unit_price", "line_value"), "line_no": 1} for r in invoices]
    tier = {c["customer_id"]: TIER[c["size_band"]] for c in customers}
    for n in range(100):
        kit, c = "K201" if n < 60 else "K202", rng.choice(customers)["customer_id"]
        qty, inv, d = rng.randint(1, 20), f"INV{200001 + n}", str(date(2025, 1, 2) + timedelta(days=rng.randrange(360)))
        unit = cents(by[kit]["list_price"] * (1 - tier[c]))
        out.append({"invoice_id": inv, "invoice_date": d, "customer_id": c, "sku": kit, "quantity": qty, "unit_price": unit,
                    "line_value": cents(unit * qty), "line_no": 1})
        if kit == "K201":
            out += [{"invoice_id": inv, "invoice_date": d, "customer_id": c, "sku": s, "quantity": qty * k, "unit_price": D("0.00"),
                     "line_value": D("0.00"), "line_no": j} for j, (s, k) in enumerate(recipe[kit], 2)]
    out.sort(key=lambda r: (r["invoice_date"], r["invoice_id"], r["line_no"]))
    return {"products": [pick(p, "sku", "description", "family", "list_price", "standard_cost") for p in products],
            "kit_components": [{"kit_sku": k, "component_sku": c, "quantity": n} for k, v in recipe.items() for c, n in v],
            "invoices": [pick(r, "invoice_id", "line_no", "invoice_date", "customer_id", "sku", "quantity", "unit_price", "line_value") for r in out]}


def po(rng, products, customers, invoices, rebates, **_):
    base = {"Fasteners": 0.60, "Adhesives": 0.52, "Safety": 0.68, "Tools": 0.58}
    sales = defaultdict(D)
    for r in invoices:
        sales[r["sku"]] += r["line_value"]
    top = lambda fam: max((p for p in products if p["family"] == fam), key=lambda p: sales[p["sku"]])["sku"]
    plants = {top("Tools"): 0.80, top("Safety"): 0.56, top("Adhesives"): 0.62}
    for p in products:
        p["standard_cost"] = cents(p["list_price"] * D(str(plants.get(p["sku"], base[p["family"]] + rng.uniform(-0.01, 0.01)))))
    products.append({"sku": "F111", "description": "Fasteners item 11", "family": "Fasteners", "case_size": 12,
                     "list_price": D("20.00"), "standard_cost": D("17.00")})
    for n in range(6):  # the control: a handful of small lines
        c = rng.choice(customers)
        unit = cents(D("20.00") * (1 - TIER[c["size_band"]]))
        qty = rng.randint(5, 15)
        value = cents(unit * qty)
        invoices.append({"invoice_id": "", "invoice_date": str(date(2025, 2, 1) + timedelta(days=50 * n)), "customer_id": c["customer_id"],
                         "sku": "F111", "quote_id": "", "quantity": qty, "unit_of_measure": "each", "list_price": D("20.00"),
                         "tier_discount_pct": f"{TIER[c['size_band']] * 100:.1f}", "invoice_discount_pct": "0.0", "unit_price": unit,
                         "line_value": value, "freight_cost": D("0.00"), "terms_discount": D("0.00"), "rep": c["rep"], "approver": c["rep"]})
    invoices.sort(key=lambda r: (r["invoice_date"], r["quote_id"]))
    for i, r in enumerate(invoices):
        r["invoice_id"] = f"INV{100001 + i}"
    check_po(products, invoices, rebates, customers, plants)
    return {"products": products, "customers": customers, "invoices": invoices, "rebates": rebates}


def pocket_margins(products, invoices, rebates, customers):
    size = {c["customer_id"]: c["size_band"] for c in customers}
    inv = defaultdict(D)
    for r in invoices:
        inv[r["customer_id"], quarter(r["invoice_date"])] += r["line_value"]
    reb = {(r["customer_id"], r["quarter"]): r["rebate_amount"] for r in rebates}
    cost = {p["sku"]: p["standard_cost"] for p in products}
    pv, gp = defaultdict(D), defaultdict(D)
    for r in invoices:
        k = (r["customer_id"], quarter(r["invoice_date"]))
        v = r["line_value"] - r["freight_cost"] - r["terms_discount"] - reb.get(k, D(0)) * r["line_value"] / inv[k]
        pv[r["sku"]] += v
        gp[r["sku"]] += v - r["quantity"] * cost[r["sku"]]
    return pv, gp


def check_po(products, invoices, rebates, customers, plants):
    """Every plant must matter: at least 3% of pocket value and 10% of its family's, and a gap to the family median of
    at least 1% of total pocket profit; the control must stay under 0.5% of pocket value."""
    pv, gp = pocket_margins(products, invoices, rebates, customers)
    fam = {p["sku"]: p["family"] for p in products}
    total, profit = sum(pv.values()), sum(gp.values())
    for sku in plants:
        peers = [gp[s] / pv[s] for s in pv if fam[s] == fam[sku] and s != sku]
        assert pv[sku] >= D("0.03") * total and pv[sku] >= D("0.1") * sum(v for s, v in pv.items() if fam[s] == fam[sku]), sku
        assert abs(gp[sku] / pv[sku] - statistics.median(peers)) * pv[sku] >= D("0.01") * profit, sku
    assert pv["F111"] < D("0.005") * total


def columns(rng, products, invoices, **_):
    hist = []
    for p in products:
        p["msrp"] = cents(p["list_price"] * D("1.3"))
        std, landed = p["standard_cost"], cents(p["standard_cost"] * D(str(round(1 + rng.uniform(0.04, 0.08), 3))))
        hist.append({"sku": p["sku"], "effective_from": "2024-01-01", "standard_cost": std, "landed_cost": landed})
        if p["family"] == "Adhesives":
            std, landed = cents(std * D("1.05")), cents(landed * D("1.05"))
            hist.append({"sku": p["sku"], "effective_from": "2025-04-01", "standard_cost": std, "landed_cost": landed})
        p["standard_cost"], p["landed_cost"] = std, landed  # products.csv shows today's costs
    return {"products": [pick(p, "sku", "description", "family", "list_price", "msrp", "standard_cost", "landed_cost") for p in products],
            "cost_history": hist,
            "invoices": [pick(r, "invoice_id", "invoice_date", "customer_id", "sku", "quantity", "list_price", "unit_price", "line_value") for r in invoices]}


VARIANTS = {"currency": (currency, 61), "list-change": (list_change, 62), "peers": (peers, 63), "uom": (uom, 64),
            "credits": (credits, 65), "kits": (kits, 66), "po": (po, 67), "columns": (columns, 68)}

if __name__ == "__main__":
    make, seed = VARIANTS[sys.argv[2]]
    products, customers, quotes, invoices, rebates, _ = generate(21, clean=True)
    tables = make(random.Random(seed), products=products, customers=customers, invoices=invoices, rebates=rebates)
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for name, rows in tables.items():
        write(out / f"{name}.csv", rows)
