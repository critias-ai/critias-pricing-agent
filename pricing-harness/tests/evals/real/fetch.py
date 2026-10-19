"""Download the wave 2 real sources into datasets/<source>/raw and check each file's SHA-256.

Usage: python -I fetch.py [source ...]   (default: every source below)
Nothing here is committed data: the files stay in the gitignored cache. Each source is pinned to a fixed URL (a Git
commit for GitHub-hosted files) and a checksum, so a moved or changed file fails loudly instead of changing the evals.

Dunnhumby "The Complete Journey" is not fetched: its download form asks for personal details and its terms forbid
redistribution. Download it by hand from https://www.dunnhumby.com/source-files/ into datasets/dunnhumby/raw.
"""
import hashlib
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3] / 'datasets'
AW = 'https://raw.githubusercontent.com/microsoft/sql-server-samples/e5d7bb90ca0b695ac14f61458047bfb5a498459e/samples/databases/adventure-works/oltp-install-script/'
OL = 'https://raw.githubusercontent.com/olist/work-at-olist-data/d9e49802f3e92d09ee94ab9ccc5e457f207a8959/datasets/'
SHA256 = {
    'Customer.csv': '4704aa5b46aed326599014524c821aca50e938587e6a1133c0f6d9aae5c5efc6',
    'Product.csv': 'df0379a7cba8b11b97ea5d104cf1313ef9f683137b6426f2fac6bb8c74c2a2ea',
    'ProductCategory.csv': 'd86dde135e023960633ed1d6a2fb72f56b74aa2f7d07af983b6bff5e33dfceb2',
    'ProductCostHistory.csv': 'afed7eb09583840258462cfbf003c4705cc4dc7a565dec50919fc1aa68f8160f',
    'ProductListPriceHistory.csv': '3169d0e0dcfab88706da0c5691a8cd7d89d0029e36c6dad10f69d781912edcff',
    'ProductSubcategory.csv': 'a90dce80f310044b99a920790cbf60b83982079af421a5935fda7bc7ab69bc75',
    'SalesOrderDetail.csv': '220129977aa63e34fa4a1d66c2604bd2184373151efb09c98b343371ba77ab8a',
    'SalesOrderHeader.csv': 'cf637c7d58006ebbc13daf0b8ed6cf7f738165d298ae0b5479a59237429c1882',
    'SalesPerson.csv': '92ed21c0e22bf0060a746d53c1f8f0ed68a1ece4b0d5b9c60dbc233d52499206',
    'SalesTerritory.csv': 'cb087c101765605e848635f6127123b1a0814397635ce5faebe52f516ccfc861',
    'SpecialOffer.csv': '728ac866bdd0751a6814249c1afe017aae34203a47b1911974fd12c1f52b22fc',
    'SpecialOfferProduct.csv': '27774a589070aa97e7995ce56f34ba5df0e09d94eef699d07a362eac9aa33e08',
    'Store.csv': '5f9d31ef5c8a4dfa2243c861654d9962a7e151ed0a5f0f7834d55184952b0520',
    'olist_customers_dataset.csv': 'c26c17f59f3027a6a0dbeb8f1fa373c38f3323ecc84f225a8f4820e5bb288df8',
    'olist_order_items_dataset.csv': '4f6abdbbc94036d0df4a76fa0520c072e31a40119d70f7f370fba1e2285d2bcb',
    'olist_order_payments_dataset.csv': '61674868ed7b872aac3dcd95bf774448a88f6426b183f21be55f75af021ffdec',
    'olist_order_reviews_dataset.csv': '012b61c7593e34f51fa614efdf802b9c7056ce6aae5307ddb93236e7cfc797d7',
    'olist_orders_dataset.csv': '8df58ef3d2d7e9944010f7beecd9b75367f5588ec6e3c91cec19ae3345ef9ecf',
    'olist_products_dataset.csv': '3e6569628a17fbc75fd206ee357b59e20364b9afa90f5b6cd5b4d624c58aa9cc',
    'olist_sellers_dataset.csv': '31eb9bd50d684526a78f2389413ce61841e97692de7b828fe7d956b534586312',
    'online_retail_II.zip': '572e36277c2390fbfde10664750731e0a86f55e33470d91919085f0408e67bfb',
    'instawdb.sql': 'd979f036750f9c7b4fb7be3d58cdbb596a74f864a6325998501b3a96c6ad53f9',
    'product_category_name_translation.csv': 'a81f0d1f27b27e7293f761bc79e3ce8f348ee39c4b3ed3e49bde38f478586278',
}
SOURCES = {  # source -> {file name: (url, sha256)}
    'uci': {'online_retail_II.zip': ('https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip', SHA256['online_retail_II.zip'])},
    'adventureworks': {f'{t}.csv': (AW + f'{t}.csv', SHA256[f'{t}.csv']) for t in (
        'Product', 'ProductCategory', 'ProductSubcategory', 'ProductCostHistory', 'ProductListPriceHistory', 'SalesOrderHeader',
        'SalesOrderDetail', 'SpecialOffer', 'SpecialOfferProduct', 'Customer', 'Store', 'SalesTerritory', 'SalesPerson')} | {'instawdb.sql': (AW + 'instawdb.sql', SHA256['instawdb.sql'])},  # the schema: column names for the headerless files
    'olist': {f'{t}.csv': (OL + f'{t}.csv', SHA256[f'{t}.csv']) for t in (
        'olist_customers_dataset', 'olist_order_items_dataset', 'olist_order_payments_dataset', 'olist_order_reviews_dataset',
        'olist_orders_dataset', 'olist_products_dataset', 'olist_sellers_dataset', 'product_category_name_translation')},
}


def fetch(source):
    raw = ROOT / source / 'raw'
    raw.mkdir(parents=True, exist_ok=True)
    for name, (url, want) in SOURCES[source].items():
        path = raw / name
        if not path.exists():
            urllib.request.urlretrieve(url, path)
        got = hashlib.sha256(path.read_bytes()).hexdigest()
        if want and got != want:
            sys.exit(f'{source}/{name}: checksum {got} is not the pinned {want}; delete the file to download again')
        print(f'{"ok " if want else "NEW"} {source}/{name} {got}')


for s in sys.argv[1:] or SOURCES:
    fetch(s)
