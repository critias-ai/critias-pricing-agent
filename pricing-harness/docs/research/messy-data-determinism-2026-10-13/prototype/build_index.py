"""Prototype workspace index for the Northbridge sample pack (experiment only).

Hand-wired to this pack's tables and columns, but every check is one a generic
profiler could run: key uniqueness, exact repeats, blanks, signs, referential
gaps, join fan-out, interval overlap, as-of coverage, partial periods and a
tie-out against a rollup. It records counts and value at stake only; it makes
no business judgement (for example it never says what POST is).

Usage: python -I build_index.py <files/data dir> <output dir> [--prepared-view]
Writes index.md (prompt text), issues.json (detail) and, with --prepared-view,
sales_costed.parquet plus the view section in index.md.
"""

import json
import sys
from pathlib import Path

import duckdb

src, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
prepared = '--prepared-view' in sys.argv
# Experiment 2: bound columns, a ranking certifier and controller-supplied diagnostics.
code_checks = '--code-checks' in sys.argv
out.mkdir(parents=True, exist_ok=True)
c = duckdb.connect()
c.execute('SET threads=4')


def csv(name):
    return f"read_csv('{src / name}.csv', all_varchar=true, header=true)"


def one(sql):
    return c.execute(sql).fetchone()


def rows(sql):
    return c.execute(sql).fetchall()


def gbp(x):
    return f'£{float(x or 0):,.0f}'


def pct(a, b):
    return f'{100 * float(a or 0) / float(b):.2f}%' if b else 'n/a'


c.execute(f"""CREATE VIEW sales AS SELECT line_id, source_row, invoice_id, product_id, description,
  nullif(trim(customer_id), '') AS customer_id, country,
  CAST(quantity AS DOUBLE) AS qty, CAST(unit_price_gbp AS DECIMAL(18,6)) AS price,
  CAST(transaction_timestamp AS TIMESTAMP) AS ts, CAST(transaction_timestamp AS DATE) AS d,
  CAST(line_value_gbp AS DECIMAL(18,6)) AS value FROM {csv('sales_transactions')}""")
c.execute(f'CREATE VIEW pm_raw AS SELECT * FROM {csv("product_master")}')
c.execute(f'CREATE VIEW cm_raw AS SELECT * FROM {csv("customer_master")}')
# One row per business key: duplicate master keys carry identical payloads (checked below).
c.execute('CREATE VIEW pm AS SELECT * EXCLUDE (rn) FROM (SELECT *, row_number() OVER (PARTITION BY product_id ORDER BY product_record_id) rn FROM pm_raw) WHERE rn = 1')
c.execute('CREATE VIEW cm AS SELECT * EXCLUDE (rn) FROM (SELECT *, row_number() OVER (PARTITION BY customer_id ORDER BY customer_record_id) rn FROM cm_raw) WHERE rn = 1')
c.execute(f"""CREATE VIEW cost AS SELECT cost_record_id, product_id, currency, cost_uom, cost_status,
  TRY_CAST(nullif(trim(unit_cost_gbp), '') AS DECIMAL(18,6)) AS unit_cost,
  CAST(valid_from AS DATE) AS vf, CAST(valid_to AS DATE) AS vt FROM {csv('product_cost_history')}""")

issues = []


def issue(iid, check, severity, where, finding, default, confidence='exact', detail=None):
    issues.append(dict(id=iid, check=check, severity=severity, where=where, finding=finding,
                       default=default, confidence=confidence, detail=detail or {}))


n_sales, total_value = one('SELECT count(*), sum(value) FROM sales')
d_min, d_max = one('SELECT min(d), max(d) FROM sales')

# Inventory: rows and business-key uniqueness per table.
keys = {
    'sales_transactions': ['line_id'], 'product_master': ['product_id'], 'customer_master': ['customer_id'],
    'product_cost_history': ['cost_record_id'], 'price_list_history': ['price_list_record_id'],
    'invoice_headers': ['invoice_id'], 'credits_returns_view': ['line_id'], 'finance_monthly': ['reporting_month'],
    'rebates_adjustments': ['adjustment_event_id'], 'service_costs': ['cost_event_id', 'cost_type'],
    'customer_agreements': ['agreement_record_id'], 'contract_exceptions': ['exception_record_id'],
    'approval_rules': ['rule_id'], 'approval_log': ['approval_record_id'],
    'open_quotes_orders': ['document_id', 'line_no'],
}
inventory = {}
for table, key in keys.items():
    k = ', '.join(key)
    n, distinct = one(f'SELECT count(*), count(DISTINCT ({k})) FROM {csv(table)}')
    inventory[table] = dict(rows=n, key=k, duplicate_keys=n - distinct)

