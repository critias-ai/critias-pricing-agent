"""Copy a workspace's files/ and plant buried anomalies in its CSVs; write the answer key elsewhere.

Usage: python -I seed_anomalies.py <clean files dir> <out files dir> <answer key csv>
Key columns: plant, tbl, row_no (1 = first data row of the output file), first_value (the row's first column).
"""

import shutil
import sys
from pathlib import Path

import duckdb

S, PM, CM, PC = 'sales_transactions', 'product_master', 'customer_master', 'product_cost_history'


def scale(col, k, plus=''):
    return f"cast(round(try_cast({col} as double) * {k} {plus}, 4) as varchar)"


def shift(cols):  # a description split on its first space pushes every later field one column right
    i = cols.index('description')
    return {'description': "split_part(description, ' ', 1)", cols[i + 1]: "substr(description, strpos(description, ' ') + 1)"} | {
        cols[j]: cols[j - 1] for j in range(i + 2, len(cols))}


TS, P, V, Q = 'transaction_timestamp', 'unit_price_gbp', 'line_value_gbp', 'quantity'
SALE = f"invoice_id not like 'C%' and try_cast({Q} as int) > 0"
NAME = f"(select any_value(customer_name) from {CM} m where m.customer_id = {S}.customer_id)"
TOTAL = f"(select cast(round(sum(try_cast({V} as double)), 2) as varchar) from {S})"
REKEY = "cast(cast(substr(line_id, 6) as bigint) + 2000000 as varchar)"
# plant, table, action, rows (None = all matching), filter, {column: SQL expression} or cols -> that dict
PLANTS = [
    ('customer_name_in_id', S, 'set', 40, 'customer_id is not null', {'customer_id': NAME}),
    ('customer_id_as_float', S, 'set', 30, 'customer_id is not null', {'customer_id': "customer_id || '.0'"}),
    ('customer_placeholder', S, 'set', 25, 'customer_id is not null', {'customer_id': "'N/A'"}),
    ('customer_id_is_product_id', S, 'set', 15, "customer_id is not null and product_id similar to '[0-9]{5}'", {'customer_id': 'product_id'}),
    ('product_id_lowercase', S, 'set', 40, "product_id = '85123A'", {'product_id': 'lower(product_id)'}),
    ('product_id_trailing_space', S, 'set', 30, "product_id = '22423'", {'product_id': "product_id || ' '"}),
    ('product_id_zero_width_char', S, 'set', 20, "product_id = '84879'", {'product_id': 'product_id || chr(8203)'}),
    ('product_id_unknown', S, 'set', 20, "product_id similar to '[0-9]{5}'", {'product_id': "'9' || product_id"}),
    ('quantity_with_unit_text', S, 'set', 25, 'true', {Q: f"{Q} || ' pcs'"}),
    ('price_decimal_comma', S, 'set', 30, f"{P} like '%.%'", {P: f"replace({P}, '.', ',')"}),
    ('price_currency_symbol', S, 'set', 20, 'true', {P: f"'£' || {P}"}),
    ('value_thousands_separator', S, 'set', 15, f'try_cast({V} as double) >= 1000', {V: rf"regexp_replace({V}, '^(\d+)(\d{{3}})', '\1,\2')"}),
    ('value_parenthesised_negative', S, 'set', 15, f"{V} like '-%'", {V: f"'(' || ltrim({V}, '-') || ')'"}),
    ('date_month_first', S, 'set', 40, f'day(try_cast({TS} as timestamp)) <= 12', {TS: f"strftime(try_cast({TS} as timestamp), '%m/%d/%Y %H:%M')"}),
    ('date_excel_serial', S, 'set', 10, 'true', {TS: f'cast(round(epoch(try_cast({TS} as timestamp)) / 86400 + 25569, 5) as varchar)'}),
    ('date_future_year', S, 'set', 5, 'true', {TS: f"'2031' || substr({TS}, 5)"}),
    ('date_impossible', S, 'set', 5, f"{TS} like '2010-02-%'", {TS: f"'2010-02-30' || substr({TS}, 11)"}),
    ('price_in_pence', S, 'set', 6, f"product_id = '85123A' and try_cast({Q} as int) >= 32", {P: scale(P, 100), V: scale(V, 100)}),
    ('quantity_extra_zeros', S, 'set', 5, f"product_id = '22086' and try_cast({Q} as int) between 1 and 24", {Q: f"{Q} || '00'", V: scale(V, 100)}),
    ('quantity_in_packs', S, 'set', 20, f'{SALE} and try_cast({Q} as int) % 12 = 0', {Q: f'cast(try_cast({Q} as int) // 12 as varchar)', P: scale(P, 12)}),
    ('silent_currency', S, 'set', 25, SALE, {P: scale(P, 1.17), V: scale(V, 1.17)}),
    ('price_decimal_shift', S, 'set', 15, SALE, {P: scale(P, 0.1), V: scale(V, 0.1)}),
    ('quantity_price_swapped', S, 'set', 15, SALE, {Q: P, P: Q}),
    ('sign_flipped_sale', S, 'set', 20, SALE, {P: f"'-' || {P}", V: f"'-' || {V}"}),
    ('value_not_quantity_times_price', S, 'set', 30, SALE, {V: scale(V, 1, '+ 10')}),
    ('test_record', S, 'set', 10, SALE, {'customer_id': "'TEST'", 'product_id': "'TEST'", 'description': "'TEST ITEM - IGNORE'"}),
    ('columns_shifted', S, 'set', 3, "description like '% %'", shift),
    ('day_loaded_twice', S, 'add', None, f"{TS} like '2010-06-30%'", {}),
    ('invoice_rekeyed_duplicate', S, 'add', None, f"invoice_id in (select invoice_id from {S} where product_id = '22423' and {SALE} order by hash(invoice_id) limit 3)",
     {'invoice_id': 'cast(cast(invoice_id as int) + 400000 as varchar)', 'line_id': f"'ORII-' || lpad({REKEY}, 10, '0')", 'source_row': f'cast(cast(source_row as bigint) + 2000000 as varchar)'}),
    ('header_row_repeated', S, 'add', 1, 'true', lambda cols: {c: f"'{c}'" for c in cols}),
    ('total_row', S, 'add', 1, 'true', lambda cols: {c: 'null' for c in cols} | {'product_id': "'TOTAL'", V: TOTAL}),
    ('product_duplicate_key', PM, 'add', None, "product_id = '47566'", {'product_record_id': "product_record_id || '-2'", 'category': "'SEASONAL_FESTIVE'"}),
    ('customer_duplicate_key', CM, 'add', 5, 'true', {'customer_record_id': "customer_record_id || '-2'", 'region': "case region when 'UK' then 'Europe' else 'UK' end"}),
    ('cost_decimal_shift', PC, 'set', None, "cost_record_id = 'PCH-84D833EABA66A249'", {'unit_cost_gbp': scale('unit_cost_gbp', 0.1)}),
    ('cost_in_pence', PC, 'set', 10, "cost_status = 'HISTORICAL'", {'unit_cost_gbp': scale('unit_cost_gbp', 100)}),
    ('cost_interval_overlap', PC, 'add', 1, "product_id = '22086' and valid_to = '2011-01-01'", {'cost_record_id': "cost_record_id || '-2'", 'valid_to': "'2011-07-01'", 'unit_cost_gbp': scale('unit_cost_gbp', 0.6)}),
    ('cost_dates_reversed', PC, 'set', 5, "cost_status = 'HISTORICAL'", {'valid_from': 'valid_to', 'valid_to': 'valid_from'}),
]

