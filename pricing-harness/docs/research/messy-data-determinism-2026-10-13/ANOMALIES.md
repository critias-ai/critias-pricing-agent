# Data anomalies: catalogue, framework and seeded test pack

Date: 2026-10-13. Status updated 2026-10-14: D1–D4 and D7 are implemented on `feat/data-findings`; D5, D6 and D8 remain deferred. Task 13 awaits explicit user approval; no paid/live steps have run. Section 2 retains historical design proposals; see §5 for the shipped behavior and evidence. This research note stays uncommitted.

Constraints from the user:
- Catalogue the anomalies before building anything into the workflow.
- Test on a pack with many seeded, buried wrong values.
- Keep the workflow and the code as simple as possible: the most compact implementation, far under 5k LOC.
- Any code for this feature must pass `/anthropic-skills:ponytail` at the ultra level.
- Code never makes business assumptions (see the policy split below).

## 1. Catalogue

60 anomalies in 10 families. Each is caught by one of eight generic detectors (D1–D8, §2). "Seeded" names the plant in the test pack (§3). "Natural" means it already occurs in the clean Northbridge pack.

### A. Cell format (the value is right but written differently)

| # | Anomaly | Example | Detector | Seeded / natural |
|---|---|---|---|---|
| A1 | Decimal comma | `0,85` | D1 | `price_decimal_comma` |
| A2 | Currency symbol in a number | `£14.94` | D1 | `price_currency_symbol` |
| A3 | Thousands separator | `1,296` | D1 | `value_thousands_separator` |
| A4 | Parenthesised negative | `(4.95)` | D1 | `value_parenthesised_negative` |
| A5 | Unit text in a number | `1 pcs` | D1 | `quantity_with_unit_text` |
| A6 | Scientific notation | `1.2E+04` | D1 | — |
| A7 | Month-first date among day-first or ISO dates | `12/01/2009 12:30` | D1 | `date_month_first` |
| A8 | Spreadsheet serial date | `40367.83333` | D1 | `date_excel_serial` |
| A9 | Timezone or DST shift | an hour's sales moved across midnight | D6 | — |
| A10 | ID turned into a float | `13527.0` | D2 | `customer_id_as_float` |
| A11 | Leading zeros lost | `85123A` vs `085123A` | D2 | — |
| A12 | Case variant | `85123a` | D2 | `product_id_lowercase` |
| A13 | Trailing or leading space | `22423␠` | D2 | `product_id_trailing_space` |
| A14 | Invisible character (zero-width, NBSP) | `84879​` | D2 | `product_id_zero_width_char` |
| A15 | Mojibake or encoding damage | `CAFÃ‰` | D2 | — |
| A16 | Spelling variants of a label | `United Kingdom`, `UK`, `U.K.` | D8 | natural (country) |

### B. Wrong value in the cell

| # | Anomaly | Example | Detector | Seeded / natural |
|---|---|---|---|---|
| B1 | Value from another column | customer name in `customer_id` | D3 | `customer_name_in_id` |
| B2 | Valid-looking ID of the wrong entity | a product ID in `customer_id` | D3 | `customer_id_is_product_id` |
| B3 | Placeholder or sentinel | `N/A`, `0`, `-1`, `9999`, `1900-01-01`, `9999-12-31` | D1, D8 | `customer_placeholder`; natural (`9999-12-31` cost end) |
| B4 | Missing value | blank `customer_id` | D1 | natural (243k rows) |
| B5 | Truncated text | a name cut at 30 characters | D2 | — |
| B6 | Test or dummy record | `TEST` customer and product | D8 | `test_record`; natural (`TEST_ITEM` category) |

### C. Unit and scale

| # | Anomaly | Example | Detector | Seeded / natural |
|---|---|---|---|---|
| C1 | Pence entered as pounds (×100) | 85123A at £255 instead of £2.55 | D7 | `price_in_pence` |
| C2 | Decimal shift (×10 or ÷10) | £0.895 instead of £8.95 | D7 | `price_decimal_shift`, `cost_decimal_shift` |
| C3 | Packs where each is expected (×12) | 1 at £5.04 instead of 12 at £0.42 | D7 | `quantity_in_packs`; natural (`pack_uom` cost) |
| C4 | Silent currency (EUR values labelled GBP) | price ×1.17 | D7 | `silent_currency`; natural (labelled EUR cost) |
| C5 | Extra digits in a quantity | 200 instead of 2 | D7 | `quantity_extra_zeros` |
| C6 | Cost in the wrong unit | cost ×100 | D7 | `cost_in_pence` |
| C7 | Quantity and price swapped | qty 3.39, price 4 | D1, D7 | `quantity_price_swapped` |

