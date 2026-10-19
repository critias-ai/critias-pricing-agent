"""Writes a fictional founder's money files (S5): python3 -I make_founder.py <out dir> [seed, default 41] [--scale X]
[--clean] [--key CSV] [--truth DIR].
A Berlin SaaS start-up, April 2022 to September 2026, billed through Stripe in EUR (some customers pay in USD),
acquiring customers through Meta and Google ads, organic search and referrals. About 200 sign-ups in the launch month
grow about 6.5% a month to roughly 5,000 a month, with seasons (a January surge, a summer trough, a quiet December),
random month-to-month swings and two shocks (a press feature in March 2023, a Meta ad-account suspension in October
2024). --scale multiplies every month's sign-ups and the ad budgets that buy them (default 1: about 87,000 customers). Every file uses the headers of a real
export pulled on 2026-10-19 (docs/references, git-ignored) or, where none was available, of the research notes in
docs/superpowers/plans/2026-10-18-mrr-reconciliation-design.md:
  stripe_balance_activity.csv  Reports > Balance, itemised activity, local time, with customer, invoice, subscription,
                               charge and utm metadata columns added
  stripe_payouts.csv           Reports > Balance, itemised payouts (sign of payout rows unverified: negative here)
  stripe_balance_summary.csv   Reports > Balance summary for the whole range
  stripe_subscriptions.csv     Billing > Subscriptions export: current state only, decimal commas, UTC
  stripe_invoices.csv          Billing > Invoices export: one row per invoice, decimal commas, UTC
  meta_ads.csv                 Ads Manager campaign export with a day breakdown
  google_ads.csv               Google Ads campaign report: plain UTF-8 in --clean; UTF-16 with tabs, title rows and
                               total rows otherwise (a customised report)
  amex.csv                     The company card: threshold-billed ad charges, tools, FX lines, card repayments
Reality in both copies: VAT added by Stripe Tax, USD customers settled in EUR, trials (with zero invoices) that
never convert, a launch coupon, refunds, disputes (some won), monthly Billing and Tax usage fees, two instant payouts,
a Google test charge, utm metadata on only some first charges, Meta reporting more results than real sign-ups.
Hidden truths (the build fails if they stop showing): Google costs at least 1.5 times Meta per paying customer but
pays back sooner, because Meta's customers churn far faster; paid CAC rises at least 20% from the first six months to
the last six, at least 25 points more than blended CAC (all acquisition spend over all new paying customers), which more
organic and referral sign-ups hold down.
Data faults, left out by --clean: balance rows repeated by an overlapping export, a balance row whose net was edited,
a second Meta export appended with its header and an overlapping week, and the Google report's layout above.
--key writes every planted row: plant, tbl, row_no (1 = first data row), scope (data).
--truth writes truth_monthly.csv and truth_channels.csv: the expected answers, the same for both copies."""
import csv
import random
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal as D
from pathlib import Path
from zoneinfo import ZoneInfo

TZ, UTC = ZoneInfo("Europe/Berlin"), timezone.utc
START, END = datetime(2022, 4, 1, tzinfo=TZ), datetime(2026, 10, 1, tzinfo=TZ)  # END is exclusive
PLANS = {"starter": ("Starter", "month", D(29)), "pro": ("Pro", "month", D(79)), "pro_year": ("Pro", "year", D(790)),
         "team": ("Team", "month", D(25))}  # EUR, before tax; Team is per seat
USD_PRICE = {"starter": D(32), "pro": D(87), "pro_year": D(869), "team": D(28)}
VAT = {"DE": D("0.19"), "FR": D("0.20"), "NL": D("0.21"), "ES": D("0.21"), "US": D(0), "GB": D(0)}
COST_PER_SIGNUP = {"meta": D(380), "google": D(700)}  # in month 0; both rise 2% a month
CHURN = {"meta": 0.30, "google": 0.015, "organic": 0.035, "referral": 0.025}  # monthly
SHARE = lambda f: [.47 - .22 * f, .38 - .18 * f, .1 + .25 * f, .05 + .15 * f]  # meta, google, organic, referral at f = 0..1 of the range
CAMPAIGNS = {"meta": [("Prospecting - Lookalike 1%", .5), ("Prospecting - Interests", .3), ("Retargeting - Site visitors", .2)],
             "google": [("Generic - Search", .55), ("Brand - Search", .25), ("Competitor - Search", .2)]}
ACQ_TOOLS = ["APOLLO.IO", "CLAY LABS", "UPWORK"]  # the acquisition costs the truth counts in full CAC
cents = lambda x: D(x).quantize(D("0.01"))
month_of = lambda t: (lambda l: f"{l.year}-{l.month:02d}")(t.astimezone(TZ))
months = [f"{y}-{m:02d}" for y in range(2022, 2027) for m in range(1, 13)][3:57]
idx = {m: i for i, m in enumerate(months)}
SEASON = {1: 1.35, 2: 1.15, 3: 1.05, 4: 1.0, 5: .95, 6: .85, 7: .72, 8: .7, 9: .95, 10: 1.05, 11: 1.0, 12: .8}
SHOCK = {"2023-03": 1.6, "2024-10": .65}
FIRST_MONTH, GROWTH = 200, 1.065


