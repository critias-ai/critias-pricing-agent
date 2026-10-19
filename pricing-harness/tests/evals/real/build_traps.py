"""Wave 2 answer keys and trapped copies on the real sources (plan 2a step 3 and 3k), from the clean packs.

Usage: python -I build_traps.py [source ...]   (run fetch.py and convert.py first)
Writes into datasets/<source>/:
- natural.csv: faults already in the real data, each row found by a plain rule below. scope says whether a data-findings
  detector claims this kind of fault (detector), no detector exists for it (none), or it needs a business rule (rule).
- trapped/files/data: the clean pack with faults planted at seeded rows; plants.csv lists every planted row.
- file-plants.csv: planted faults with no rows to point at (a dropped month, an unreadable file), and what should happen.
Keys use the score_findings.py layout: plant, tbl, row_no (1 = first data row), scope.
"""
import csv
import random
import re
import shutil
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3] / 'datasets'
csv.field_size_limit(1 << 24)


class Pack:
    def __init__(self, source, seed):
        self.dir, self.rng, self.used = ROOT / source, random.Random(seed), set()
        self.t = {}
        for p in sorted((self.dir / 'clean/files/data').glob('*.csv')):
            with p.open(newline='', encoding='utf-8') as f:
                header, *rows = list(csv.reader(f))
            self.t[p.stem] = (header, rows)
        self.natural, self.plants, self.file_plants, self.encoding = [], [], [], {}

    def col(self, t, c):
        return self.t[t][0].index(c)

    def rows(self, t, test):  # indices of the table's rows passing test(row as dict)
        h, rows = self.t[t]
        return [i for i, r in enumerate(rows) if test(dict(zip(h, r)))]

    def found(self, plant, t, idx, scope):
        self.natural += [(plant, t, i + 1, scope) for i in idx]

    def pick(self, t, n, test=lambda r: True):
        idx = sorted(self.rng.sample([i for i in self.rows(t, test) if (t, i) not in self.used], n))
        self.used.update((t, i) for i in idx)
        return idx

    def plant(self, name, t, idx, change):  # change(row as dict) -> {column: new value}
        h, rows = self.t[t]
        for i in idx:
            for c, v in change(dict(zip(h, rows[i]))).items():
                rows[i][self.col(t, c)] = v
            self.plants.append((name, t, i + 1, 'data'))

    def append(self, name, t, new_rows):
        h, rows = self.t[t]
        for r in new_rows:
            rows.append(list(r))
            self.used.add((t, len(rows) - 1))
            self.plants.append((name, t, len(rows), 'data'))

    def whole_column(self, name, t, c, fmt):
        self.plant(name, t, range(len(self.t[t][1])), lambda r: {c: fmt(r[c])} if r[c] else {})

    def write(self):
        out = self.dir / 'trapped/files/data'
        shutil.rmtree(self.dir / 'trapped', ignore_errors=True)
        out.mkdir(parents=True)
        for t, (h, rows) in self.t.items():
            with (out / f'{t}.csv').open('w', newline='', encoding=self.encoding.get(t, 'utf-8')) as f:
                csv.writer(f).writerows([h, *rows])
        for name, rows, header in (('natural', self.natural, 'plant tbl row_no scope'), ('plants', self.plants, 'plant tbl row_no scope'),
                                   ('file-plants', self.file_plants, 'plant tbl expect')):
            with (self.dir / f'{name}.csv').open('w', newline='') as f:
                csv.writer(f).writerows([header.split(), *rows])
        for name, rows in (('natural', self.natural), ('plants', self.plants)):
            print(name, dict(Counter(r[0] for r in rows)))
        print('file plants', self.file_plants)


money = lambda v, k: f'{float(v) * k:.2f}'
PRODUCT = re.compile(r'^[0-9]{5}[A-Za-z]{0,2}$')


