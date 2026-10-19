# Data findings stress test: baseline before the D0-2 rewrite

Date: 2026-10-16. Script: `bundled/harness-tools/data_findings.py` (VERSION 6), on commit 9b2d703.

There were no model calls. Raw outputs are in `.cache/findings-stress/`.

## How it was run

- `tests/evals/findings_stress.py <name> <clean> [--seeded DIR --key CSV]`:
  - one pack per process, with a cold cache;
  - it reports findings by detector, the value column, whether the peer-ratio check (D7) ran, and whether a domain check (D3) was possible;
  - it also reports wall time and peak memory;
  - recall per plant comes from `score_findings.py`.
- `tests/python/test_findings_generalise.py` holds one test per risk in plan section 3k.
  - Each test states the *target* behaviour.
  - All 14 fail today, and each is marked `xfail(strict=True)`, so a fix turns it red until its marker is removed.
  - The full Python suite: 60 passed, 14 xfailed.

## Results

| Pack | Shape | Wall | Peak memory | Findings | Notes |
|---|---|---:|---:|---:|---|
| Northbridge clean | 15 CSVs, about 324 MB | 27 s | 2.3 GB | 93 | The same as Task 11 |
| Northbridge seeded | 15 CSVs, 37 plants | 27 s | (same run) | 133 | **30/37 caught, 0 unexplained**: the same as Task 11 |
| Retail eval set | 1 CSV, 1,175 rows | 0.1 s | 75 MB | 0 | Single file: D7 and D3 can't run |
| Scale, long (Dunnhumby-like) | 1 CSV, 2.6M rows × 10 | 12 s | 2.2 GB | 2 (shape) | Single file: D7 didn't run |
| Scale, wide (M5-like) | 1 CSV, 3,049 × 1,947 | 13 s | 2.8 GB | 0 | No value column, because every count is an integer. Effectively nothing was checked. |

Speed is fine at these sizes. Memory is the constraint: the wide file uses 2.8 GB of the 4 GB DuckDB limit.

### Northbridge plants missed (7)

| Plant | Why it's missed |
|---|---|
| `value_not_quantity_times_price` (0/30) | No identity check (D5 not built). |
| `cost_dates_reversed` (0/5), `cost_interval_overlap` (0/1), `date_future_year` (0/5) | No time check (D6 not built). |
| `silent_currency` ×1.17 (0/25) | Invisible to any ratio threshold. This is known: open-items. |
| `quantity_extra_zeros` (0/5) | Quantity ×100, with the value also ×100. Unit price is unchanged, and quantity has no peer key that fits well. |
| `price_decimal_shift` (11/15) | 4 of the ×0.1 rows sit on products whose median is not stable enough. |

### Gaps found by the targeted tests (14, all confirmed)

| Area | Gap | Source that hits it |
|---|---|---|
| Read | XLSX is not read at all: it crashes with "Could not determine delimiter" when passed. | UCI |
| Read | A non-UTF-8 file crashes the **whole run** (UnicodeDecodeError), so every other source loses its findings too. | AdventureWorks |
| Read | A multi-character delimiter (`+\|`) crashes the run. | AdventureWorks |
| D1 | A column wholly in currency text (`$1,234.00`) gives no finding. | Airbnb |
| D1 | A column wholly in `R$` gives no finding, and `R$` isn't in the currency list. | Olist |
| D1 | A column wholly in decimal commas gives no finding. | European exports |
| D1 | A column wholly of DD/MM dates gives no finding. | UK and EU exports |
| D1 | Ambiguous slash dates (day never above 12) are not reported. | Any |
| D3 | Keys are matched by column name only, so `sku` against `product_id` gets no check. | Cost overlays, AdventureWorks |
| D4 | Repeated documents need an `id`/`no`/`number` column name, so UCI's `Invoice` is missed. | UCI |
| D7 | No peer-ratio check inside a single file. | UCI, Airbnb, M5, retail |
| D7 | ×24 (a case of 24) is not labelled, and its rows are dropped as "outlier". | Iowa, S2 |
| Value | One value column per source is guessed, so other money columns (freight) are invisible. | Olist, AdventureWorks |
| Coverage | There is no record of what was skipped or not built. Silence looks the same as clean. | All |

The Northbridge value-column picks also look off in places:
- `customer_agreements`: `free_freight_threshold_gbp`;
- `approval_log`: `requested_value`.

## Proposed rewrite order

Each step comes with its red tests turned green, and the stress runs re-checked.

