"""Wave 2 case inputs: the folders the analyst gets, in datasets/<source>/case-<name>/ (each holds files/).

Usage: python -I build_cases.py   (run fetch.py, convert.py and build_traps.py first)
- uci: case-bare (the sales CSVs only), case-csv and case-xlsx (with unit_costs.csv, a synthetic cost overlay);
- adventureworks: case (headed CSVs with pricing_policy.md), case-raw (the install files as shipped, with their schema);
- olist: case (the CSVs as shipped);
- uci case-competitor (UCI-7): case-csv with competitor_prices.csv, 200 of our products under reworded names and pack
  sizes plus 20 items we don't sell; case-out2 (OUT-2): the trapped copy with accounts.csv and three planted large
  customers, chosen among big accounts that pay like their peers and checked to rank among the 15 largest gaps, paying
  below their size band (legacy terms ×0.75, AM4's discounts ×0.70-0.85, prices per each on lines sold by the
  dozen ÷12); case-po5 (PO-5): the clean sheets with product_groups.csv and a cost overlay of tight margin bands per
  group, with a portfolio-wide low (top Decor product), a Cards-only high, a Bags-only low and a tiny control.
The cost overlay is seeded, so the keys built from it are fixed: every product gets a cost from its median selling
price and a margin drawn from 35% to 60%; products described as candles cost 15% more from 2011-04-01; two products
have no cost at all.
"""
import csv
import random
import re
import shutil
import statistics
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3] / 'datasets'
POLICY = """# Pricing policy (Adventure Works Cycles, fictional)

- Margin floor: bikes are priced for at least a 40% margin on current standard cost; other products at least 30%.
- Reseller prices are set from list price by the pricing team; reps may not change them.
- Discounts come only from special offers (SpecialOffer.csv): a line's discount must equal its offer's DiscountPct, its
  quantity must sit within the offer's MinQty and MaxQty (MaxQty blank means no upper limit), and the order date must
  fall within the offer's StartDate and EndDate.
- List price changes for resellers: at most one a year, announced 60 days ahead, largest accounts told by their rep.
"""


def fresh(path):
    shutil.rmtree(path, ignore_errors=True)
    (path / 'files').mkdir(parents=True)
    return path / 'files'


def copy_all(src, dst):
    for f in sorted(src.iterdir()):
        shutil.copy(f, dst / f.name)


def unit_costs(sales):
    price, words = defaultdict(list), {}
    for path in sales:
        with path.open(newline='') as f:
            for r in csv.DictReader(f):
                sku = r['StockCode'].upper()
                if re.fullmatch(r'[0-9]{5}[A-Z]{0,2}', sku) and not r['Invoice'].startswith(('C', 'A')) and int(r['Quantity']) > 0 and float(r['Price']) > 0:
                    price[sku].append(float(r['Price']))
                    words.setdefault(sku, r['Description'] or '')
    rng, rows = random.Random(51), []
    ranked = sorted(price, key=lambda s: (-sum(price[s]), s))
    missing = set(ranked[99:101])  # two products with no cost
    for sku in sorted(price):
        cost = round(statistics.median(price[sku]) * (1 - rng.uniform(0.35, 0.60)), 2)
        if sku in missing:
            continue
        rows.append((sku, '2009-12-01', f'{cost:.2f}'))
        if 'CANDLE' in words[sku].upper():
            rows.append((sku, '2011-04-01', f'{cost * 1.15:.2f}'))
    return rows, sorted(missing)


WORDS = lambda d: frozenset(re.findall(r'[A-Z0-9]+', d.upper()))
PRODUCT = re.compile(r'[0-9]{5}[A-Z]{0,2}')


def read_sheet(path):
    with path.open(newline='') as f:
        return list(csv.reader(f))


def write_sheet(path, rows):
    with path.open('w', newline='') as f:
        csv.writer(f).writerows(rows)


def sale(r):  # an ordinary 2011 product line with a positive quantity and price
    return r[4] >= '2011' and PRODUCT.fullmatch(r[1].upper()) and r[0].isdigit() and int(r[3]) > 0 and float(r[5]) > 0


