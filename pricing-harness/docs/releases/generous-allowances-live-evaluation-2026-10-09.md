# Generous-allowance Lighting & Candles rerun — 9 October 2026

The workflow **did not complete end to end**. One newly authorized paid submission returned a verified numerical partial and six evidence downloads. It repaired chart layout but exhausted three final visual-handoff repairs on an object-comparison mismatch. More allowances exposed a specific validation-contract defect; they did not resolve it.

## Scope and configuration

Exact unchanged prompt: `Review how Lighting & Candles performed over the last five complete quarters.` One fresh source-only workspace, same 24 original fixture inputs and confirmed fictional context, OpenRouter `openai/gpt-6-luna` / high. Saved app DeepSeek/high settings remain unchanged. No fallback, recovery submission, full suite, commit, push or deployment.

The user explicitly approved making the per-stage repair ceiling configurable. Workflow 1.0.16 adds optional `workflow.policy.handoffRepairPerStage`, accepting nonnegative integers, defaulting to one. The worker passes it to the existing final-JSON repair loop; each attempt still debits the shared repair budget. Cancellation/provider read errors still escape without repair, and evidence guards remain unchanged. Only settings.ts, handoff.ts, worker.ts, versions.json and their two focused test files changed before the run.

| Allowance | Saved/default | Temporary experiment |
|---|---:|---:|
| Analysis/report deadline | 1200s | 2400s |
| Finalization reserve | 360s | 720s |
| Model attempts / tools | 100 / 150 | 200 / 300 |
| Analyst revisions | 2 | 4 |
| Shared / per-stage format repairs | 4 / 1 | 12 / 3 |
| Corrections | 1 | 3 |
| Renders / previews | 2 / 2 | 4 / 4 |
| Batch seconds / estimated USD | 1800 / 1 | 3600 / 2 |

Provider retry one, no-progress three and maximum analysis groups three were preserved. Quick limits were unchanged. Temporary config is in the independent evidence folder; saved `harness.config.json` and `.env` hashes are unchanged. The batch cost check runs before each turn, not as an intrarequest billing hard stop.

## Result

| Measure | Prior 1.0.15 run | Generous 1.0.16 run |
|---|---:|---:|
| Outcome | verified-partial | verified-partial |
| Elapsed | 824.293s | 1129.734s |
| First verified numerical answer | 403.855s | 381.91s |
| SDK USD | 0.0963762 | 0.14193856 |
| Model calls / tools | 76 / 112 | 108 / 195 |
| Shared repairs / corrections | 1 / 1 | 3 / 3 |
| Renders / previews | 2 / 2 | 4 / 4 |
| Analyst revisions | 2 | 1 |
| Approved / held claims | 57 / 8 | 28 / 9 |
| Published evidence downloads | 9 | 6 |
| Published report/charts | 0 | 0 |

SDK usage is complete and reconciles across 108 records. Final remaining allowances: 1270.525s, 92 model attempts and 105 tools. No provider retry. Analyst delivered final JSON with no preflight or format repair after two successful executions, using one revision. Numerical verifier completed task T1, approved 28 claims and correctly held nine unavailable complete-population cost/margin values. Different claim counts reflect different generated packaging, not changed numerical truth.

First visual verifier independently caught clipped narrow titles and requested correction. The correction stage shortened titles and improved annotations across two more renders. The final visual verifier initially omitted the exact checkpoint read, then repaired provenance. Its remaining three rejections were `Chart and verified values/population/units disagree`; after the fourth rejected candidate, the configured three-repair stage ceiling stopped the run.

## Confirmed failure

`src/agent/workflow/output-contract.ts:22` permits unknown actual/expected types in visual comparisons. `src/agent/workflow/render-tools.ts:29` compares nested arrays and numeric scalars, but uses identity equality for objects. The final execution supplied separate objects such as `{x:[...],y:[...]}` for actual and expected. All four objects match deeply within tolerance; parsed objects nevertheless fail identity equality. This is a schema/comparison contract mismatch, not a discrepancy in the independently checked chart numbers.

A read-only replay through the compiled production validator reproduces the exact rejection with the real presentation, latest execution, hashes, recorded reads and checkpoint. A separate synthetic fixture rejects equal objects but accepts equivalent nested arrays. This diagnosis modifies neither product code nor live evidence and does not grant workflow approval. Recommended follow-up is a focused contract/comparator repair with a regression test; no such fix or extra paid replay was performed here.

## Independent verification and preservation

- TDD red: five new checks fail against the old hardcoded limit/settings parser. Green: 71 focused tests across eight files; typecheck, build and configured temporary dry run pass. Dry run plans exactly one prompt.
- Six raw-source DuckDB checks pass over 1,067,371 sales observations, including all 41,684 scoped lines and the 53 missing-cost observations.
- Calculation result comparisons 64/64; analyst claims 37/37 including nine nulls; final figure data 34/34. GBP931,065.10 signed revenue and 494,476 EA reconcile; missing costs are not imputed. Scenario costs remain explicitly synthetic and margin excludes off-invoice adjustments/service expenses.
- Independent visual review inspected eight final chart captures plus both full-page captures. Final narrow margin titles/annotations fit; a desktop units-chart crop partly obscures its title while the full-page capture shows it intact. Wide table requires horizontal access on narrow screens. Visual approval remains blocked despite improved draft charts.
- Integrity/config/input checks 93/93; all six published downloads match workspace and archived hashes; all 162 archived analysis files match workspace. All 371 baseline files, except the six authorized implementation files, were preserved; all baseline files were unchanged during the paid run, including settings and credentials. All 69 compiled files and all 24 workspace inputs are unchanged.
- Evaluator controls and old scripts stayed outside the model workspace. Full model responses, sessions, events, attempted repairs and all draft previews are preserved. The numerical response retains a stale sentence saying no chart capture was available; final system text correctly labels presentation incomplete.

## Evidence

- Raw evaluation: `.cache/configured-agent-evaluations/2026-10-09T08-47-25.210Z-ebd49559/`
- Independent verification: `.cache/generous-allowances-live-2026-10-09T08-43-40Z-41a95287/`
- Fresh model workspace: `/private/tmp/pricing-focused-2026-10-09T08-47-25.210Z-ebd49559/lighting`
- Product run: `577ff249-01f9-469a-8537-a8a3ed2b482e`
- Key files: experiment-config.json, dry-run.log, focused-tests.log, typecheck.log, build.log, audit.json, calculation-review.json, claim-review.json, chart-data-review.json, artifact-integrity.json, visual-object-comparison-audit.json, visual-gate-replay.json and responses.md.

This single exploratory run shows the larger limits enabled more correction/verification work, exceeding the saved model/tool/render/correction caps. It does not establish reliable completion or isolate the causal effect of each allowance. Stop after evidence/reporting; another live run requires new authorization.
