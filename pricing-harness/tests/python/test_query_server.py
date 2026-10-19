import json
import subprocess
import sys
from pathlib import Path

SERVER = Path(__file__).resolve().parents[2] / 'bundled/harness-tools/query_server.py'


def session(tmp_path, statements, files=None):
    files = files or {'Sales Data.csv': 'product,qty,price\nA,2,1.50\nB,3,2.00\nC,1,\n'}
    if not (tmp_path / 'files').exists():
        (tmp_path / 'files').mkdir()
        for name, text in files.items():
            (tmp_path / 'files' / name).write_text(text)
    stage = tmp_path / 'stage'
    stage.mkdir(exist_ok=True)
    lines = ''.join(json.dumps({'id': i, 'sql': s}) + '\n' for i, s in enumerate(statements, 1))
    out = subprocess.run(
        [sys.executable, str(SERVER), '--root', str(tmp_path), '--stage', str(stage), '--cache', str(tmp_path / 'cache'),
         '--sources', json.dumps([f'files/{name}' for name in files]), '--memory', '256MB', '--threads', '1'],
        input=lines, capture_output=True, text=True, timeout=120,
    )
    assert out.returncode == 0, out.stderr
    rows = [json.loads(line) for line in out.stdout.splitlines()]
    return rows[0], {r['id']: r for r in rows[1:]}


def test_sources_are_typed_views_named_after_the_file(tmp_path):
    ready, r = session(tmp_path, ['SELECT sum(qty) AS q, sum(price) AS p FROM sales_data'])
    assert ready['tables'][0]['name'] == 'sales_data'
    assert ready['tables'][0]['typed'] is True
    assert r[1]['rows'] == [[6, '3.50']]



def test_views_persist_and_report_redefinition(tmp_path):
    _, r = session(tmp_path, [
        'CREATE VIEW big AS SELECT * FROM sales_data WHERE qty > 1',
        'SELECT count(*) AS n FROM big',
        'CREATE OR REPLACE VIEW big AS SELECT * FROM sales_data',
        'SELECT count(*) AS n FROM big',
    ])
    assert r[1]['changed'] == [{'name': 'big', 'change': 'created'}]
    assert r[2]['rows'] == [[2]]
    assert r[3]['changed'] == [{'name': 'big', 'change': 'redefined'}]
    assert r[4]['rows'] == [[3]]


def test_statement_kinds_and_file_access_are_limited(tmp_path):
    _, r = session(tmp_path, [
        "ATTACH 'x.db'",
        "SELECT 1 AS a; -- second\nATTACH 'y.db'; SELECT 2 AS b",
        "SELECT * FROM read_csv('/etc/hosts')",
        "COPY (SELECT 1 AS a) TO 'out.csv'",
        "COPY (SELECT 1 AS a) TO '/tmp/query_server_outside.csv'",
    ])
    assert not r[1]['ok'] and 'allowed' in r[1]['error']
    # Several statements run in order; each keeps its own result, and a refused one does not stop the others.
    batch = r[2]['batch']
    assert [b['ok'] for b in batch] == [True, False, True]
    assert batch[0]['rows'] == [[1]] and 'allowed' in batch[1]['error'] and batch[2]['rows'] == [[2]]
    assert not r[3]['ok'] and 'Permission' in r[3]['error']
    assert r[4]['ok']
    assert (tmp_path / 'stage/out.csv').exists()
    assert not r[5]['ok']


def test_non_finite_numbers_show_as_null_not_invalid_json(tmp_path):
    _, r = session(tmp_path, ["SELECT 'NaN'::DOUBLE AS a, 'Infinity'::DOUBLE AS b, 1.5::DOUBLE AS c"])
    assert r[1]['rows'] == [[None, None, 1.5]]


def test_combining_totals_from_different_rows_is_stopped_once_and_side_by_side_totals_get_a_note(tmp_path):
    # Product C has no price: sum(price) skips it, sum(qty) does not.
    combined = 'SELECT sum(qty) * 10 - sum(price) AS d FROM sales_data'
    _, r = session(tmp_path, [combined, combined, 'SELECT sum(qty) AS q, sum(price) AS p FROM sales_data'])
    assert r[1]['stopped'].startswith('Not run: In d, 1 rows count in sum(qty) but not in sum(price)')
    assert r[1]['rows'] == []
    assert r[2]['rows'] == [['56.50']] and r[2].get('stopped') is None
    assert r[3]['note'].startswith('Note: these totals come from different rows: 1 rows count in sum(qty)')


