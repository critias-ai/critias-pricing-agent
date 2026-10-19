"""Data findings on the shapes the generalisation sources bring (plan section 3k): one test per gap the D0-2 rewrite closed."""
import os
from test_data_findings import LINE, df, issues, line, pack


def lines(**change):
    return [line(i, **{k: v(i) for k, v in change.items()}) for i in range(2000)]


def parse_issues(result, source, column):
    return {i for (c, i) in issues(result, source) if c == column}


def test_a_column_wholly_of_currency_text_is_flagged(tmp_path):
    result = pack(tmp_path, lines(price=lambda i: f'"${(i % 200 + 1) * 10:,.2f}"'))
    assert parse_issues(result, 'lines.csv', 'price')


def test_a_column_wholly_of_real_prices_is_flagged(tmp_path):
    result = pack(tmp_path, lines(price=lambda i: f'"R$ {(i % 200 + 1) * 0.1:.2f}"'.replace('.', ',')))
    assert parse_issues(result, 'lines.csv', 'price')


def test_a_column_wholly_of_decimal_commas_is_flagged(tmp_path):
    result = pack(tmp_path, lines(price=lambda i: f'"{(i % 200 + 1) * 0.1:.2f}"'.replace('.', ',')))
    assert 'decimal-comma' in parse_issues(result, 'lines.csv', 'price')


def test_a_column_wholly_of_day_first_dates_is_flagged_day_first(tmp_path):
    result = pack(tmp_path, lines(sold_at=lambda i: f'{1 + i % 28:02d}/01/2024 10:00'))
    assert any('day-first' in i for i in parse_issues(result, 'lines.csv', 'sold_at'))


def test_slash_dates_that_never_exceed_twelve_are_ambiguous(tmp_path):
    result = pack(tmp_path, lines(sold_at=lambda i: f'{1 + i % 12:02d}/{1 + i % 12:02d}/2024 10:00'))
    assert any('ambiguous' in i for i in parse_issues(result, 'lines.csv', 'sold_at'))


def test_domain_matches_keys_by_their_values_not_their_names(tmp_path):
    rows = lines(product_id=lambda i: f'X{i % 20:02d}' if i % 50 == 0 else f'P{i % 200:03d}')
    result = pack(tmp_path, rows, products=None, extra={'products.csv': ['sku,name', *[f'P{i:03d},Item {i}' for i in range(200)]]})
    assert any(f['detector'] == 'domain' for f in issues(result, 'lines.csv').values())


def test_repeated_documents_are_found_without_an_id_like_column_name(tmp_path):
    rows = [r.replace('INV', '') for r in lines()] + [line(i, line_id=f'L9{i:04d}', invoice_id='9999') for i in range(4, 8)]
    result = pack(tmp_path, rows, extra={'lines.csv': [LINE.replace('invoice_id', 'Invoice'), *rows]})
    assert ('Invoice', 'repeated-document') in issues(result, 'lines.csv')


def test_peer_ratio_runs_inside_a_single_file(tmp_path):
    rows = lines()
    rows[8] = line(8, price='80.00')
    path = tmp_path / 'lines.csv'
    path.write_text('\n'.join([LINE, *rows]) + '\n')
    _, result = df.detect([str(path)], tmp_path / 'cache')
    assert any(f['detector'] == 'ratio' and f['rows'] == 1 for f in result['findings'])


def test_a_case_of_24_has_its_own_label(tmp_path):
    rows = lines()
    rows[8] = line(8, price='21.60')
    assert ('price', 'x24 vs product_id median') in issues(pack(tmp_path, rows), 'lines.csv')


def test_a_non_utf8_source_is_reported_and_the_rest_still_checked(tmp_path):
    rows = lines()
    rows[8] = line(8, price='80.00')
    pack(tmp_path, rows)
    (tmp_path / 'notes.csv').write_bytes('note_id,text\nN1,caf\u00e9\n'.encode('utf-16'))
    result = df.detect([str(tmp_path / n) for n in ('products.csv', 'customers.csv', 'lines.csv', 'notes.csv')], tmp_path / 'cache')
    cover = {os.path.basename(c['source']): c for c in result[1]['coverage']}
    assert cover['notes.csv']['status'] == 'skipped' and 'UTF-8' in cover['notes.csv']['reason']
    assert ('price', 'x1e2 vs product_id median') in issues(result, 'lines.csv')


