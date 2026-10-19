"""Opt-in synthetic capacity check; expected totals are derived independently."""
import csv
import json
import platform
import resource
import sys
import time
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from fractions import Fraction
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'bundled/harness-tools'))
from data_workspace import prepare_source,ImportOptions,connect_analysis,attach_source,quote

@dataclass
class ScaleExpected:
    rows:int
    revenue:int
    cogs:int
    keyed:dict

def generate_scale(path:Path,rows:int,seed:int=0)->ScaleExpected:
    if rows<1:raise ValueError('rows must be positive')
    pattern=[(2021+i//20,'X',f'P{i%20:02}',100+i%20,60+(i%20)*2) for i in range(100)]
    keyed={};revenue=cost=0
    for i,(year,group,product,r,c) in enumerate(pattern):
        count=rows//100+(1 if i<rows%100 else 0);keyed[(year,product)]=(r*count,c*count);revenue+=r*count;cost+=c*count
    # Repeated chunks keep generation memory bounded regardless of requested size.
    with path.open('w',newline='') as file:
        writer=csv.writer(file);writer.writerow(['year','group','product','revenue','cogs'])
        chunk=pattern*1000
        for _ in range(rows//len(chunk)):writer.writerows(chunk)
        writer.writerows((pattern[i%100] for i in range(rows%len(chunk))))
    return ScaleExpected(rows,revenue,cost,keyed)

def disk_bytes(root):return sum(p.stat().st_size for p in Path(root).rglob('*') if p.is_file())

def run_scale(root:Path,rows:int):
    root=Path(root);root.mkdir(parents=True,exist_ok=True);source=root/'sales.csv';start=time.perf_counter();expected=generate_scale(source,rows);generated=time.perf_counter();prepared=prepare_source(source,root/'cache',ImportOptions(format='csv'));imported=time.perf_counter()
    conn=connect_analysis(root/'analysis',root/'spill',memory_limit='4GB',threads=4)
    try:
        total=conn.execute(f"SELECT count(*),sum(CAST(revenue AS BIGINT)),sum(CAST(cogs AS BIGINT)) FROM read_csv({quote(source)},all_varchar=true)").fetchone()
        attach_source(conn,prepared,'sales');records=conn.execute('SELECT CAST(year AS INTEGER),product,sum(CAST(revenue AS BIGINT)),sum(CAST(cogs AS BIGINT)) FROM sales.raw GROUP BY year,product ORDER BY year,product').fetchall()
        assert total==(expected.rows,expected.revenue,expected.cogs)
        assert prepared.row_count==rows
        for year,product,revenue,cost in records:assert (revenue,cost)==expected.keyed[(year,product)]
        nonempty=sum(r>0 for r,c in expected.keyed.values());assert len(records)==nonempty
        # Thresholds use exact fractions, independently of DuckDB floating point.
        annual={year:(sum(r for (y,p),(r,c) in expected.keyed.items() if y==year),sum(c for (y,p),(r,c) in expected.keyed.items() if y==year)) for year in range(2021,2026)}
        flags=[]
        for year,product,revenue,cost in records:
            gr,gc=annual[year];bps=10000*(Fraction(revenue-cost,revenue)-Fraction(gr-gc,gr));flags.append((year,product,abs(bps)>=500,revenue>50000))
        conn.execute('CREATE TABLE results AS SELECT CAST(year AS INTEGER) AS "year", product, sum(CAST(revenue AS BIGINT)) AS revenue, sum(CAST(cogs AS BIGINT)) AS cogs FROM sales.raw GROUP BY year, product')
        conn.execute(f"COPY results TO {quote(root/'results.csv')} (HEADER)")
        with (root/'results.csv').open() as file:assert sum(1 for _ in csv.DictReader(file))==len(records)
    finally:conn.close()
    queried=time.perf_counter();reused=prepare_source(source,root/'cache',ImportOptions(format='csv'));cached=time.perf_counter()
    peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*(1 if sys.platform=='darwin' else 1024)
    report={'host':platform.platform(),'native_macos':sys.platform=='darwin','python':platform.python_version(),'duckdb':prepared.duckdb_version,'requested_rows':rows,'checked_rows':total[0],'source_bytes':source.stat().st_size,'disk_bytes':disk_bytes(root),'peak_process_rss_bytes':peak,'memory_limit':'4GB','threads':4,'generate_seconds':generated-start,'import_seconds':imported-generated,'query_export_seconds':queried-imported,'cache_check_seconds':cached-queried,'cache_reused':reused.database_path==prepared.database_path,'groups':len(records),'independent_outliers':sum(x[2] for x in flags),'independent_detail':sum(x[3] for x in flags),'all_checks_passed':True}
    destination=Path(__import__('os').environ.get('PRICING_SCALE_OUTPUT',str(root/'scale-result.json')));destination.parent.mkdir(parents=True,exist_ok=True);destination.write_text(json.dumps(report,indent=2));print(json.dumps(report));return report

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--directory',type=Path,required=True);parser.add_argument('--rows',type=int,required=True);args=parser.parse_args();run_scale(args.directory,args.rows)
