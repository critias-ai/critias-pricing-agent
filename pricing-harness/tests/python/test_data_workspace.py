import importlib.util
import sys
from pathlib import Path
import pytest

def helper():
    path=Path(__file__).resolve().parents[2]/'bundled/harness-tools/data_workspace.py'
    assert path.exists(), 'disk-backed helper missing'
    spec=importlib.util.spec_from_file_location('data_workspace',path)
    module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
    return module

def test_raw_csv_cache_is_reused_and_invalidated(tmp_path):
    m=helper();source=tmp_path/'sales.csv';source.write_text('product,amount,cost\nA,"1,200.50",\nB,12.00,5.00\n')
    options=m.ImportOptions(format='csv');first=m.prepare_source(source,tmp_path/'cache',options)
    assert first.row_count==2
    assert m.prepare_source(source,tmp_path/'cache',options).database_path==first.database_path
    conn=m.connect_analysis(tmp_path/'run',tmp_path/'tmp',memory_limit='128MB',threads=1)
    try:
        m.attach_source(conn,first,'sales')
        result=m.fetch_small_result(conn,'SELECT * FROM sales.raw',max_rows=2)
        assert result.iloc[0]['amount']=='1,200.50'
        assert result.iloc[0]['cost'] is None
        with pytest.raises(ValueError,match='bound'):m.fetch_small_result(conn,'SELECT * FROM sales.raw',max_rows=1)
        with pytest.raises(Exception):conn.execute("INSERT INTO sales.raw VALUES ('C','2','1')")
    finally:conn.close()
    source.write_text('product,amount,cost\nC,1,1\n')
    assert m.prepare_source(source,tmp_path/'cache',options).database_path!=first.database_path

def test_excel_requires_sheet_and_preserves_missing_cached_formula(tmp_path):
    from openpyxl import Workbook
    m=helper();book=Workbook();book.active.title='data';book.active.append(['product','amount']);book.active.append(['A','=1+1']);book.create_sheet('notes')
    source=tmp_path/'sales.xlsx';book.save(source)
    with pytest.raises(ValueError,match='sheet'):m.prepare_source(source,tmp_path/'cache',m.ImportOptions(format='xlsx'))
    prepared=m.prepare_source(source,tmp_path/'cache',m.ImportOptions(format='xlsx',sheet='data'))
    conn=m.connect_analysis(tmp_path/'run',tmp_path/'tmp')
    try:
        m.attach_source(conn,prepared,'sales');assert m.fetch_small_result(conn,'SELECT * FROM sales.raw').iloc[0]['amount'] is None
    finally:conn.close()

def test_fresh_analysis_can_retry_without_retaining_views_or_changing_sources(tmp_path):
    m=helper();source=tmp_path/'sales.csv';source.write_text('product,amount\nA,12.00\n')
    prepared=m.prepare_source(source,tmp_path/'cache',m.ImportOptions(format='csv'))
    before=prepared.database_path.read_bytes()
    for _ in range(2):
        conn=m.connect_analysis(tmp_path/'run',tmp_path/'tmp',fresh=True)
        try:
            m.attach_source(conn,prepared,'sales')
            conn.execute('CREATE VIEW s AS SELECT * FROM sales.raw')
            assert conn.execute('SELECT count(*) FROM s').fetchone()[0]==1
        finally:conn.close()
    conn=m.connect_analysis(tmp_path/'run',tmp_path/'tmp')
    try:
        m.attach_source(conn,prepared,'sales')
        assert conn.execute('SELECT count(*) FROM s').fetchone()[0]==1
    finally:conn.close()
    assert prepared.database_path.read_bytes()==before
    assert source.read_text()=='product,amount\nA,12.00\n'

def test_source_hash_is_reused_until_file_identity_changes(tmp_path,monkeypatch):
    m=helper();source=tmp_path/'sales.csv';source.write_text('product,amount\nA,1\n')
    calls=[];original=m.source_hash
    monkeypatch.setattr(m,'source_hash',lambda path:(calls.append(path),original(path))[1])
    first=m.cached_source_hash(source,tmp_path/'cache');second=m.cached_source_hash(source,tmp_path/'cache')
    assert first==second==original(source) and len(calls)==1
    source.write_text('product,amount\nB,2\n')
    assert m.cached_source_hash(source,tmp_path/'cache')!=first and len(calls)==2

def test_prepare_source_cache_hit_does_not_rehash(tmp_path,monkeypatch):
    m=helper();source=tmp_path/'sales.csv';source.write_text('product,amount\nA,1\n')
    options=m.ImportOptions(format='csv');m.prepare_source(source,tmp_path/'cache',options)
    calls=[];original=m.source_hash
    monkeypatch.setattr(m,'source_hash',lambda path:(calls.append(path),original(path))[1])
    m.prepare_source(source,tmp_path/'cache',options)
    assert calls==[]

def test_utf16_csv_imports_with_the_same_values_as_utf8(tmp_path):
    m=helper();text='Day\tCampaign\tCost\n2026-01-01\tMarke Müller – Suche\t1,234.50\n2026-01-02\tBrand\t7.00\n'
    (tmp_path/'u8.csv').write_text(text,encoding='utf-8');(tmp_path/'u16.csv').write_text(text,encoding='utf-16')  # utf-16 writes a BOM
    assert m.text_encoding(tmp_path/'u16.csv')=='utf-16' and m.text_encoding(tmp_path/'u8.csv')=='utf-8-sig'
    rows={}
    for name in ('u8','u16'):
        prepared=m.prepare_source(tmp_path/f'{name}.csv',tmp_path/'cache',m.ImportOptions(format='csv'))
        conn=m.connect_analysis(tmp_path/f'run-{name}',tmp_path/'tmp',memory_limit='128MB',threads=1)
        try:m.attach_source(conn,prepared,'src');rows[name]=conn.execute('SELECT * FROM src.raw ORDER BY 1').fetchall()
        finally:conn.close()
        assert prepared.column_mapping=={'Day':'Day','Campaign':'Campaign','Cost':'Cost'}
        assert not list(prepared.database_path.parent.glob('*.csv'))  # the decoded copy is not kept
    assert rows['u16']==rows['u8']==[('2026-01-01','Marke Müller – Suche','1,234.50'),('2026-01-02','Brand','7.00')]
    (tmp_path/'latin.csv').write_text('a,b\n1,2\n',encoding='latin-1')
    with pytest.raises(ValueError,match='UTF-8 or UTF-16'):m.prepare_source(tmp_path/'latin.csv',tmp_path/'cache',m.ImportOptions(format='csv',encoding='latin-1'))