def test_a_multi_character_delimiter_is_reported(tmp_path):
    result = pack(tmp_path, extra={'odd.csv': ['a+|b', '1+|2', '3+|4']})
    cover = {os.path.basename(c['source']): c for c in result[1]['coverage']}
    assert cover['odd.csv']['status'] == 'skipped' and 'delimiter' in cover['odd.csv']['reason']


def test_xlsx_sheets_are_checked(tmp_path):
    from openpyxl import Workbook
    book = Workbook()
    for r in [LINE, *lines()]:
        book.active.append(r.split(','))
    book.active['F12'] = '1,10'  # one price with a decimal comma
    book.save(tmp_path / 'lines.xlsx')
    _, result = df.detect([str(tmp_path / 'lines.xlsx')], tmp_path / 'cache')
    assert any(f['column'] == 'price' and f['issue'] == 'decimal-comma' for f in result['findings'])


def test_every_money_column_is_reported_with_its_value(tmp_path):
    header = LINE + ',freight'
    rows = [f'{r},{(i % 7 + 1) * 1.5:.2f}' for i, r in enumerate(lines())]
    result = pack(tmp_path, extra={'lines.csv': [header, *rows]})
    cover = [c for c in result[1]['coverage'] if c['source'].endswith('lines.csv')]
    assert {'price', 'freight'} <= set(cover[0]['valueColumns'])


def test_coverage_names_every_detector_for_every_source(tmp_path):
    cover = {os.path.basename(c['source']): c['detectors'] for c in pack(tmp_path)[1]['coverage']}
    assert set(cover) == {'lines.csv', 'products.csv', 'customers.csv'}
    for detectors in cover.values():
        assert set(detectors) == {'parse', 'shape', 'domain', 'uniqueness', 'ratio', 'identity', 'time'}
    assert cover['lines.csv']['parse'] == cover['lines.csv']['time'] == 'ran'
    assert cover['customers.csv']['time'].startswith('skipped: ')


def test_identity_flags_a_value_that_is_not_quantity_times_price_and_ignores_zero_columns(tmp_path):
    rows = [f'{r},{int(r.split(",")[4]) * float(r.split(",")[5]):.2f},0.00' for r in lines()]
    rows[9] = rows[9].rsplit(',', 2)[0] + ',99.99,0.00'
    result = pack(tmp_path, extra={'lines.csv': [LINE + ',value,adjustment', *rows]})
    found = {(c, i) for (c, i), f in issues(result, 'lines.csv').items() if f['detector'] == 'identity'}
    assert found == {('value', 'not quantity × price')}


def test_time_flags_reversed_dates_but_not_dates_that_are_mostly_equal(tmp_path):
    starts = [f'2024-01-{1 + i % 28:02d}' for i in range(2000)]
    rows = [f'{r},{s},{s if i % 10 else "2024-02-01"},{"2023-12-01" if i == 5 else "2024-03-01"}' for i, (r, s) in enumerate(zip(lines(), starts))]
    result = pack(tmp_path, extra={'lines.csv': [LINE + ',start,last,end', *rows]})
    found = {(c, i) for (c, i), f in issues(result, 'lines.csv').items() if f['detector'] == 'time'}
    assert found == {('start', 'after end'), ('last', 'after end'), ('sold_at', 'after end')}  # row 5 ends before it starts; last ≠ start is never reversed


def test_year_month_values_are_dates(tmp_path):
    rows = lines(sold_at=lambda i: '2099-01' if i == 3 else f'2024-{1 + i % 12:02d}')
    assert ('sold_at', 'after today') in issues(pack(tmp_path, rows), 'lines.csv')


def test_time_compares_a_row_with_the_row_its_key_refers_to(tmp_path):
    rows = lines(sold_at=lambda i: '2023-06-01' if i == 4 else '2024-01-15 10:00:00')  # product P004 launched 2024-01-01
    result = pack(tmp_path, rows, extra={'products.csv': ['product_id,name,launched', *[f'P{i:03d},Item {i},2024-01-01' for i in range(200)]]})
    found = issues(result, 'lines.csv')
    assert found[('sold_at', f'before {tmp_path / "products.csv"}:launched')]['rows'] == 1


