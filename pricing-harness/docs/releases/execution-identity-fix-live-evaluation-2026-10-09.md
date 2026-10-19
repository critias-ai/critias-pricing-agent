# Numerical execution identity fix and fresh live evaluation — 9 October 2026

The numerical handoff defect is fixed and live-confirmed. One fresh Luna/high test delivered an independently checked numerical answer and immutable checkpoint after **397.929 seconds**. The run ended **verified-partial** after **547.752 seconds / USD0.069235125**: presentation hit a separate path-identity handoff defect. Two charts rendered, but neither the HTML report nor charts became verified, published deliverables. Mobile layout also remains deficient. This is progress in numerical delivery, not complete end-to-end success.

## Bounded implementation and local checks

Workflow **1.0.13** moves numerical `checkExecution` selection to the controller's execution ledger. It selects the latest successful verifier execution, ignoring producer IDs, paths and captions. The numerical output schema no longer requires that internal identifier. The short verifier prompt and data helper guide explain the ownership; visual-verifier execution references retain their existing requirement.

All existing source-access, provenance, source/script/output hash, independent-code, scalar agreement, explicit source-related hold, scope and previous-checkpoint guards remain. An invalid latest successful result fails; the controller cannot choose an older agreeable result. A failed execution does not replace the latest successful execution.

Changed existing files: `src/agent/workflow/{checkpoints.ts,output-contract.ts,role-prompts.ts}`, `tests/unit/workflow-checkpoints.test.ts`, `bundled/harness-tools/data-analysis.md`, and `bundled/versions.json`, under `pricing-harness/`. Other preexisting changes were preserved. No model settings changed.

Seven new regression cases failed before implementation; **64 focused tests in six files** then passed. Typecheck and build passed. The focused files cover checkpoints, handoff, coordinator, budget, workflow controller and workflow integration; no full suite ran. Read-only replay of both unchanged verifier packages from the previous failure now accepts the recorded execution, with 53 approved claims and nine holds. Replay made no paid calls, created no checkpoint and changed no historical evidence.

## Fresh evaluation controls

From `pricing-harness/`, `npm run eval:configured -- --dry-run` selected exactly one message:

> Review how Lighting & Candles performed over the last five complete quarters.

Then `npm run eval:configured` ran **exactly once**, in a new external workspace. Effective provider/model/reasoning: **OpenRouter / openai/gpt-6-luna / high**. Saved app model remains **deepseek/deepseek-v4.1-flash / high**. Both analysis and report limits remain **1,200 seconds total, 360-second finalisation reserve, 100 model calls, 150 tool calls; two shared analyst revisions; four shared final-format repairs, at most one per stage; one correction allowance**. Batch limits remain **1,800 seconds / USD1**. The existing renderer also shares that correction allowance when rendering a second time; this run consumed it for presentation, not a numerical discrepancy.

The workspace started with only 24 fixture data/company/dictionary files and the established fictional company context. Historical scripts, responses, controls and evaluator answers were not preloaded. Observed tool arguments contain no independent evaluator paths. The prompt and context match both comparison runs. The rebuilt files match the compiled hashes recorded at live launch.

## Live behavior and accounting

| Stage | Seconds | Model calls | Tool calls | SDK USD |
|---|---:|---:|---:|---:|
| Coordinator | 15.340 | 2 | 1 | 0.001623310 |
| Analyst | 250.115 | 18 | 22 | 0.033698255 |
| Numerical verifier | 130.618 | 10 | 16 | 0.017417490 |
| Visualizer | 148.806 | 18 | 26 | 0.016496070 |
| Request, including transitions | **547.752** | **48** | **65** | **0.069235125** |

All 48 model usage records reconcile to total SDK cost; usage is complete. Tokens: input 144, output 65,045, cache read 1,202,460, cache write 197,389, total 1,465,038. Largest input including cache: 56,521 tokens. These are recorded SDK estimates, not a separately audited provider invoice.

Two analyst revisions were consumed. Initial SQL failed on an ambiguous column before succeeding; the first revision failed on decimal overflow, and the second succeeded. After revisions reached zero, `validate_handoff` remained available: an empty claim list failed tool-schema validation at 05:41:57 UTC; a complete 59-claim package returned `valid:true` at 05:42:52. It then passed final handoff without a format repair. No additional analyst execution followed exhaustion.

The numerical verifier executed its own script successfully twice. Its final response omitted `checkExecution`; the controller attached **044fb023-ea17-48e7-b0aa-94bf867fdaa0** and derived **43 approvals / 16 source-supported holds**. No numerical handoff repair or numerical correction was needed. The checkpoint was sealed and its answer delivered publicly before presentation began.

The visualizer used two counted renders and two previews. One presentation format repair was consumed; both final attempts failed. No provider retry, model fallback, visual-verifier stage or further prompt occurred. Seven tool failures are retained: the two analyst SQL failures, unavailable `python`, invalid empty preflight, two relative-directory lookup mistakes and an attempted shell rendering operation blocked in favor of counted tools.