# key_dup on masters, with payload comparison.
for table, key, rid in [('product_master', 'product_id', 'product_record_id'), ('customer_master', 'customer_id', 'customer_record_id')]:
    dups = rows(f"""SELECT {key}, count(*), count(DISTINCT (COLUMNS(* EXCLUDE ({rid}, {key})))::VARCHAR)
      FROM {csv(table)} GROUP BY 1 HAVING count(*) > 1""")
    if dups:
        identical = all(r[2] == 1 for r in dups)
        issue(f'I-keydup-{table}', 'key_dup', 'block', f'{table}.{key}',
              f"{len(dups)} key(s) repeated ({', '.join(str(r[0]) for r in dups)}); payloads {'identical apart from record id' if identical else 'DIFFER'}; a raw join fans out",
              'use_dimension_unique' if identical else 'ask_user')

# Join fan-out before deduplication.
fan = one("SELECT count(*) FROM sales s JOIN pm_raw p USING (product_id)")[0] - one("SELECT count(*) FROM sales s JOIN pm p USING (product_id)")[0]
fan_c = one("SELECT count(*) FROM sales s JOIN cm_raw p USING (customer_id)")[0] - one("SELECT count(*) FROM sales s JOIN cm p USING (customer_id)")[0]
issue('I-fanout-sales-masters', 'fanout', 'block', 'sales_transactions -> product_master / customer_master',
      f'raw joins add {fan:,} extra product rows and {fan_c:,} extra customer rows', 'use_dimension_unique')

# Exact repeats in sales (all observed fields equal apart from line_id/source_row).
rep_rows, rep_value = one("""SELECT sum(n - 1), sum((n - 1) * v) FROM (SELECT count(*) n, any_value(value) v FROM sales
  GROUP BY invoice_id, product_id, description, qty, price, ts, customer_id, country HAVING count(*) > 1)""")
issue('I-rowdup-sales', 'row_dup', 'material', 'sales_transactions',
      f'{rep_rows:,} rows repeat an earlier row exactly ({pct(rep_rows, n_sales)} of rows, {gbp(rep_value)} signed value); source keeps them as separate observations',
      'report_only (kept; no evidence they are errors)')

# Required-looking blanks.
blank_c, blank_v = one('SELECT count(*), sum(value) FROM sales WHERE customer_id IS NULL')
issue('I-null-sales-customer', 'required_null', 'material', 'sales_transactions.customer_id',
      f'{blank_c:,} rows blank ({pct(blank_c, n_sales)} of rows, {gbp(blank_v)} value)', 'report_only (keep as "unidentified" in customer views)')

# Sign mix.
neg_c, neg_v = one('SELECT count(*), sum(value) FROM sales WHERE qty < 0')
issue('I-sign-sales', 'sign_mix', 'note', 'sales_transactions.quantity',
      f'{neg_c:,} negative-quantity lines, {gbp(neg_v)} value; line_value_gbp = quantity x unit_price on every row', 'keep_signed')

# Referential gaps.
fk_p = one('SELECT count(*) FROM sales s ANTI JOIN pm USING (product_id)')[0]
fk_c = one('SELECT count(*) FROM sales s ANTI JOIN cm USING (customer_id) WHERE s.customer_id IS NOT NULL')[0]
issue('I-fk-sales', 'fk_gap', 'note', 'sales -> masters', f'{fk_p:,} sales rows without a product master row; {fk_c:,} non-blank customer ids without a customer master row', 'report_only')

# Item-type mix of sales (master classification, as recorded).
mix = rows('SELECT p.item_type, count(*), sum(s.value) FROM sales s JOIN pm p USING (product_id) GROUP BY 1 ORDER BY 3 DESC')

# Cost intervals: overlaps inside one product's history (historical/current rows).
ov = rows("""SELECT a.product_id, a.cost_record_id, b.cost_record_id, greatest(a.vf, b.vf), least(a.vt, b.vt) FROM cost a JOIN cost b
  ON a.product_id = b.product_id AND a.cost_record_id < b.cost_record_id AND a.vf < b.vt AND b.vf < a.vt""")