### D. Sign and arithmetic

| # | Anomaly | Example | Detector | Seeded / natural |
|---|---|---|---|---|
| D1 | Sign flipped on a sale | negative price on a normal invoice | D5, D7 | `sign_flipped_sale` |
| D2 | Mixed sign conventions | credits held as negative quantity in one table, positive in another | D5 | natural |
| D3 | Line value ≠ quantity × price | value off by £10 | D5 | `value_not_quantity_times_price` |
| D4 | Header total ≠ sum of lines | — | D5 | — |
| D5 | Rounding drift | totals differ in the pennies | D5 | natural |

### E. Duplication

| # | Anomaly | Example | Detector | Seeded / natural |
|---|---|---|---|---|
| E1 | Exact duplicate rows | the same line twice | D4 | natural (`repeat_rank`) |
| E2 | Period loaded twice | all of 2010-06-30 repeated | D4 | `day_loaded_twice` |
| E3 | Re-keyed duplicate | invoice copied under a new invoice and line ID | D4 | `invoice_rekeyed_duplicate` |
| E4 | Duplicate master key, conflicting payload | 47566 with two categories, which doubles its sales on join | D4 | `product_duplicate_key`, `customer_duplicate_key` |
| E5 | Same event in two tables | a credit in both sales and the credits view | D5 | natural |

### F. References and joins

| # | Anomaly | Example | Detector | Seeded / natural |
|---|---|---|---|---|
| F1 | Orphan foreign key | product not in the master | D3 | `product_id_unknown`; natural |
| F2 | Join fan-out | duplicate master key or overlapping cost | D4, D6 | via E4 and G3 |
| F3 | Join silently fails on format | `22423␠` ≠ `22423` | D2, D3 | via A12–A14 |
| F4 | Grain mismatch | rebates at `product_id=ALL` | D3 | natural |
| F5 | Denormalised field disagrees with the master | line country ≠ customer country | D5 | natural |

### G. Time

| # | Anomaly | Example | Detector | Seeded / natural |
|---|---|---|---|---|
| G1 | Date outside the data's range | 2031 | D6 | `date_future_year` |
| G2 | Impossible date | 2010-02-30 | D1 | `date_impossible` |
| G3 | Overlapping validity intervals | two costs for 22086 in 2011 H1 | D6 | `cost_interval_overlap`; natural (1 row) |
| G4 | Reversed interval | `valid_from` > `valid_to` | D6 | `cost_dates_reversed` |
| G5 | Gap in validity | no cost for part of the period | D6 | natural (`no_cost`) |
| G6 | Partial or missing period | last month only part-covered | D6 | natural (2011-12) |
| G7 | Backdated or late-arriving rows | a booking months after its date | D6 | — |
| G8 | Event before the entity existed | sale before the product's first date | D6 | — |

### H. Totals and controls

| # | Anomaly | Example | Detector | Seeded / natural |
|---|---|---|---|---|
| H1 | Detail doesn't tie to the finance control | sales vs `finance_monthly` | D5 | natural, worsened by E2 |
| H2 | Summary row inside the data | `TOTAL` row | D8, D7 | `total_row` |

### I. Meaning (code can only surface these, never decide them)

| # | Anomaly | Example | Detector | Seeded / natural |
|---|---|---|---|---|
| I1 | Non-merchandise in the item column | POST, BANK CHARGES, ADJUST, gift vouchers | D2, D8 | natural |
| I2 | Status implies exclusion | PROPOSED cost, DRAFT price | D8 | natural |
| I3 | Zero-price or free lines | price 0 | D7, D8 | natural |
| I4 | Cancelled but not reversed | order cancelled, credit missing | D5 | — |
| I5 | Internal or intercompany customer | — | D8 | — |
| I6 | Extreme but real value | qty 80,995 then credited | D7 | natural |

### J. File structure

| # | Anomaly | Example | Detector | Seeded / natural |
|---|---|---|---|---|
| J1 | Header row repeated mid-file | a row of column names | D1, D8 | `header_row_repeated` |
| J2 | Shifted columns | a split description pushes every later field right | D1 | `columns_shifted` |
| J3 | Embedded newline in a quoted field | — | load | — |
| J4 | BOM, delimiter or encoding change | — | load | — |
| J5 | Column renamed or reordered between extracts | — | load | — |

J3–J5 break loading, not values. DuckDB's sniffer handles or rejects them, so they need no detector.

## 2. Framework

### The split

- **Code**: detects, counts, attaches value at stake and evidence, and offers lossless candidate fixes. It never changes a number by itself.
- **The user**: picks a treatment per finding.
- **Each question**: is answered only when the answer is the same under every untreated finding's options.

