# Lighting & Candles baseline after simplifying visual review

**The revised workflow completed end to end and published a report.** It used one fresh source-only workspace and the exact prompt from the previous run: “Review how Lighting & Candles performed over the last five complete quarters.” Evaluation model was OpenRouter `openai/gpt-6-luna` / high; the saved DeepSeek/high application setting was not changed. No fallback or additional prompt was used.

## Run and comparison

Both runs used the same temporary generous limits: 2,400 seconds per analysis/report request, 200 model attempts, 300 tools, four analyst revisions, 12 shared format repairs (three per stage), three corrections, four renders/previews, and a 3,600-second / $2 estimated batch cap.

| | Workflow 1.0.16 | Workflow 1.0.17 |
|---|---:|---:|
| Outcome | Verified partial | Complete |
| Elapsed | 1,129.734 s | 712.633 s |
| Estimated SDK cost | $0.14193856 | $0.081282555 |
| Model calls / tools | 108 / 195 | 72 / 117 |
| Format repairs | 3 | 2 |
| HTML reports published | 0 | 1 |

The current run used 72 model calls and 117 tools, two format repairs, two analyst revisions, three corrections, and four renders/previews. SDK usage is complete. First verified numerical answer arrived after 360.366 seconds. The final visual reviewer requested a narrow-screen table correction; the visualizer split the dense tables into separate metric tables, and the reviewer then approved the result.

## Output quality

The answer says signed invoice revenue peaked at £331,019.82 in Q4 2010, fell to £134,150.38 in Q1 2011, then recovered to £154,877.51 by Q3 2011—still £13,072.86 below Q3 2010. Verified weighted invoice margin fell from 48.82% in Q4 2010 to 38.28% in Q2 2011. Q3 2011 gross profit and margin are held unavailable because 53 records (322 signed units; £163.33 revenue) have blank unit cost. The answer states the signed invoice basis, avoids unsupported causal or pricing claims, and discloses 2,060 repeated observations that were retained rather than assumed erroneous.

Independent read-only controls passed six source checks and verified original input hashes across 1,067,371 sales rows. The 41,684-row Lighting cohort passed 85 direct comparisons against independently recomputed source controls: 45 quarterly value/cost checks, 20 movement values and 20 chart data points. Numerical verification approved 34 claims, held six cost-dependent claims, and marked all three requested operations complete. All 18 published artifact hashes and file sizes match their manifest.

The visual review approved the final desktop and narrow report views after correcting clipped narrow tables. The report has two trend charts and full-quarter tables. It is numerically supported and usable as an evaluation baseline, though the complete report is long and dense on a phone rather than a brief executive summary.

## Evidence and deliverables

- [Published HTML report](<.cache/configured-agent-evaluations/2026-10-09T10-58-08.955Z-b12610cd/outputs/F01-1/report.html>)
- [Final answer and run record](<.cache/configured-agent-evaluations/2026-10-09T10-58-08.955Z-b12610cd/F01-1.json>)
- Raw evaluation evidence: `.cache/configured-agent-evaluations/2026-10-09T10-58-08.955Z-b12610cd/`
- Fresh workspace: `/private/tmp/pricing-focused-2026-10-09T10-58-08.955Z-b12610cd/lighting`
- Independent checks and output cross-check: `.cache/minimal-visual-review-live-2026-10-09/independent-review/`
- Artifact manifest verification: `.cache/configured-agent-evaluations/2026-10-09T10-58-08.955Z-b12610cd/artifact-integrity.json`
- Temporary experiment settings: `.cache/minimal-visual-review-live-2026-10-09/experiment-harness.config.json`

Saved model, budgets, credentials, sources and historical evidence remain unchanged. No full suite, fallback, commit, push or deployment was performed.
