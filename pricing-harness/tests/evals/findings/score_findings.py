"""Score data findings against answer keys, crediting each fault only to the detector meant to catch it.

Usage: python -I score_findings.py <seeded findings.json> <clean findings.json> <plants csv> [--natural CSV] [--files CSV]
- plants: faults planted in the seeded copy; natural: faults already in the clean copy (scored on the clean findings).
- A fault is caught when findings of its intended detector (INTENDED: detector or detector:issue prefix) flag at least
  90% of its rows. Whole-column plants flag every row of their table, so crediting any finding would hide misses there.
- A fault is out of scope when its key says so (scope business, none or rule) or INTENDED names no detector.
- files: faults with no rows (an unreadable file); utf16 ones must be skipped with a reason naming UTF-8.
- Noise: clean findings of which under half the rows are natural faults' rows (any scope). Unexplained: seeded findings on no planted row and not on clean.
"""
import argparse
import json
from pathlib import Path

import duckdb

PARSE, RATIO, DUP, ROW, VARIANT = ['parse'], ['ratio'], ['uniqueness:duplicate-key'], ['uniqueness:repeated-row'], ['shape:variant']
INTENDED = {
    # Northbridge (.cache/seeded-pack)
    'columns_shifted': PARSE, 'cost_dates_reversed': ['time'], 'cost_decimal_shift': RATIO, 'cost_in_pence': RATIO,
    'cost_interval_overlap': ['time'], 'customer_duplicate_key': DUP, 'customer_id_as_float': ['parse:float-formatted'],
    'customer_id_is_product_id': ['domain'], 'customer_name_in_id': ['domain'], 'customer_placeholder': ['domain'],
    'date_excel_serial': ['parse:serial-date'], 'date_future_year': ['time:after today'], 'date_impossible': ['parse:invalid-date'],
    'date_month_first': ['parse:slash-date'], 'day_loaded_twice': ROW, 'header_row_repeated': ['parse:header-text', 'shape', 'domain'],
    'invoice_rekeyed_duplicate': ['uniqueness:repeated-document'], 'price_currency_symbol': ['parse:currency-symbol'],
    'price_decimal_comma': ['parse:decimal-comma'], 'price_decimal_shift': RATIO, 'price_in_pence': RATIO, 'product_duplicate_key': DUP,
    'product_id_lowercase': VARIANT, 'product_id_trailing_space': ['shape'], 'product_id_unknown': ['domain'],
    'product_id_zero_width_char': ['shape'], 'quantity_extra_zeros': RATIO, 'quantity_in_packs': RATIO,
    'quantity_price_swapped': ['parse:non-integer', 'ratio'], 'quantity_with_unit_text': ['parse:unit-text'],
    'sign_flipped_sale': ['ratio:negative'], 'silent_currency': RATIO, 'test_record': ['domain', 'shape'], 'total_row': ['domain', 'shape'],
    'value_not_quantity_times_price': ['identity'], 'value_parenthesised_negative': ['parse:parenthesised-negative'],
    'value_thousands_separator': ['parse:thousands-separator'],
    # S2 B2B, S3 SaaS (wave 1)
    'data_freight_as_text': PARSE, 'data_future_date': ['time:after today'], 'data_line_value_mismatch': ['identity'],
    'data_pack_of_24': RATIO, 'data_price_x10': RATIO, 'data_quote_valid_before_made': ['time'], 'data_rebate_quarter_format': ['shape'],
    'data_rep_lowercase': VARIANT, 'data_repeated_line': ROW, 'data_unknown_customer': ['domain'],
    'data_uom_case_priced_each': None,  # quantity read against unit of measure: a business rule (open item 9)
    'data_annual_value_as_mrr': RATIO, 'data_billed_after_churn': ['time'], 'data_future_month': ['time:after today'],
    'data_mrr_as_text': PARSE, 'data_mrr_mismatch': None,  # identity with a discount term: left to skills or the user
    'data_negative_seats': ['ratio:negative'], 'data_plan_name_case': VARIANT, 'data_repeated_row': ROW,
    # Wave 2 planted (UCI, AdventureWorks, Olist)
    'currency_x117_stretch': None, 'renamed_sku': None, 'each_vs_case_x12': RATIO, 'price_x100': RATIO, 'repeated_line': ROW,
    'due_date_day_first': ['parse:slash-date'], 'future_order_date': ['time:after today'], 'ship_before_order': ['time'],
    'order_rekeyed_header': ['uniqueness:repeated-document'], 'order_rekeyed_lines': ['uniqueness:repeated-document'],
    'sign_flipped': ['ratio:negative'], 'unknown_product': ['domain'], 'category_case_variant': VARIANT,
    'delivered_before_purchase': ['time'], 'freight_in_reais_text': PARSE, 'payment_decimal_comma': ['parse:decimal-comma'],
    # Wave 2 natural, scope detector
    'repeated_row': ROW, 'stock_code_lowercase': VARIANT, 'non_product_code': ['shape'],
    'carrier_before_purchase': ['time'], 'delivered_before_carrier': ['time'], 'review_id_repeated': DUP,
    'category_not_in_translation': ['domain'],
}

