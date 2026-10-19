# Data findings stress test: wave 1 data (S2 B2B, S3 SaaS)

Date: 2026-10-17. Script: `bundled/harness-tools/data_findings.py` VERSION 7, unchanged. No model calls.

- **Data:** `tests/evals/generators/make_b2b.py` and `make_saas.py`, each written twice: trapped (`inputs/b2b`,
  `inputs/saas`) and `--clean`. The answer keys, `tests/evals/findings/{b2b,saas}-plants.csv`, list every planted row.
- **Run:** `findings_stress.py <name> <clean> --seeded <trapped> --key <plants>`. Raw output is in `.cache/findings-stress/`.
- Neither the script nor the data was changed to make them fit. Every miss below is a gap to address.

## Result

| Pack    |            Rows |  Wall | Peak memory | Findings clean / trapped | Data faults caught | Unexplained |
| ------- | --------------: | ----: | ----------: | -----------------------: | -----------------: | ----------: |
| S2 B2B  | 9,900 in 5 CSVs | 0.9 s |      674 MB |                   5 / 14 |        **7 of 11** |           0 |
| S3 SaaS | 6,545 in 4 CSVs | 0.2 s |      111 MB |                   1 / 11 |         **4 of 9** |           0 |

**Caught:** text currency (both), repeated rows (both), an unknown customer (both), line value ≠ quantity × unit price,
×10 prices, future invoice dates, quotes valid before they were made, and negative seats.

## Data faults missed (9)

| Plant                                                                       | Rows found | Why it's missed                                                                                                                            |
| --------------------------------------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| S2 `data_uom_case_priced_each`: C029's quantities in cases, priced per each |     0 / 46 | Nothing checks a rare value in a low-cardinality column (`unit_of_measure` is `each` on 99% of rows), or quantity against unit of measure. |
| S2 `data_rep_lowercase`: `r03` beside `R03`                                 |     0 / 20 | The shape check needs at least 10 distinct values; `rep` has 6.                                                                            |
| S2 `data_rebate_quarter_format`: `Q3 2025` beside `2025-Q3`                 |      0 / 4 | Same 10-value limit; `quarter` has 8 distinct values.                                                                                      |
| S2 `data_pack_of_24`: Safety lines booked in packs of 24                    |      5 / 8 | Three rows not flagged by the peer-ratio check.                                                                                            |
| S3 `data_future_month`: `2027-…` months                                     |      0 / 4 | `YYYY-MM` months aren't read as dates, so the time check reports "no date columns" on the subscriptions table.                             |
| S3 `data_billed_after_churn`: rows after the customer's churn month         |      0 / 6 | No check across tables for dates (a row after the customer's end date). Also blocked by the month format above.                            |
| S3 `data_mrr_mismatch`: mrr ≠ seats × price × (1 − discount)                |     0 / 12 | The identity check covers three columns (a = b × c), not a discount term.                                                                  |
| S3 `data_plan_name_case`: `BETTER` beside `Better`                          |     0 / 12 | The 10-value limit again; `plan` has 3 distinct values.                                                                                    |
| S3 `data_annual_value_as_mrr`: annual contract value in `mrr`               |    17 / 20 | Three rows not flagged.                                                                                                                    |

## Labels and noise

- **Wrong labels.**
  - A ×10 price was labelled `x12` once.
  - Annual values (×12) were labelled `x12` on only 8 rows; 8 were labelled `x1e1` and 1 `x24`. The peer median is per
    customer, and seat counts and discounts move it.
  - The analyst would read "x1e1" as a decimal shift, which is the wrong cause.
- **Noise on the clean copies, all from the same two rules:**
  - `customer_id` flagged as a repeated document: 232 rebate rows (one per customer per quarter, as designed) and 80
    subscription rows (monthly snapshots). A customer ID isn't a document ID. The counts also move between the clean and
    trapped copies (232 → 200, 80 → 48), although those rows didn't change.
  - Small orders flagged `x1e-1` against the customer's median quantity (38 quote and 18 invoice rows), and R04's
    discounts flagged `x1e-1`/`x1e1` against the customer's median discount. These are natural spreads, labelled as
    decimal shifts.
