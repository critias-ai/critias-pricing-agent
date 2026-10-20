"""Disk-backed raw staging. This module deliberately has no financial definitions."""
import csv
import hashlib
import io
import json
import os
import re
import shutil
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal
import duckdb

DATA_TOOL_VERSION = '0.1.2'

@dataclass(frozen=True)
class ImportOptions:
    format: Literal['csv','xlsx']
    header_row: int = 1  # 0: the file has no header row; columns are named column1..N
    delimiter: str | None = None
    encoding: str = 'utf-8-sig'  # a byte-order mark is not part of the first header
    sheet: str | None = None

@dataclass(frozen=True)
class PreparedSource:
    database_path: Path
    source_sha256: str
    row_count: int
    column_mapping: dict[str,str]
    import_options: ImportOptions
    data_tool_version: str
    duckdb_version: str

def source_hash(path):
    digest=hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda:source.read(8*1024*1024),b''):digest.update(chunk)
    return digest.hexdigest()

def cached_source_hash(path,cache_root):
    """Reuse a content hash while device, inode, size, mtime and ctime are unchanged."""
    path=Path(path).resolve(strict=True);index=Path(cache_root)/'.hash-index';index.mkdir(parents=True,exist_ok=True)
    entry=index/(hashlib.sha256(str(path).encode()).hexdigest()+'.json')
    def identity():
        s=path.stat();return [s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns]
    before=identity()
    try:
        saved=json.loads(entry.read_text())
        if saved.get('identity')==before and isinstance(saved.get('sha256'),str):return saved['sha256']
    except (OSError,ValueError):pass
    digest=source_hash(path)
    if identity()==before:
        temp=index/(entry.name+'.'+str(uuid.uuid4())+'.partial')
        temp.write_text(json.dumps({'identity':before,'sha256':digest}));os.replace(temp,entry)
    return digest

def text_encoding(path):
    """'utf-16' for a file that starts with a UTF-16 byte-order mark (some ad-platform exports), else 'utf-8-sig'."""
    with open(path,'rb') as file:head=file.read(2)
    return 'utf-16' if head in (b'\xff\xfe',b'\xfe\xff') else 'utf-8-sig'

def header_row(sample,delimiter):
    """1-based row of the header: the first row as wide as most rows in the sample. Narrower rows above it, such as a
    report title or a date range, are skipped. The sample's last row may be cut off, so it is not counted."""
    rows=list(csv.reader(io.StringIO(sample),delimiter=delimiter))[:-1] or list(csv.reader(io.StringIO(sample),delimiter=delimiter))
    widths=[len(r) for r in rows if r]
    if not widths:return 1
    width=max(set(widths),key=widths.count)
    return next(i for i,r in enumerate(rows,1) if len(r)==width)

def quote(value):return "'"+str(value).replace("'","''")+"'"
def identifier(value):return '"'+str(value).replace('"','""')+'"'

MAX_XLSX_CELLS=20_000_000  # rows x header width; blank gap rows count, since openpyxl yields them

def _headers(values):
    if not values or any(v is None or not str(v).strip() for v in values):raise ValueError('missing column header')
    names=[str(v) for v in values]
    if len({name.casefold() for name in names})!=len(names):raise ValueError('duplicate column headers; resolve before import')
    return names