a = argparse.ArgumentParser()
a.add_argument('seeded'), a.add_argument('clean'), a.add_argument('plants'), a.add_argument('--natural'), a.add_argument('--files')
args = a.parse_args()
db = duckdb.connect()
stem = "regexp_extract(source, '([^/#]+)[.](csv|xlsx)', 1)"
results = []


def load(tag, path):
    out = json.loads(Path(path).read_text())
    rows = [(f['id'], f['detector'], f['source'], f['column'], f['issue'], f['rows']) for f in out['findings']]
    db.execute(f'CREATE TABLE {tag}_findings (id VARCHAR, detector VARCHAR, source VARCHAR, "column" VARCHAR, issue VARCHAR, "rows" BIGINT)')
    if rows:
        db.executemany(f'INSERT INTO {tag}_findings VALUES (?, ?, ?, ?, ?, ?)', rows)
    db.execute(f"""CREATE TABLE {tag}_hits AS SELECT x.rid, g.*, {stem} tbl
        FROM read_parquet('{out['findingsDir']}/flags.parquet') x JOIN {tag}_findings g ON g.id = x.finding""")
    return out


def score(tag, key):
    cols = db.execute(f"SELECT * FROM read_csv('{key}') LIMIT 0").description
    scope = 'scope' if 'scope' in [c[0] for c in cols] else "'data'"
    db.execute(f"CREATE OR REPLACE TABLE k AS SELECT plant, tbl, row_no - 1 AS rid, {scope} AS scope FROM read_csv('{key}')")
    for plant, tbl, scope, n in db.execute('SELECT plant, tbl, any_value(scope), count(*) FROM k GROUP BY 1, 2 ORDER BY 1, 2').fetchall():
        want = INTENDED.get(plant, []) if scope in ('data', 'detector') else None
        rx = '^(' + '|'.join(w.replace(' ', '[ ]') for w in want) + ')' if want else '^$'
        flagged, by = db.execute(f"""SELECT count(DISTINCT k.rid), string_agg(DISTINCT h.detector || ':' || h.issue, '; ')
            FROM k JOIN {tag}_hits h ON h.tbl = k.tbl AND h.rid = k.rid WHERE k.plant = ? AND k.tbl = ?
            AND regexp_matches(h.detector || ':' || h.issue, ?)""", [plant, tbl, rx]).fetchone()
        results.append((tag, plant, tbl, n, flagged, None if want is None else flagged >= 0.9 * n, by or ''))


seeded, clean = load('seeded', args.seeded), load('clean', args.clean)
score('seeded', args.plants)
if args.natural:
    score('clean', args.natural)
for tag, plant, tbl, n, flagged, ok, by in sorted(results, key=lambda r: (r[5] is None, r[5] is True, r[0], r[1])):
    print(f"{'out-of-scope' if ok is None else 'CAUGHT' if ok else 'missed'} {tag:6} {plant:30} {tbl:28} {flagged}/{n}  {by}"[:240])
for plant, tbl, expect in (db.execute(f"SELECT * FROM read_csv('{args.files}')").fetchall() if args.files else []):
    if 'utf16' in plant:
        ok = any(c['status'] == 'skipped' and 'UTF-8' in c.get('reason', '') and tbl in c['source'] for c in seeded['coverage'])
        results.append(('file', plant, tbl, 1, int(ok), ok, ''))
        print(f"{'CAUGHT' if ok else 'missed'} file   {plant}")
    else:
        print(f'out-of-scope file   {plant}: {expect}')
scored = [r for r in results if r[5] is not None]
print(f"caught {sum(r[5] for r in scored)}/{len(scored)} in scope ({sum(r[5] for r in scored if r[0] == 'seeded')}/{sum(r[0] == 'seeded' for r in scored)} planted, "
      f"{sum(r[5] for r in scored if r[0] == 'clean')}/{sum(r[0] == 'clean' for r in scored)} natural)")
on = "k.tbl = h.tbl AND k.rid = h.rid" if args.natural else 'false'
noise = db.execute(f"""SELECT detector, source, "column", issue, "rows" FROM clean_findings WHERE id NOT IN (
    SELECT h.id FROM clean_hits h JOIN clean_findings g USING (id) WHERE EXISTS (SELECT 1 FROM k WHERE {on}) GROUP BY h.id, g."rows" HAVING 2 * count(*) >= g."rows")
    ORDER BY "rows" DESC""").fetchall()
print(f'noise: {len(noise)} clean findings on no natural fault, {sum(r[4] for r in noise)} rows')
for r in noise:
    print('  noise', r)
unexplained = db.execute("""SELECT id, detector, source, "column", issue, "rows" FROM seeded_findings WHERE id NOT IN (SELECT id FROM clean_findings)
    AND id NOT IN (SELECT h.id FROM seeded_hits h JOIN read_csv(?) p ON p.tbl = h.tbl AND p.row_no - 1 = h.rid)""", [args.plants]).fetchall()
print(f'findings: seeded {len(seeded["findings"])}, clean {len(clean["findings"])}, unexplained {len(unexplained)}')
for u in unexplained:
    print('  unexplained', u)
