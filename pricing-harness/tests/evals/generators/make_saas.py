"""Writes the fictional SaaS subscription eval data (plan 2b, S3): python3 -I make_saas.py <out dir> [seed, default 31] [--clean] [--key CSV].
Monthly subscription snapshots for 2024 and 2025: good/better/best plans priced per seat, monthly or annual billing
(annual 15% off), a 20% sign-up discount for the first three months, upgrades, downgrades, seat changes and churn.
On 2025-04-01 list prices rise (Good 10 to 12, Better 25 to 29, Best 50 to 59 per seat per month). Customers who
signed up before 2024 keep the old price (grandfathered). Of the rest, a random 30% (price_test.csv, arm "holdout")
keep the old price until 2025-10-01, so the increase's true effect on churn is known: three times the monthly churn
rate for the three months after a customer's price rises.
Each customer has an acquisition channel, and acquisition.csv has each month's spend and new customers per channel,
so CAC and LTV can be worked out by cohort. Not stated anywhere: paid-search customers who signed up in July to
December 2024 churn at three times the usual rate, and cost more to acquire.
Data faults, left out by --clean: annual contract value in the mrr column, repeated rows, an unknown customer, mrr
that doesn't match seats × price × (1 − discount), negative seats, mrr as currency text, rows after the customer
churned, future months and plan names in another case.
--key writes every planted row: plant, tbl, row_no (1 = first data row), scope (data)."""
import csv
import random
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

OLD = {"Good": Decimal(10), "Better": Decimal(25), "Best": Decimal(50)}
NEW = {"Good": Decimal(12), "Better": Decimal(29), "Best": Decimal(59)}
PLANS = list(OLD)
SEGMENTS = ["SMB", "Mid-market", "Enterprise"]
INCREASE, HOLDOUT_END = "2025-04", "2025-10"
CHANNELS = {"organic": 150, "paid_search": 600, "partner": 400}  # usual cost to acquire one customer, GBP
LATE_PAID = ("2024-07", "2024-12")  # the hidden cohort: paid search, signed up in these months
months = [f"{y}-{m:02d}" for y in (2024, 2025) for m in range(1, 13)]
cents = lambda x: Decimal(x).quantize(Decimal("0.01"))
add = lambda month, n: (lambda y, m: f"{y + (m - 1 + n) // 12}-{(m - 1 + n) % 12 + 1:02d}")(*map(int, month.split("-")))


def generate(seed=31, clean=False):
    rng = random.Random(seed)
    customers, subs, test, plants = [], [], [], []
    acq = random.Random(seed + 1)  # channels and spend draw apart, so they don't shift the subscriptions' draws
    signups = [add("2023-01", rng.randrange(36)) for _ in range(420)]
    for n, signup in enumerate(sorted(signups), 1):
        cid = f"A{n:04d}"
        segment = rng.choices(SEGMENTS, [6, 3, 1])[0]
        seats = max(1, round(rng.lognormvariate({"SMB": 1.3, "Mid-market": 2.6, "Enterprise": 3.8}[segment], 0.5)))
        plan = rng.choices(PLANS, [5, 4, 2] if segment != "SMB" else [7, 3, 1])[0]
        billing = "annual" if rng.random() < 0.3 else "monthly"
        grandfathered = signup < "2024-01"
        channel = acq.choices(list(CHANNELS), [5, 3, 2])[0]
        late_paid = channel == "paid_search" and LATE_PAID[0] <= signup <= LATE_PAID[1]
        arm = None
        if not grandfathered and signup < INCREASE:
            arm = "holdout" if rng.random() < 0.3 else "increase"
            test.append({"customer_id": cid, "arm": arm, "assigned": "2025-03-15"})
        churn, month, raised = None, signup, None
        while month <= "2025-12" and churn is None:
            old = grandfathered or month < INCREASE or (arm == "holdout" and month < HOLDOUT_END)
            book = NEW if signup >= INCREASE or not old else OLD
            if book is NEW and signup < INCREASE and raised is None:
                raised = month
            hazard = 0.012 * (3 if raised and month < add(raised, 3) else 1) * (3 if late_paid else 1)
            disc = Decimal("0.15") if billing == "annual" else Decimal(0)
            if month < add(signup, 3):
                disc += Decimal("0.20")
            if month >= "2024-01":
                mrr = cents(seats * book[plan] * (1 - disc))
                subs.append({"month": month, "customer_id": cid, "plan": plan, "billing": billing, "seats": seats,
                             "price_per_seat": book[plan], "discount_pct": f"{disc * 100:.0f}", "mrr": mrr})
            if rng.random() < hazard and month > signup:
                churn = month
                break
            r = rng.random()
            if r < 0.010 and plan != "Best":
                plan = PLANS[PLANS.index(plan) + 1]
            elif r < 0.015 and plan != "Good":
                plan = PLANS[PLANS.index(plan) - 1]
            elif r < 0.06:
                seats = max(1, seats + rng.choice([-2, -1, 1, 1, 2, 3]))
            month = add(month, 1)
        customers.append({"customer_id": cid, "company": f"Company {n:04d}", "segment": segment,
                          "signup_month": signup, "channel": channel, "churn_month": churn or "",
                          "grandfathered": "yes" if grandfathered else "no"})
    subs.sort(key=lambda r: (r["month"], r["customer_id"]))
    prices = [{"plan": p, "price_per_seat": OLD[p], "valid_from": "2020-01-01", "valid_to": "2025-03-31"} for p in PLANS]
    prices += [{"plan": p, "price_per_seat": NEW[p], "valid_from": "2025-04-01", "valid_to": ""} for p in PLANS]
    acquisition = []
    for month in [add("2023-01", i) for i in range(36)]:
        for channel, cac in CHANNELS.items():
            new = sum(c["signup_month"] == month and c["channel"] == channel for c in customers)
            each = cac * (2 if channel == "paid_search" and LATE_PAID[0] <= month <= LATE_PAID[1] else 1)
            spend = cents(Decimal(max(new, 1) * each) * Decimal(str(round(acq.uniform(0.85, 1.15), 3))))  # paid channels spend in quiet months too
            acquisition.append({"month": month, "channel": channel, "spend": spend, "new_customers": new})
    check_cohort(customers)
    if not clean:
        subs = trap(rng, subs, customers, plants)
    plants.sort(key=lambda p: (p[1], p[2], p[0]))
    return customers, subs, prices, test, plants, acquisition