### Eight detectors

All the detectors are generic SQL over the raw tables. They are driven by a column profile, with no pack-specific knowledge.

| | Detector | Flags | Covers |
|---|---|---|---|
| D1 | **Parse** | rows that fail the column's dominant type, or parse only under an alternate format (decimal comma, symbol, separator, parentheses, month-first, serial date) | A1–A8, B3, B4, C7, G2, J1, J2 |
| D2 | **Shape** | code-like columns (few shapes, no spaces): rare shapes, and values whose trimmed, case-folded, invisible-stripped form matches a common value | A10–A15, B5, F3, I1 |
| D3 | **Domain** | key-like values missing from their reference set, and which other column's domain (name, other entity's key) they do match | B1, B2, F1, F4 |
| D4 | **Uniqueness** | duplicate keys (with or without conflicting payload), exact repeats, and repeated blocks (same content under new keys, a whole day twice) | E1–E4, F2 |
| D5 | **Identities** | violators of relations that hold on ≥ 99.9% of rows. Relations are discovered, not declared: value = qty × price, header = Σ lines, detail = control total, same event in two tables | D1–D5, E5, F5, H1, I4 |
| D6 | **Time** | reversed, overlapping or gapped intervals; dates outside the dense range; partial periods; events before first-seen | A9, G1, G3–G8 |
| D7 | **Peer ratio** | value ÷ the entity's own median (price per product, cost per product), flagged at ratios near 10ᵏ, 12, known FX rates, or a robust outlier threshold | C1–C7, D1, H2, I3, I6 |
| D8 | **Labels** | the value list of every low-cardinality text column, plus key values that look like non-items (`TOTAL`, `TEST`, `N/A`). These are listed only, for the user to classify | A16, B3, B6, H2, I1, I2, I5 |

### One findings table

Each finding has these fields:
- `id`
- `detector`
- `table`
- `column`
- `predicate`: a SQL WHERE over the raw table
- `rows`
- `value_at_stake`
- three examples
- `confidence`: exact or heuristic
- `candidate_fix`: a lossless SQL rewrite, if there is one, such as trim or lower-and-match, parse `0,85`, or `/100`

A finding's **signature** is its detector, table, column and pattern. New rows with the same issue inherit the decision; a new signature is a new pending finding.

### Four treatments, chosen by the user

The user picks one treatment per signature, stored in `.pricing/policies.json`:
- `keep`
- `exclude`
- `fix` (apply the candidate fix)
- `hold` (stop answers that depend on it)

### Workflow (three steps)

1. **When data changes, code runs the detectors.** They write `findings.json` in seconds. No model is involved.
2. **The agent gets a short findings summary**, the top findings by value at stake, plus the stored treatments.
3. **For each answer, code checks materiality.** It takes the answer's margin (the gap between the winner and the runner-up, or a threshold) and the value at stake each pending finding puts on the competing groups.
   - **If no pending finding can move the conclusion**, answer and list the findings.
   - **Otherwise**, ask the user once about the findings that matter and store their choice.

   This is the certification bound from experiment 2, except that each finding's own rows set the bound, not an assumed cost range.

### Size budget

Rough estimate: the detectors are about 8 × 20–30 lines of SQL in Python, and findings, signatures, treatments and the materiality check about 60 lines. That is under 300 lines in all. It adds three things to the harness: one controller hook, one prompt field and one policy file.

## 3. Seeded test pack

- Generator: `prototype/seed_anomalies.py`, 95 lines, checked with ponytail ultra. It takes about 2 s, gives the same output on every run, and fails if a plant matches no rows.
- Usage: `python -I seed_anomalies.py <clean files dir> <out files dir> <answer key csv>`.
- Built from `workspace/northbridge-test/files` into `workspace/northbridge-seeded/files`, which is git-ignored. Only `files/` is copied. The harness adopts the files on first open, and `.pricing/context.md` can be copied over for the two confirmations.
- Answer key: `.cache/seeded-pack/answer_key.csv`, kept outside the workspace so the agent can't read it. Columns: plant, table, row number in the output file, first column.
- Plants are deterministic, spread through the file in original order, and use the pack's own value formats.

Integrity check: every difference from the clean pack is a planted row.

| Table | Rows edited | Rows added |
|---|---|---|
| `sales_transactions` (1,067,371 rows) | 534 | 1,987 |
| `product_cost_history` | 16 | 1 |
| `product_master` | 0 | 1 |
| `customer_master` | 0 | 5 |

That is 37 plant types and 2,544 planted rows. They are 0.2% of sales rows, and their value at stake is concentrated in a few traps.

### Traps on the benchmark question