def prepare_source(source:Path,cache_root:Path,options:ImportOptions)->PreparedSource:
    source=Path(source).resolve(strict=True);cache_root=Path(cache_root);cache_root.mkdir(parents=True,exist_ok=True)
    if options.header_row<0 or (options.header_row==0 and options.format!='csv'):raise ValueError('header_row must be positive (0, no header, for CSV only)')
    if options.format not in ('csv','xlsx'):raise ValueError('unsupported format')
    sha=cached_source_hash(source,cache_root)
    key=hashlib.sha256(json.dumps([sha,asdict(options),DATA_TOOL_VERSION,duckdb.__version__],sort_keys=True).encode()).hexdigest()
    final=cache_root/key
    def restored():
        metadata=json.loads((final/'metadata.json').read_text())
        if not (final/'source.duckdb').is_file():raise ValueError('incomplete cache; remove it and retry')
        return PreparedSource(final/'source.duckdb',sha,metadata['row_count'],metadata['column_mapping'],options,DATA_TOOL_VERSION,duckdb.__version__)
    if final.exists():return restored()
    temp=cache_root/(key+'.'+str(uuid.uuid4())+'.partial');temp.mkdir();conn=None
    try:
        conn=duckdb.connect(str(temp/'source.duckdb'))
        conn.execute("SET memory_limit='4GB'");conn.execute(f"SET temp_directory={quote(temp/'spill')}")
        if options.format=='csv':
            encoding=text_encoding(source) if options.encoding.lower() in ('utf-8','utf8','utf-8-sig') else options.encoding.lower()
            if encoding not in ('utf-8','utf8','utf-8-sig','utf-16'):raise ValueError('CSV encoding must be UTF-8 or UTF-16; convert explicitly before import')
            with source.open(encoding=encoding,newline='') as file:
                sample=file.read(65536);file.seek(0)
                delimiter=options.delimiter or csv.Sniffer().sniff(sample,delimiters=',;\t|').delimiter
                reader=csv.reader(file,delimiter=delimiter,strict=True)
                for _ in range(options.header_row-1):next(reader)
                first=next(reader);names=_headers(first) if options.header_row else [f'column{i}' for i in range(1,len(first)+1)]
            read=source
            if encoding=='utf-16':  # DuckDB reads UTF-8 here: decode into the cache once, values unchanged
                read=temp/'source.csv'
                with source.open(encoding='utf-16',newline='') as file,read.open('w',encoding='utf-8',newline='') as out:shutil.copyfileobj(file,out)
            conn.execute(f"CREATE TABLE raw AS SELECT * FROM read_csv({quote(read)}, header={str(bool(options.header_row)).lower()}, all_varchar=true, delim={quote(delimiter)}, skip={max(options.header_row-1,0)}, strict_mode=true, ignore_errors=false{'' if options.header_row else ', names=['+','.join(quote(n) for n in names)+']'})")
            actual=[row[0] for row in conn.execute('DESCRIBE raw').fetchall()]
            if actual!=names:raise ValueError('parsed headers differ from inspected headers')
        else:
            from openpyxl import load_workbook
            book=load_workbook(source,read_only=True,data_only=True)
            try:
                if options.sheet is None:raise ValueError(f'explicit sheet required; available sheets: {book.sheetnames}')
                if options.sheet not in book.sheetnames:raise ValueError('selected sheet does not exist')
                sheet=book[options.sheet];sheet.reset_dimensions()  # the file's declared size is untrusted: rows pad to the header only
                names=_headers(next(sheet.iter_rows(min_row=options.header_row,max_row=options.header_row,values_only=True),()))
                conn.execute('CREATE TABLE raw ('+', '.join(identifier(n)+' VARCHAR' for n in names)+')')
                import pandas
                batch=[];cells=0
                def flush(rows):  # a DataFrame insert is ~100x faster than executemany with one parameter per cell
                    conn.register('batch',pandas.DataFrame(rows,columns=range(len(names)),dtype=object));conn.execute('INSERT INTO raw SELECT * FROM batch');conn.unregister('batch')
                for row in sheet.iter_rows(min_row=options.header_row+1,values_only=True):
                    if len(row)>len(names) and any(v is not None for v in row[len(names):]):raise ValueError('Excel row/header width mismatch')
                    row=(tuple(row)+(None,)*len(names))[:len(names)];cells+=len(names)
                    if cells>MAX_XLSX_CELLS:raise ValueError(f'Excel sheet is over {MAX_XLSX_CELLS:,} cells; export it to CSV')
                    batch.append(tuple(None if value is None else str(value) for value in row))
                    if len(batch)*len(names)>=1_000_000:flush(batch);batch=[]
                if batch:flush(batch)
            finally:book.close()
        count=conn.execute('SELECT count(*) FROM raw').fetchone()[0];conn.close();conn=None
        (temp/'source.csv').unlink(missing_ok=True)
        if source_hash(source)!=sha:raise ValueError('source changed during preparation; retry with stable input')
        metadata={'row_count':count,'column_mapping':dict(zip(names,names)),'source_sha256':sha,'import_options':asdict(options),'data_tool_version':DATA_TOOL_VERSION,'duckdb_version':duckdb.__version__}
        (temp/'metadata.json').write_text(json.dumps(metadata,indent=2));shutil.rmtree(temp/'spill',ignore_errors=True)
        try:os.rename(temp,final)
        except FileExistsError:shutil.rmtree(temp)
        return restored()
    except Exception:
        if conn is not None:conn.close()
        shutil.rmtree(temp,ignore_errors=True)
        raise