def add_months(t, n):
    m = t.month - 1 + n
    y, m = t.year + m // 12, m % 12 + 1
    return t.replace(year=y, month=m, day=min(t.day, 28))


def fx(t):  # USD per EUR, drifting
    return D(str(round(1.02 + 0.08 * ((t - START).days / (END - START).days), 4)))


def planned(m, scale):
    """The sign-ups a month is planned for, and budgeted to buy: trend times season, before swings and shocks."""
    return scale * FIRST_MONTH * GROWTH ** idx[m] * SEASON[int(m[5:])] / SEASON[4]


def month_start(m):
    return datetime(int(m[:4]), int(m[5:]), 1, tzinfo=TZ)


def generate(seed=41, scale=1.0, clean=False):
    rng = random.Random(seed)
    sid = lambda p, n=24: p + "".join(rng.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", k=n))
    span = (END - START).total_seconds()
    signups = []  # organic and referral take a growing share over the range
    for i, m in enumerate(months):
        a, b = month_start(m), month_start(months[i + 1]) if i + 1 < len(months) else END
        n = round(planned(m, scale) * SHOCK.get(m, 1) * min(max(rng.lognormvariate(0, .15), .6), 1.6))
        signups += sorted(a + (b - a) * rng.random() for _ in range(n))
    prices = {p: sid("price_1") for p in PLANS}
    products = {name: sid("prod_", 14) for name, _, _ in PLANS.values()}
    first = ["anna", "ben", "clara", "david", "emma", "felix", "greta", "hugo", "ines", "jonas", "lea", "marc", "nina", "omar", "paula", "sam"]
    last = ["meyer", "dubois", "jansen", "garcia", "smith", "keller", "martin", "bakker", "lopez", "brown", "wolf", "laurent"]
    customers, invoices, balance, subs = [], [], [], []
    for n, t in enumerate(signups, 1):
        f = (t - START).total_seconds() / span
        channel = rng.choices(list(CHURN), SHARE(f))[0]
        country = rng.choices(list(VAT), [50, 12, 10, 8, 12, 8])[0]
        plan = rng.choices(list(PLANS), [45, 30, 15, 10])[0]
        fn, ln = rng.choice(first), rng.choice(last)
        c = {"id": sid("cus_", 14), "n": n, "email": f"{fn}.{ln}{n}@example.{rng.choice(['com', 'org', 'net'])}",
             "name": f"{fn.title()} {ln.title()}", "country": country, "cur": "usd" if country == "US" else "eur",
             "channel": channel, "signup": t, "plan": plan, "seats": rng.randint(3, 15) if plan == "team" else 1,
             "coupon": rng.random() < .2, "utm": channel in COST_PER_SIGNUP and rng.random() < .6,
             "utm_renewals": rng.random() < .5, "trial": rng.random() < .5, "paid": []}
        customers.append(c)
        simulate(rng, sid, c, prices, invoices, balance, subs)
    payouts = settle(rng, sid, balance)
    spend, meta_rows, google_rows = ads(rng, customers)
    amex = card(rng, spend)
    truth_m, truth_c = truth(customers, balance, payouts, spend, amex)
    check(truth_c, truth_m)
    files = {"stripe_balance_activity": balance_rows(balance), "stripe_payouts": payout_rows(payouts),
             "stripe_balance_summary": summary_rows(balance, payouts), "stripe_subscriptions": subs,
             "stripe_invoices": invoices, "meta_ads": meta_rows, "google_ads": google_rows, "amex": amex}
    plants = [] if clean else trap(random.Random(seed + 1), files)
    return files, plants, truth_m, truth_c


def simulate(rng, sid, c, prices, invoices, balance, subs):
    name, interval, eur = PLANS[c["plan"]]
    unit = USD_PRICE[c["plan"]] if c["cur"] == "usd" else eur
    sub, t = sid("sub_1"), c["signup"]
    status, canceled, ended, cancel_at_end, period = "active", None, None, False, (t, None)
    trial_end = t + timedelta(days=14) if c["trial"] else None
    if trial_end:  # Stripe opens a trial with a zero invoice
        invoices.append(invoice(sid, c, sub, t, t, trial_end, D(0), D(0), D(0), None))
        if rng.random() < .25:
            subs.append(sub_row(c, sub, prices, unit, "canceled", t, trial_end, trial_end, trial_end, trial_end, False, trial_end))
            return
        t = trial_end
    k = 0
    while t < END:
        nxt = add_months(t, 12 if interval == "year" else 1)
        period = (t, nxt)
        sub_total = unit * c["seats"]
        disc = cents(sub_total * D("0.2")) if c["coupon"] and (k < 3 if interval == "month" else k == 0) else D(0)
        tax = cents((sub_total - disc) * VAT[c["country"]])
        total = sub_total - disc + tax
        charge_t = t + timedelta(minutes=rng.randint(1, 50))
        if charge_t >= END:
            break
        ch, inv = sid("ch_3"), sid("in_1")
        invoices.append(invoice(sid, c, sub, t, t, nxt, sub_total, disc, tax, ch, inv, total))
        rate = fx(charge_t) if c["cur"] == "usd" else D(1)
        gross = cents(total / rate)
        fee = cents(gross * (D("0.0525") if c["cur"] == "usd" else D("0.015")) + D("0.25"))
        meta = c["utm"] and (k == 0 or c["utm_renewals"])
        row = {"t": charge_t, "cat": "charge", "gross": gross, "fee": fee, "desc": "Subscription creation" if k == 0 else "Subscription update",
               "c": c, "inv": inv, "sub": sub, "ch": ch, "cfa": total, "cfc": c["cur"], "utm": meta}
        balance.append(row)
        c["paid"].append({"t": charge_t, "months": 12 if interval == "year" else 1, "mrr": cents((sub_total - disc) / rate / (12 if interval == "year" else 1)),
                          "mrr_list": cents(sub_total / rate / (12 if interval == "year" else 1)), "net_ex_tax": gross - fee - cents(tax / rate)})
        r, rt, dt = rng.random(), charge_t + timedelta(days=rng.randint(1, 10)), charge_t + timedelta(days=rng.randint(20, 60))
        if r < .005 and rt < END:  # refunded within days, and cancelled
            balance.append({**row, "t": rt, "cat": "refund", "gross": -gross, "fee": D(0), "desc": "REFUND FOR CHARGE"})
            c["paid"][-1]["net_ex_tax"] -= gross - cents(tax / rate)
            status, canceled, ended = "canceled", rt, rt
            break
        if .005 <= r < .0065 and dt < END:  # disputed; four in ten are won
            balance.append({**row, "t": dt, "cat": "dispute", "gross": -gross, "fee": D(15), "desc": "Chargeback withdrawal"})
            c["paid"][-1]["net_ex_tax"] -= gross - cents(tax / rate) + 15
            if rng.random() < .4 and dt + timedelta(days=30) < END:
                balance.append({**row, "t": dt + timedelta(days=30), "cat": "dispute_reversal", "gross": gross, "fee": D(0), "desc": "Chargeback reversal"})
                c["paid"][-1]["net_ex_tax"] += gross - cents(tax / rate)
            status, canceled, ended = "canceled", dt, dt
            break
        if rng.random() > (1 - CHURN[c["channel"]]) ** c["paid"][-1]["months"]:
            canceled, cancel_at_end = t + (nxt - t) * rng.random(), True
            if nxt <= END:
                status, ended = "canceled", nxt
            break
        if c["plan"] == "starter" and rng.random() < .02:  # upgrades take effect at the next period
            c["plan"], unit = "pro", USD_PRICE["pro"] if c["cur"] == "usd" else PLANS["pro"][2]
        t, k = nxt, k + 1
    subs.append(sub_row(c, sub, prices, unit, status, c["signup"], period[0], period[1] or period[0], canceled, ended, cancel_at_end, trial_end))


def utc(t, secs=False):
    return t.astimezone(UTC).strftime("%Y-%m-%d %H:%M:%S" if secs else "%Y-%m-%d %H:%M") if t else ""


comma = lambda x: f"{x:.2f}".replace(".", ",")  # the Dashboard exports follow the account's locale


def invoice(sid, c, sub, t, start, end, sub_total, disc, tax, ch, inv=None, total=None):
    total = D(0) if total is None else total
    row = dict.fromkeys(INVOICE_HEADER, "")
    c["invoices"] = c.get("invoices", 0) + 1
    row.update({"id": inv or sid("in_1"), "Amount Due": comma(total), "Billing": "charge_automatically", "Charge": ch or "",
                "Closed": "true", "Currency": c["cur"], "Customer": c["id"], "Date (UTC)": utc(t),
                "Description": "", "Ending Balance": "0,00", "Forgiven": "false", "Number": f"{c['id'][4:12].upper()}-{c['invoices']:04d}",
                "Paid": "true", "Paid At (UTC)": utc(t), "Finalized At (UTC)": utc(t),
                "Minimum Line Item Period Start (UTC)": utc(start), "Maximum Line Item Period End (UTC)": utc(end),
                "Period Start (UTC)": utc(start), "Period End (UTC)": utc(start), "Starting Balance": "0,00",
                "Subscription": sub, "Subtotal": comma(sub_total), "Total Discount Amount": comma(disc),
                "Applied Coupons": "WELCOME20" if disc else "", "Tax": comma(tax), "Total": comma(total),
                "Customer Email": c["email"], "Amount Paid": comma(total), "Status": "paid", "Customer Name": c["name"],
                "Exclusive Tax Amount": comma(tax), "Inclusive Tax Amount": "0,00", "Customer Address Country": c["country"],
                "Automatic Tax Enabled": "true"})
    return row


def sub_row(c, sub, prices, unit, status, created, cps, cpe, canceled, ended, at_end, trial_end=None):
    name = PLANS[c["plan"]][0]
    return {"id": sub, "Customer ID": c["id"], "Customer Description": "", "Customer Email": c["email"],
            "Plan": prices[c["plan"]], "Product": name, "Product ID": "", "Quantity": c["seats"], "Currency": c["cur"],
            "Cancellation Reason": "cancellation_requested" if canceled else "", "Cancellation Feedback": "",
            "Interval": PLANS[c["plan"]][1], "Amount": comma(unit), "Status": status, "Created (UTC)": utc(created),
            "Start (UTC)": utc(created), "Start Date (UTC)": utc(created), "Current Period Start (UTC)": utc(cps),
            "Current Period End (UTC)": utc(cpe), "Trial Start (UTC)": utc(created) if trial_end else "",
            "Trial End (UTC)": utc(trial_end), "Application Fee Percent": "", "Coupon": "WELCOME20" if c["coupon"] else "",
            "Tax Percent": "", "Canceled At (UTC)": utc(canceled), "Cancel At Period End": str(at_end).lower(),
            "Ended At (UTC)": utc(ended), "Exclusive Tax Rate": f"{VAT[c['country']] * 100:.0f}" if VAT[c["country"]] else "",
            "Inclusive Tax Rate": "", "Customer Name": c["name"], "Automatic Tax Enabled": "true", "Tax Location Recognized": "true"}


def settle(rng, sid, balance):
    """Monthly Billing and Tax usage fees, then daily automatic payouts of everything available, plus two instant payouts."""
    volumes = {}
    for r in balance:
        if r["cat"] == "charge":
            volumes[month_of(r["t"])] = volumes.get(month_of(r["t"]), D(0)) + r["gross"]
    for m in months:
        y, mm = map(int, m.split("-"))
        volume = volumes.get(m, D(0))
        t = datetime(y + mm // 12, mm % 12 + 1, 2, 3, 0, tzinfo=TZ)
        if t < END:
            balance.append({"t": t, "cat": "fee", "gross": -cents(volume * D("0.012")), "fee": D(0), "desc": "Billing and Tax usage fees"})
    for r in balance:
        r["id"] = sid("txn_3")
        r["avail"] = (r["t"] + timedelta(days=7)).replace(hour=0, minute=0, second=0) if r["cat"] in ("charge", "dispute_reversal") else r["t"]
        r["net"] = r["gross"] - r["fee"]
    balance.sort(key=lambda r: r["t"])
    payouts, day, pending = [], START.replace(hour=0), sorted(balance, key=lambda r: r["avail"])
    instant = {START + timedelta(days=d) for d in (200, 420, 900, 1300)}
    i, available = 0, D(0)
    while day < END:
        while i < len(pending) and pending[i]["avail"] <= day:
            available += pending[i]["net"]
            i += 1
        if day in instant and available > 100:
            amount = cents(available / 2)
            payouts.append({"t": day + timedelta(hours=11), "gross": -amount, "fee": cents(amount * D("0.01")), "desc": "Instant payout", "id": sid("po_1"), "txn": sid("txn_1")})
            available -= amount + payouts[-1]["fee"]
        if available > 0:
            payouts.append({"t": day + timedelta(hours=6), "gross": -available, "fee": D(0), "desc": "STRIPE PAYOUT", "id": sid("po_1"), "txn": sid("txn_1")})
            available = D(0)
        day += timedelta(days=1)
    return sorted(payouts, key=lambda p: p["t"])


local = lambda t: t.astimezone(TZ).strftime("%Y-%m-%d %H:%M:%S")


def balance_rows(balance):
    out = []
    for r in balance:
        c = r.get("c")
        out.append({"balance_transaction_id": r["id"], "created": local(r["t"]), "available_on": local(r["avail"]), "currency": "eur",
                    "gross": f"{r['gross']:.2f}", "fee": f"{r['fee']:.2f}", "net": f"{r['net']:.2f}", "reporting_category": r["cat"],
                    "description": r["desc"], "customer_id": c["id"] if c else "", "customer_email": c["email"] if c else "",
                    "invoice_id": r.get("inv", ""), "subscription_id": r.get("sub", ""), "charge_id": r.get("ch", ""),
                    "customer_facing_amount": f"{r['cfa']:.2f}" if c else "", "customer_facing_currency": r.get("cfc", ""),
                    "payment_metadata[utm_source]": c["channel"] if c and r["utm"] else "",
                    "payment_metadata[utm_campaign]": CAMPAIGNS[c["channel"]][c["n"] % 3][0].split(" - ")[0].lower() if c and r["utm"] else ""})
    return out


def payout_rows(payouts):
    return [{"payout_id": p["id"], "effective_at": local(p["t"]), "currency": "eur", "gross": f"{p['gross']:.2f}", "fee": f"{p['fee']:.2f}",
             "net": f"{p['gross'] - p['fee']:.2f}", "reporting_category": "payout", "balance_transaction_id": p["txn"],
             "description": p["desc"], "payout_expected_arrival_date": (p["t"] + timedelta(days=0 if p["desc"] == "Instant payout" else 2)).strftime("%Y-%m-%d"),
             "payout_status": "paid"} for p in payouts]


def summary_rows(balance, payouts):
    ag, af = sum(r["gross"] for r in balance), sum(r["fee"] for r in balance)
    pg, pf = sum(p["gross"] for p in payouts), sum(p["fee"] for p in payouts)
    end = ag - af + pg - pf
    rows = [("starting_balance", f"Starting balance ({START:%Y-%m-%d})", 0), ("activity_gross", "Account activity before fees", ag),
            ("activity_fee", "Less fees", -af), ("activity", "Activity", ag - af), ("payouts_gross", "Payouts to bank", pg),
            ("payouts_fee", "Payout fees", -pf), ("payouts", "Total payouts", pg - pf), ("ending_balance", f"Ending balance ({END - timedelta(days=1):%Y-%m-%d})", end)]
    return [{"category": a, "description": b, "net_amount": f"{D(v):.2f}", "currency": ""} for a, b, v in rows]


def ads(rng, customers):
    """Daily spend per campaign, set so each paid sign-up cost its channel's rising price; Meta claims 30% more results than it brought."""
    spend, meta_rows, google_rows, signed, days = {}, [], [], {}, (END - START).days
    n_plan = len(customers) / sum(planned(m, 1) * SHOCK.get(m, 1) for m in months)  # the scale, recovered
    for c in customers:
        signed.setdefault((c["signup"].astimezone(TZ).date(), c["channel"]), []).append(c)
    day = START
    while day < END:
        m = month_of(day)
        d, f = day.strftime("%Y-%m-%d"), 1 + D("0.02") * idx[m]
        in_month = ((month_start(months[idx[m] + 1]) if idx[m] + 1 < len(months) else END) - month_start(m)).days
        for ch in COST_PER_SIGNUP:
            today = len(signed.get((day.date(), ch), []))
            g = (day - START).days / days
            expected = planned(m, n_plan) / in_month * SHARE(g)[list(CHURN).index(ch)]  # sign-ups the budget buys
            base = cents(COST_PER_SIGNUP[ch] * f * D(str(round(expected * rng.uniform(.85, 1.15), 4))))
            for camp, share in CAMPAIGNS[ch]:
                amount = cents(base * D(str(share)) * D(str(round(rng.uniform(.9, 1.1), 3))))
                spend[(d, ch)] = spend.get((d, ch), D(0)) + amount
                results = round(today * share * (1.3 if ch == "meta" else 1.0) + rng.random() * .6)
                impressions = int(amount * rng.randint(60, 110))
                if ch == "meta":
                    meta_rows.append({"Reporting starts": d, "Reporting ends": d, "Campaign name": camp, "Campaign delivery": "active",
                                      "Attribution setting": "7-day click or 1-day view", "Results": results or "",
                                      "Result indicator": "actions:offsite_conversion.fb_pixel_start_trial" if results else "",
                                      "Cost per results": f"{amount / results:.6f}" if results else "", "Ad set budget": f"{int(base * D(str(share)) * D('1.2'))}",
                                      "Ad set budget type": "Daily", "Amount spent (EUR)": f"{amount:.2f}", "Impressions": impressions,
                                      "Reach": int(impressions * .72), "Ends": "Ongoing", "Results (initial)": "", "Results (initial) indicator": ""})
                else:
                    google_rows.append({"Day": d, "Campaign": camp, "Currency code": "EUR", "Cost": f"{amount:.2f}",
                                        "Impr.": impressions, "Clicks": impressions // 40, "Conv.": f"{results:.2f}"})
        day += timedelta(days=1)
    return spend, meta_rows, google_rows


def card(rng, spend):
    """The company Amex: Meta and Google bill at rising thresholds (Meta also on the 1st), tools monthly, repaid monthly."""
    rows = []
    row = lambda t, desc, amount, cat, ext="": rows.append({"Date": t.strftime("%d/%m/%Y"), "Description": desc, "Amount": f"{amount:.2f}",
                                                             "Extended Details": ext, "Appears On Your Statement As": desc, "Address": "",
                                                             "City/State": "", "Zip Code": "", "Country": "", "Reference": f"'AT{rng.randint(10**14, 10**15 - 1)}'",
                                                             "Category": cat, "_t": t})
    gid = f"{rng.randint(10**9, 10**10 - 1)}"
    row(START, f"GOOGLE *ADS{gid}", D("1.00"), "Business Services-Advertising Services")  # card check, refunded
    row(START + timedelta(days=3), f"GOOGLE *ADS{gid}", D("-1.00"), "Business Services-Advertising Services")
    for ch, steps, desc in (("meta", [25, 50, 250, 500, 750], "FACEBK *"), ("google", [50, 200, 350, 500], "GOOGLE *ADS")):
        owed, step, paid_at, last, day = D(0), 0, 0, START, START
        while day < END:
            owed += spend.get((day.strftime("%Y-%m-%d"), ch), D(0))
            threshold = D(steps[min(step, len(steps) - 1)])
            due = owed >= threshold or (ch == "google" and (day - last).days >= 30 and owed > 0) or (ch == "meta" and day.day == 1 and owed >= 1)
            if due:
                code = gid if ch == "google" else "".join(rng.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(10))
                row(day + timedelta(days=1), desc + code, owed, "Business Services-Advertising Services")
                owed, last, paid_at = D(0), day, paid_at + 1
                step += paid_at % 2 == 0
            day += timedelta(days=1)
    ad_month = {}
    for (d, _), v in spend.items():
        ad_month[d[:7]] = ad_month.get(d[:7], 0) + v
    tools = [("APOLLO.IO", D(99), "usd"), ("CLAY LABS", D(149), "usd"), ("NOTION LABS", D(10), "usd"), ("FIGMA", D(15), "eur"), ("AWS EMEA", None, "eur")]
    for m in months:
        y, mm = map(int, m.split("-"))
        seats = 1 + int(ad_month.get(m, 0) // 50000)  # the growth team's tools grow with the ad budget
        for name, price, cur in tools:
            t = datetime(y, mm, 3 + len(name) % 5, tzinfo=TZ)
            price = price * seats if price and name in ACQ_TOOLS else price
            if name == "AWS EMEA":
                price = cents(D(180) + D(10) * idx[m] + D(str(round(rng.uniform(0, 40), 2))))
            if cur == "usd":
                rate, eur = fx(t), cents(price / fx(t) * D("1.02"))
                row(t, name, eur, "Business Services-Internet Services", f"Foreign Spend Amount: {price:.2f} US Dollars Commission Amount: {cents(price / rate * D('0.02')):.2f} Currency Exchange Rate: {rate}")
            else:
                row(t, name, price, "Business Services-Internet Services")
        if idx[m] >= 5:  # a growth freelancer from the sixth month
            row(datetime(y, mm, 20, tzinfo=TZ), "UPWORK -REF" + str(rng.randint(10**6, 10**7)), cents(D(rng.randint(800, 1500)) * seats), "Business Services-Other Services")
    rows.sort(key=lambda r: r["_t"])
    by_month = {}
    for r in rows:
        by_month[month_of(r["_t"])] = by_month.get(month_of(r["_t"]), D(0)) + D(r["Amount"])
    for m, total in by_month.items():
        y, mm = map(int, m.split("-"))
        t = datetime(y + mm // 12, mm % 12 + 1, 15, tzinfo=TZ)
        if t < END:
            row(t, "PAYMENT RECEIVED - THANK YOU", -total, "Fees & Adjustments")
    rows.sort(key=lambda r: r["_t"])
    for r in rows:
        del r["_t"]
    return rows


def truth(customers, balance, payouts, spend, amex):
    """The expected answers. MRR is at month end, in EUR at the charge's rate, before tax; new = first paid charge."""
    n = len(months)
    ends = [month_start(months[i + 1]) if i + 1 < n else END for i in range(n)]
    zero = lambda: [D(0)] * n
    mrr, mrr_list, paying, new = zero(), zero(), [set() for _ in range(n)], [[] for _ in range(n)]
    for c in customers:
        if c["paid"]:
            new[idx[month_of(c["paid"][0]["t"])]].append(c)
        for p in c["paid"]:
            i, until = idx[month_of(p["t"])], add_months(p["t"], p["months"]) + timedelta(hours=1)
            while i < n and ends[i] <= until:
                mrr[i] += p["mrr"]
                mrr_list[i] += p["mrr_list"]
                paying[i].add(c["n"])
                i += 1
    sums = {}
    for r in balance:
        i = idx[month_of(r["t"])]
        for k, v in ((r["cat"], r["gross"]), ("_fee", r["fee"]), ("_net", r["net"])):
            sums.setdefault(k, zero())[i] += v
    out, ad, tools = zero(), {ch: zero() for ch in COST_PER_SIGNUP}, zero()
    for p in payouts:
        out[idx[month_of(p["t"])]] -= p["gross"]
    for (d, ch), v in spend.items():
        ad[ch][idx[d[:7]]] += v
    for r in amex:
        m = f"{r['Date'][6:]}-{r['Date'][3:5]}"
        if m in idx and any(r["Description"].startswith(t) for t in ACQ_TOOLS):
            tools[idx[m]] += D(r["Amount"])
    cat = lambda k, i: sums.get(k, zero())[i]
    monthly = []
    for i, m in enumerate(months):
        row = {"month": m, "mrr": mrr[i], "mrr_before_discount": mrr_list[i], "paying_customers": len(paying[i]), "new_paying": len(new[i])}
        row.update({f"new_{ch}": sum(c["channel"] == ch for c in new[i]) for ch in CHURN})
        row.update({"new_with_utm": sum(c["utm"] for c in new[i]), "charges_gross": cat("charge", i), "refunds": cat("refund", i),
                    "disputes": cat("dispute", i) + cat("dispute_reversal", i), "stripe_fees": cat("_fee", i) - cat("fee", i),
                    "activity_net": cat("_net", i), "payouts": out[i],
                    "meta_spend": ad["meta"][i], "google_spend": ad["google"][i], "acquisition_tools": tools[i]})
        paid_new = row["new_meta"] + row["new_google"]
        row["paid_cac"] = cents((ad["meta"][i] + ad["google"][i]) / paid_new) if paid_new else ""
        row["blended_cac"] = cents((ad["meta"][i] + ad["google"][i] + tools[i]) / len(new[i])) if new[i] else ""
        monthly.append(row)
    channels = []
    offset = lambda c, p: idx[month_of(p["t"])] - idx[month_of(c["paid"][0]["t"])]
    for ch in CHURN:
        cs = [c for c in customers if c["channel"] == ch and c["paid"]]
        cohort = [c for c in cs if idx[month_of(c["paid"][0]["t"])] < 6]  # the first six months, observed for years
        kept = sum(any(offset(c, p) <= 12 < offset(c, p) + p["months"] for p in c["paid"]) for c in cohort) / max(len(cohort), 1)
        total = sum(ad[ch]) if ch in ad else D(0)
        cac = cents(total / len(cs)) if total else D(0)
        cohort_cac = cents(sum(ad[ch][:6]) / max(len(cohort), 1)) if total else D(0)
        cum, payback, per_month = D(0), "", {}  # net revenue after fees and tax, spread over the months each charge covers
        for c in cohort:
            for p in c["paid"]:
                for j in range(p["months"]):
                    per_month[offset(c, p) + j] = per_month.get(offset(c, p) + j, D(0)) + p["net_ex_tax"] / p["months"]
        for k in range(n):
            cum += per_month.get(k, D(0)) / max(len(cohort), 1)
            if payback == "" and cohort_cac and cum >= cohort_cac:
                payback = k + 1
        channels.append({"channel": ch, "paying_customers": len(cs), "linked_by_utm": sum(c["utm"] for c in cs), "ad_spend": total,
                         "cac": cac, "first_6m_cohort": len(cohort), "first_6m_cac": cohort_cac, "retained_12m": f"{kept:.3f}",
                         "payback_months_net_revenue": payback})
    return monthly, channels


def check(channels, monthly):
    by = {c["channel"]: c for c in channels}
    m, g = by["meta"], by["google"]
    assert g["cac"] >= D("1.5") * m["cac"], (g["cac"], m["cac"])
    assert g["payback_months_net_revenue"] and (not m["payback_months_net_revenue"] or g["payback_months_net_revenue"] < m["payback_months_net_revenue"]), (g, m)
    half = lambda rows, k: sum((r[k] for r in rows), D(0))
    early, late = monthly[:6], monthly[-6:]
    paid = lambda rows: (half(rows, "meta_spend") + half(rows, "google_spend")) / sum(r["new_meta"] + r["new_google"] for r in rows)
    blended = lambda rows: (half(rows, "meta_spend") + half(rows, "google_spend") + half(rows, "acquisition_tools")) / sum(r["new_paying"] for r in rows)
    rise, blend = paid(late) / paid(early), blended(late) / blended(early)
    assert rise >= D("1.2") and rise - blend >= D("0.25"), (rise, blend)  # the blended figure hides most of the rise


def trap(rng, files):
    """Data faults on top of the truth: rows are appended or edited, so row numbers stay meaningful."""
    plants, bal, meta = [], files["stripe_balance_activity"], files["meta_ads"]
    start = rng.randrange(len(bal) // 2, len(bal) - 40)
    n0 = len(bal)
    bal.extend(dict(r) for r in bal[start:start + 30])  # an overlapping second export pasted below the first
    plants += [("data_repeated_export_rows", "stripe_balance_activity", i + 1, "data") for i in range(n0, len(bal))]
    i = rng.choice([i for i, r in enumerate(bal[:n0]) if r["reporting_category"] == "charge"])
    bal[i]["net"] = f"{D(bal[i]['net']) + 10:.2f}"
    plants.append(("data_net_not_gross_minus_fee", "stripe_balance_activity", i + 1, "data"))
    n0 = len(meta)
    week = [r for r in meta if r["Reporting starts"] >= "2026-03-01"][:21]
    meta.append({k: k for k in meta[0]})  # the second export's header, pasted as a row
    meta.extend(dict(r) for r in week)
    plants += [("data_meta_second_export", "meta_ads", i + 1, "data") for i in range(n0, len(meta))]
    plants.append(("data_google_report_layout", "google_ads", 0, "data"))
    return plants


INVOICE_HEADER = ["id", "Amount Due", "Application Fee", "Billing", "Charge", "Closed", "Currency", "Customer", "Date (UTC)", "Description",
                  "Due Date (UTC)", "Ending Balance", "Forgiven", "Number", "Paid", "Paid At (UTC)", "Marked Uncollectible At (UTC)",
                  "Voided At (UTC)", "Finalized At (UTC)", "Minimum Line Item Period Start (UTC)", "Maximum Line Item Period End (UTC)",
                  "Period Start (UTC)", "Period End (UTC)", "Starting Balance", "Subscription", "Subtotal", "Total Discount Amount",
                  "Applied Coupons", "Tax", "Tax Percent", "Total", "Customer Email", "Amount Paid", "Status", "Customer Name",
                  "Exclusive Tax Amount", "Inclusive Tax Amount", "Merchant Tax ID", "Customer Tax ID", "Tax Filing Currency",
                  "Tax Filing Amount", "Tax Filing Currency Fx Rate", "From Invoice Invoice", "From Invoice Reason", "Latest Revision",
                  "Customer Address Line1", "Customer Address Line2", "Customer Address City", "Customer Address State",
                  "Customer Address Zip", "Customer Address Country", "Last Finalization Error Type", "Last Finalization Error Code",
                  "Automatic Tax Enabled"]


def write(path, rows, quoting=csv.QUOTE_MINIMAL):
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n", quoting=quoting)
        w.writeheader()
        w.writerows(rows)


def write_meta(path, rows):  # Meta quotes the fields that hold a space, as in the real export
    q = lambda v: f'"{v}"' if " " in str(v) or "," in str(v) else str(v)
    path.write_text("\n".join(",".join(q(v) for v in r) for r in [list(rows[0]), *[r.values() for r in rows]]) + "\n", encoding="utf-8", newline="\n")


def write_google(path, rows, clean):
    if clean:
        return write(path, rows)
    total = sum(D(r["Cost"]) for r in rows)
    money = lambda x: f"{x:,.2f}"
    last = END - timedelta(days=1)
    lines = ["Campaign report", f"{START.day} {START:%B %Y} - {last.day} {last:%B %Y}", "\t".join(rows[0])]
    lines += ["\t".join(money(D(v)) if k == "Cost" else str(v) for k, v in r.items()) for r in rows]
    lines += [f"Total: Account\t\tEUR\t{money(total)}\t\t\t", f"Total: Search\t\tEUR\t{money(total)}\t\t\t"]
    path.write_text("\n".join(lines) + "\n", encoding="utf-16", newline="\n")


if __name__ == "__main__":
    out = Path(sys.argv[1])
    opt = lambda k: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else None
    key, truth_dir, n = opt("--key"), opt("--truth"), opt("--scale")
    args = [a for a in sys.argv[2:] if not a.startswith("--") and a not in (key, truth_dir, n)]
    clean = "--clean" in sys.argv
    files, plants, monthly, channels = generate(int(args[0]) if args else 41, float(n or 1), clean)
    out.mkdir(parents=True, exist_ok=True)
    for name, rows in files.items():
        p = out / f"{name}.csv"
        if name.startswith("stripe_balance") or name == "stripe_payouts":
            write(p, rows, csv.QUOTE_ALL)  # the Reports exports quote every field
        elif name == "meta_ads":
            write_meta(p, rows)
        elif name == "google_ads":
            write_google(p, rows, clean)
        else:
            write(p, rows)
    if key:
        write(Path(key), [dict(zip(["plant", "tbl", "row_no", "scope"], p)) for p in plants])
    if truth_dir:
        Path(truth_dir).mkdir(parents=True, exist_ok=True)
        write(Path(truth_dir) / "truth_monthly.csv", monthly)
        write(Path(truth_dir) / "truth_channels.csv", channels)
