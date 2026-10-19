# Minimal analyst handoff — paid evaluation, 9 October 2026

One fresh authorized repeat on workflow **1.0.15** returned a **verified numerical partial answer**, an immutable checkpoint and **nine downloads**. First verified answer: **403.855 seconds**. Total request: **824.293 seconds** (13m 44s), SDK-estimated **USD 0.0963762**, with complete usage accounting.

The analyst handoff change worked in this run: after two calculation revisions, all five tools were removed, the model returned one actual 65-claim final JSON response, and the package passed without a format repair. There were no preflight calls or post-transition analyst tool attempts. Presentation remained unapproved because the visual verifier twice omitted the exact checkpoint JSON from its executed read provenance, exhausting its single format repair. Verified numerical delivery survived that later failure.

## Setup and authorization

The user explicitly requested another paid evaluation of the same difficult Lighting & Candles prompt after local AH-01–AH-03 validation. The configured dry run confirmed exactly one selected message:

> Review how Lighting & Candles performed over the last five complete quarters.

`npm run eval:configured` ran once from `pricing-harness/`, with **openai/gpt-6-luna / high** as the existing evaluation override. Saved application configuration stayed **deepseek/deepseek-v4.1-flash / high**. No fallback or evaluator recovery prompt was submitted.

Limits remained **1,200 seconds total / 360-second finalization reserve, 100 model calls / 150 tool calls**, **two shared analyst revisions**, **four shared format repairs with at most one per stage**, and **one shared correction**. Batch limits remained **1,800 seconds / USD1**, with zero automatic recovery messages.

Before launch, all 11 source/compiled/config fingerprints from local validation matched, all 33 available server source/output timestamp pairs were current, and 69 compiled files were inventoried. No rebuild or test suite was needed or run. The 370-file baseline and saved configuration were captured before execution.

Automatic approval review initially rejected process creation because it could not confirm private-payload authorization. No evaluation process or paid request began from that attempt. A read-only audit established the exact 24-file fixture payload: fictional Northbridge company material and public Online Retail II-derived history, with Kaggle/UCI attribution. The same command was accepted with that provenance and the current user authorization. Credentials, evaluator controls, historical responses and unrelated workspaces were excluded. The authorization audit is retained; this did not add a second evaluation submission.

Fresh workspace: `/private/tmp/pricing-focused-2026-10-09T08-19-33.712Z-80198182/lighting`. Its pre-turn state contained only fixture files and the configured context/index, with no prior conversations, runs, scripts or evaluator answers.

## Timing, usage and delivery

| Stage | Seconds | Model calls | Tool debits | SDK USD | Outcome |
| --- | ---: | ---: | ---: | ---: | --- |
| Coordinator | 26.390 | 2 | 1 | 0.001792140 | Plan accepted |
| Analyst | 250.127 | 19 | 25 | 0.031545540 | 65-claim final package accepted |
| Numerical verifier | 125.421 | 14 | 19 | 0.014437355 | 57 approved facts; 8 holds; all three numerical tasks completed |
| Visualizer | 180.013 | 19 | 31 | 0.020120935 | Three charts; two renders and previews |
| Visual verifier | 239.164 | 22 | 36 | 0.028480230 | Exact checkpoint-read requirement failed twice |
| **Whole request** | **824.293** | **76** | **112** | **0.096376200** | **Verified partial; nine downloads; no approved report** |

Batch wall time, including setup/archive: 826.563 seconds. Final public response: 245 words, saved in full in `responses.md` and the raw result. Numerical answer persisted at 403.855 seconds, before presentation began. Published files include analyst/verifier code, quarterly and five-quarter CSVs, quality/UOM/missing-cost diagnostics, numerical execution output and provenance. The rendered HTML and chart figures remain draft evidence rather than approved downloads.