- **Value columns:** the invoices list includes the two discount-percent columns, quotes include `discount_pct`, and
  products fall back to `case_size`. A percent or a pack size isn't money at stake.

## Business plants (S2): not found, and outside the script's stated scope

The script flags data facts only. None of S2's business plants were found, which is expected from its design, but it
still has to be decided where they're caught:

| Plant                                              | Rows | Found |
| -------------------------------------------------- | ---: | ----: |
| Approvals at the wrong level, against `policy.md`  |   97 |     3 |
| Discounts beyond policy (over 30%)                 |   60 |     0 |
| Lines below the floor (pocket price < cost × 1.10) |  190 |     5 |
| R04's deep discounts                               |  381 |     6 |
| C027's legacy contract                             |   57 |     3 |

The few hits are other findings (text freight, an unknown customer) that land on those rows by chance. These need the
analyst (pricing-scan, discount governance, peer comparisons); the live cases will test that.

## After the fixes (VERSION 8, same day)

Four changes to `data_findings.py`, +37 / −20 lines, with five new tests that fail on VERSION 7:

1. **Spelling variants on every text column**, at any number of distinct values. A collision after trimming and
   upper-casing is the evidence, so no floor is needed.
2. **Shape checks from 5 distinct values (was 10), on code-like columns** where at least 95% of values are short and have no
   spaces. A shape off a dominant one (95%+) is flagged as well as a rare one. Country names and long labels stay
   out, since that is where shapes are noise.
3. **Dates:** `YYYY-MM` is read as a month. Each row's dates are also compared with the dates of the row its key refers
   to (for example signup and churn on the customer), by day, through non-numeric keys only.
4. **Ratio:** rows 5× or more from the peer median that sit near no clean multiple are reported as `outlier` instead of
   dropped. The partial catches were exactly these rows. Their medians don't fit them closely: discounts pull packs of
   24 down to 19–21×, and seat and discount changes move annual values to 7–16×.

| Pack                                           |   Data faults caught |           Clean findings | Unexplained |
| ---------------------------------------------- | -------------------: | -----------------------: | ----------: |
| S2 B2B                                         | **10 of 11** (was 7) |                9 (was 5) |           0 |
| S3 SaaS                                        |   **8 of 9** (was 4) |                1 (was 1) |           0 |
| Northbridge                                    |      33 of 37 (same) | 147 (was 105, none lost) |           0 |
| Retail, retail-outliers, retail-ladder-neutral |                    — |           1, 1, 0 (same) |           — |

**Still missed:**

- S2 `data_uom_case_priced_each`: `case` on 1.2% of `unit_of_measure` values is no variant, shape or ratio fault.
  Finding it means reading quantity against the unit, which is a business rule.
- S3 `data_mrr_mismatch`: out of scope, as you decided. The discount in the formula is for a skill or the user.

**The 42 new clean findings on Northbridge:**

- **28 date findings, all facts.** For example, 28 invoices dated in May are booked to April's `reporting_month`, and a
  few quotes fall after the price list's `valid_to`. One fact repeats across every pair of date columns, though: the 28
  May invoices produce about 10 findings.
- **12 `outlier` ratio findings.** These are rows such as 2,535 UCI unit prices like 0.001, which VERSION 7 dropped.
- **2 description variants** (leading spaces).

**On the S2 clean copy:**

- 260 quotes valid only until before the customer's contract start. This is a fact of how the generator dates contracts.
- 3 `outlier` findings on small orders and discounts, which are natural spread.

**Left open:**

- Scale labels are still guesses: annual values come out as `x12`, `x1e1` or `x24`.
- `customer_id` is still flagged as a repeated document in snapshot and per-quarter tables.
- Time findings aren't deduplicated across column pairs.