blank_cost = rows("SELECT product_id, cost_status, vf, vt FROM cost WHERE unit_cost IS NULL")
odd_unit = rows("SELECT product_id, currency, cost_uom, cost_status FROM cost WHERE currency <> 'GBP' OR cost_uom <> 'EA'")

# As-of cost coverage of every sales line: valid_from inclusive, valid_to exclusive (data_dictionary.md).
c.execute("""CREATE TABLE matched AS SELECT s.line_id, count(k.cost_record_id) AS matches,
  any_value(k.unit_cost) AS unit_cost, any_value(k.currency) AS currency, any_value(k.cost_uom) AS uom
  FROM sales s LEFT JOIN cost k ON k.product_id = s.product_id AND s.d >= k.vf AND s.d < k.vt AND k.cost_status <> 'PROPOSED'
  GROUP BY s.line_id""")
c.execute("""CREATE TABLE costed AS SELECT s.*, p.item_type, p.category, p.product_name,
  CASE WHEN m.matches = 0 THEN 'no_cost' WHEN m.matches > 1 THEN 'overlap' WHEN m.unit_cost IS NULL THEN 'blank_cost'
       WHEN m.uom <> 'EA' THEN 'pack_uom' WHEN m.currency <> 'GBP' THEN 'eur_currency' ELSE 'ok' END AS cost_status,
  CASE WHEN m.matches = 1 THEN m.unit_cost END AS unit_cost
  FROM sales s LEFT JOIN pm p USING (product_id) JOIN matched m USING (line_id)""")
cov = rows("""SELECT item_type, cost_status, count(*), sum(value), count(DISTINCT product_id) FROM costed
  WHERE cost_status <> 'ok' GROUP BY 1, 2 ORDER BY 1, 4 DESC""")
merch_total = one("SELECT count(*), sum(value) FROM costed WHERE item_type = 'MERCHANDISE'")
top_gap = rows("""SELECT product_id, any_value(product_name), cost_status, count(*), sum(value),
  sum(CASE WHEN value < 0 THEN value ELSE 0 END), sum(CASE WHEN value > 0 THEN value ELSE 0 END)
  FROM costed WHERE item_type = 'MERCHANDISE' AND cost_status <> 'ok' GROUP BY 1, 3 ORDER BY abs(sum(value)) DESC LIMIT 8""")
gap_lines = sum(r[2] for r in cov if r[0] == 'MERCHANDISE')
gap_value = sum(float(r[3]) for r in cov if r[0] == 'MERCHANDISE')
issue('I-cost-coverage', 'interval_gap', 'material', 'sales (MERCHANDISE) -> product_cost_history as-of sale date',
      f'{gap_lines:,} merchandise lines ({pct(gap_lines, merch_total[0])}) lack one usable cost, {gbp(gap_value)} value ({pct(gap_value, merch_total[1])}). '
      + '; '.join(f'{r[0]} "{r[1]}" {r[2]} {r[3]:,} lines {gbp(r[4])} (credits {gbp(r[5])})' for r in top_gap[:4]),
      'bound_uncovered (exclude from cost measures; bound their effect; never treat as zero cost)',
      detail=dict(by_status=[dict(item_type=r[0], status=r[1], lines=r[2], value=float(r[3]), products=r[4]) for r in cov],
                  top_products=[dict(product_id=r[0], name=r[1], status=r[2], lines=r[3], value=float(r[4]), credit_value=float(r[5]), positive_value=float(r[6])) for r in top_gap]))
if ov:
    issue('I-cost-overlap', 'interval_overlap', 'block', 'product_cost_history',
          f'{len(ov)} overlapping interval pair(s): ' + '; '.join(f'{r[0]} {r[1]} vs {r[2]} on {r[3]}..{r[4]}' for r in ov),
          'hold affected lines (status overlap) until a selection rule is confirmed')
if blank_cost:
    issue('I-cost-blank', 'required_null', 'material', 'product_cost_history.unit_cost_gbp',
          f'{len(blank_cost)} records blank: ' + ', '.join(f'{r[0]} ({r[1]} {r[2]}..{r[3]})' for r in blank_cost),
          'treat as no usable cost (status blank_cost)')
if odd_unit:
    issue('I-cost-unit', 'unit_conflict', 'material', 'product_cost_history currency/cost_uom vs column unit_cost_gbp',
          f'{len(odd_unit)} records say currency/uom other than GBP/EA in a GBP-per-EA field: ' + ', '.join(f'{r[0]} {r[1]}/{r[2]}' for r in odd_unit),
          'exclude (status pack_uom / eur_currency) and bound; conversion needs a confirmed rule', confidence='heuristic')

