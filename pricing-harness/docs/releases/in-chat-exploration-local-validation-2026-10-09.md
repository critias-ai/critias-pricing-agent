# In-chat exploration — local validation, 9 October 2026

IC-01–IC-06 were implemented inline in the existing dirty checkout using TDD. Workflow **2.0.0** replaces report production with native React tables and locally bundled **plotly.js-basic-dist-min 4.1.2** charts inside checked assistant messages. Visualization version is **0.2.0**; pricing 0.2.0, its commit/license, data-tool 0.1.1 and Pi SDK 1.0.4 are preserved.

## Implemented behavior

- Coordinator → analyst → independent numerical verifier → immutable checkpoint remains the approval path. Ordinary synthetic success has exactly three stages; no visualizer, visual verifier, render, preview, output manifest or exported result is produced.
- Optional table/chart descriptions reference scalar claim IDs. Values come exclusively from sealed approved facts; arbitrary CSV cells are never sent to the renderer. Executed holds produce null gaps and unavailable cells with reasons. The held analyst draft is withheld. Unknown bindings, rankings, nonfinite values and unit mismatches omit affected views.
- Limits cover four tables/charts, twelve columns and 1,000 rows per table, 5,000 cells total, four series and a 1 MiB UTF-8 result. Invalid views are advisory; financial handoff repairs, operation completion and numerical safeguards remain separate.
- Continuations preserve earlier views/claims immutably. Selected-claim cache lookup remains text-only; explicitly requested full-checkpoint exploration can reuse intact evidence. Delivery and producing run IDs remain distinct.
- Text and rich payload share one persisted message ID. Reconnect deduplicates; restoration rebuilds serialized values from frozen evidence. Unsupported versions, missing/changed sources/checkpoints, wrong scope/conversation/producing run remove rich data and add a generic rerun notice. Finalization invalidation emits replacements under the same IDs and persists them.
- Cancellation before approval delivers no numerical UI. Cancellation after intact approval and incomplete later operations retain checked partial answers. A failed Plotly load retains verified text and readable tables.
- Charts support local hover, zoom, pan, legend and reset. Tables support numeric sorting, label search across all delivered rows, 25-row pagination and reset. Held values sort last in either direction. State is per message; refresh resets ephemeral controls. Older-answer scroll position survives activity updates. Markup-like labels render literally; no external requests or export buttons are introduced.
- Active report workers/tools/schemas and product report modal/sidebar are retired. Historical artifact listing/download and hash guards remain. Explicit legacy startup fails with bounded-mode guidance before provider startup. Report-named budgets and historical counters remain readable; retired render/preview fields are inactive. Normal startup no longer probes Python Plotly/Jinja, Chromium or image capability. `--pricing-only` keeps numerical verification and suppresses rich delivery.

## Final checks

Commands ran from `pricing-harness/`. The exact focused selections are in [IC-06](../superpowers/plans/2026-10-09-in-chat-exploration.md) and the command JSON files below.

| Check | Result | Evidence file |
| --- | --- | --- |
| Exact focused unit/integration selection, 25 files | **162/162 passed**, exit 0 | `final-focused.log`, `.json` |
| `npm run typecheck` | Exit 0 | `final-typecheck.log`, `.json` |
| `npm run build` | Exit 0 | `final-build.log`, `.json` |
| Exact three-file browser selection | **6/6 passed**, exit 0 | `final-browser.log`, `.json`, `final-browser-traces/` |
| `npm run eval:configured -- --dry-run` | Exit 0; one original Lighting prompt; **paidCalls:false** | `configured-dry-run.log`, `.json` |

TDD failures and subsequent passing checks are retained for contracts, malformed optional handoffs, UI, retirement, evaluator adaptation, restoration versions, approval cancellation, checkpoint invalidation and full-cache exploration. Browser fixture corrections are also retained: chart dragging required a visible plot, responsive captures needed to await Plotly resize, and the source-change fixture needed to mutate every registered fixture source. Initial failures are not presented as passes.

### Actual rendered inspection