Counters: two analyst revisions, one format repair (visual verifier), one correction debit (the visualizer's second render), two renders and two previews; zero provider retries. The single correction debit was not a numerical correction. At stop, 375.958 seconds, 24 model calls and 38 tool debits remained. The per-stage format-repair ceiling caused the terminal rejection.

All 76 usage records reconcile to SDK USD0.0963762. Token totals: input 228; output 77,023; cache read 2,479,015; cache write 264,414; total 2,820,680. Peak input including cache: 69,535.

## Handoff and presentation diagnosis

The analyst's initial calculation succeeded after two failed attempts. The first revision failed; the second succeeded. The saved SDK transcript then records removal of `read`, `write`, `edit`, `bash` and `execute_analysis`, followed by the schema/inventory steer and one final assistant JSON response. The installed SDK's `getCurrentTools` resolves that transcript to an empty tool list. No analyst `validate_handoff` call, late tool call or final-format repair occurred. Controller-owned canonicalization and numerical verification proceeded normally.

The visual verifier executed two successful comparison scripts. The latest script read all three figures, the sealed quarterly CSV inside the checkpoint directory and the captures, and recomputed raw-source values. It did **not** open the checkpoint's `checkpoint.json`. The existing guard at `src/agent/workflow/render-tools.ts:37` requires that exact JSON path in the latest successful execution's `accessed` records. Reading a CSV from the same checkpoint directory does not meet that requirement.

The machine audit confirms the missing JSON read is the rejecting condition: all required figures were recorded and every checked checkpoint/provenance/accessed-file hash remained stable. The first rejection and its single repaired attempt both report `Visual comparison lacks recorded figure/checkpoint reads`. No application fix or acceptance relaxation was applied during this evaluation.

The model attempted visual approval, but the harness rejected it; **there is no accepted visual-verifier result or published approved report**. The final response retains an earlier stage-scoped statement that no chart capture was supplied for its numerical review, followed by the presentation-incomplete notice. That wording should not be mistaken for absence of draft captures later in the run.

## Independent review

Evaluator calculations reread the original full source population through separate DuckDB SQL, outside the model workspace. They did not execute generated analyst/verifier code or reuse its figures as expected answers.

- **93/93 selected draft comparisons pass**: quarterly and five-quarter figures, movements, endpoint changes and holds.
- **65/65 submitted-claim comparisons pass**, including eight correct null holds. Percentage/percentage-point claims use their four-decimal rounding tolerance; unrounded result comparisons use 1e-7 absolute tolerance with small relative floating-point tolerance.
- **53/53 selected chart-data comparisons pass**: quarter order, values, hover source counts and changes, and unavailable-margin gaps.
- **Six source checks pass**: line arithmetic, product uniqueness, scoped count, unique effective cost match, GBP/EA basis and the 53 missing-cost observations.
- **96 configuration/usage/source/checkpoint integrity checks pass**. All 370 preexisting baseline files and 69 compiled files match before reporting; all 24 workspace fixture inputs retain their hashes.
- **105 archived generated/output files match** the live workspace. Nine published downloads exist. Evaluator helper/control paths do not appear in observed model tool arguments.

| Quarter | Signed revenue GBP | Invoice margin amount GBP | Weighted invoice margin |
| --- | ---: | ---: | ---: |
| Q3 2010 | 167,950.37 | 60,611.9343 | 36.0892% |
| Q4 2010 | 331,019.82 | 161,618.8327 | 48.8245% |
| Q1 2011 | 134,150.38 | 59,122.6873 | 44.0719% |
| Q2 2011 | 143,067.02 | 54,770.7555 | 38.2833% |
| Q3 2011 | 154,877.51 | Held | Held |

Full window: GBP931,065.10, 494,476 signed EA and 41,684 sales observations. Q3 2011 revenue rose 8.2552% versus Q2 and fell 7.7838% versus Q3 2010. The 53 missing-cost observations correctly keep Q3 2011 and complete five-quarter cost-derived margin measures unavailable. The fictional cost estimates, pre-adjustment margin basis and blank-master-UOM reliance on confirmed EA context are disclosed.

Six latest chart captures were independently inspected: desktop and 390px versions of revenue, units and stacked margin amount/rate panels. The charts provide complementary views and mark Q3 2011 margin unavailable. Axes and units are visible; mobile quarter labels are densely packed, especially in the margin panel. This is a remaining presentation limitation, not broad mobile acceptance. Captures and observations are fingerprinted in `independent-visual-review.json`.

The review helpers initially compared some serialized decimal strings as text. Those representation-only mismatches were corrected to numerical comparison; initial helper outputs are retained separately. They were not model arithmetic failures.

## Comparison and verdict

| Run | Total seconds | SDK USD | Verified delivery |
| --- | ---: | ---: | --- |
| Previous 1.0.14 preflight failure | 316.545 | 0.044143640 | None |
| Earlier presentation-path failure | 547.752 | 0.069235125 | Numerical partial at 397.929s; eight downloads |
| **Current 1.0.15** | **824.293** | **0.096376200** | **Numerical partial at 403.855s; nine downloads; visual approval blocked** |

Removing preflight restored real analytical submission and verified numerical delivery in this single run. Presentation remains incomplete. Total time and cost increased versus both comparison runs; first verified delivery is 5.926 seconds later than the earlier numerical-partial run. Reliability across repeated runs remains unestablished. No additional prompt, recovery, fallback, full suite, code/settings change, commit, push or deployment followed.

## Evidence

- Raw live evidence: `.cache/configured-agent-evaluations/2026-10-09T08-19-33.712Z-80198182/` — manifest/settings, pre-turn inventory, complete result/snapshot/events/sessions, generated code, figures, captures, outputs and workflow state.
- Independent evidence: `.cache/minimal-handoff-live-2026-10-09T08-18-34Z-ff92a22b/` — readiness/baselines, payload authorization audit, dry run/paid console, fresh raw controls, source/claim/draft/chart reviews, SDK transition audit, rejection diagnosis, complete stage/public responses, integrity and preservation results.
- Local implementation: [minimal-analyst-handoff-local-validation-2026-10-09.md](minimal-analyst-handoff-local-validation-2026-10-09.md).
- Comparisons: [presentation-path-live-evaluation-2026-10-09.md](presentation-path-live-evaluation-2026-10-09.md), [execution-identity-fix-live-evaluation-2026-10-09.md](execution-identity-fix-live-evaluation-2026-10-09.md).
