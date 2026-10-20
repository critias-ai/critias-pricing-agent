"""Regression tests for the 2026-10 security audit fixes (XLSX bounds, peer-ratio identifier quoting)."""
import importlib.util
import sys
import zipfile
from pathlib import Path
import duckdb
import pytest

TOOLS = Path(__file__).resolve().parents[2] / 'bundled/harness-tools'
sys.path.insert(0, str(TOOLS))


def load(name):
    spec = importlib.util.spec_from_file_location(name, TOOLS / f'{name}.py')
    module = importlib.util.module_from_spec(spec); sys.modules[name] = module; spec.loader.exec_module(module)
    return module


def workbook(path, width, last_row, dimension_rows=None):
    """A minimal sheet: `width` header cells, one cell in `last_row`, and a declared <dimension> that may lie."""
    col = lambda n: (col((n - 1) // 26) if n > 26 else '') + chr(65 + (n - 1) % 26)
    header = ''.join(f'<c r="{col(i)}1" t="inlineStr"><is><t>h{i}</t></is></c>' for i in range(1, width + 1))
    tail = f'<row r="{last_row}"><c r="A{last_row}" t="inlineStr"><is><t>x</t></is></c></row>' if last_row > 1 else ''
    dim = f'A1:XFD{dimension_rows or last_row}'
    ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
        z.writestr('_rels/.rels', f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="{rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr('xl/workbook.xml', f'<workbook xmlns="{ns}" xmlns:r="{rel}"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels', f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="{rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
        z.writestr('xl/worksheets/sheet1.xml', f'<worksheet xmlns="{ns}"><dimension ref="{dim}"/><sheetData><row r="1">{header}</row>{tail}</sheetData></worksheet>')


def test_xlsx_declared_width_is_ignored_and_rows_pad_to_the_header(tmp_path):
    m = load('data_workspace')
    workbook(tmp_path / 'wide.xlsx', 3, 4)  # declares 16,384 columns; only 3 headers exist
    prepared = m.prepare_source(tmp_path / 'wide.xlsx', tmp_path / 'cache', m.ImportOptions(format='xlsx', sheet='S'))
    assert prepared.row_count == 3 and list(prepared.column_mapping) == ['h1', 'h2', 'h3']


def test_xlsx_gap_rows_stop_at_the_cell_cap(tmp_path, monkeypatch):
    m = load('data_workspace')
    monkeypatch.setattr(m, 'MAX_XLSX_CELLS', 1000)
    workbook(tmp_path / 'sparse.xlsx', 10, 1_048_576)  # one far cell makes openpyxl yield ~1M blank rows
    with pytest.raises(ValueError, match='cells; export it to CSV'):
        m.prepare_source(tmp_path / 'sparse.xlsx', tmp_path / 'cache', m.ImportOptions(format='xlsx', sheet='S'))


def test_peer_ratio_quotes_header_text_as_identifiers():
    PeerRatio = load('peer_ratio').PeerRatio
    conn = duckdb.connect()
    name = 'unit "price"'  # a header with a double quote must stay one identifier
    conn.execute(f'CREATE TABLE "s v" ("sku" VARCHAR, "{name.replace(chr(34), chr(34) * 2)}" VARCHAR)')
    conn.execute('INSERT INTO "s v" SELECT \'A\', (10 + i % 3)::VARCHAR FROM range(6) t(i)')
    peers = PeerRatio(conn, [{'source': 'a.csv', 'column': name, 'key': 'sku'}], {'a.csv': 's v'})
    assert len(peers.peers) == 1
    assert conn.execute(f'SELECT count(*) FROM {peers.peers[0]["table"]}').fetchone()[0] == 1