Inspected real 1280×900 and 390×844 application captures, including chart and table sections. Revenue traces retain original Q1/Q2 order and values `[10,20]` and `[20,10]` GBP. Margin is `[36.09,null]` with `%` ticks, a single approved point and no connection across the hold. Hover displays `36.09%`. Literal `<b>` text does not become markup. Narrow charts resize to the container; wide tables scroll inside labelled keyboard-focusable regions, with no page overflow.

The browser checks exercise hover, zoom, pan, legend/reset, keyboard pagination/sort, 60-row search, empty results, independent message state, refresh reset, Plotly cleanup and renderer failure. Interaction request lists are empty; submission/model/tool counters remain unchanged. Synthetic counter totals include earlier fixture requests and are not paid-provider usage.

## Evidence and preservation

Unique ignored evidence directory:

`pricing-harness/.cache/in-chat-exploration-2026-10-09-9acba84ac1/`

Key files: `INITIAL_GIT_STATUS.txt`, `INITIAL_DIFF_STAT.txt`, `INITIAL_SHA256SUMS.txt`, `FINAL_GIT_STATUS.txt`, `preservation-review.json`, `compiled-settings-bundle-fingerprints.json`, `environment-fingerprints.json`, `historical-evidence-sha256.txt`, `historical-evidence-review.json`, `ledger.md`, `synthetic-chart-data.json`, `synthetic-{chat,chart,margin,table}-{desktop,narrow}.png`, passing/failing trace folders, and `synthetic-workspace-evidence/`.

Initial nonignored hashes match for source data, historical release/evaluation inputs, saved `harness.config.json`, Python requirements/locks, the pricing plugin and unrelated existing changes. All sixteen removals are the explicit migration below. Historical root-cache review covers **5,426 files**, with no modification timestamps after the initial snapshot. Initial hashes excluded ignored credential/history files; their final hashes and pre-session modification timestamps are recorded separately, rather than claimed as a before/after hash comparison. Credentials were not written or printed. Python dependencies/environment were not changed.

Saved app model remains DeepSeek Flash/high. The configured dry run retains the existing Luna/high evaluation override, original manifest/prompt, 1200/360-second analysis/report allowance, 100 attempts, 150 tools, shared repair/revision ceilings and 1800-second/USD1 batch limits. No fallback or live call occurred. Both JavaScript lockfiles add only the pinned browser Plotly package; its installed MIT license is reproduced in third-party notices.

### Explicit retirements

Original bytes, including modified baseline visualization work, are preserved with hashes in `retired-originals/` and the ledger. Replacements are fact-binding/checkpoint trust tests, native UI tests and report-retirement checks.

- `src/agent/workflow/{render-input,render-tools}.ts`
- `src/ui/Outputs.tsx`
- `bundled/harness-skills/analysis-visualize/assets/report.html`
- `bundled/harness-skills/analysis-visualize/references/html-reporting.md`
- `bundled/harness-skills/analysis-visualize/scripts/{render_report,report_contract,plotly_theme}.py`
- `bundled/harness-skills/analysis-visualize/scripts/preview_report.mjs`
- `tests/unit/{workflow-presentation-paths,workflow-render-input,workflow-render,preview}.test.ts`
- `tests/integration/{workflow-presentation,visual-review-lifecycle}.test.ts`
- `tests/python/test_reporting.py`

Ignored compiled copies of the two retired workflow modules were removed before rebuilding so packaged output cannot retain them. Historical outputs and evidence were not deleted or rewritten.

## Limits and stopping point

This is local application verification, not a live model-quality or latency comparison. Browser restart exercises reconstructed controller/event state and disk restoration inside the fixture server; it is not an operating-system process-restart trial. Full report-centric 15-case acceptance remains pending migration. No scale benchmark, full suite, paid evaluation, unrelated DeepSeek verifier packaging fix, fallback model, commit, push or deployment was performed.

Vite reports the expected large lazy Plotly chunk: about 1.21 MB / 404 KB gzip. It remains a local lazy chunk; the build passes. No live latency saving or full acceptance pass is claimed.
