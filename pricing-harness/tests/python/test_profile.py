import importlib.util
import json
import subprocess
import sys
from pathlib import Path

TOOLS=Path(__file__).resolve().parents[2]/'bundled/harness-tools'

def helper():
    spec=importlib.util.spec_from_file_location('data_workspace',TOOLS/'data_workspace.py')
    module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
    return module

def prepared(m,tmp_path,text,name='s.csv'):
    source=tmp_path/name;source.write_text(text)
    return m.prepare_source(source,tmp_path/'cache',m.ImportOptions(format='csv'))

def test_profile_reports_cast_facts_without_business_meaning(tmp_path):
    m=helper()
    p=prepared(m,tmp_path,'id,amount,when,at,label,big,code,flag\n1,10.5,2024-01-01,2024-01-01 10:00:00,A,"1,200.50",007,true\n2,3,2024-02-01,2024-02-01 11:30:00,B,"2,000",008,false\n3,,2024-03-01,2024-03-01 09:15:00,A,3,009,TRUE\n')
    profile=m.profile_prepared(p);cols={c['name']:c for c in profile['columns']}
    assert profile['rowCount']==3 and profile['columnCount']==8 and profile['profiledColumns']==8
    assert cols['id']['inferredType']=='integer' and cols['id']['min']=='1' and cols['id']['max']=='3'
    assert cols['amount']['inferredType']=='decimal' and cols['amount']['nonNull']==2
    assert cols['when']['inferredType']=='date' and cols['at']['inferredType']=='timestamp'
    assert cols['label']['inferredType']=='text' and cols['label']['topValues'][0]=={'value':'A','count':2}
    assert cols['big']['inferredType']=='text' and cols['big']['thousandsSeparatorValues']==2
    assert cols['code']['inferredType']=='code' and cols['code']['leadingZeroValues']==3
    assert cols['flag']['inferredType']=='boolean'

def test_mostly_numeric_columns_report_cast_failures(tmp_path):
    m=helper()
    # A second column gives the delimiter sniffer something to detect; one-column files cannot be sniffed.
    rows='\n'.join([f'{i},x' for i in range(1,40)]+['n/a,x'])
    p=prepared(m,tmp_path,'qty,note\n'+rows+'\n')
    col=m.profile_prepared(p)['columns'][0]
    assert col['inferredType']=='mostly-numeric' and col['castFailures']==1

def test_wide_sources_are_truncated_and_profiles_cached(tmp_path):
    m=helper();p=prepared(m,tmp_path,'a,b,c\n1,2,3\n')
    first=m.profile_prepared(p,max_columns=2)
    assert first['columnCount']==3 and first['profiledColumns']==2
    assert list(p.database_path.parent.glob('profile-v1-*.json'))
    assert m.profile_prepared(p,max_columns=2)==first

def test_cli_profiles_every_excel_sheet(tmp_path):
    from openpyxl import Workbook
    book=Workbook();book.active.title='sales';book.active.append(['amount']);book.active.append([5])
    other=book.create_sheet('costs');other.append(['cost']);other.append([2.5])
    source=tmp_path/'book.xlsx';book.save(source)
    out=subprocess.run([sys.executable,str(TOOLS/'profile_source.py'),'--source',str(source),'--cache',str(tmp_path/'cache'),'--format','xlsx'],capture_output=True,text=True,check=True)
    profiles=json.loads(out.stdout)['profiles']
    assert [p['sheet'] for p in profiles]==['sales','costs']
    assert profiles[1]['columns'][0]['inferredType']=='decimal'

import pytest

def test_typed_view_casts_profiled_types_and_keeps_text(tmp_path):
    m=helper();p=prepared(m,tmp_path,'id,amount,when,label,code\n1,10.5,2024-01-01,A,007\n2,,2024-02-01,B,008\n')
    profile=m.profile_prepared(p);conn=m.connect_analysis(tmp_path/'run',tmp_path/'tmp',fresh=True)
    try:
        m.attach_source(conn,p,'sales');made=m.create_typed_view(conn,'sales',profile)
        assert made=={'view':'sales_typed','textColumns':['label','code']}
        types=dict((r[0],r[1]) for r in conn.execute('DESCRIBE sales_typed').fetchall())
        assert types['id']=='BIGINT' and types['amount'].startswith('DECIMAL') and types['when']=='DATE' and types['code']=='VARCHAR'
        assert float(conn.execute('SELECT sum(amount) FROM sales_typed').fetchone()[0])==pytest.approx(10.5)
    finally:conn.close()

def test_typed_view_overrides_and_refuses_lossy_casts(tmp_path):
    m=helper();p=prepared(m,tmp_path,'id,label\n1,A\n2,B\n');profile=m.profile_prepared(p)
    conn=m.connect_analysis(tmp_path/'run',tmp_path/'tmp',fresh=True)
    try:
        m.attach_source(conn,p,'sales')
        assert m.create_typed_view(conn,'sales',profile,overrides={'id':'VARCHAR'})['textColumns']==['id','label']
        with pytest.raises(ValueError,match='NULL'):m.create_typed_view(conn,'sales',profile,view_name='bad',overrides={'label':'BIGINT'})
        with pytest.raises(ValueError,match='SQL type'):m.create_typed_view(conn,'sales',profile,overrides={'id':'BIGINT; DROP TABLE x'})
        with pytest.raises(ValueError,match='not in source'):m.create_typed_view(conn,'sales',profile,overrides={'missing':'BIGINT'})
    finally:conn.close()