src, out, key = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
tables = list(dict.fromkeys(p[1] for p in PLANTS))
shutil.copytree(src, out, ignore=lambda d, names: [n for n in names if n[:-4] in tables])
db = duckdb.connect()
for t in tables:
    db.execute(f"create table {t} as select *, (row_number() over ())::double ord, null::varchar planted from read_csv('{src}/data/{t}.csv', all_varchar = true)")
for name, t, action, n, where, cols in PLANTS:
    cols = cols(db.table(t).columns[:-2]) if callable(cols) else cols
    pick = f"ord in (select ord from {t} where planted is null and ({where}) order by hash(ord, '{name}') {f'limit {n}' if n else ''})"
    if action == 'set':
        db.execute(f"update {t} set {', '.join(f'{c} = {e}' for c, e in cols.items())}, planted = '{name}' where {pick}")
    else:
        db.execute(f"insert into {t} select * replace ({', '.join(f'{e} as {c}' for c, e in cols.items())}{', ' if cols else ''}ord + 0.5 as ord, '{name}' as planted) from {t} where {pick}")
keys = []
for t in tables:
    first = db.table(t).columns[0]
    db.execute(f"copy (select * exclude (ord, planted) from {t} order by ord) to '{out}/data/{t}.csv' (header)")
    keys.append(f"select planted plant, '{t}' tbl, r row_no, k first_value from (select planted, row_number() over (order by ord) r, {first} k from {t}) where planted is not null")
key.parent.mkdir(parents=True, exist_ok=True)
db.execute(f"copy ({' union all '.join(keys)} order by tbl, row_no) to '{key}' (header)")
counts = dict(db.sql(f"select plant, count(*) from read_csv('{key}') group by 1").fetchall())
assert len(counts) == len(PLANTS), f'plants that matched no rows: {sorted({p[0] for p in PLANTS} - set(counts))}'
print(f'{sum(counts.values())} rows planted across {len(counts)} plants; key: {key}')
