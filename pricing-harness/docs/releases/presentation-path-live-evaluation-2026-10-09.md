# Presentation-repair live evaluation — 9 October 2026

One fresh authorized paid evaluation on workflow **1.0.14** stopped with **no verified answer** after **316.545 seconds**, SDK-estimated **USD 0.044143640**. The analyst calculated a correct quarterly draft but repeatedly preflighted placeholder claims instead of submitting its analytical package. The configured no-progress guard stopped it before numerical verification. No checkpoint, downloadable artifact, rendered chart or visual-verifier result was delivered. This run does not establish whether the presentation repair works live.

## Setup and constraints

Read `PROJECT_GUIDE.md` and `path-handoff-repair-2026-10-09.md`. The current build was ready: all 12 presentation-repair files matched the previously verified build; 32 server source/output checks found no stale files, and the UI build was current. The preceding repair phase passed 91 focused checks, typecheck and build. No rebuild or full suite was needed or run in this evaluation.

`npm run eval:configured -- --dry-run` selected exactly one message:

> Review how Lighting & Candles performed over the last five complete quarters.

Then `npm run eval:configured` was executed **exactly once** from `pricing-harness/`. OpenRouter fixture/document/calculation transmission and the paid test were explicitly authorized. Effective evaluation model was **openai/gpt-6-luna, high reasoning**; saved app model remained **deepseek/deepseek-v4.1-flash, high**. No fallback or recovery prompt was submitted.

Confirmed request limits: **1,200 seconds total, 360-second finalisation reserve, 100 model calls, 150 tool calls; two shared analyst revisions; four shared final-format repairs, at most one per stage; one numerical correction**. Batch limits remained **1,800 seconds / USD 1**, with zero automatic recovery messages. The old manifest identifier still says “ten-minutes”; the recorded effective configuration has the 1,200-second limits above.

Fresh workspace: `/private/tmp/pricing-focused-2026-10-09T06-26-07.362Z-49f3a925/lighting`. Its pre-turn state contained only 24 fixture/company files and two context/index files, with no prior runs/messages/scripts/responses/evaluator answers. Independent controls stayed outside that workspace.

## Outcome, timing and usage

| Stage | Seconds | Model calls | Tool debits | SDK USD | Outcome |
| --- | ---: | ---: | ---: | ---: | --- |
| Coordinator | 19.021 | 2 | 2 | 0.001805775 | Plan completed |
| Analyst | 296.314 | 32 | 60 | 0.042337865 | No-progress stop before final package |
| Numerical verifier / visualizer / visual verifier | Not reached | 0 | 0 | 0 | Unproven |
| Whole request | **316.545** | **34** | **62** | **0.044143640** | **No verified answer** |

Batch wall time was 318.847 seconds including setup/archive. First verified answer: none. Usage is complete; all 34 SDK usage records reconcile exactly to the reported cost. Tokens: input 102, output 35,475, cache read 1,031,119, cache write 128,678, total 1,195,374; peak input including cache 62,156.

Counters: two analyst revisions; zero provider retries, numerical corrections, final-format repairs, renders or previews. Four failed generated-script executions preceded the initial success, followed by two successful revisions: seven execution attempts, three recorded successes. Initial failures do not decrement the revision allowance before a first success. Other temporary errors included missing shell `python` and a reserved SQL alias. The model corrected these within the original turn; no evaluator recovery was sent.

Final generated analyst script: **287 lines / 20,787 bytes**, SHA-256 `bb5528a34e79efeabb8b5e690b9a04acd1aef61498a87b4ddd8810328d05f7bd`; it matches the last recorded successful execution. No verifier/presentation scripts were generated.

Stop reason: `no progress: 3 identical operation/result pairs`. At stop, **883.641 seconds, 66 model calls and 88 tool debits** remained. Neither elapsed time, money, finalisation reserve nor the final-format repair cap caused this failure.

Complete public response, 15 words:

> I could not independently verify an answer within this request. Retained analysis files are drafts.

## Handoff/preflight diagnosis

After the second revision, handoff mode correctly restricted the analyst to `validate_handoff`. The saved model session contains ten preflight requests/results:

1. Empty arguments: rejected for missing `candidate`.
2. Empty `claims`, `code`, `results`: rejected by schema.
3. `{schemaVersion: 1, blockingInput: "x"}`: packaging-valid blocking branch.
4. Seven copies of a single placeholder claim, `id: "foo", label: "bar", value: 1, unit: "x"`, referencing the existing script/quarterly CSV: packaging-valid.

The model used these as schema probes and never returned actual analytical claims as final JSON. `valid: true` proves only packaging/path/execution eligibility; it never approves the dummy value or any arithmetic. The blocking probe was likewise never delivered as a genuine user question.

The controller stopped on the third identical placeholder operation/result. Its event log retains five preflight events, including two placeholder successes; `stage-runner.ts` observes an event before persisting it, so the triggering third event is absent from that log. Saved session records preserve all ten preflight calls/results, including additional calls in the final batch. There are **64 session tool requests/results versus 62 controller tool debits**; the two schema-invalid calls account for the difference in these totals. Both are below 150. Preserve both records when assessing tool activity rather than silently equating these counts.