def competitor(uci):
    out = fresh(uci / 'case-competitor')
    copy_all(uci / 'case-csv/files', out)
    rows = read_sheet(out / 'online_retail_2010_2011.csv')[1:]
    owners, names, rev, qty = defaultdict(set), defaultdict(Counter), defaultdict(float), defaultdict(int)
    for sheet in ('online_retail_2009_2010', 'online_retail_2010_2011'):
        for r in read_sheet(out / f'{sheet}.csv')[1:]:
            if PRODUCT.fullmatch(r[1].upper()) and r[2]:
                owners[WORDS(r[2])].add(r[1].upper())
                names[r[1].upper()][r[2]] += 1
    for r in rows:
        if sale(r):
            rev[r[1].upper()] += int(r[3]) * float(r[5])
            qty[r[1].upper()] += int(r[3])
    name = {s: names[s].most_common(1)[0][0] for s in rev}
    pool = sorted(s for s in rev if len(owners[WORDS(name[s])]) == 1 and len(name[s].split()) >= 2)
    rng, items = random.Random(53), []
    for s in rng.sample(pool, 200):
        w = name[s].title().split()
        pack = rng.choice((1, 1, 1, 6, 12, 24))
        items.append((' '.join(w[1:]) + ', ' + w[0] if len(w) >= 3 else ' '.join(w), pack, f'{rev[s] / qty[s] * rng.uniform(0.8, 1.25) * pack:.2f}'))
    decoys = [f'{a} {b}' for a in ('Bamboo', 'Titanium', 'Solar', 'Wireless', 'Smart') for b in ('Garden Kneeler', 'Phone Stand', 'Yoga Mat', 'Desk Organiser')]
    assert not any(WORDS(d) in owners for d in decoys)
    items += [(d, rng.choice((1, 6)), f'{rng.uniform(3, 30):.2f}') for d in decoys]
    rng.shuffle(items)
    write_sheet(out / 'competitor_prices.csv', [('item_description', 'pack_size', 'pack_price_gbp'), *items])