# Partial period.
issue('I-period-partial', 'partial_period', 'note', 'sales_transactions.transaction_timestamp',
      f'data runs {d_min} to {d_max}; {d_max:%Y-%m} covers {d_max.day} days and Q{(d_max.month - 1) // 3 + 1} {d_max.year} is partial. Last complete quarter: 2011-Q3; last five complete: 2010-Q3..2011-Q3',
      'label partial; exclude from "complete period" windows')

# Tie-out: merchandise invoice sales and COGS by month vs finance_monthly.
tie = rows(f"""WITH s AS (SELECT strftime(d, '%Y-%m') m, sum(value) v,
    sum(CASE WHEN cost_status = 'ok' THEN qty * unit_cost END) cogs FROM costed WHERE item_type = 'MERCHANDISE' GROUP BY 1),
  f AS (SELECT reporting_month m, CAST(merchandise_invoice_sales_gbp AS DECIMAL(18,6)) fv, CAST(merchandise_cogs_gbp AS DECIMAL(18,6)) fc FROM {csv('finance_monthly')})
  SELECT f.m, s.v, f.fv, s.v - f.fv, s.cogs, f.fc, s.cogs - f.fc FROM f LEFT JOIN s USING (m) ORDER BY 1""")
max_sales_diff = max(abs(float(r[3] or 0)) for r in tie)
total_sales_diff = sum(float(r[3] or 0) for r in tie)
total_cogs_diff = sum(float(r[6] or 0) for r in tie)
fin_sales = sum(float(r[2]) for r in tie)
fin_cogs = sum(float(r[5]) for r in tie)
# Does one product's monthly value explain the residual? (generic residual attribution)
expl = rows("""WITH r AS (SELECT strftime(d, '%Y-%m') m, product_id, sum(value) v FROM costed WHERE item_type = 'MERCHANDISE' GROUP BY 1, 2)
  SELECT product_id, sum(v) FROM r GROUP BY 1""")
# A product whose total covers at least 95% of the residual is reported; this is arithmetic, not a classification.
attributed = [f'{p} ({gbp(v)})' for p, v in expl if total_sales_diff and 0.95 <= float(v) / total_sales_diff <= 1.05]
issue('I-tie-finance', 'no_tie', 'note' if abs(total_sales_diff) < 0.005 * fin_sales else 'material', 'sales (MERCHANDISE) vs finance_monthly',
      f'merchandise invoice sales differ from finance_monthly by {gbp(total_sales_diff)} in total ({pct(total_sales_diff, fin_sales)}; max month {gbp(max_sales_diff)}); '
      f'COGS on usable-cost lines differs by {gbp(total_cogs_diff)} ({pct(total_cogs_diff, fin_cogs)}) before any uncovered lines'
      + (f'; the sales residual is within 5% of the total of product(s) {", ".join(attributed)}' if attributed else ''),
      'report_only (finance_monthly is a derived rollup; do not force a tie-out or chase residuals below 0.5%)', confidence='heuristic',
      detail=dict(months=[dict(month=r[0], sales=float(r[1] or 0), finance_sales=float(r[2]), sales_diff=float(r[3] or 0), cogs=float(r[4] or 0), finance_cogs=float(r[5]), cogs_diff=float(r[6] or 0)) for r in tie]))

# Rebates grain and duplicate events; service costs currency and duplicates.
reb_all = one(f"SELECT count(*), sum(CAST(signed_amount_gbp AS DECIMAL(18,6))) FROM {csv('rebates_adjustments')} WHERE product_id = 'ALL'")
issue('I-grain-rebates', 'grain_mismatch', 'material', 'rebates_adjustments.product_id',
      f'{reb_all[0]:,} records at customer-period level with product_id=ALL ({gbp(reb_all[1])}); no product allocation in the data',
      'SKU/category margins use the invoice basis before rebates and say so; allocation needs a confirmed rule')
if inventory['rebates_adjustments']['duplicate_keys']:
    issue('I-dup-rebates', 'row_dup', 'note', 'rebates_adjustments.adjustment_event_id',
          f"{inventory['rebates_adjustments']['duplicate_keys']} duplicate event id(s)", 'count each event once if payloads match')
