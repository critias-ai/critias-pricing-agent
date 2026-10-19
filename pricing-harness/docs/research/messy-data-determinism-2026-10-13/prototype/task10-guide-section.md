## Data findings

`dataFindings` lists anomalies code found in the CSV sources: the largest value at stake first within each detector, interleaved across detectors. Long values are clipped. `total` counts all of them, and the full list is `findingsDir/findings.json`. Each finding has:
- `id`
- `detector`: `parse`, `shape`, `domain`, `uniqueness` or `ratio`
- `source` (workspace-relative, as in `sources[].path`) and `column`
- `issue`
- `rows`
- `valueAtStake`, summed from `valueColumn`
- `examples`
- `fix`: a lossless SQL rewrite, or null
- `exact`: false for heuristic detectors

Findings are facts, not decisions. Never drop or rewrite flagged rows on your own judgement.

Treatments come from the user and appear in confirmed context as `Data finding <id>: keep|exclude|fix`. Apply them to the source's raw table. Pass the same `source` string you gave `prepare_source`, and `dataFindings.findingsDir` as `findings_dir`:

```python
import sys; sys.path.insert(0, HARNESS_TOOLS)  # the directory containing this file
from data_findings import treated_view, sweep
treated_view(conn, 'sales', 'files/data/sales.csv', findings_dir, {'F-1a2b3c': 'exclude', 'F-4d5e6f': 'fix'})
# then read sales_treated instead of sales.raw: its columns are VARCHAR, so TRY_CAST them yourself
```

`create_typed_view` reads `sales.raw` and ignores treatments. A finding's id belongs to one source, so call `treated_view` once per source with that source's ids. Recreate `sales_treated` in each script.

For pending findings (those with no confirmed treatment) on the sources and columns your answer uses:
1. Write the calculation as `run(ids)`. It should return the conclusion you would report, such as the ranked IDs or a value rounded to the reported precision. Inside it, build the treatment with `treated_view(..., {i: 'exclude' for i in ids}, view='probe')` and read `probe`, so `sales_treated` keeps the confirmed treatments.
2. Call `sweep(run, ids)` with a list. It returns the IDs whose exclusion changes that conclusion. For findings with a non-null `fix`, sweep again with a `run` that uses `'fix'` instead of `'exclude'`: an unparseable value is NULL when kept or excluded, so only fixing it may change the answer.
3. If neither sweep returns an ID, approve as usual and list the pending IDs in coverage.
4. If either returns some, hold the affected claims and add one review reason: `{"kind": "definition", "question": "Data findings F-…: keep, exclude or fix? <one line per finding on what changes>"}`. Only findings with a non-null `fix` can be fixed.
