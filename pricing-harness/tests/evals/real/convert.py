"""Turn the fetched raw files into clean packs: datasets/<source>/clean/files/data/*.csv, values unchanged.

Usage: python -I convert.py [source ...]   (run fetch.py first)
- uci: each workbook sheet becomes one CSV, and the workbook itself is copied to xlsx/ to test the XLSX path.
- adventureworks: the headerless install files get their column names from instawdb.sql (tab, or +| with &| row ends);
  the raw files are also copied as shipped to raw-pack/, to test how the script handles them.
- olist: copied as shipped.
"""
import csv
import re
import shutil
import sys
import zipfile
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[3] / 'datasets'
AW_COLUMNS = {  # from instawdb.sql at the pinned commit; every file's field count matches
    'Product': 'ProductID Name ProductNumber MakeFlag FinishedGoodsFlag Color SafetyStockLevel ReorderPoint StandardCost ListPrice Size SizeUnitMeasureCode WeightUnitMeasureCode Weight DaysToManufacture ProductLine Class Style ProductSubcategoryID ProductModelID SellStartDate SellEndDate DiscontinuedDate rowguid ModifiedDate',
    'ProductCategory': 'ProductCategoryID Name rowguid ModifiedDate',
    'ProductSubcategory': 'ProductSubcategoryID ProductCategoryID Name rowguid ModifiedDate',
    'ProductCostHistory': 'ProductID StartDate EndDate StandardCost ModifiedDate',
    'ProductListPriceHistory': 'ProductID StartDate EndDate ListPrice ModifiedDate',
    'SalesOrderHeader': 'SalesOrderID RevisionNumber OrderDate DueDate ShipDate Status OnlineOrderFlag SalesOrderNumber PurchaseOrderNumber AccountNumber CustomerID SalesPersonID TerritoryID BillToAddressID ShipToAddressID ShipMethodID CreditCardID CreditCardApprovalCode CurrencyRateID SubTotal TaxAmt Freight TotalDue Comment rowguid ModifiedDate',
    'SalesOrderDetail': 'SalesOrderID SalesOrderDetailID CarrierTrackingNumber OrderQty ProductID SpecialOfferID UnitPrice UnitPriceDiscount LineTotal rowguid ModifiedDate',
    'SpecialOffer': 'SpecialOfferID Description DiscountPct Type Category StartDate EndDate MinQty MaxQty rowguid ModifiedDate',
    'SpecialOfferProduct': 'SpecialOfferID ProductID rowguid ModifiedDate',
    'Customer': 'CustomerID PersonID StoreID TerritoryID AccountNumber rowguid ModifiedDate',
    'Store': 'BusinessEntityID Name SalesPersonID Demographics rowguid ModifiedDate',
    'SalesTerritory': 'TerritoryID Name CountryRegionCode Group SalesYTD SalesLastYear CostYTD CostLastYear rowguid ModifiedDate',
    'SalesPerson': 'BusinessEntityID TerritoryID SalesQuota Bonus CommissionPct SalesYTD SalesLastYear rowguid ModifiedDate',
}


def cell(v):  # how a spreadsheet export would write the value
    if v is None:
        return ''
    if hasattr(v, 'strftime'):
        return v.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def write(path, header, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def uci(src, out):
    with zipfile.ZipFile(src / 'raw/online_retail_II.zip') as z:
        z.extract('online_retail_II.xlsx', src / 'raw')
    book = src / 'raw/online_retail_II.xlsx'
    (src / 'xlsx/files/data').mkdir(parents=True, exist_ok=True)
    shutil.copy(book, src / 'xlsx/files/data/online_retail_II.xlsx')
    wb = load_workbook(book, read_only=True)
    for sheet in wb.sheetnames:  # "Year 2009-2010" -> online_retail_2009_2010.csv
        rows = wb[sheet].iter_rows(values_only=True)
        header = next(rows)
        write(out / f"online_retail_{re.sub(r'[^0-9]+', '_', sheet).strip('_')}.csv", header, ([cell(v) for v in r] for r in rows))


def adventureworks(src, out):
    pack = src / 'raw-pack/files/data'
    pack.mkdir(parents=True, exist_ok=True)
    for table, names in AW_COLUMNS.items():
        text = (src / 'raw' / f'{table}.csv').read_text(encoding='utf-8-sig')
        shutil.copy(src / 'raw' / f'{table}.csv', pack / f'{table}.csv')
        sep, end = ('+|', '&|\n') if '+|' in text else ('\t', '\n')
        rows = [r.split(sep) for r in text.split(end) if r.strip()]
        assert all(len(r) == len(names.split()) for r in rows), table
        write(out / f'{table}.csv', names.split(), rows)


def olist(src, out):
    out.mkdir(parents=True, exist_ok=True)
    for f in sorted((src / 'raw').glob('*.csv')):
        shutil.copy(f, out / f.name)


for source in sys.argv[1:] or ('uci', 'adventureworks', 'olist'):
    src = ROOT / source
    shutil.rmtree(src / 'clean', ignore_errors=True)
    globals()[source](src, src / 'clean/files/data')
    print(source, sorted(p.name for p in (src / 'clean/files/data').iterdir()))