svc_eur = one(f"SELECT count(*), sum(CAST(cost_amount_gbp AS DECIMAL(18,6))) FROM {csv('service_costs')} WHERE currency <> 'GBP'")
issue('I-unit-service', 'unit_conflict', 'note', 'service_costs.currency vs cost_amount_gbp',
      f'{svc_eur[0]:,} records say non-GBP currency in a GBP field ({gbp(svc_eur[1])}); {inventory["service_costs"]["duplicate_keys"]} duplicate cost_event_id+cost_type keys',
      'exclude and disclose; only relevant to service-cost questions', confidence='heuristic')

order = {'block': 0, 'material': 1, 'note': 2}
issues.sort(key=lambda i: order[i['severity']])

lines = [
    'WORKSPACE INDEX (precomputed by code from the files; numbers are exact unless marked heuristic; ids are stable).',
    'Use it instead of re-deriving these facts. Apply each issue\'s default unless confirmed context says otherwise.',
    'It states data facts only; business meanings still come from confirmed context. Detail: ' + str(out / 'issues.json'),
    '',
    'TABLES (rows | business key | duplicate keys):',
]
for t, v in inventory.items():
    lines.append(f"- {t}: {v['rows']:,} | {v['key']} | {v['duplicate_keys']}")
lines += [
    '',
    'JOINS: sales.product_id -> product_master.product_id (N:1 after one row per key); sales.customer_id -> customer_master.customer_id (N:1, blank allowed);',
    'sales.invoice_id -> invoice_headers.invoice_id; cost as-of: product_cost_history.product_id with sale date in [valid_from, valid_to) (data_dictionary.md), PROPOSED rows start 2012-01-01.',
    'DERIVED (do not add to sales): invoice_headers = per-invoice rollup of sales; credits_returns_view = negative/credit lines of sales by line_id; finance_monthly = monthly company rollup.',
    '',
    'SALES BY product_master.item_type (as recorded): ' + '; '.join(f'{r[0]} {r[1]:,} lines {gbp(r[2])}' for r in mix),
    '',
    'DATA ISSUES (severity | id | check | where: finding | default):',
]
for i in issues:
    tag = ' [heuristic]' if i['confidence'] == 'heuristic' else ''
    lines.append(f"[{i['severity']}] {i['id']} {i['check']}{tag} | {i['where']}: {i['finding']} | default: {i['default']}")

if prepared:
    pv = out / 'sales_costed.parquet'
    c.execute(f"""COPY (SELECT line_id, invoice_id, product_id, product_name, item_type, category, customer_id,
        customer_id IS NULL AS customer_missing, country, ts AS transaction_timestamp, d AS sale_date,
        strftime(d, '%Y-%m') AS month, year(d) || '-Q' || quarter(d) AS quarter, qty AS quantity,
        price AS unit_price_gbp, value AS line_value_gbp, cost_status, unit_cost AS unit_cost_gbp,
        CASE WHEN cost_status = 'ok' THEN CAST(qty * unit_cost AS DECIMAL(18,6)) END AS line_cogs_gbp,
        row_number() OVER (PARTITION BY invoice_id, product_id, description, qty, price, ts, customer_id, country ORDER BY source_row) AS repeat_rank,
        -- D-cost-range: an unusable cost lies in [0, unit price], so line gross profit lies in [min(0, value), max(0, value)].
        CASE WHEN cost_status = 'ok' THEN value - CAST(qty * unit_cost AS DECIMAL(18,6)) ELSE least(0, value) END AS gp_lower_gbp,
        CASE WHEN cost_status = 'ok' THEN value - CAST(qty * unit_cost AS DECIMAL(18,6)) ELSE greatest(0, value) END AS gp_upper_gbp
      FROM costed ORDER BY source_row) TO '{pv}' (FORMAT parquet)""")
    n_pv = one(f"SELECT count(*) FROM read_parquet('{pv}')")[0]
    assert n_pv == n_sales, (n_pv, n_sales)
    lines += [
        '',
        f'PREPARED VIEW: {pv} ({n_pv:,} rows = every sales_transactions row, ledger checked). One row per sales line with product attributes from one master row per key,',
        'month, quarter (YYYY-Qn), signed quantity/value, cost_status (ok | no_cost | overlap | blank_cost | pack_uom | eur_currency) and unit_cost_gbp/line_cogs_gbp',
        'from the as-of cost only when cost_status = ok (credits carry signed cost on their own date, per data_dictionary.md). repeat_rank > 1 marks exact repeats (kept).',
        'Query it with DuckDB read_parquet(...) for sales, revenue, COGS and margin work; cite the raw source files it was built from',
        '(files/data/sales_transactions.csv, product_master.csv, product_cost_history.csv) in sourcePaths. Gross profit over a set of lines is only complete when every line in it is ok; otherwise bound or hold.',
    ]

