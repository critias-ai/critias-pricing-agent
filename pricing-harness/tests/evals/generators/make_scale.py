"""Synthetic scale shapes for the findings stress run: M5-like wide counts, Dunnhumby-like long lines.

Usage: python -I make_scale.py <out dir>   (writes <out>/wide/sales_train.csv and <out>/long/transaction_data.csv; make both folders first)
"""
import sys, duckdb
out = sys.argv[1]
db = duckdb.connect()
days = ', '.join(f"cast((hash(i, {d}) % 7) as int) as d_{d}" for d in range(1, 1942))
db.execute(f"copy (select 'ITEM_' || i as id, 'FOODS_' || (i % 3 + 1) as cat_id, 'CA_1' as store_id, 'CA' as state_id, 'D' || (i % 7) as dept_id, 'FOODS' as cat, {days} from range(3049) t(i)) to '{out}/wide/sales_train.csv' (header)")
db.execute(f"copy (select (i % 2500) + 1 as household_key, i // 9 as basket_id, i % 711 + 1 as day, 'P' || (hash(i) % 92000) as product_id, (i % 3) + 1 as quantity, round(((hash(i) % 92000) % 500) / 50.0 + 0.5, 2) as sales_value, 'S' || (i % 582) as store_id, round(-((i % 5) * 0.1), 2) as retail_disc, i % 2400 as trans_time, i % 102 + 1 as week_no from range(2600000) t(i)) to '{out}/long/transaction_data.csv' (header)")
print('ok')