def check_cohort(customers):
    """The hidden cohort must stand out: its 12-month churn at least 1.5 times that of the other paid-search cohorts of 2023-24."""
    def churned(rows):
        return sum(bool(c["churn_month"]) and c["churn_month"] < add(c["signup_month"], 12) for c in rows) / len(rows)
    paid = [c for c in customers if c["channel"] == "paid_search" and c["signup_month"] <= "2024-12"]
    late = [c for c in paid if c["signup_month"] >= LATE_PAID[0]]
    assert len(late) >= 15 and churned(late) >= 1.5 * churned([c for c in paid if c not in late]), (len(late), churned(late))


def trap(rng, subs, customers, plants):
    """Data faults on top of the truth. Rows are edited in place or appended, so row numbers stay meaningful."""
    used = set()
    pick = lambda n, pool: [i for i in rng.sample([i for i in pool if i not in used], n) if not used.add(i)]
    plant = lambda name, idx: plants.extend((name, "subscriptions", i + 1, "data") for i in idx)
    every = range(len(subs))
    annual = pick(20, [i for i in every if subs[i]["billing"] == "annual"])
    for i in annual:  # the contract value, not the monthly figure
        subs[i]["mrr"] = subs[i]["mrr"] * 12
    plant("data_annual_value_as_mrr", annual)
    wrong = pick(12, every)
    for i in wrong:
        subs[i]["mrr"] = cents(subs[i]["mrr"] * Decimal("0.9"))
    plant("data_mrr_mismatch", wrong)
    unknown = pick(8, every)
    for i in unknown:
        subs[i]["customer_id"] = "A9999"
    plant("data_unknown_customer", unknown)
    negative = pick(5, [i for i in every if subs[i]["seats"] > 1])
    for i in negative:
        subs[i]["seats"] = -subs[i]["seats"]
        subs[i]["mrr"] = -subs[i]["mrr"]
    plant("data_negative_seats", negative)
    text = pick(10, every)
    for i in text:
        subs[i]["mrr"] = f"${subs[i]['mrr']:,}"
    plant("data_mrr_as_text", text)
    future = pick(4, every)
    for i in future:
        subs[i]["month"] = "2027" + subs[i]["month"][4:]
    plant("data_future_month", future)
    case = pick(12, [i for i in every if subs[i]["plan"] == "Better"])
    for i in case:
        subs[i]["plan"] = "BETTER"
    plant("data_plan_name_case", case)
    start = len(subs)
    subs.extend(dict(subs[i]) for i in pick(15, every))
    plant("data_repeated_row", range(start, len(subs)))
    churned = [c for c in customers if "2024-01" <= c["churn_month"] < "2025-10"]
    start = len(subs)
    for c in rng.sample(churned, 6):  # still billed two months after churning
        last = max((r for r in subs[:start] if r["customer_id"] == c["customer_id"]), key=lambda r: r["month"])
        y, m = map(int, c["churn_month"].split("-"))
        subs.append({**last, "month": f"{y + m // 12}-{m % 12 + 1:02d}"})
    plant("data_billed_after_churn", range(start, len(subs)))
    return subs


def write(path, rows):
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    out = Path(sys.argv[1])
    key = sys.argv[sys.argv.index("--key") + 1] if "--key" in sys.argv else None
    args = [a for a in sys.argv[2:] if not a.startswith("--") and a != key]
    customers, subs, prices, test, plants, acquisition = generate(int(args[0]) if args else 31, "--clean" in sys.argv)
    out.mkdir(parents=True, exist_ok=True)
    for name, rows in [("customers", customers), ("subscriptions", subs), ("price_book", prices), ("price_test", test),
                       ("acquisition", acquisition)]:
        write(out / f"{name}.csv", rows)
    if key:
        write(Path(key), [dict(zip(["plant", "tbl", "row_no", "scope"], p)) for p in plants])