if code_checks:
    assert prepared, '--code-checks needs --prepared-view'
    bad_value = one('SELECT count(*) FROM sales WHERE abs(value - CAST(qty AS DECIMAL(18,6)) * price) > 0.000001')[0]
    n_joined = one('SELECT count(*) FROM costed')[0]
    s_path, p_path, k_path = 'files/data/sales_transactions.csv', 'files/data/product_master.csv', 'files/data/product_cost_history.csv'
    diagnostics = [
        dict(id='IDX-source-coverage', kind='source-coverage', actual=n_pv, expected=n_sales, sourcePaths=[s_path],
             reason='Controller-supplied from the workspace index: prepared view rows versus sales_transactions rows (row ledger).'),
        dict(id='IDX-parsing', kind='parsing', actual=bad_value, expected=0, sourcePaths=[s_path],
             reason='Controller-supplied: rows where line_value_gbp differs from quantity x unit_price_gbp after typed casts; every row cast without failure.'),
        dict(id='IDX-join-integrity', kind='join-integrity', actual=n_joined, expected=n_sales, sourcePaths=[s_path, p_path, k_path],
             reason='Controller-supplied: sales rows after joining one product master row per key and the as-of cost match (I-keydup-product_master, I-fanout-sales-masters).'),
        dict(id='IDX-period-coverage', kind='period-coverage', actual=None, expected=None, sourcePaths=[s_path],
             reason=f'Controller-supplied: data covers {d_min} to {d_max} (I-period-partial). Supply your own period-coverage diagnostic when the question names a narrower period.'),
    ]
    (out / 'diagnostics.json').write_text(json.dumps(diagnostics, indent=1))
    (out / 'index_tools.py').write_text('''"""Deterministic helpers for the workspace index (experiment)."""


def certify_ranking(rows, top_n=1):
    """rows: iterable of (id, lower, upper) bounds for a measure where higher ranks first.
    Returns whether the top-N set, and its order, is fixed under the bounds."""
    rows = sorted(((str(i), float(lo), float(hi)) for i, lo, hi in rows), key=lambda r: (-r[1], r[0]))
    top, rest = rows[:top_n], rows[top_n:]
    best_rest = max((r[2] for r in rest), default=float('-inf'))
    set_certified = all(r[1] > best_rest for r in top)
    order_certified = set_certified and all(top[i][1] > top[i + 1][2] for i in range(len(top) - 1))
    return {
        'certified': set_certified, 'orderCertified': order_certified,
        'top': [{'id': r[0], 'lower': r[1], 'upper': r[2]} for r in top],
        'bestRivalUpper': best_rest, 'margin': (min((r[1] for r in top), default=0.0) - best_rest) if rest else None,
        'rule': 'top-N lower bounds exceed every other upper bound (D-cost-range)',
    }
''')
    lines += [
        '',
        'DECISION D-cost-range (experiment default, not user-confirmed): an unusable unit cost lies between 0 and the line\'s own unit price,',
        'so an uncovered line\'s gross profit lies between min(0, value) and max(0, value). The prepared view applies this in gp_lower_gbp / gp_upper_gbp',
        '(both equal the line gross profit when cost_status = ok). For a ranking or comparison of a cost-based measure, sum these per group and call',
        f'certify_ranking(rows, top_n) from {out / "index_tools.py"} (rows = [(id, lower, upper)]). A certified result is complete: approve it and report the bounded gap as coverage citing the issue ids.',
        'CONTROLLER DIAGNOSTICS: the controller adds source-coverage, parsing, join-integrity and period-coverage diagnostics from this index; supply reconciliation and eligibility',
        '(and period-coverage for a narrower requested period). For a certified ranking the eligibility diagnostic is actual = rank positions the bounds can change (0), expected = 0.',
    ]

(out / 'index.md').write_text('\n'.join(lines) + '\n')
(out / 'issues.json').write_text(json.dumps(dict(inventory=inventory, issues=issues), indent=1, default=str))
print('\n'.join(lines))
print(f"\nindex.md: {len(chr(10).join(lines)):,} chars")