def test_views_and_tables_last_the_conversation_even_when_made_temp(tmp_path):
    # Each turn starts a new session on the same stage folder.
    session(tmp_path, ['CREATE OR REPLACE TEMP VIEW big AS SELECT * FROM sales_data WHERE qty > 1',
                       'CREATE TABLE totals AS SELECT sum(qty) AS q FROM sales_data'])
    _, r = session(tmp_path, ['SELECT count(*) AS n FROM big', 'SELECT q FROM totals'])
    assert r[1]['rows'] == [[2]] and r[2]['rows'] == [[6]]


def test_a_new_stage_folder_starts_clean(tmp_path):
    import shutil
    session(tmp_path, ['CREATE VIEW big AS SELECT * FROM sales_data'])
    shutil.rmtree(tmp_path / 'stage')  # what the workflow does when a conversation starts afresh
    _, r = session(tmp_path, ['SELECT count(*) AS n FROM big'])
    assert r[1]['ok'] is False and 'big' in r[1]['error']


def test_rows_far_from_their_key_median_get_a_note_when_material(tmp_path):
    # Five products at about 2.00 each; one line of P1 is keyed at 200.00, a hundred times its product's median.
    lines = ['line_id,product,qty,price,value']
    for n in range(100):
        product, price = f'P{n % 5 + 1}', 2 + (n % 3) / 100
        lines.append(f'L{n},{product},1,{price:.2f},{price:.2f}')
    lines.append('L100,P1,1,200.00,200.00')
    files = {'sales.csv': '\n'.join(lines) + '\n', 'products.csv': 'product,name\n' + ''.join(f'P{i},Item {i}\n' for i in range(1, 6))}
    total = "SELECT sum(value) AS sales FROM sales"
    _, r = session(tmp_path, [total, "SELECT sum(value) AS sales FROM sales WHERE product = 'P2'", total,
                              "CREATE VIEW p1 AS SELECT product, sum(value) AS sales FROM sales GROUP BY 1"], files)
    assert r[1]['note'] == ("Note: 1 of the rows this statement sums have price at least 5 times, or at most a fifth of, "
                            "their product's median across sales. They hold 200.00 of sum(\"value\"), 49.9% of its total "
                            "here. They may be entry errors: check whether they change the answer.")
    assert r[2]['note'] is None  # P2's rows are all near their median
    assert r[3]['note'] is None  # the same rows were noted once already
    assert r[4]['note'] is None and r[4]['changed'] == [{'name': 'p1', 'change': 'created'}]


def test_a_created_population_is_measured_once_on_the_columns_it_holds(tmp_path):
    # Line value is quantity times price, so only price is described by its product's median.
    lines, total = ['line_id,product,qty,price,value'], 200.0
    for n in range(100):
        product, price, qty = f'P{n % 5 + 1}', 2 + (n % 3) / 100, 10 if n % 2 else 1
        lines.append(f'L{n},{product},{qty},{price:.2f},{qty * price:.2f}')
        total += round(qty * price, 2)
    lines.append('L100,P1,1,200.00,200.00')
    files = {'sales.csv': '\n'.join(lines) + '\n', 'products.csv': 'product,name\n' + ''.join(f'P{i},Item {i}\n' for i in range(1, 6))}
    _, r = session(tmp_path, ["CREATE VIEW pop AS SELECT s.product, s.price, s.value AS sales FROM sales AS s WHERE s.qty > 0",
                              'SELECT sum(sales) AS total FROM pop'], files)
    assert r[1]['note'] == ("Note: 1 of the rows in this view have price at least 5 times, or at most a fifth of, their "
                            f"product's median across sales. They hold 200.00 of sales, {200 / total:.1%} of this view's "
                            "total. They may be entry errors: check whether they change the answer.")
    assert r[2]['note'] is None  # a statement over the view is not probed again


