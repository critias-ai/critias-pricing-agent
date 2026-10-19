# Minimal fact handoff repair — 8 October 2026

Implemented workflow **1.0.11** with scalar numerical candidates, controller-owned verification metadata, stage-relative evidence paths and one format repair per stage under a four-repair request cap. Local checks and saved-evidence replay pass. One fresh live Luna/high test progressed through an analyst handoff, a targeted correction and the corrected handoff, but the final verifier timed out. **No verified answer, numerical checkpoint or chart was published.**

## Minimal implementation

The existing modules handle the change; no new product module, agent layer or analytical query library was introduced.

- New analyst claims contain a number, null for an unavailable measure, or a string array for a ranked cohort. A label identifies the period/population; narrative remains in coverage/holds and evidence files. Internal legacy checkpoint values remain readable.
- The verifier supplies its reply, recorded execution ID and task-completion IDs. The controller derives schema version, approvals and held IDs from its executed checks. Duplicated producer approval/hold prose does not govern publication. Held reasons are retained in checkpoint coverage.
- Harmless additional top-level numerical-check diagnostics are tolerated. Individual comparisons remain typed, source-backed and subject to numerical disagreement checks. Arbitrary table values do not become approved scalar facts.
- Analyst file paths resolve from the workspace, stage or run directory, retaining canonical paths, escape checks and recorded script/output hashes.
- Each stage may make one format repair. `workflow.policy.handoffRepair: 4` is the configurable whole-request cap; repairs still consume the shared time/model/tool budgets. Numerical corrections remain separately capped at one.

The analyst and verifier role prompts are **67 and 64 words**, respectively. Both remain below the existing 80-word limit; the shared prompt is 62 words. Brief transport examples live in the existing data helper guide, not a predefined analytical query library.

Relevant files: `src/agent/workflow/{output-contract.ts,handoff.ts,checkpoints.ts,budget.ts,role-prompts.ts}`, `bundled/harness-tools/data-analysis.md`, `bundled/versions.json`, and `harness.config.json`.

Saved app model remains **deepseek/deepseek-v4.1-flash/high**. The evaluation overrides it with **openai/gpt-6-luna/high**. Both analysis/report classes retain **600 seconds, a 180-second reserve, 100 model calls and 150 tool calls**. Two shared analyst revisions and the existing numerical correction/render/preview caps remain unchanged. No commit, push or deployment occurred.

## Local verification

Test-first reproductions failed on prose candidates, exhausted stage repair, stage-relative evidence paths and duplicated verifier metadata before implementation. The approval-of-null regression now falsifies the authoritative executed check instead of the ignored producer approval list.

Final checks:

- **69 focused tests in 12 files**, covering handoffs/checkpoints/budgets/settings/revisions, scope/continuity, correction, cancellation, runner limits and rendering gates;
- **one affected browser test**, exercising checked partial persistence, reconnect and a follow-up;
- typecheck and updated app build;
- no-paid configured evaluation preview.

No full suite, dependency changes or scale benchmark ran.

Saved-case replay used the previous failed 150-tool run in a clone. The old prose package is intentionally rejected as a new numerical candidate. Its saved analyst numbers and independently recomputed CSV/Decimal results were repackaged into **78 scalar facts: 73 approvals and five legitimate missing-cost holds**. Independent raw-source calculations were rerun in the clone; it was not automatic approval of old prose. The verifier's format repair succeeded after an earlier analyst repair, consuming two shared repairs. Deliberately wrong numerical values and changed raw sources were rejected; original evidence hashes remained unchanged. The replay made zero paid calls.

Replay implementation: `.scratch/fact-handoff/replay.mjs`. Final replay evidence: `.cache/fact-handoff-replay-2026-10-08/2026-10-08T21-45-14.933Z/`. An earlier local replay included baseline-quarter unavailable movement fields; those were removed from the final replay to keep its holds specifically tied to missing costs.

## One fresh live test

Prompt:

> Review how Lighting & Candles performed over the last five complete quarters.

Exactly one paid submission ran in a fresh source-only workspace, with identical confirmed context/source inputs. Old analysis code and evaluator control files were excluded, but the new transport-guide example repeated one real fixture value; see the evaluation confound below. Native execution is exploratory evidence, not operating-system isolation.

| Measure | Before: 1.0.10 / 150 tools | After: 1.0.11 / 150 tools |
|---|---:|---:|
| Request duration | 278.726s | **602.264s** |
| SDK-estimated cost | $0.034818360 | **$0.089127705** |
| Model / tool calls | 31 / 40 | **67 / 82** |
| Initial analyst script lines / bytes | 174 / 13,559 | **173 / 16,214** |
| Corrected analyst script lines / bytes | None | **183 / 16,854** |
| Shared revisions / handoff repairs / corrections | 2 / 1 / 0 | **2 / 2 / 1** |
| Public response words | 18 | **17** |
| Verified answers / charts | 0 / 0 | **0 / 0** |
| Stop reason | Shared handoff repair exhausted | **Deadline exhausted** |

The run took 2.16 times as long and cost 2.56 times as much. It progressed past the earlier request-wide repair failure but did not deliver the requested answer. This is not a quality improvement in delivered output. These single-run observations do not isolate causality: generated code, work orders and model behavior also differed. The response is a failure notice, so its shorter length is not a useful improvement.

No time to first verified answer exists. No chart was generated, preventing numerical/render/layout inspection. Live multi-turn continuity was not exercised; the browser fixture establishes transport behavior only.