1. **Coverage and isolation.** Each source is prepared on its own. A source that can't be read becomes a `skipped: reason` coverage line, never a crash. Every detector reports ran, skipped or not built per source. This is the "no silent skip" rule, and it makes everything after it measurable.
2. **Reading.** Add XLSX (every sheet) through `prepare_source`'s existing XLSX path. The TypeScript adapter (`data-findings.ts`, today "CSV only") passes XLSX through.
3. **D1 whole-column formats:** currency text (including `R$`), decimal commas, day-first and ambiguous dates.
4. **D7:** single-file peers, grouping by the file's own code-like columns; a ×24 label.
5. **D3 by value overlap, and D4 repeated documents by structure.**
6. **Value columns:** every money-like column with its own value at stake, and integer measures allowed.
7. **D5 identity** (`qty × price` against line value, where all three exist) **and D6 time** (future dates, reversed or overlapping validity intervals). These would catch 4 to 5 of the 7 missed Northbridge plants.
8. **Memory on wide files:** reshape, or batch columns, to stay well under 4 GB.

**Budget:** the earlier findings work ran under a 300-line production diff budget. Steps 1 to 8 will likely go over that. This needs your call: raise the budget for D0-2, or split it into two releases (steps 1 to 4, then 5 to 8).

## After the rewrite (VERSION 7, same day)

Built in one release, as you decided, with ponytail ultra. The production diff is +163 / −58 lines: `data_findings.py` grew from 191 to 283 lines, plus the adapter and the prompt.

| Pack | Wall | Peak memory | Findings | Recall |
|---|---:|---:|---:|---|
| Northbridge clean | 35 s (was 27) | 2.1 GB (was 2.3) | 105 (was 93) | — |
| Northbridge seeded | 47 s | (same run) | 148 (was 133) | **33/37** (was 30), **0 unexplained** |
| Retail | 0.1 s | 82 MB | 1 (the 22 return lines) | — |
| Scale, long (2.6M rows) | 15 s | 2.4 GB | 2 | — |
| Scale, wide (1,947 columns) | 10 s | 2.6 GB | 0 | — |

Every VERSION 6 finding on the clean Northbridge pack is still there.

**The 12 new clean findings, reviewed.** All are facts, and none are false alarms:
- pack-of-24 price lines (`x24`, 4 findings, 84 rows) that VERSION 6 dropped as "outlier";
- `x12`/`x1e1` description-count ratios in `product_master` by supplier (4 findings);
- quotes whose `valid_to` is after the promised ship or delivery date (2), and one approval requested after its `valid_from`;
- one credit line whose value isn't quantity × unit price.

**Newly caught plants:**
- `value_not_quantity_times_price` (D5);
- `cost_dates_reversed` and `date_future_year` (D6).

**Still missed:**
- `silent_currency` (×1.17): invisible to any ratio;
- `quantity_extra_zeros`: quantity and value both ×100, so unit price is unchanged;
- `cost_interval_overlap`: not checked on purpose, see below;
- 4 of 15 `price_decimal_shift` rows.

**All 14 gaps from the targeted tests are closed.** The markers are removed: `test_findings_generalise.py` is now 16 ordinary tests, including one for D5 and one for D6.

**Noise found and fixed during the rewrite:**
- D5 first flagged 247 clean "identities" on a mostly-zero adjustment column, since 0 = 0 × anything. It is now judged on informative rows only (value not 0, neither factor 0 or ±1), and still flags every row that breaks a holding identity.
- D6 flagged `last > first` on invoices where the two are usually equal. It is now judged only on rows where the two dates differ.
- D7 broke ties between keys alphabetically. It now prefers another source's key, then fewer, larger groups.
- D4 briefly lost a repeated-invoice finding, because IDs are mostly numbers with a few `C…` values. A column now counts as an ID when at least 95% of its values are whole numbers.

**Shortcuts left in the code (each has a comment):**
- **Overlapping validity intervals:** not checked. That needs to know which column the intervals belong to, which is a business assumption.
- **Value matching for D3:** only code-like text columns. Numeric IDs under different names still need a shared name.
- **D5 on very wide sources:** skipped above 3,000 column triples, and the coverage report says so.
- **Integer value column:** a whole-number column stands in only when a source has no decimal column, and it may pick an ID column.
- **Memory:** step 8 was skipped. The wide file peaks at 2.6 GB, under the 4 GB limit.
- **"After today":** depends on the run date, but the findings cache is keyed by content. A cached result can go stale once its date passes.