def test_groups_whose_negative_rows_cancel_much_of_a_sum_get_a_note_once(tmp_path):
    files = {'lines.csv': 'product,quarter,qty,value\nA,Q2,10,20\nA,Q2,-8,-16\nA,Q3,5,10\nB,Q2,10,20\nB,Q2,-2,-4\nB,Q3,4,8\n'}
    grouped = 'SELECT product, quarter, sum(qty) AS q, sum(value) AS v FROM lines GROUP BY 1, 2'
    _, r = session(tmp_path, [grouped, grouped, 'SELECT product, sum(qty) AS q FROM lines GROUP BY ALL',
                              "SELECT quarter AS period, sum(qty) AS q FROM lines WHERE product = 'B' GROUP BY period"], files)
    assert r[1]['note'] == ('Note: In 1 of the 4 groups this statement returns, negative rows offset at least half, but not '
                            'all, of the positive rows in sum(qty) (A, Q2). A value per unit in these groups (a sum divided by that '
                            'net amount) rests on little net quantity. They may be returns: check whether they change the answer.')
    assert r[2]['note'] is None  # told once
    assert 'In 1 of the 2 groups' in r[3]['note'] and '(A)' in r[3]['note']  # A: 8 of 15 sold came back
    assert r[4]['note'] is None  # B's returns are a fifth of its sales


def test_saving_unsummed_source_rows_gets_a_note(tmp_path):
    _, r = session(tmp_path, ['CREATE TABLE g AS SELECT product, sum(qty) AS q FROM sales_data GROUP BY 1'])
    lines = {'id': 1, 'sql': 'SELECT * FROM sales_data WHERE qty > 0', 'save': 'lines.csv'}
    grouped = {'id': 2, 'sql': 'SELECT * FROM g', 'save': 'g.csv'}
    out = subprocess.run(
        [sys.executable, str(SERVER), '--root', str(tmp_path), '--stage', str(tmp_path / 'stage'), '--cache',
         str(tmp_path / 'cache'), '--sources', json.dumps(['files/Sales Data.csv']), '--memory', '256MB', '--threads', '1'],
        input=json.dumps(lines) + '\n' + json.dumps(grouped) + '\n', capture_output=True, text=True, timeout=120)
    rows = {r['id']: r for r in map(json.loads, out.stdout.splitlines()[1:])}
    assert '3 unsummed source rows' in rows[1]['note']
    assert rows[2]['note'] is None
    _, r = session(tmp_path, ["COPY (SELECT * FROM sales_data) TO 'lines2.csv' (HEADER)",
                              "COPY (SELECT product, sum(qty) FROM sales_data GROUP BY 1) TO 'g2.csv' (HEADER)"])
    assert '3 unsummed source rows' in r[1]['note']
    assert r[2]['note'] is None


def test_a_byte_order_mark_is_not_part_of_the_first_header(tmp_path):
    ready, r = session(tmp_path, ['SELECT product FROM bom'], {'bom.csv': '﻿product,qty\nA,2\n'})
    assert ready['notes'] == []
    assert r[1]['rows'] == [['A']]


def test_each_workbook_sheet_is_a_view(tmp_path):
    from openpyxl import Workbook
    book = Workbook()
    book.active.title = 'Year 2010'
    book.active.append(['product', 'qty'])
    book.active.append(['A', 2])
    other = book.create_sheet('2011')
    other.append(['product', 'qty'])
    other.append(['B', 5])
    (tmp_path / 'files').mkdir()
    book.save(tmp_path / 'files' / 'Online Retail.xlsx')
    ready, r = session(tmp_path, ['SELECT sum(qty) AS q FROM online_retail_year_2010',
                                  'SELECT sum(qty) AS q FROM online_retail_2011'], {'Online Retail.xlsx': None})
    assert [t['name'] for t in ready['tables']] == ['online_retail_year_2010', 'online_retail_2011']
    assert r[1]['rows'] == [[2]] and r[2]['rows'] == [[5]]


def test_a_headerless_file_is_read_with_numbered_columns_and_a_note_to_ask(tmp_path):
    ready, r = session(tmp_path, ['SELECT column1, column3 FROM orders'],
                       {'orders.csv': '43659\t2022-05-30 00:00:00.000\t20565.62\n43660\t2022-05-30 00:00:00.000\t1294.25\n'})
    assert r[1]['rows'] == [[43659, '20565.62'], [43660, '1294.25']]
    assert any(n.startswith('orders: no header row') and 'Ask the user' in n for n in ready['notes'])