## Stage behavior

| Stage | Seconds | Model / tool calls | SDK cost |
|---|---:|---:|---:|
| Coordinator | 14.664 | 2 / 1 | $0.001343065 |
| Initial analyst and format repair | 332.737 | 37 / 44 | $0.053824035 |
| Numerical verifier: targeted correction | 94.411 | 12 / 16 | $0.012880110 |
| Analyst correction and format repair | 99.244 | 8 / 10 | $0.012737495 |
| Final numerical verifier | 58.335 | 8 / 11 | $0.008343000 |

The coordinator supplied one combined operation covering eligibility/cost checks, quarterly metrics and sequential/first-to-last movements. The initial analyst encountered four failed execution attempts before first success, reserved SQL aliases and ambiguous edit matches. It completed initial execution plus two successful revisions. An intermediate draft held excess margins due to a blank master selling-unit field; the final table correctly applied the confirmed EA basis.

The first output package put an execution-description sentence in the evidence inventory. Its one stage repair corrected paths but returned only **12 claims**, omitting supported margin and movement claims. Its optional `analysis_results.json` still contained `NaN`, so that JSON was excluded as evidence; the CSV remained usable and the package reached verification.

The verifier identified both incomplete claim coverage and invalid JSON, requested a targeted analyst correction and returned provisional task metadata. No approvals or checkpoint were published. The correction stage copied compatible analysis code into its own directory, fixed JSON null serialization and the endpoint SQL condition, executed successfully and produced **40 scalar claims**. Its first envelope appended text after JSON; one local format repair fixed it. The corrected package was accepted. Two different analyst stages therefore used one repair each without exhausting the shared four-repair allowance. Original files stayed read-only.

The final verifier had only about 56 seconds left before the deadline. Its first independent execution failed on the reserved alias `types`; its next execution failed because persistent DuckDB view `s` already existed. It was editing the rerunnable script when cancellation occurred. Neither attempt completed an independent verification record. The recorded abort is deadline cancellation, not a provider connection failure. There were no provider retries.

The request stopped at the 600-second limit plus approximately two seconds of bounded cancellation grace, with **33 model calls and 68 tools remaining**. A numerical checkpoint could not be sealed, so no partial numerical answer was published. No further paid submission or post-run product tuning occurred.

## Independent calculations and remaining failures

Evaluator controls were freshly recomputed from raw sources without running/importing either agent's analysis code. The initial final draft passed **123/124 comparisons**: its endpoint result was absent. That package also had incomplete claim coverage and separately recorded invalid JSON. The corrected draft passed **166/166 comparisons**, including **all 40 claim values**, quarterly totals, cost coverage, sequential movements and endpoint figures. Corrected JSON is valid. This is evaluator confirmation of drafts, not successful product verification or delivery.

The correct population is **41,684 observations and 494,476 signed units**, with **£931,065.10** revenue across the five quarters. Revenue from Q3 2010 to Q3 2011 falls **£13,072.86 / 7.78%**, and signed units fall **22,915 / 21.27%**. Complete-scope Q3 2011 gross profit/margin and corresponding movements remain unavailable because **53 observations for 84596L have a blank applicable cost**. No missing cost was substituted with zero. Earlier-quarter supported gross profit and weighted margins reconcile.

Recorded integrity checks passed **62/62**: source/workspace hashes, fresh inputs, excluded evaluator controls, exact model/settings, unchanged compiled files, recorded scripts, revision cap, complete 67-record SDK usage and cost reconciliation. Peak input plus cache was 101,267 tokens. Costs are SDK estimates, not billing guarantees.

Remaining failures are late/incomplete packaging, slow generated-script repairs, and non-rerunnable verifier SQL. The previous table-versus-prose comparison failure did not recur in an accepted new candidate, but a complete live approval/checkpoint with the new fact protocol remains unproven. All five stages consumed the same request budget. The final verifier needs successful independent execution; correct evaluator results do not justify bypassing it.

Complete public response:

> I could not independently verify an answer within this request: deadline exhausted. Retained analysis files are drafts.

## Evidence

Evidence: `.cache/configured-agent-evaluations/2026-10-08T21-45-54.307Z-92a64b03/`. It preserves complete sessions, all returned packages/corrections, raw execution/provenance records, source/config snapshots and public response. `evaluator/quality-review.json` records 290 comparisons (289 pass across initial/corrected drafts, with completeness/serialization limitations disclosed separately); `integrity.json` records the 62 checks. Run: `d646b52d-6b26-4077-abe6-86067cfbfb92`.

### Evaluation confound caught in final review

The new transport-guide example inadvertently used `q3_2010_revenue: 167950.37`, the real first-quarter Lighting fixture total. The analyst read this guide during the live run. Although no evaluator control files or previous scripts were seeded and the resulting calculations were separately recomputed, that example supplied one expected value. **This run is not an answer-blind performance evaluation.** The 62 recorded integrity checks verify file exclusion and sources; they do not establish that example text was free of expected values.

After the run, the example was replaced with fictional `quarter_a_revenue: 123.45` in both producer/check examples. This was a guidance-only correction; compiled application code is unchanged. Original live evidence was retained, and no additional paid run was made. Fresh live delivery and performance with generic guidance remain unproven.

The previous 150-tool comparison remains in `luna-high-150-tools-evaluation-2026-10-08.md`; its completed and interrupted evidence is unchanged. No additional live call was made in this phase.
