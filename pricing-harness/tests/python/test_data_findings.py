import importlib.util
import io
import json
import sys
from pathlib import Path

import duckdb
import pytest

TOOLS = Path(__file__).resolve().parents[2] / 'bundled/harness-tools'


def load(name):
    spec = importlib.util.spec_from_file_location(name, TOOLS / f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


df, dw = load('data_findings'), load('data_workspace')
LINE = 'line_id,invoice_id,product_id,customer_id,quantity,price,sold_at'


def line(i, **change):
    row = dict(line_id=f'L{i:05d}', invoice_id=f'INV{i // 4:04d}', product_id=f'P{i % 200:03d}', customer_id=str(1000 + i % 37),
               quantity=str(2 + i % 3), price=f'{(i % 200 + 1) * 0.1:.2f}', sold_at=f'2024-01-{1 + i % 28:02d} 10:00:00')
    return ','.join({**row, **change}.values())


def pack(tmp_path, lines=None, products=None, extra=None):
    """Write a clean three-table pack (200 products, 50 customers, 2000 lines); pass lists to plant anomalies."""
    files = {'products.csv': ['product_id,name', *(products or [f'P{i:03d},Item {i}' for i in range(200)])],
             'customers.csv': ['customer_id,customer_name', *[f'{1000 + i},Shop {i}' for i in range(50)]],
             'lines.csv': [LINE, *(lines or [line(i) for i in range(2000)])], **(extra or {})}
    for name, rows in files.items():
        (tmp_path / name).write_text('\n'.join(rows) + '\n')
    return df.detect([str(tmp_path / n) for n in files], tmp_path / 'cache')


def issues(result, source):
    return {(f['column'], f['issue']): f for f in result[1]['findings'] if f['source'].endswith(source)}


def test_clean_pack_has_no_findings(tmp_path):
    assert pack(tmp_path)[1]['findings'] == []


def test_findings_are_cached_by_source_content(tmp_path):
    first = pack(tmp_path)
    sentinel = {'findings': ['cached']}
    (first[0] / 'findings.json').write_text(json.dumps(sentinel))
    paths = [str(tmp_path / n) for n in ('products.csv', 'customers.csv', 'lines.csv')]
    assert df.detect(paths, tmp_path / 'cache')[1] == sentinel
    (tmp_path / 'products.csv').rename(tmp_path / 'items.csv')
    paths[0] = str(tmp_path / 'items.csv')
    out, result = df.detect(paths, tmp_path / 'cache')
    assert result != sentinel
    (out / 'findings.json').write_text(json.dumps(sentinel))
    with (tmp_path / 'lines.csv').open('a') as f:
        f.write(line(2000) + '\n')
    assert df.detect(paths, tmp_path / 'cache')[1] != sentinel


def test_parse_labels_failures_by_format_and_offers_lossless_fixes(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[10], lines[11], lines[12] = line(10, price='"1,10"'), line(11, sold_at='01/12/2024 10:00'), LINE
    found = issues(pack(tmp_path, lines), 'lines.csv')
    assert found[('price', 'decimal-comma')]['rows'] == 1
    assert found[('price', 'decimal-comma')]['fix'] == "replace(\"price\", ',', '.')"
    assert found[('sold_at', 'slash-date ambiguous')]['fix'] is None
    assert found[('price', 'header-text')]['rows'] == 1


def test_parse_offers_a_fix_only_when_every_flagged_value_parses(tmp_path):
    lines = [line(i) for i in range(2000)]
    for i, price in enumerate(['"1,296"', '"0,125"', '(n/a)', '"$1,234.50"', ' 5kg'], 20):
        lines[i] = line(i, price=price)
    found = issues(pack(tmp_path, lines), 'lines.csv')
    assert found[('price', 'thousands-separator')]['rows'] == 1
    assert found[('price', 'thousands-separator')]['fix'] is not None
    assert found[('price', 'mixed-text')]['fix'] is None
    assert found[('price', 'mixed-text')]['examples'] == ['0,125']
    assert ('price', 'text') in found
    assert ('price', 'parenthesised-negative') not in found
    assert found[('price', 'currency-symbol')]['fix'] is None
    assert found[('price', 'unit-text')]['fix'] is None


def test_shape_finds_case_and_invisible_variants_of_codes(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[7], lines[207] = line(7, product_id='p007'), line(207, product_id='P007​')
    found = issues(pack(tmp_path, lines), 'lines.csv')
    assert found[('product_id', 'variant-of-common-value')]['rows'] == 2


def test_shape_variants_follow_the_common_spelling_not_upper_case(tmp_path):
    source = tmp_path / 'regions.csv'
    names = [f'Region{chr(65 + i)}' for i in range(12)]
    source.write_text('\n'.join(['region,store', *(f'{names[i % 12]},S{i}' for i in range(600)), 'REGIONB,S600']) + '\n')
    finding = next(f for f in df.detect([str(source)], tmp_path / 'cache')[1]['findings'] if f['issue'] == 'variant-of-common-value')
    assert finding['rows'] == 1 and finding['examples'] == ['REGIONB']


def test_shape_variants_offer_no_fix_that_merges_distinct_records(tmp_path):
    source = tmp_path / 'products.csv'
    source.write_text('\n'.join(['product_id,description', *[f'A{i:02d},Upper item {i}' for i in range(12)],
                                 'a00,Separate lower item']) + '\n')
    cache = tmp_path / 'cache'
    folder, result = df.detect([str(source)], cache)
    finding = next(f for f in result['findings'] if f['issue'] == 'variant-of-common-value')
    assert finding['rows'] == 1 and finding['examples'] == ['a00']
    assert finding['fix'] is None


@pytest.mark.parametrize('source_columns', [
    [('files/data/s890.csv', 'product_id'), ('files/data/s2908.csv', 'product_id')],
    pytest.param([('files/data/a.csv', 'b.csv|c'), ('files/data/a.csv|b.csv', 'c')], marks=pytest.mark.skipif(sys.platform == 'win32', reason='Windows file names cannot contain |')),
], ids=['short-hash-collision', 'signature-boundary'])
def test_finding_ids_keep_flags_and_treatments_within_their_source(tmp_path, monkeypatch, source_columns):
    monkeypatch.chdir(tmp_path)
    (tmp_path / 'files/data').mkdir(parents=True)
    sources = [source for source, _ in source_columns]
    upper = [f'A{i:02d},Upper item {i}' for i in range(12)]
    lower = ['a00,Lower item']
    for (source, column), rows in zip(source_columns, (upper + lower, lower + upper)):
        Path(source).write_text('\n'.join([f'{column},description', *rows]) + '\n')
    cache = tmp_path / 'cache'
    folder, result = df.detect(sources, cache)
    findings = [next(f for f in result['findings'] if f['source'] == source and f['issue'] == 'variant-of-common-value')
                for source in sources]
    assert findings[0]['id'] != findings[1]['id']
    assert [f['rows'] for f in findings] == [1, 1]
    with duckdb.connect() as conn:
        flags = f'read_parquet({dw.quote(folder / "flags.parquet")})'
        for finding, rid in zip(findings, (12, 0)):
            assert conn.execute(f'SELECT rid FROM {flags} WHERE finding = ?', [finding['id']]).fetchall() == [(rid,)]
            assert finding['examples'] == ['a00']


def test_parse_guard_only_evaluates_a_fix_on_its_own_rows(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[30], lines[31] = line(30, sold_at='45000.5'), line(31, sold_at='12/01/2009 12:30')
    found = issues(pack(tmp_path, lines), 'lines.csv')
    assert found[('sold_at', 'serial-date')]['fix'] is not None
    assert found[('sold_at', 'slash-date ambiguous')]['fix'] is None


def test_domain_says_where_missing_keys_come_from(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[3], lines[4] = line(3, customer_id='Shop 3'), line(4, customer_id='9999')
    found = issues(pack(tmp_path, lines), 'lines.csv')
    assert found[('customer_id', f'value-of {tmp_path / "customers.csv"}:customer_name')]['rows'] == 1
    assert found[('customer_id', f'missing-from {tmp_path / "customers.csv"}')]['rows'] == 1


def test_domain_ignores_small_empty_and_one_row_sources_as_keys(tmp_path):
    extra = {'totals.csv': ['month,quantity', *[f'2024-{m:02d},{1000 + 17 * m}' for m in range(1, 13)]],
             'empty.csv': ['invoice_id,note'], 'one.csv': ['sold_at,note', '2024-01-01 10:00:00,control']}
    assert [f for f in pack(tmp_path, extra=extra)[1]['findings'] if f['detector'] == 'domain'] == []


def test_domain_value_of_never_points_at_the_flagged_column_itself(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[3], lines[4] = line(3, product_id='Item 3'), line(4, product_id='X999')
    returns = ['line_id,reason', *[f'L{i:05d},damaged' for i in range(0, 2000, 10)]]
    found = issues(pack(tmp_path, lines, extra={'returns.csv': returns}), 'lines.csv')
    assert found[('product_id', f'missing-from {tmp_path / "products.csv"}')]['rows'] == 1
    assert ('product_id', f'value-of {tmp_path / "lines.csv"}:product_id') not in found


def test_domain_survives_a_blank_in_the_value_column(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[3], lines[4] = line(3, customer_id='Shop 3'), line(4, customer_id='9999')
    customers = ['customer_id,customer_name', *[f'{1000 + i},Shop {i}' for i in range(49)], '1049,']
    found = issues(pack(tmp_path, lines, extra={'customers.csv': customers}), 'lines.csv')
    assert found[('customer_id', f'missing-from {tmp_path / "customers.csv"}')]['rows'] == 1


def test_domain_master_ties_ignore_source_order(tmp_path):
    for name, start in (('a.csv', 0), ('b.csv', 5)):
        (tmp_path / name).write_text(f'code,{name[0]}\n' + ''.join(f'C{i:03d},{i}\n' for i in range(start, start + 100)))
    paths = [str(tmp_path / n) for n in ('a.csv', 'b.csv')]
    found = [{(f['source'], f['issue']) for f in df.detect(p, tmp_path / f'cache{i}')[1]['findings']} for i, p in enumerate((paths, paths[::-1]))]
    assert found[0] == found[1] != set()


def test_uniqueness_finds_repeats_conflicts_and_rekeyed_documents(tmp_path):
    lines = [line(i) for i in range(2000)] + [line(100)] + [line(i, line_id=f'L9{i:04d}', invoice_id='INV9999') for i in range(4, 8)]
    products = [f'P{i:03d},Item {i}' for i in range(200)] + ['P001,Other item']
    result = pack(tmp_path, lines, products)
    assert issues(result, 'lines.csv')[('*', 'repeated-row')]['rows'] == 1
    assert issues(result, 'lines.csv')[('invoice_id', 'repeated-document')]['examples'] == ['INV9999']
    assert issues(result, 'products.csv')[('product_id', 'duplicate-key conflicting')]['rows'] == 2


def test_repeated_documents_need_several_lines_and_something_to_compare(tmp_path):
    links = ['line_id,invoice_id', *[f'L{i:05d},INV{i // 4:04d}' for i in range(2000)]]
    docs = ['row_id,doc_id,cust_id,kind', *[f'R{i:03d},D{i // 2:03d},C{i // 2:03d},k' for i in range(200)], *[f'S{i:03d},E{i:03d},CS,k' for i in range(200)]]
    found = pack(tmp_path, extra={'links.csv': links, 'docs.csv': docs})[1]['findings']
    assert [f for f in found if f['issue'] == 'repeated-document'] == []


def test_ratio_finds_scale_and_sign_errors_against_the_best_fitting_key(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[7], lines[8] = line(7, price='80.00'), line(8, price='-0.90')
    found = issues(pack(tmp_path, lines), 'lines.csv')
    assert found[('price', 'x1e2 vs product_id median')]['rows'] == 1
    assert found[('price', 'negative vs product_id median')]['rows'] == 1


def test_ratio_checks_columns_against_a_key_with_several_rows_per_group(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[8] = line(8, price='80.00')
    credits = [line(i) for i in range(0, 2000, 2)]
    credits[4] = lines[8]
    result = pack(tmp_path, lines, extra={'credits.csv': [LINE, *credits]})
    assert ('price', 'x1e2 vs product_id median') in issues(result, 'lines.csv')
    assert ('price', 'x1e2 vs product_id median') in issues(result, 'credits.csv')


def test_ratio_labels_a_twelve_fold_value_x12(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[8] = line(8, price='10.80')
    found = issues(pack(tmp_path, lines), 'lines.csv')
    assert found[('price', 'x12 vs product_id median')]['rows'] == 1
    assert ('price', 'x1e1 vs product_id median') not in found


def test_ratio_labels_a_twelfth_x1_12_not_a_tenth(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[8] = line(8, price='0.075')
    found = issues(pack(tmp_path, lines), 'lines.csv')
    assert found[('price', 'x1/12 vs product_id median')]['rows'] == 1
    assert ('price', 'x1e-1 vs product_id median') not in found


def test_ratio_keeps_running_when_many_rows_are_a_dozen_out(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[100:160] = [line(i, price=f'{(i % 200 + 1) * 1.2:.2f}') for i in range(100, 160)]  # 3% of rows, over the 2% switch-off
    assert issues(pack(tmp_path, lines), 'lines.csv')[('price', 'x12 vs product_id median')]['rows'] == 60


def test_ratio_ignores_nan_cells_and_overflowing_sums(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[8] = line(8, price='80.00')
    lines[300:350] = [line(i, price='NaN') for i in range(300, 350)]
    assert ('price', 'x1e2 vs product_id median') in issues(pack(tmp_path, lines), 'lines.csv')
    lines = [line(i) for i in range(2000)]
    lines[7:10] = [line(i, price='1e308') for i in range(7, 10)]
    json.dumps(pack(tmp_path, lines)[1]['findings'], allow_nan=False)


@pytest.mark.parametrize('nonfinite', ['inf', 'NaN'])
def test_ratio_peer_median_ignores_nonfinite_cells(tmp_path, nonfinite):
    products, lines = tmp_path / 'products.csv', tmp_path / 'lines.csv'
    products.write_text('product_id,name\n' + '\n'.join(f'P{p:02d},Item {p}' for p in range(30)) + '\n')
    rows = [f'P{p:02d},{nonfinite if p == 0 and i < 6 else "10.0"}' for p in range(30) for i in range(10)]
    lines.write_text('product_id,price\n' + '\n'.join(rows) + '\n')
    _, result = df.detect([str(products), str(lines)], tmp_path / 'cache')
    assert [f for f in result['findings'] if f['detector'] == 'ratio'] == []


def test_value_column_is_a_decimal_column_not_an_id_column(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[10] = line(10, price='"1,10"')
    lines[20:50] = [line(i, customer_id='1000.0') for i in range(20, 50)]
    assert {f['valueColumn'] for f in issues(pack(tmp_path, lines), 'lines.csv').values()} == {'price'}