def out2(uci):
    out = fresh(uci / 'case-out2')
    copy_all(uci / 'trapped/files/data', out)
    path = out / 'online_retail_2010_2011.csv'
    head, *rows = read_sheet(path)
    rev, lines = defaultdict(float), Counter()
    for r in rows:
        if sale(r) and r[6]:
            rev[r[6]] += int(r[3]) * float(r[5])
            lines[r[6]] += 1
    ranked = sorted(rev, key=lambda c: (rev[c], c))
    band = {c: ('small', 'mid', 'large')[3 * i // len(ranked)] for i, c in enumerate(ranked)}
    def gaps():  # each customer's gap to its band's median price index, at reference (median) prices
        seen = defaultdict(list)
        for r in rows:
            if sale(r):
                seen[r[1].upper()].append(float(r[5]))
        ref = {k: statistics.median(v) for k, v in seen.items()}
        paid, base = defaultdict(float), defaultdict(float)
        for r in rows:
            if sale(r) and r[6]:
                paid[r[6]] += int(r[3]) * float(r[5])
                base[r[6]] += int(r[3]) * ref[r[1].upper()]
        index = {c: paid[c] / base[c] for c in base}
        med = {b: statistics.median(index[c] for c in index if band[c] == b) for b in ('small', 'mid', 'large')}
        return {c: (index[c] - med[band[c]]) * base[c] for c in index}, index, med
    _, index, med = gaps()
    rng = random.Random(54)
    typical = sorted((c for c in rev if band[c] == 'large' and lines[c] >= 100 and abs(index[c] - med['large']) <= 0.08), key=lambda c: (-rev[c], c))
    am4, legacy, dozen = typical[:3]  # the biggest accounts that pay like their peers, so the plants stand out
    others = rng.sample(sorted(c for c in rev if band[c] in ('mid', 'large') and c not in (legacy, am4, dozen)), 4)
    factor = {legacy: lambda: 0.75, am4: lambda: rng.uniform(0.70, 0.85), dozen: lambda: 1 / 12,
              **{c: (lambda: rng.uniform(0.88, 1.0)) for c in others}}  # AM4's other accounts: small discounts
    for r in rows:
        if sale(r) and r[6] in factor:
            r[5] = f'{max(0.01, float(r[5]) * factor[r[6]]()):.2f}'
    gap = gaps()[0]
    worst = sorted(gap, key=gap.get)[:15]
    assert {legacy, am4, dozen} <= set(worst), [(c, round(gap[c])) for c in (legacy, am4, dozen)]  # among the 15 largest gaps below peers
    write_sheet(path, [head, *rows])
    managers = {c: f'AM{i % 3 + 1}' for i, c in enumerate(sorted(rev))} | {c: 'AM4' for c in (am4, *others)}
    write_sheet(out / 'accounts.csv', [('customer_id', 'size_band', 'account_manager', 'terms'),
                                       *[(c, band[c], managers[c], 'legacy trade terms (2009)' if c == legacy else 'standard') for c in sorted(rev)]])
    print('out2 plants: legacy', legacy, 'AM4', am4, 'dozen', dozen)


BANDS = {'Decor': 0.45, 'Bags': 0.55, 'Kitchen': 0.50, 'Candles and lights': 0.40, 'Cards and wrap': 0.32}


def group(d):
    d = d.upper()
    return ('Bags' if 'BAG' in d else 'Candles and lights' if re.search('CANDLE|T-LIGHT|LIGHT|LANTERN', d)
            else 'Kitchen' if re.search('MUG|CUP|PLATE|BOWL|CAKE|TEA|JAR|SPOON', d) else 'Cards and wrap' if re.search('CARD|WRAP|PAPER', d) else 'Decor')


def po5(uci):
    out = fresh(uci / 'case-po5')
    copy_all(uci / 'clean/files/data', out)
    price, names, rev = defaultdict(list), defaultdict(Counter), defaultdict(float)
    for sheet in ('online_retail_2009_2010', 'online_retail_2010_2011'):
        for r in read_sheet(out / f'{sheet}.csv')[1:]:
            s = r[1].upper()
            if PRODUCT.fullmatch(s) and r[0].isdigit() and int(r[3]) > 0 and float(r[5]) > 0:
                price[s].append(float(r[5]))
                names[s][r[2]] += 1
            if PRODUCT.fullmatch(s) and r[4] >= '2011' and (r[0].startswith('C') or int(r[3]) > 0):
                rev[s] += int(r[3]) * float(r[5])  # net of cancellations, so a cancelled giant order doesn't rank
    groups = {s: group(names[s].most_common(1)[0][0]) for s in price}
    top = lambda g, n=0: sorted((s for s in rev if groups.get(s) == g), key=lambda s: (-rev[s], s))[n]
    plants = {top('Decor'): 0.12, top('Cards and wrap'): 0.45, top('Bags'): 0.44, top('Candles and lights', 300): 0.05}
    rng = random.Random(55)
    costs = [(s, '2009-12-01', f'{statistics.median(price[s]) * (1 - plants.get(s, BANDS[groups[s]] + rng.uniform(-0.02, 0.02))):.2f}') for s in sorted(price)]
    write_sheet(out / 'unit_costs.csv', [('sku', 'effective_from', 'unit_cost'), *costs])
    write_sheet(out / 'product_groups.csv', [('sku', 'product_group'), *sorted(groups.items())])
    print('po5 plants', plants)


def main():
    uci = ROOT / 'uci'
    bare = fresh(uci / 'case-bare')
    copy_all(uci / 'clean/files/data', bare)
    rows, missing = unit_costs(sorted(bare.glob('*.csv')))
    for name, src in (('case-csv', uci / 'clean/files/data'), ('case-xlsx', uci / 'xlsx/files/data')):
        out = fresh(uci / name)
        copy_all(src, out)
        with (out / 'unit_costs.csv').open('w', newline='') as f:
            csv.writer(f).writerows([('sku', 'effective_from', 'unit_cost'), *rows])
    print('uci: costs for', len({r[0] for r in rows}), 'products, rises', sum(r[1] != '2009-12-01' for r in rows), 'no cost', missing)
    aw = ROOT / 'adventureworks'
    out = fresh(aw / 'case')
    copy_all(aw / 'clean/files/data', out)
    (out / 'pricing_policy.md').write_text(POLICY)
    raw = fresh(aw / 'case-raw')
    copy_all(aw / 'raw-pack/files/data', raw)
    shutil.copy(aw / 'raw/instawdb.sql', raw / 'instawdb.sql')
    out = fresh(ROOT / 'olist/case')
    copy_all(ROOT / 'olist/clean/files/data', out)
    competitor(uci)
    out2(uci)
    po5(uci)
    print('built', sorted(str(p.relative_to(ROOT)) for p in ROOT.glob('*/case*')))


main()