def uci():
    p, A, B = Pack('uci', 41), 'online_retail_2009_2010', 'online_retail_2010_2011'
    # Natural faults.
    for t in (A, B):
        seen = set()
        p.found('repeated_row', t, [i for i, r in enumerate(p.t[t][1]) if tuple(r) in seen or seen.add(tuple(r))], 'detector')
        p.found('stock_code_lowercase', t, p.rows(t, lambda r: re.fullmatch(r'[0-9]{5}[a-z]+', r['StockCode'])), 'detector')
        p.found('non_product_code', t, p.rows(t, lambda r: not PRODUCT.match(r['StockCode'])), 'detector')
        p.found('test_record', t, p.rows(t, lambda r: r['StockCode'].startswith('TEST')), 'detector')
        p.found('customer_id_missing', t, p.rows(t, lambda r: not r['Customer ID']), 'none')
        p.found('country_unspecified', t, p.rows(t, lambda r: r['Country'] == 'Unspecified'), 'none')
        p.found('negative_qty_not_cancellation', t, p.rows(t, lambda r: not r['Invoice'].startswith('C') and int(r['Quantity']) < 0), 'rule')
    last_a = max(r[p.col(A, 'InvoiceDate')] for r in p.t[A][1])  # the second sheet repeats the first one's last 9 days
    p.found('sheets_overlap', B, p.rows(B, lambda r: r['InvoiceDate'] <= last_a), 'none')
    # Planted faults, all in the 2010-2011 sheet after its overlap with the first one.
    sale = lambda r: r['InvoiceDate'] > last_a and PRODUCT.match(r['StockCode']) and r['Invoice'].isdigit() and int(r['Quantity']) > 0 and float(r['Price']) > 0
    h, rows = p.t[B]
    rows[:] = [r for r in rows if not r[p.col(B, 'InvoiceDate')].startswith('2011-03')]
    p.file_plants.append(('dropped_month', B, 'all of 2011-03 removed; a time gap should be reported'))
    p.plant('price_x100', B, p.pick(B, 15, sale), lambda r: {'Price': money(r['Price'], 100)})
    p.plant('each_vs_case_x12', B, p.pick(B, 20, lambda r: sale(r) and int(r['Quantity']) % 12 == 0),
            lambda r: {'Quantity': str(int(r['Quantity']) // 12), 'Price': money(r['Price'], 12)})
    cust = Counter(rows[i][p.col(B, 'Customer ID')] for i in p.rows(B, lambda r: sale(r) and r['Customer ID']))
    who = sorted(c for c, n in cust.items() if 40 <= n <= 60)[0]
    p.plant('currency_x117_stretch', B, p.pick(B, 25, lambda r: sale(r) and r['Customer ID'] == who), lambda r: {'Price': money(r['Price'], 1.17)})
    p.plant('renamed_sku', B, p.rows(B, lambda r: r['StockCode'] == '22423' and r['InvoiceDate'] >= '2011-07-01'), lambda r: {'StockCode': '22423R'})
    p.append('repeated_line', B, [list(rows[i]) for i in p.pick(B, 20, sale)])
    p.append('day_loaded_twice', B, [list(r) for r in rows if r[p.col(B, 'InvoiceDate')].startswith('2011-06-30')])
    p.write()


def adventureworks():
    p, H, D = Pack('adventureworks', 42), 'SalesOrderHeader', 'SalesOrderDetail'
    order_date = {r[0]: r[2] for r in p.t[H][1]}
    sell_end = {r[0]: r[p.col('Product', 'SellEndDate')] for r in p.t['Product'][1]}
    offers = {r[0]: r for r in p.t['SpecialOffer'][1]}
    p.found('sold_after_sell_end', D, p.rows(D, lambda r: sell_end[r['ProductID']] and order_date[r['SalesOrderID']] > sell_end[r['ProductID']]), 'none')
    p.found('offer_not_applied', D, p.rows(D, lambda r: abs(float(r['UnitPriceDiscount']) - float(offers[r['SpecialOfferID']][2])) > 1e-4), 'rule')
    p.found('fixed_width_padding', 'Product', p.rows('Product', lambda r: any(r[c].endswith(' ') for c in ('ProductLine', 'Class', 'Style'))), 'none')
    full = lambda r: float(r['UnitPrice']) > 0
    p.plant('price_x100', D, p.pick(D, 15, full), lambda r: {'UnitPrice': money(r['UnitPrice'], 100), 'LineTotal': money(r['LineTotal'], 100)})
    p.plant('sign_flipped', D, p.pick(D, 10, full), lambda r: {'UnitPrice': '-' + r['UnitPrice'], 'LineTotal': '-' + r['LineTotal']})
    p.plant('unknown_product', D, p.pick(D, 10), lambda r: {'ProductID': '9999'})
    p.plant('ship_before_order', H, p.pick(H, 8, lambda r: r['OrderDate'][8:10] != '01'), lambda r: {'ShipDate': r['OrderDate'][:8] + '01' + r['OrderDate'][10:]})
    p.plant('future_order_date', H, p.pick(H, 5), lambda r: {'OrderDate': '2031' + r['OrderDate'][4:]})
    p.whole_column('due_date_day_first', H, 'DueDate', lambda v: f'{v[8:10]}/{v[5:7]}/{v[:4]}')
    h, rows = p.t[D]
    p.append('repeated_line', D, [list(rows[i]) for i in p.pick(D, 10)])
    lines = Counter(x[0] for x in rows)
    order = p.t[H][1][p.pick(H, 1, lambda r: lines[r['SalesOrderID']] >= 5)[0]]
    p.append('order_rekeyed_header', H, [['99999', *order[1:7], 'SO99999', *order[8:24], 'A0000000-0000-0000-0000-000000099999', order[25]]])
    p.append('order_rekeyed_lines', D, [['99999', str(900000 + k), *r[2:9], f'B0000000-0000-0000-0000-{k:012d}', r[10]]
                                        for k, r in enumerate(x for x in rows if x[0] == order[0])])
    p.file_plants.append(('raw_install_files', 'raw-pack', 'headerless tab files read with the first row as header; Store.csv (+| fields) not read, with a clear reason'))
    p.write()


def olist():
    p, O, I, P, S = Pack('olist', 43), 'olist_orders_dataset', 'olist_order_items_dataset', 'olist_order_payments_dataset', 'olist_sellers_dataset'
    p.found('carrier_before_purchase', O, p.rows(O, lambda r: r['order_delivered_carrier_date'] and r['order_delivered_carrier_date'] < r['order_purchase_timestamp']), 'detector')
    p.found('delivered_before_carrier', O, p.rows(O, lambda r: r['order_delivered_customer_date'] and r['order_delivered_carrier_date'] and r['order_delivered_customer_date'] < r['order_delivered_carrier_date']), 'detector')
    reviews = Counter(r[0] for r in p.t['olist_order_reviews_dataset'][1])
    p.found('review_id_repeated', 'olist_order_reviews_dataset', p.rows('olist_order_reviews_dataset', lambda r: reviews[r['review_id']] > 1), 'detector')
    named = {r[0] for r in p.t['product_category_name_translation'][1]}
    p.found('category_not_in_translation', 'olist_products_dataset', p.rows('olist_products_dataset', lambda r: r['product_category_name'] and r['product_category_name'] not in named), 'detector')
    p.found('category_missing', 'olist_products_dataset', p.rows('olist_products_dataset', lambda r: not r['product_category_name']), 'none')
    p.found('seller_city_not_a_city', S, p.rows(S, lambda r: re.search(r'[0-9@/\\]', r['seller_city'])), 'none')
    p.found('delivered_without_date', O, p.rows(O, lambda r: r['order_status'] == 'delivered' and not r['order_delivered_customer_date']), 'rule')
    p.found('canceled_but_delivered', O, p.rows(O, lambda r: r['order_status'] == 'canceled' and r['order_delivered_customer_date']), 'rule')
    p.file_plants.append(('month_missing_natural', O, 'no orders in 2016-11 between 2016-10 and 2016-12; a time gap should be reported'))
    sold = lambda r: float(r['price']) > 0
    p.plant('price_x100', I, p.pick(I, 15, sold), lambda r: {'price': money(r['price'], 100)})
    p.plant('unknown_product', I, p.pick(I, 10), lambda r: {'product_id': 'f' * 32})  # sellers is the unreadable file, so not seller_id
    p.plant('delivered_before_purchase', O, p.pick(O, 8, lambda r: r['order_delivered_customer_date'] > r['order_purchase_timestamp'][:10]),
            lambda r: {'order_delivered_customer_date': str(int(r['order_purchase_timestamp'][:4]) - 1) + r['order_delivered_customer_date'][4:]})
    p.plant('category_case_variant', 'olist_products_dataset', p.pick('olist_products_dataset', 20, lambda r: r['product_category_name'] == 'beleza_saude'),
            lambda r: {'product_category_name': 'Beleza_Saude'})
    p.whole_column('freight_in_reais_text', I, 'freight_value', lambda v: 'R$ ' + v.replace('.', ','))
    p.whole_column('payment_decimal_comma', P, 'payment_value', lambda v: v.replace('.', ','))
    h, rows = p.t[I]
    p.append('repeated_line', I, [list(rows[i]) for i in p.pick(I, 15)])
    p.encoding[S] = 'utf-16'
    p.file_plants.append(('utf16_file', S, 'not read, with a clear reason'))
    p.write()


for source in sys.argv[1:] or ('uci', 'adventureworks', 'olist'):
    print('==', source)
    globals()[source]()