def connect_analysis(run_dir:Path,temp_dir:Path,memory_limit='4GB',threads=4,*,fresh=False):
    run_dir=Path(run_dir);temp_dir=Path(temp_dir);run_dir.mkdir(parents=True,exist_ok=True);temp_dir.mkdir(parents=True,exist_ok=True)
    if threads<1:raise ValueError('threads must be positive')
    if fresh:
        for name in ('analysis.duckdb','analysis.duckdb.wal'):
            (run_dir/name).unlink(missing_ok=True)
    conn=duckdb.connect(str(run_dir/'analysis.duckdb'))
    conn.execute(f'SET memory_limit={quote(memory_limit)}');conn.execute(f'SET threads={int(threads)}');conn.execute(f'SET temp_directory={quote(temp_dir)}')
    return conn

def attach_source(conn,prepared:PreparedSource,alias:str):
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*',alias):raise ValueError('invalid source alias')
    conn.execute(f'ATTACH {quote(prepared.database_path)} AS {identifier(alias)} (READ_ONLY)')

def fetch_small_result(conn,sql:str,max_rows=100000):
    if not isinstance(max_rows,int) or max_rows<1:raise ValueError('result bound must be positive')
    result=conn.execute(f'SELECT * FROM ({sql.rstrip().rstrip(";")}) AS bounded_result LIMIT {max_rows+1}').fetchdf()
    if len(result)>max_rows:raise ValueError(f'result exceeds bound of {max_rows}; export complete results using DuckDB COPY and prepare a labelled chart overview')
    return result.astype(object).where(result.notna(),None)  # SQL NULL stays None (pandas 3 would give NaN in text columns)

PROFILE_VERSION='1'
_INTEGER=r'^[+-]?[0-9]+$'
_DECIMAL=r'^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
_THOUSANDS=r'^[+-]?[0-9]{1,3}(,[0-9]{3})+([.][0-9]+)?$'
_LEADING_ZERO=r'^[+-]?0[0-9]+'
_TIME=r'[ T][0-9]{1,2}:[0-9]{2}'
_PROFILE_SQL_TYPES={'integer':'BIGINT','decimal':'DOUBLE','mostly-numeric':'DOUBLE','date':'DATE','timestamp':'TIMESTAMP'}

def profile_prepared(prepared:PreparedSource,*,max_columns=200,top_values=5,max_value_chars=60):
    """Describe parsing facts per column: counts, cast results, ranges and frequent values.
    inferredType reports which parse succeeded for every present value; it is not a business meaning."""
    cached=prepared.database_path.parent/f'profile-v{PROFILE_VERSION}-{max_columns}-{top_values}.json'
    if cached.is_file():return json.loads(cached.read_text())
    conn=duckdb.connect(str(prepared.database_path),read_only=True)
    try:
        names=[row[0] for row in conn.execute('DESCRIBE raw').fetchall()];columns=[]
        for name in names[:max_columns]:
            col=identifier(name);v=f"NULLIF(trim({col}),'')"
            non_null,blank,present,distinct,integers,decimals,stamps,times,booleans,thousands,zeros,exponents=conn.execute(f"""SELECT count({col}),
              count(*) FILTER (WHERE {col} IS NOT NULL AND trim({col})=''), count({v}), approx_count_distinct({v}),
              count(*) FILTER (WHERE regexp_matches({v},{quote(_INTEGER)})), count(*) FILTER (WHERE regexp_matches({v},{quote(_DECIMAL)})),
              count(TRY_CAST({v} AS TIMESTAMP)), count(*) FILTER (WHERE regexp_matches({v},{quote(_TIME)})),
              count(*) FILTER (WHERE regexp_matches({v},'^(true|false)$','i')), count(*) FILTER (WHERE regexp_matches({v},{quote(_THOUSANDS)})),
              count(*) FILTER (WHERE regexp_matches({v},{quote(_LEADING_ZERO)})), count(*) FILTER (WHERE regexp_matches({v},'[eE]') AND regexp_matches({v},{quote(_DECIMAL)}))
              FROM raw""").fetchone()
            failures=0
            if present==0:inferred='empty'
            elif integers==present:inferred='code' if zeros else 'integer'
            elif decimals==present:inferred='decimal'
            elif stamps==present:inferred='timestamp' if times else 'date'
            elif booleans==present:inferred='boolean'
            elif decimals>=0.95*present:inferred='mostly-numeric';failures=present-decimals
            else:inferred='text'
            low=high=None;sql_type=_PROFILE_SQL_TYPES.get(inferred)
            if sql_type:low,high=conn.execute(f'SELECT min(TRY_CAST({v} AS {sql_type}))::VARCHAR, max(TRY_CAST({v} AS {sql_type}))::VARCHAR FROM raw').fetchone()
            top=conn.execute(f'SELECT {v} AS value, count(*) AS n FROM raw WHERE {v} IS NOT NULL GROUP BY 1 ORDER BY n DESC, 1 LIMIT {int(top_values)}').fetchall()
            columns.append({'name':name,'inferredType':inferred,'nonNull':non_null,'blank':blank,'distinctApprox':distinct,'castFailures':failures,'thousandsSeparatorValues':thousands,'leadingZeroValues':zeros,'exponentValues':exponents,'min':low,'max':high,'topValues':[{'value':str(value)[:max_value_chars],'count':n} for value,n in top]})
        profile={'schemaVersion':1,'profileVersion':PROFILE_VERSION,'sourceSha256':prepared.source_sha256,'format':prepared.import_options.format,'sheet':prepared.import_options.sheet,'rowCount':prepared.row_count,'columnCount':len(names),'profiledColumns':len(columns),'columns':columns}
    finally:conn.close()
    temp=cached.parent/(cached.name+'.'+str(uuid.uuid4())+'.partial');temp.write_text(json.dumps(profile,indent=2));os.replace(temp,cached)
    return profile

