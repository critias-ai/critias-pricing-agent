# Data findings stress test: wave 2 real data (UCI, AdventureWorks, Olist)

Date: 2026-10-17. Script: `bundled/harness-tools/data_findings.py` VERSION 8, unchanged. No model calls. Dunnhumby skipped
for now (its download form asks for personal details).

- **Data:** `tests/evals/real/fetch.py` downloads each source, pinned by URL (a Git commit for GitHub files) and SHA-256,
  into the gitignored `.cache/eval-data/`. `convert.py` makes the clean packs with values unchanged. `build_traps.py`
  writes the answer keys and the trapped copies.
- **Two kinds of fault are scored:**
  - **Real faults already in the data** (`natural.csv`). Each was found by a plain rule in `build_traps.py` and its count
    checked by a separate DuckDB query. Each is tagged by whether a detector claims that kind of fault (`detector`), no
    detector exists for it (`none`), or it needs a business rule (`rule`).
  - **Planted faults** in a trapped copy (`plants.csv`, plus `file-plants.csv` for faults with no rows to point at).
- **Scoring:** a fault counts as caught only when **the detector meant for it** flags at least 90% of its rows. Planted
  whole-column faults (`R$` text, decimal commas, day-first dates) flag every row of their table, which would otherwise
  hide misses in the same table.
- Neither the script nor the data was changed to make them fit. One plant was moved because of a fault in my test, not
  the script: the unreadable UTF-16 sellers file hid an "unknown seller" plant, so that plant now uses an unknown product.

## Result

| Pack           | Rows                | Wall, clean | Peak memory | Findings clean / trapped | Planted caught | Real faults caught (in scope) |
| -------------- | ------------------- | ----------: | ----------: | -----------------------: | -------------: | ----------------------------: |
| UCI            | 1,067,371 in 2 CSVs |       5.7 s |      1.2 GB |                  47 / 47 |     **4 of 7** |                    **3 of 4** |
| AdventureWorks | 175,219 in 13 CSVs  |       7.4 s |      1.4 GB |                  25 / 40 |     **9 of 9** |                 none in scope |
| Olist          | 550,759 in 8 CSVs   |       7.8 s |      0.4 GB |                  42 / 47 |     **7 of 8** |                    **3 of 4** |

**Caught, planted:** repeated lines and a day loaded twice; ×100 prices (some labelled `outlier`, not `x1e2`); ×12
each-vs-case lines; negative prices; unknown product IDs; a whole order re-keyed; ship dates before order dates;
future dates; delivered before purchase; a category case variant; a whole column of `R$ 13,29`, of decimal commas and of
day-first dates; a UTF-16 file (skipped, with "not UTF-8; convert it to UTF-8 first").

**Caught, real:** UCI's 12,133 exact repeated rows, 3,199 of 3,366 lower-case stock codes (`85123a` beside `85123A`)
and its `TEST001`/`TEST002` lines; Olist's 166 orders handed to the carrier before they were bought, 23 delivered
before the carrier had them, and 1,603 reviews sharing an ID with a different review. It also found 1,359 Olist orders
approved after the carrier had them, which I hadn't listed.

## Faults that are in the data and the script misses

### Inside what the script claims to do

1. **A UTF-8 file with a byte-order mark isn't read (Olist).** `product_category_name_translation.csv` starts with a
   BOM and has CRLF line ends. It's skipped with "ValueError: parsed headers differ from inspected headers", which
   doesn't say what's wrong. Because it's skipped, the domain check never runs, so the **13 products whose category
   has no translation** (`pc_gamer`, `portateis_cozinha_e_preparadores_de_alimentos`) are missed.
2. **Common non-product codes in UCI aren't flagged: 5,317 of 6,094 rows.** `POST` (2,120 rows), `DOT` (1,445), `M`
   (1,421), `D` (177), `S` (103), `PADS`, `CRUK` and `B` (bad-debt adjustments with prices down to −£53,594). The
   rare-shape check only flags a shape under 0.1% of rows, or one off a shape held by 95%. Here product codes are split
   between `99999` and `99999A`, so no shape reaches 95%, and postage, manual and discount lines are too frequent to be
   rare. Rarer ones (`AMAZONFEE`, `BANK CHARGES`, `C2`, `gift_…`) are flagged.
