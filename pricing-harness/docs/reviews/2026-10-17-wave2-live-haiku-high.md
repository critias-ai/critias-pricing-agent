# Wave 2 live run: Haiku 5.5 high, judged by Sol low

Date: 2026-10-17.

- **Analyst:** `anthropic/claude-haiku-5.5`, thinking high, through OpenRouter.
- **Judge:** `gpt-6.1-sol`, thinking low.
- **Code:** commit `f1c4e41`, plugin 0.4.9, data findings VERSION 8.
- **Scope:** the 19 wave 2 cases on real data (UCI, AdventureWorks, Olist), 3 runs each, 57 runs, all finished.
- **Before the run:** free oracle 69 of 69; judge oracle 60 of 60. A smoke run of two UCI cases showed that the CSV path
  copes with 1.07M rows (70 s) and that workbooks can't be queried (below).
- **Test cases were not changed after the run**, as agreed, even where they look too strict. Each failure below is
  tagged: **harness** (a harness or skill problem), **analyst** (the model's own work), or **test** (my key or rubric).

Run folder: `.cache/evals/live-2026-10-17T11-04-33-268Z`.

## Result: 22 of 57

| Case                     | Passed | Main reason for failures                                                                                                            | Tag               |
| ------------------------ | -----: | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| AW-1 waterfall           | 1 of 3 | Runs 2 and 3 had **every figure right** but wrote `Internet`, not `internet`; text must match exactly.                              | test              |
| AW-2 offer rules         | 2 of 3 | Run 3 said nothing broke the rules, missing the 2,151 lines tagged with an offer they didn't get.                                   | analyst           |
| AW-3 cost and margin     | 0 of 3 | Cost effect left blank instead of 0 (runs 2, 3); one subcategory off (run 1). Also a key fault, below.                              | analyst, test     |
| AW-4 reseller discounts  | 0 of 3 | Didn't check each reseller's cause before advising, and didn't stage or weigh the risk (R2, R3 every run).                          | harness (skill)   |
| AW-5 bike prices         | 3 of 3 |                                                                                                                                     |                   |
| AW-6 3% reseller rise    | 0 of 3 | Total given rounded ($0.88M) or on FY2024; the judge wanted more than one account named.                                            | test, analyst     |
| AW-7 raw database files  | 1 of 3 | Runs 2 and 3 couldn't read the headerless files: no view, and scripts may not read sources.                                         | harness           |
| Olist-1 seller revenue   | 3 of 3 |                                                                                                                                     |                   |
| Olist-2 sellers vs peers | 3 of 3 | All 367 pairs exact, every run.                                                                                                     |                   |
| Olist-3 freight north    | 3 of 3 |                                                                                                                                     |                   |
| Olist-4 no cost data     | 3 of 3 |                                                                                                                                     |                   |
| Olist-5 vouchers         | 0 of 3 | Figures right; **the voucher rule was never saved to `context.md`**.                                                                | harness           |
| UCI-1 bare context       | 0 of 3 | `pricing-intake` was never read. The replies passed every rubric item.                                                              | harness (routing) |
| UCI-2 workbook           | 0 of 3 | **Workbook sheets can't be queried.** Run 2 got round it (below) and was £16 off in 2010.                                           | harness, test     |
| UCI-3 price or mix       | 0 of 3 | **Figures exact every run**; judge failed R1 because no reply said revenue rose; the reply number sat in a table.                   | test              |
| UCI-4 GP by country      | 2 of 3 | Run 3 didn't explain what drove the largest movers.                                                                                 | analyst           |
| UCI-5 losing customers   | 0 of 3 | Replies said 108 customers, leaving out the carriage charged that the context counts as income; the file was right in runs 2 and 3. | analyst           |
| UCI-6 top 50 up 4%       | 0 of 3 | **Files right every run**; replies used 2010 as the base (2011 is partial) or rounded figures.                                      | test              |
| UCI-8 wholesale          | 1 of 3 | Runs 1 and 2 didn't save the 1,000-unit rule to `context.md`.                                                                       | harness           |

- **Consistency:** 11 of 14 cases that save files gave the same figures on every repeat.
- **Effort:** about 11 model calls and 60 to 120 seconds a run; UCI-2 took 543 s, about 4 minutes of it reading the
  workbook.

## The products with no cost

Your extra check held up. Two UCI products have no cost. Every saved margin file that got as far as costs (UCI-2 run 2,
UCI-4, UCI-5 runs 2 and 3, UCI-6) left them out of margin rather than costing them at zero. UCI-2 run 2 also said so
plainly: 2,172 lines (£63,584) with no cost, left out of margin, "including them at zero cost would overstate" it.

## Harness and skill findings

1. **Workbooks can't be queried (UCI-2).** The query tool loads CSVs only (`query_server.py`, `format='csv'`). Already
   recorded as open-items 12, with a note to redo the workbook tests after the fix.
2. **The "no direct source reads" guard can be bypassed (UCI-2 run 2).** The script was refused once. On a second try it
   converted the workbook to CSVs in `/tmp`, copied them into its work folder and queried those. That worked, but the
   rows bypassed the SQL checks the guard exists for.
3. **Headerless files can't be read at all (AW-7, 2 of 3).** The analyst found the column order in `instawdb.sql`, but
   the query tool has no way to read a file with given column names, and scripts may not read sources. Run 1 passed
   (how is not yet checked).
4. **Rules the user states aren't saved (Olist-5 0 of 3, UCI-8 2 of 3).** Same as wave 1's S2-5.
5. **`pricing-intake` isn't read with a bare context (UCI-1, 0 of 3).** The answers were good: they gave provisional
   figures, named the treatments and said margin needs costs. But the intake skill never fired.
6. **Causes not checked before advising (AW-4, 0 of 3).** Same pattern as OUT-1 in wave 1.

## Test faults (left unchanged, as agreed)

- **A key fault (AW-3, UCI-2):** the grader uses an exact tolerance (1e-10) for any column named like `margin`, and I
  stored those values rounded to 4 decimals, so even a perfect answer fails them. It changed no result in this run, as
  every affected run also failed for another reason, but it must be fixed before these cases run again.
- **Strict checks that failed correct work:** exact text for channel names (AW-1); reply numbers inside tables, or
  rounded (UCI-3, UCI-6, AW-6); the base year for a 4% rise when the latest year is partial (UCI-6); and "revenue rose"
  demanded word for word (UCI-3, R1). Counting these as passes would give 30 of 57 (AW-1 runs 2 and 3, all of UCI-3 and UCI-6).
