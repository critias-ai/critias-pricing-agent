# Open items

Pruned 2026-10-22: items that were fixed, re-tested or decided (for example cause-finding before recommending is
accepted as a model limit) were removed; git history has the full record. Eval results are in `tests/evals/RESULTS.md`
and `docs/eval-comparison-2026-10-21.md`.

## Harness

1. **Adding a workspace file resets the analyst (2026-10-18).** The conversation key (`orchestrator.ts`) hashes the
   bundle fingerprint and every workspace file, so adding, removing or replacing any file makes the next turn start
   fresh: the analyst folder is deleted and earlier turns are forgotten, while the visible chat stays. Planned fix: keep
   the session when files are only added and tell the analyst about the new files; reset only when a known file changed
   or went, or the bundle changed. Needs a live multi-turn re-run.

2. **More upload formats aren't checked.** `src/files.ts` maps only `.csv` and `.xlsx` to table kinds, so `.tsv`, a
   delimited `.txt` and `.xlsm` get no findings or profiles, although `data_findings.py` and the query tool read them.
   `.xls`, `.json` and `.parquet` aren't read by any tool. Cheapest step: map `.tsv` and `.xlsm` in `files.ts`.
3. **The "no direct source reads" guard can be bypassed:** a script converts the source to CSV in `/tmp`, copies it
   into the work folder, and the copy is queried (wave 2, UCI-2 run 2).
4. **Peer-ratio and returns notes cover SQL only.** `peer_ratio.py` and `offsets.py` check SQL sums; figures computed
   in Python scripts (`execute_analysis`, `python3` in `bash`) are not checked. The 5× threshold and 0.5% materiality
   came from the seeded pack and the Storage question only; recheck on other data. A uniform currency slip (×1.17) is
   invisible to any ratio threshold.

5. **context.md precedence over skill methods is untested.** The plugin says confirmed definitions override card
   defaults; the harness prompt does not, and no run has had a `context.md` that sets a different method. Needs a test
   (for example a turn that confirms a different bridge order) before wiring an explicit rule.
6. **Compaction and scenario assumptions:** check that compaction keeps user-stated scenario assumptions that are not
   in `context.md`; the default summary format was not inspected.

7. **Haiku 5.5 is priced $0** (not in Pi's price list), so `--max-usd` can't stop a Haiku run; token totals are the
    only cost record.

## Data findings (noted, not built)

8. **Open misses:** C029's `case` unit priced per each (quantity against unit is a business rule); scale labels are
    guesses (annual values labelled x12, x1e1 or x24); `customer_id` flagged as a repeated document in snapshot and
    per-quarter tables; one date fact repeated across every pair of date columns.
9. **Noise fixes to decide:** timestamp and decimal (money) columns treated as keys (Olist timestamps, S3 `spend`);
    variable-length codes split into many shapes (read a run of digits or letters as one unit); spelling variants in
    free-text columns (only where values repeat). No generic rule yet for numbers that aren't measures (zip codes, line
    numbers) or peer groups that don't describe the column.
10. **Uncovered faults:** overlapping extracts and empty months (script); renamed codes, missing values and
    placeholders (skills); overlapping cost intervals and fixed-width padding (script, small).
11. **Headerless files** can't be given a schema: no way to pass column names to the query tool.
12. Reading a large workbook takes 237 s against 5.7 s for the same data as CSV.

## Eval tests to review before the next round

13. **Fail on every model and judge:** out-1, out-2 (R1-R3 may ask for more than the data shows; out-2's planted gaps
    are smaller than natural UCI outliers), retail-outliers-portfolio (Sol flags 9 to 16 hard negatives),
    retail-storage-advice (no model states the £14,559 gross-profit fall or names S08), ec-2 (R2's old-list
    attribution can't be shown in the published data), s3-5 (R1's churn half; 12-month GP already nets churn).
14. **Rubric items that may be too strict:** fo-5 R3 fails replies that say the ranking holds with similar tagging but
    omit "upper bound"; s3-5 R2 fails replies that flag partner Enterprise (2 customers) because the key's example is
    the 9-customer second-half partner cohort.
15. **SQL NULL where the key expects 0** (aw-3, ec-4, messy rebates), identical on Haiku, DeepSeek and Sol: a harness
    rule or a key that accepts blank as zero.
16. **messy-conversation `expectQuestion`:** Sol delivers provisional figures and ends with the right rebate question,
    failing only because nothing was presented or written before asking. Decide whether the rule fits.
17. **Not re-run with the intake gate:** ladder-l0, ladder-l1, rt-intake-setup, messy-conversation.