The question is "what sku had the highest absolute gross margin". The truth is unchanged from the clean pack: 22423, £139,548.15, because every plant is wrong data. A naive analysis joins the master and as-of cost directly, and silently drops rows that fail to parse. On the two packs it gives:

| Rank | Clean pack | Seeded pack, naive |
|---|---|---|
| 1 | 22423, £139,548 | **47566, £165,596**: `product_duplicate_key` doubles every line on join |
| 2 | 85123A, £94,148 | **85123A, £158,138**: `price_in_pence`, 6 lines out of 5,805 |
| 3 | 85099B, £85,527 | 22423, £139,328: 30 lines lost to `product_id_trailing_space`, plus 3 re-keyed invoices |
| 4 | 47566, £82,723 | 22086, £111,539: `quantity_extra_zeros` and `cost_interval_overlap` |
| 5 | 22086, £64,801 | 85099B, £108,432: `cost_decimal_shift` |

So either of two traps alone gives a wrong top answer, and three more distort the figures in the top five. The rest are buried noise that a careful analysis should flag without being derailed by.

### Scoring a run

- **Detection.** A plant counts as caught when one finding's predicate covers at least 90% of its key rows. Run the same detectors on the clean pack too: any finding that appears on both packs is natural, and new findings that match no plant are false alarms.
- **Answer.** Possible outcomes:
  - correct: 22423, £139,548.15, or a figure that differs only by findings the agent names
  - correctly held or asked, citing a material finding
  - wrong

  Also record wall time and cost, as in the earlier experiments.

## 4. Not covered yet

- **J3–J5 break the loader.** They are a separate test of the load step, not of detection.
- **A9, A11, A15, B5, G7 and G8 are catalogued but not seeded.** The generator takes one more line per plant if wanted.
- **Detector false-alarm rates on free-text columns are unknown until D1–D8 exist.** Country names already show shape alone is noisy there, so D2 must run only on code-like columns.

## 5. Implementation verification — 2026-10-14

D1–D4 and D7 are implemented at final code HEAD `1f8054e`, cache VERSION **5**. The framework above is historical/aspirational: its eight-detector scope, `.pricing/policies.json` and universal treatment-certification language exceed the shipped subset. Implementation uses the existing `definition` → ask-user → `confirmedDefinitions` path and callback sensitivity sweeps. D5, D6 and D8 are deferred; sweep is not exhaustive certification. The [execution record](DATA-FINDINGS-EXECUTION.md) contains all 26 pre-guide commits, the complete 37-plant score table, deviations and remaining limitations.

- Acceptance: **30/37** plants caught, **133 seeded / 93 clean / 0 unexplained findings**. Both answer-changing traps caught: `price_in_pence` **6/6**, `product_duplicate_key` **1/1**. Misses: cost_dates_reversed 0/5, cost_interval_overlap 0/1, date_future_year 0/5, quantity_extra_zeros 0/5, silent_currency 0/25, value_not_quantity_times_price 0/30, price_decimal_shift 11/15. Quantity_in_packs is caught at 19/20.
- Final cold seeded/clean: **26.159 / 19.155 s**; warm **0.097 / 0.074 s**. Exact materiality: `kept: 47566 | both excluded: 22423 | material: True`. Actual prompt compaction: **38 retained / 11,919 characters**, both benchmark traps retained within the 12,000-character bound.
- Final Python **215** lines, adapter **59**, production diff **297** changed lines; Ponytail ultra **PASS for minimality/budgets with remaining limitations**. **343 Vitest / 48 Python tests**, typecheck and format passed. Final scoped spec **PASS** and quality **Approved** address all reproduced review findings.
- Task 14 fresh warm VERSION 5 smokes: **133 seeded / 93 clean**, both exit 0 with empty stderr and entire JSON results identical to final checkpoint 4. No new documentation-only tests or suite/cold reruns.
- Deviations include confirmed-treatment probe preservation (`956bfa0`), full and unambiguous JSON-tuple signature IDs (`7ff11a6`, `1f8054e`), withdrawal of unsafe D2 normalization candidates (`d3e85b2`) and finite D7 peer baselines (`2220123`). D2 still flags variants but offers no normalization fix; its historical case-distinct merge risk is resolved. Older ID-based confirmations require reconfirmation; no automatic migration.
- **Task 13 remains pending explicit approval** ($0.20 per variant / $0.40 total); no Task 13 preparation steps or paid/live outcome. No push or PR; research remains uncommitted.

Deterministic checks and zero unexplained findings on this pack do not establish live model correctness, generalized false-positive rates, universal business-losslessness or exhaustive mixed-treatment coverage. All remaining inherited limits are retained in the execution record.