No final analyst package reached `finishHandoff`, so its bounded final-format repair was never used. The no-progress guard prevented a loop as configured; the actionable gap is the transition from successful preflight to final analytical submission. A future focused fix should make the successful checked package lead directly to final submission and discourage placeholder/probing batches, while preserving independent numerical verification. Raising budgets or weakening the guard would not address this evidence.

## Independent numerical and integrity review

Fresh evaluator-only DuckDB calculations read the original full source files, without executing the generated analyst script or treating its results as expected answers. **334/334 selected comparisons pass** across quarterly CSV/JSON, quarter-to-quarter movements, totals, endpoint changes, covered-subset figures and cost-coverage counts. **Six source checks pass**: source line-value arithmetic, deduplicated product uniqueness, scoped row count, unique effective historical cost match per row, GBP/EA cost basis and 53 blank-cost observations. This is independent draft review, not a model-verifier approval or delivered answer.

| Quarter | Signed invoice revenue GBP | Invoice gross profit GBP | Weighted invoice margin |
| --- | ---: | ---: | ---: |
| Q3 2010 | 167,950.37 | 60,611.9343 | 36.0892% |
| Q4 2010 | 331,019.82 | 161,618.8327 | 48.8245% |
| Q1 2011 | 134,150.38 | 59,122.6873 | 44.0719% |
| Q2 2011 | 143,067.02 | 54,770.7555 | 38.2833% |
| Q3 2011 | 154,877.51 | Held | Held |

Full window: **GBP 931,065.10**, **494,476 signed units**, **41,684 sales rows**. Q3 2011 revenue is 8.2552% above Q2 and 7.7838% below Q3 2010. Its 53 blank-cost rows carry GBP 163.33 / 322 units. The remaining cost-covered Q3 subset has GP GBP 63,447.6528 and margin 41.0096%; these are **subset metrics**, not whole-quarter results. Full-quarter and five-quarter cost-derived profit/margin remain held. The confirmed fixture context supplies the EA selling-unit definition; the source master also contains a null selling-unit label for SKU 85123A, retained in the generated diagnostics. No source was rewritten to resolve it.

An intermediate draft mistakenly counted five quarters as five merchandise rows in its total row; the final allowed analyst revision corrected it to 41,684. It is not a final draft failure. Comparisons use unrounded controls with 1e-7 absolute tolerance and small relative floating-point tolerance. No actual claim package or verifier-approved claim list exists in this run.

**62 integrity/configuration checks and 67 supplemental archive/exclusion/comparison checks pass.** All 24 original and workspace source files retain their pre-turn hashes; all 67 compiled files retain their launch hashes. All 362 preexisting repository files retained their baseline hashes during the evaluation. Only this report and the authorized subsequent guide update were added/changed for reporting. Archived analysis files match the fresh workspace. Independent helper paths/controls do not appear in observed model tool arguments.

No rendering or preview occurred. Desktop and 390px chart inspection is therefore **unavailable, not passed**. Earlier mobile clipping/overlap and shared-render-correction risks remain unresolved; this run never reached those paths.

## Comparison and verdict

| Run | Seconds | SDK USD | Verified delivery |
| --- | ---: | ---: | --- |
| Original handoff failure | 241.932 | 0.033255105 | None |
| Previous numerical-identity failure | 653.699 | 0.067889980 | None |
| Previous presentation-path failure | 547.752 | 0.069235125 | Numerical partial at 397.929s; checkpoint/eight downloads; no approved report |
| **Current 1.0.14 test** | **316.545** | **0.044143640** | **None; stopped in analyst preflight** |

Against the requested 241.932-second baseline, this run is **74.613 seconds slower (30.84%)** and **USD 0.010888535 more expensive (32.74%)**, still with no verified delivery. It is faster/cheaper than the most recent partial run only because it fails earlier and delivers less. **This is not improvement.** The presentation repair remains locally verified and live-unproven. No code/settings change, additional prompt, fallback, full suite, commit, push or deployment followed this failed run.

## Evidence

- Raw unique live evidence: `.cache/configured-agent-evaluations/2026-10-09T06-26-07.362Z-49f3a925/` — manifest, effective settings/config, pre-turn state, final result, workflow, complete raw sessions/events, generated scripts/outputs/provenance.
- Independent unique evidence: `.cache/presentation-live-2026-10-09T06-25-45.704899Z/` — baseline/build readiness/preflight, console log, fresh raw controls, `audit.json`, `calculation-review.json`, `independent-source-checks.json`, `supplemental-review.json`, complete public assistant/tool records, `stage-responses.md`, `responses.md`, final preservation and evidence hashes.
- Prior repair: `presentation-path-repair-2026-10-09.md`; prior partial: `execution-identity-fix-live-evaluation-2026-10-09.md`; original comparison: `verifier-repair-twenty-minute-evaluation-2026-10-09.md`.