Script sizes: analyst **220 lines / 16,352 bytes**; independent verifier **273 / 20,253**; presentation generator **132 / 11,362**. Four successful recorded analytical executions are retained. The presentation generator is an artifact, not a recorded independent analytical execution.

Final model stop reasons were normal `stop`; workflow termination was:

```text
stage handoffRepair budget exhausted: /report needs a recorded render_report execution
```

There were still 652.490 seconds, 52 model calls and 85 tool calls remaining. The per-stage repair limit, not the total request budget, ended presentation.

## Independent numerical and integrity review

Independent DuckDB calculations from original raw sources passed **411/411 comparisons** across quarterly CSV/JSON results, movements, all 59 accepted scalar/null claims, executed verifier checks and approval/hold status. Six additional source-structure checks passed. Raw totals and chart values use a 1e-7 comparison tolerance; rounded claim/verifier values use their stated two-decimal or four-decimal margin precision. Initial reviewer differences were rounding-only and were corrected in the evaluator; no agent evidence or calculation changed.

The five-quarter period is Q3 2010–Q3 2011. Signed revenue totals **GBP931,065.10**; quarterly revenue is **167,950.37; 331,019.82; 134,150.38; 143,067.02; 154,877.51**. Q3-to-Q3 revenue changed **−7.78%**. Scope contains **41,684** eligible source observations. Q3 2011 has **53 nonnumeric historical costs** among 6,745 uniquely matched GBP/EA/CURRENT observations; only 6,692 qualify. Full-quarter cost/profit/margin and dependent full-window/endpoint comparisons remain unavailable. No zero or qualified-subset substitution occurred.

Integrity/configuration audit passed **95/95 checks**; supplemental archive, artifact, render, preview, chart-data and presentation-table checks passed **176/176**. All 24 source files match both their original fixture and fresh-workspace launch hashes. The checkpoint reference, its source references and all eight frozen evidence files match recorded hashes. All eight public evidence downloads match their originals and archive copies. Historical replay evidence remains unchanged. All 358 preexisting project files were preserved except the six authorized fix files and the subsequent guide update; the report is new. Saved model/settings and the live compiled build remain unchanged.

## Presentation diagnosis and visual inspection

`worker.ts` returns an absolute HTML path from `render_report`, while its ledger records a workspace-relative path. `handoff.ts` compares `data.report` with that ledger path literally. The visualizer initially returned the correct existing HTML file as an absolute path; repair feedback only said it needed a recorded render execution. The repair switched to the absolute input `report.json`, which also fails and no longer identifies rendered HTML. Figure/capture references were also absolute; later inventory checks were not reached.

A future bounded fix should derive presentation references from recorded render/preview evidence or safely canonicalize them before comparison, while preserving hash, inventory and capture-inspection checks. The numerical fix did not change this separate presentation contract. No post-failure application changes or further paid test were made.

Both final chart captures and full pages were inspected directly at **1280px desktop and 390px viewport**; individual narrow chart captures are 354px wide. Revenue and margin are complementary; values, units and quarter order match independent controls. Missing Q3 margin is JSON null with `connectgaps:false`, correctly shown as unavailable. Desktop charts are readable. At 390px, chart titles and revenue endpoint labels clip; the margin's missing-cost annotation overlaps its peak label. Wide tables require horizontal scrolling. The model itself disclosed these defects. Responsive chart layout needs its own correction and validation; a successful renderer is not visual acceptance.

## Comparison and evidence

| Run | Seconds | SDK USD | Independently verified delivery |
|---|---:|---:|---|
| Earlier handoff failure | 241.932 | 0.033255105 | None; correct drafts are not delivered evidence |
| Previous path/preflight run | 653.699 | 0.067889980 | None; successful independent checks rejected on execution identity |
| Current execution-identity fix | 547.752 | 0.069235125 | Numerical answer, immutable checkpoint and eight evidence downloads; presentation incomplete |

Current runtime is 105.947 seconds below the previous run, while cost is USD0.001345145 higher. The meaningful improvement is verified numerical delivery. This is neither complete chart delivery nor proof that the fix caused a timing improvement; the single earlier 241.932-second failure was cheaper and faster but unsuccessful.

Unique live evidence: `.cache/configured-agent-evaluations/2026-10-09T05-38-54.647Z-f3d58ce6/`.

Independent/local evidence: `.cache/execution-handoff-fix-2026-10-09T05-37-00.527677Z/`: focused verification, historical replay, effective preflight, complete public response in `responses.md`, complete public stage text in `stage-responses.md` / `complete-assistant-text.json`, raw controls, calculation review, audit, render ledger, supplemental review, checkpoint copy and SHA-256 manifest. Full original sessions and events remain in the live archive. Two compact observer events interleaved into a large image write; the evaluator separated them for parsing without modifying raw logs, and reconciled all usage records.

No automatic recovery, additional prompt, full suite, commit, push or deployment occurred. This is a native synthetic-fixture evaluation; broader acceptance, multi-turn continuity and real-data readiness remain unproven.