_VIEW_SQL_TYPES={'integer':'BIGINT','decimal':'DECIMAL(38,10)','date':'DATE','timestamp':'TIMESTAMP','boolean':'BOOLEAN'}

def create_typed_view(conn,alias,profile,*,view_name=None,overrides=None):
    """Create a view casting columns whose every present value parsed as one type; others stay VARCHAR.
    Raises instead of creating a view where a cast would turn present values into NULL."""
    view=view_name or f'{alias}_typed';overrides=dict(overrides or {})
    for name in (alias,view):
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*',name):raise ValueError(f'invalid identifier: {name}')
    for sql_type in overrides.values():
        if not re.fullmatch(r'[A-Z]+(\([0-9]+(,[0-9]+)?\))?',str(sql_type)):raise ValueError(f'invalid SQL type override: {sql_type}')
    names=[row[0] for row in conn.execute(f'DESCRIBE {identifier(alias)}.raw').fetchall()]
    unknown=sorted(set(overrides)-set(names))
    if unknown:raise ValueError(f'override columns not in source: {unknown}')
    columns={c['name']:c for c in profile.get('columns',[])};parts=[];cast=[];text=[]
    for name in names:
        info=columns.get(name,{});sql_type=overrides.get(name)
        if sql_type is None:
            sql_type=_VIEW_SQL_TYPES.get(info.get('inferredType'))
            if sql_type and sql_type.startswith('DECIMAL') and info.get('exponentValues'):sql_type='DOUBLE'
        value=f"NULLIF(trim({identifier(name)}),'')"
        if sql_type and sql_type!='VARCHAR':parts.append(f'TRY_CAST({value} AS {sql_type}) AS {identifier(name)}');cast.append(name)
        else:parts.append(identifier(name));text.append(name)
    conn.execute(f'CREATE OR REPLACE VIEW {identifier(view)} AS SELECT '+', '.join(parts)+f' FROM {identifier(alias)}.raw')
    if cast:
        typed=conn.execute('SELECT '+', '.join(f'count({identifier(n)})' for n in cast)+f' FROM {identifier(view)}').fetchone()
        raw=conn.execute('SELECT '+', '.join(f"count(NULLIF(trim({identifier(n)}),''))" for n in cast)+f' FROM {identifier(alias)}.raw').fetchone()
        lost=[name for name,a,b in zip(cast,typed,raw) if a!=b]
        if lost:
            conn.execute(f'DROP VIEW {identifier(view)}')
            raise ValueError(f'casting would turn present values into NULL for columns {lost}; cast them explicitly or override as VARCHAR')
    return {'view':view,'textColumns':text}

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description='Prepare one raw source; output metadata only')
    parser.add_argument('--source',type=Path,required=True);parser.add_argument('--cache',type=Path,required=True);parser.add_argument('--format',choices=['csv','xlsx'],required=True);parser.add_argument('--sheet');parser.add_argument('--header-row',type=int,default=1);parser.add_argument('--delimiter');args=parser.parse_args()
    prepared=prepare_source(args.source,args.cache,ImportOptions(format=args.format,sheet=args.sheet,header_row=args.header_row,delimiter=args.delimiter))
    metadata=asdict(prepared);metadata['database_path']=str(prepared.database_path);print(json.dumps(metadata))