def test_case_variants_are_found_in_a_column_of_few_values(tmp_path):
    rows = [f'{r},{"BETTER" if i == 6 else ("Good", "Better", "Best")[i % 3]}' for i, r in enumerate(lines())]
    result = pack(tmp_path, extra={'lines.csv': [LINE + ',plan', *rows]})
    assert issues(result, 'lines.csv')[('plan', 'variant-of-common-value')]['rows'] == 1


def test_a_value_off_the_dominant_shape_is_flagged_from_five_values(tmp_path):
    rows = [f'{r},{"Q3 2025" if i < 30 else f"2025-Q{1 + i % 4}" if i % 2 else f"2024-Q{1 + i % 4}"}' for i, r in enumerate(lines())]
    result = pack(tmp_path, extra={'lines.csv': [LINE + ',quarter', *rows]})
    assert issues(result, 'lines.csv')[('quarter', 'rare-shape A9 9999')]['rows'] == 30


def test_a_far_value_with_no_clean_multiple_is_still_reported(tmp_path):
    rows = lines()
    rows[8] = line(8, price='17.00')  # 19× the product's 0.90: neither a power of ten nor a pack
    assert issues(pack(tmp_path, rows), 'lines.csv')[('price', 'outlier vs product_id median')]['rows'] == 1


def test_a_utf8_file_with_a_byte_order_mark_is_read(tmp_path):
    rows = lines(product_id=lambda i: 'P999' if i < 5 else f'P{i % 200:03d}')
    pack(tmp_path, rows)
    (tmp_path / 'products.csv').write_bytes(b'\xef\xbb\xbf' + '\r\n'.join(['product_id,name', *[f'P{i:03d},Item {i}' for i in range(200)]]).encode() + b'\r\n')
    result = df.detect([str(tmp_path / n) for n in ('products.csv', 'customers.csv', 'lines.csv')], tmp_path / 'cache2')
    assert {os.path.basename(c['source']): c['status'] for c in result[1]['coverage']}['products.csv'] == 'ran'
    assert issues(result, 'lines.csv')[('product_id', f'missing-from {tmp_path / "products.csv"}')]['rows'] == 5


def test_frequent_codes_off_the_shapes_that_hold_most_rows_are_flagged(tmp_path):
    code = lambda i: 'POST' if i < 40 else 'M' if i < 60 else f'{10000 + i % 300}' + ('A' if i % 8 == 0 else '')  # products split 88/12 by shape
    rows = [f'{r},{code(i)}' for i, r in enumerate(lines())]
    found = issues(pack(tmp_path, extra={'lines.csv': [LINE + ',stock_code', *rows]}), 'lines.csv')
    assert found[('stock_code', 'rare-shape AAAA')]['rows'] == 40 and found[('stock_code', 'rare-shape A')]['rows'] == 20
    assert ('stock_code', 'rare-shape 99999A') not in found


def test_a_file_whose_first_row_is_data_is_reported_as_having_no_header(tmp_path):
    rows = [f'{i}\tItem {i}\t2019-04-30 00:00:00.000' for i in range(1, 50)]
    result = pack(tmp_path, extra={'category.csv': rows, 'offer.csv': [f'{i}\t{i % 3}\t.0000' for i in range(1, 50)]})
    cover = {os.path.basename(c['source']): c for c in result[1]['coverage']}
    for name in ('category.csv', 'offer.csv'):
        assert cover[name]['status'] == 'skipped' and 'no header row' in cover[name]['reason']


def test_a_multi_character_delimiter_is_reported_when_rows_end_in_another(tmp_path):
    result = pack(tmp_path, extra={'store.csv': ['292+|Bike Store+|279&|', '294+|Bike Shop+|280&|']})
    cover = {os.path.basename(c['source']): c for c in result[1]['coverage']}
    assert cover['store.csv']['status'] == 'skipped' and 'delimiter' in cover['store.csv']['reason']