3. **Headerless files are read silently with a data row as the header (AdventureWorks as shipped).** The install files
   have no header row. 11 of 13 are skipped with "missing column header" or "duplicate column headers", which doesn't
   say the file has no header. `ProductCategory.csv` and `SpecialOfferProduct.csv` are **read with their first data row
   as column names** (value columns `680` and `1`). `Store.csv`, with `+|` between fields, gets "missing column header",
   not the script's own "multi-character delimiter" message.
4. **A peer check needs three rows per product.** 2 of Olist's 15 ×100 prices are on products sold only once or twice,
   so there is no median to compare with. That's a limit of the method, but it's never reported.

### No detector exists for these

| Fault                                                                  | Where          |    Rows |
| ---------------------------------------------------------------------- | -------------- | ------: |
| The workbook's two sheets overlap: 1–9 December 2010 is in both        | UCI            |  22,523 |
| A month with no rows (2011-03 planted; 2016-11 empty in the real data) | UCI, Olist     |   month |
| A stock code renamed mid-year (`22423` → `22423R`, same description)   | UCI (planted)  |     931 |
| Missing customer ID                                                    | UCI            | 243,007 |
| Placeholder value `Unspecified` in country                             | UCI            |     756 |
| Missing product category                                               | Olist          |     610 |
| Text that isn't a city in `seller_city` (`4482255`, an email address)  | Olist          |      18 |
| Products sold after their sell-end date (a join through two tables)    | AdventureWorks |      64 |
| Fixed-width padding: `ProductLine` `M `, `Class` `L `                  | AdventureWorks |     308 |
| A ×1.17 currency slip on one customer (stretch item, as planned)       | UCI (planted)  |      25 |

### Needs a business rule (outside the script's design)

- UCI: 3,457 negative-quantity lines that aren't cancellations (stock write-offs such as "damaged", priced at zero).
- AdventureWorks: 2,151 lines whose discount differs from their special offer's (2,118 are "Volume Discount 11 to 14"
  at 0% on orders outside 11 to 14 units).
- Olist: 8 orders marked delivered with no delivery date; 6 cancelled orders with a delivery date.

## Noise on the clean copies

- **Timestamps treated as keys (Olist):** `order_purchase_timestamp`, `order_delivered_customer_date` and
  `review_answer_timestamp` are over 99% distinct, so repeats are flagged "duplicate-key conflicting" (1,122, 1,616
  and 1,921 rows).
- **Numbers that aren't measures:** zip-code prefixes against the state median (1,716 rows), `order_item_id` against the
  product median, and order quantity against the order median.
- **AdventureWorks line totals against the product median** (2,211 rows): a line total grows with quantity, so it has no
  per-product peer value.
- **Status labels as code shapes (Olist):** `canceled`, `shipped`, `unavailable` and `processing` flagged as rare shapes
  (2,963 rows). The same applies to UCI's `C` cancellation invoices, which are flagged as **parse failures**
  ("mixed-text", 19,500 rows), because `Invoice` is 98% digits.
- **Repeated documents that are lists:** `StoreID` in customers, `ProductID` in the cost and list-price histories,
  `SalesPersonID` in stores.

## Workbook path (UCI as shipped)

The same workbook passed as `.xlsx` gives the same 47 findings by detector on both sheets as the CSV copies, but takes
**237 s instead of 5.7 s** (peak memory the same, 1.2 GB). Reading the workbook is the cost; the detectors aren't.

## Run

```bash
.venv/bin/python -I tests/evals/real/fetch.py
.venv/bin/python -I tests/evals/real/convert.py
.venv/bin/python -I tests/evals/real/build_traps.py
.venv/bin/python -I tests/evals/findings/findings_stress.py olist .cache/eval-data/olist/clean --seeded .cache/eval-data/olist/trapped --key .cache/eval-data/olist/plants.csv --out .cache/findings-stress/wave2
```

Raw output is in `.cache/findings-stress/wave2/`.
