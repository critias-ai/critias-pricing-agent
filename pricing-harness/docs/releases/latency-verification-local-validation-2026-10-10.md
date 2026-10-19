# Latency and verification routing — local validation, 10 October 2026

Workflow **2.2.0**. Implements `docs/superpowers/plans/2026-10-10-latency-and-verification.md` (Tasks 0–15) on branch `perf/latency-verification`. Apart from two authorized live runs (see "Live check" and "Second live run"), nothing in this validation called a model: the checks are unit and integration tests with fake runners, the Python helper tests, the build and the offline browser fixture. The live run is a single stochastic observation: **a latency improvement is not established**, and it exposed a delivery-text regression described below.

## Delivered behaviour

1. **Event log.** `events.jsonl` is written through a serialized `EventLog`: concurrent large appends no longer interleave lines (the old log was corrupted at character 524,290), string values are truncated at 8,000 characters and configured secrets are redacted.
2. **TypeScript hashing.** `hashFile` reuses a content hash while device, inode, size, mtime and ctime are unchanged; touch-and-restore and rename-replace edits still force a fresh hash.
3. **Python hashing.** `prepare_source` reuses a source hash through `cached_source_hash` (a `.hash-index` under the cache root); cache hits no longer rehash the source. They also no longer open it, so an execution served from the cache records no read of the raw file; item 16 removes the requirement that it did.
4. **Timing.** Each model request records gate wait, time to first token, generation time, output tokens and tokens per second as a `model_timing` event; stage metrics aggregate it; `scripts/latency-report.mjs` summarizes one run per role.
5. **Source profiles (Python).** `profile_prepared` and `profile_source.py` produce cached, facts-only column profiles for CSV and every Excel sheet (up to 200 columns, 10 sheets).
6. **Profiles in prompts.** Every stage prompt carries `sourceProfiles`, compacted to a size budget. A failed profile is recorded and never blocks analysis.
7. **Planner read policy.** The coordinator cannot read tabular files (`.csv .tsv .xlsx .xls .parquet .duckdb`); it plans from `sourceProfiles`.
8. **Typed views.** `create_typed_view` casts profiled columns and raises rather than let a cast turn present values into NULL.
9. **Output helper.** `harness_output.py` provides `emit_handoff` and `emit_checks`: exactly one marked JSON document, NaN/NA/NaT to null, structural validation before printing, a second emit refused.
10. **Executed handoff.** The controller reads the last marked document from script output and, when the analyst returns `{"fromExecution":true}`, builds the packet from the executed `handoff.json` (bound to the script that wrote it).
11. **Review policy.** The self-check gate reports typed triggers; `routeReview` maps them to none, note, repair, targeted, full or ask-user by configuration. Without `workflow.review`, every finding runs the full verifier as before (`legacyReviewPolicy`). `reviewReasons` accept `{kind, question, claimIds}`.
12. **Routing.** The orchestrator applies those routes: one repair turn for packaging faults (a second fault escalates to the full verifier), user questions for definitions, notes folded into coverage, and a targeted independent check of only the named claims, sealed with the self-checked remainder as one `mixed` checkpoint.
13. **Early delivery.** With `background: true`, targeted review first delivers the self-checked claims marked "Verifying…", then updates the same message in place to `mixed`, to a corrected answer with change notes, or to "could not be independently verified".
14. **Badge.** The chat shows an assurance badge (Self-checked, Verifying…, Independently verified, Partly independently verified).
15. **Checked figures.** Added after the live check (below). Self-checked and mixed messages that carry no tables now list the checkpoint's approved figures and group withheld measures by reason (`checked-figures.ts`, at most 40 lines). The early "Verifying…" message lists the self-checked remainder. Values and labels come from the sealed checkpoint, not from model prose. Verifier-written narratives are not repeated, and nothing is appended when exploration tables are attached.
16. **No source-read requirement.** Added after the second live run (below). The controller no longer requires an execution's recorded file reads to include the sources that a diagnostic, approval or hold cites, nor that every recorded file still exists unchanged (`stableRefs` over the recorded reads, and the provenance-record cross-check). Cited paths must still be known source files, scripts and outputs must be unchanged, and a verifier still cannot rerun or import analyst code; analyst and verifier numbers are still compared. The reads stay recorded as evidence and are still frozen into the checkpoint when present.

## Checks run

All commands ran from `pricing-harness/`.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Exit 0, no output |
| `npx vitest run` | 53 files, **261/261 passed** on a clean run (baseline 202: +59 tests); a second run failed only on the intermittent test below |
| `.venv/bin/python -m pytest tests/python -q` | **18 passed** (baseline 6: +12) |
| `npm run build` | Exit 0 (bundle-size warning only; not compared against a baseline build) |
| `npm run test:browser` | **6/6 passed** after one expectation update (first run: 5 passed, 1 failed; see Pinned tests); re-run 6/6 after the checked-figures change; **not re-run** after item 16, which does not touch the UI |

`tests/unit/runs.test.ts › deduplicates before hashing…` is **intermittent and pre-existing**. It sleeps a fixed 30 ms, then asserts a side effect that sits behind about ten real filesystem round trips, so it fails under full-suite load (about 1 run in 8 here). It passes 10/10 in isolation and fails identically with the original `hashFile` swapped back in. It was not changed. Three consecutive full runs after the last change gave 257/257, 256/257 (this test) and 257/257.

## Live check — one paid run

Run with `npm run eval:configured` (the `evaluation` block of `harness.config.json`): workflow 2.2.0 with the review block below, **GPT-6 Luna / high**, one message, "Review how Lighting & Candles performed over the last five complete quarters.", fresh workspace, unchanged synthetic sources and the installed context. Evidence: `.cache/configured-agent-evaluations/2026-10-10T18-26-44.458Z-9276801e/` (not tracked).

The comparison row is the final trial in `self-check-workflow-evaluation-2026-10-09.md` (workflow 2.1.1, **Luna / medium**). The thinking level differs, the generated work orders and claim sets differ, and both are single stochastic observations. This is not a benchmark.

| Measure | 2.1.1 baseline (Luna/medium) | 2.2.0 (Luna/high) |
| --- | ---: | ---: |
| Run elapsed / first verified answer | 437.2 s | **405.0 s** (single delivery) |
| Coordinator | 19.3 s | 26.8 s |
| Analyst | 231.4 s | 289.9 s + 74.3 s repair turn |
| Verifier | 183.6 s | none |
| Outside stages | 3.0 s | 13.9 s |
| Model requests / tool calls | 49 / 55 | **33 / 40** |
| Time inside model requests | 389.3 s (89.0%) | 378.1 s (93.4%) |
| Non-model time inside stages | 44.9 s | 13.0 s |
| SDK cost | USD 0.0569 | USD 0.0823 |
| Outcome / assurance | Complete, independently reviewed | Complete, **self-checked** |

Latency report for this run (`node scripts/latency-report.mjs`):

| role | wall_s | requests | first_token_s | generation_s | output_tokens | tokens_per_s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| coordinator | 26.2 | 2 | 9.8 | 16.3 | 2327 | 142.4 |
| analyst (both stages) | 363.6 | 31 | 128.2 | 223.7 | 34128 | 152.6 |

Across the run: 138.0 s waiting for first tokens (34% of wall time; mean 4.2 s per request, maximum 15.7 s), 240.0 s generating (59%) at about 152 tokens per second, 18 ms waiting at the budget gate.

**How the changes routed.**

1. `source_profiles`: 15 of 15 sources profiled without error. This is the 13.9 s before the planner started (about 11 s more than the baseline's 3.0 s outside stages). The planner made one read (a `SKILL.md`) and no tabular reads; the read block was never triggered.
2. Analyst `analyse`: 23 requests, 29 tool calls. All three executions wrote `handoff.json` through `emit_handoff`, and both analyst stages returned `{"fromExecution":true}`, so the packet was built from the executed handoff rather than restated by the model. `create_typed_view` was not used.
3. The first self-check raised one `packaging` trigger: "Diagnostic lacks recorded source access: source_row_coverage". The policy routed it to **repair**: one `analyst:correct` turn (74.3 s, 8 requests, 10 tool calls). **Correction, found after the second live run:** this was not an analyst fault. Item 3's hash reuse, with the profiling step warming the cache first, meant the two earlier executions opened no raw source file, so the recorder logged no read of any; only the repair turn's script read them, which is what satisfied the check. The repair turn and its 74.3 s were caused by that defect, not by the model.
4. The re-assessment found no triggers (`outcome: none`), so the answer was sealed **self-checked**. No verifier ran; targeted review and background delivery were not triggered, so early-delivery and in-place update were not exercised live.
5. One message was delivered at 404.99 s.

**What this does and does not show.**

- The measured gain is 7% (405.0 s against 437.2 s). That is inside the spread of the earlier trials (288 s to 437 s) and confounded by high against medium thinking, so it is not evidence of an improvement.
- Mechanically, the verifier stage (75.6 to 183.6 s in the earlier trials) was skipped and model requests fell by a third. Against that, the analyst took longer, the repair turn cost 74.3 s, the run cost 45% more, and profiling added about 11 s. The counterfactual verifier duration for this run is unknown.
- Model request time is still 93% of the run. First-token latency is a third of it, so shorter prompts and fewer requests matter more than the infrastructure changes.
- Tool failures were not reduced: 8 of 40 calls failed (5 `edit` mismatches and 3 script errors: a reserved SQL alias `quarter`, a tuple-unpack error and a `KeyError`), against 7 to 8 in the baseline. None involved the new helpers.
- Non-model time inside stages fell from 44.9 s to 13.0 s. I did not measure the cause; hash reuse and a cache already warmed by profiling are plausible but unconfirmed.
- **Accuracy of the totals.** The delivered quarterly revenue claims sum to GBP 931,065.10 and the quantity claims to 494,476 EA, equal to the evaluator-only controls recorded in the baseline note. Only those two totals were compared; the 20 approved and 30 held claims were not audited independently.

**Delivered text regressed.** The same question produced a 238-word narrative in the baseline (written by the verifier) and a **51-word message with no figures** here: "results … are in the quarterly and comparison tables", although the work order had `visualize: false` and no tables were attached. With no verifier, the reply is the analyst's own `reply` argument, and the model wrote a generic sentence. The checkpoint holds the claims, but the chat does not show them. This path was already how self-checked answers were delivered in 2.1.1; the new routing makes it more common. It was outside the plan and was addressed afterwards (item 15 above): the controller now appends the checkpoint's approved figures and withheld measures to self-checked and mixed messages without tables, and `data-analysis.md` asks the analyst for a narrative that does not point to tables it did not attach. Replaying the compiled module on this run's sealed checkpoint gives a 24-line block containing all 20 figures and the 30 withheld measures grouped under one reason. That is a replay, not a second live run, and the analyst's own stub sentence ("…are in the quarterly and comparison tables") would still appear above it.

## Second live run — Luna/medium, failed

Same question, workflow 2.2.0 **before item 16**, **Luna / medium** (the configuration's `thinkingLevel` overridden to `medium` in a scratch copy of the config; the tracked file is unchanged). Evidence: `.cache/configured-agent-evaluations/2026-10-10T19-12-27.418Z-919bb463/` (not tracked).

**Outcome: `no-verified-answer` after 669.6 s, USD 0.156. No answer was delivered** (the 15 words are the error message). By role: coordinator 21 s (3 requests), analyst 444 s (38), verifier 366 s (45). There is no timing comparison to make from a failed run.

What happened:

1. The analyst's first three scripts failed on its own errors (a SQL binder error, a `KeyError`, and `emit_handoff` refusing a supporting check that reused a delivered claim ID, as designed). The fourth succeeded.
2. The analyst then revised twice more and failed both (a `SyntaxError` after an `edit`, a SQL binder error). With revisions exhausted, the harness restored the last successful package.
3. The self-check raised `unclassified: Recorded independent source access is required` and routed to the full verifier. After one analyst correction, the verifier's approvals were rejected twice as "Unsupported claim approval", exhausting `handoffRepair`.

Two causes, both in how recorded file reads were validated:

- **Reads were not recorded (introduced by items 3 and 5).** The recorder logs only files that are opened. With a warm hash index, `prepare_source` never opened the raw CSV, so an execution recorded `.hash-index` and cache files but no `files/data/*.csv`, while the validation demanded a recorded read of every cited source. Across the runs in `.cache`, the 15 runs before item 3 recorded raw reads in nearly every successful execution, with no `.hash-index` reads; the Luna/high run recorded them in 1 of 3 (the repair turn) and this run in **0 of 8**. All 43 approved verifier checks cited `files/data/sales_transactions.csv`, none of which was in the verifier's recorded reads. Reproduced locally with the real recorder: a cold run records the CSV, a warm run does not.
- **Restore dropped a recorded file (pre-existing, not changed by this work).** `AnalystRevisions` leaves `.duckdb` files out of its backup, but the recorded reads list `scratch/analysis.duckdb`. After a restore the file was gone, the stability check failed, and the plain error was classified `unclassified`. `revisions.ts` is not tracked in this repository and was not modified.

Resolution: item 16 removes the requirement rather than making the helper open files to satisfy it. That also removes the restore failure path. It is covered by unit tests, not replayed end to end: the workspace of the failed run no longer exists.

## Configuration

`harness.config.json`, inside `workflow`:

```json
"review": {
  "note": ["metadata"],
  "repair": ["packaging"],
  "targeted": ["calculation", "coverage", "eligibility", "join-integrity", "parsing", "period-coverage", "source-coverage"],
  "full": ["reconciliation", "scope", "unclassified"],
  "askUser": ["definition"],
  "escalateToFullWhen": {"claimsAffectedOver": 10, "shareOfClaimsOver": 0.3},
  "background": true
}
```

`bundled/versions.json`: `workflowVersion` 2.1.1 → **2.2.0**. `dataToolVersion` stays 0.1.1 because the prepared DuckDB cache format did not change, so cache keys are unchanged. Operator documentation is in `docs/local-setup.md` under "Review routing".

## Pinned tests and changed expectations

Pinned to `legacyReviewPolicy` (these tests document the pre-2.2 routing, where a failed self-check goes straight to the full verifier; they read `harness.config.json`, which now enables the new policy):

- `tests/integration/workflow-self-check.test.ts`: its `missing` case expects a verifier run with the reason supplied.
- `tests/integration/workflow-chat-exploration.test.ts`: asserts the stage list `coordinator:plan, analyst:analyse, verifier:numerical`; with the new policy the packaging fault gets an `analyst:correct` repair turn first.
- `tests/integration/workflow.test.ts` (an untracked file that predates this work; edited in the working tree and **not committed**): seven continuation and correction tests. Their fake analyst records an execution with no reads and a non-JSON `results.csv`. The removed source-read guard used to fail that first, straight to the verifier; the self-check now reaches the output check and the new policy gives a repair turn. Pinned with one line in `setup`; no assertion changed.

Expectation changed (not pinned), with approval:

- `tests/browser/chat-exploration.spec.ts:32`: expected stage count 3 → 4. The offline fixture's analyst emits no self-check diagnostics, which the gate reports as a `packaging` trigger, so under the new default it gets one repair turn before the verifier. The UI assertions in that spec were unaffected.

Other deliberate test changes, with approval:

- Role-prompt word cap raised from 80 to **110** in `tests/unit/workflow-coordinator.test.ts` and `tests/integration/analyst-handoff-lifecycle.test.ts`. The plan's prompt additions end at coordinator 90, analyst 101 and verifier 82 words. The shared-prompt cap (70) is unchanged. Earlier release notes that say "at most 80 words" describe the previous state.
- `tests/unit/workflow-self-check.test.ts`: the `missing-access` case was removed from the unsafe-evidence list, because it pinned the requirement item 16 removes. New tests assert that a missing or removed recorded read seals, and that a cited file which is not a known source is still rejected. `tests/unit/source-access.test.ts` (new) covers the verifier side.
- `tests/python/test_profile.py`: the plan's mostly-numeric fixture used a one-column CSV, which `prepare_source` cannot import without an explicit delimiter (see below). A second column was added; assertions are unchanged.

## Not verified

- **Latency is one observation.** A single Luna/high run (405.0 s) against a Luna/medium baseline (437.2 s). The 7% difference is within the earlier spread and confounded by thinking level, and that run's repair turn was caused by the defect described above. The same-settings Luna/medium run failed before delivering (see "Second live run"), so there is still no valid same-settings comparison, and no run has exercised item 16 live.
- **Routes exercised live: repair only.** Targeted review, background delivery, in-place update, ask-user, note and full-verifier escalation were not triggered by the live run; they are covered by integration tests with fake runners only.
- **The worker has no direct test.** No test imports `src/agent/workflow/worker.ts`. The live run exercised the timing wrapper (33 `model_timing` events) and handoff detection (3 of 3 executions). The planner read block (`assertStageReadAllowed`) only ran on a permitted read, so the blocking path is unexercised outside its unit test.
- **Prompt steering.** In the live run the analyst used `emit_handoff` and returned `{"fromExecution":true}` in both stages, and did not use `create_typed_view`. Whether the profile and typed-view guidance changes model behaviour beyond that is not established.
- **Checked figures are not seen live.** They are covered by unit tests, delivery tests with fake runners and a replay on the live run's checkpoint, not by a second live run or a browser spec.
- **Known limitation (Task 13).** If the fallback verifier returns `blockingInput` after an early delivery, the early message keeps its "Verifying…" note while the question is asked.
- **Browser coverage of the badge.** The badge is tested through server-side rendering and the message-reducer test. No browser spec asserts badge text.
- **Browser suite and routing.** Because `harness.config.json` now enables targeted review, the browser fixture exercises the repair route only; targeted and background routes are covered by integration tests, not in a browser.
- **Pre-existing limitation, not changed.** A single-column CSV with no explicit delimiter fails to import (`csv.Sniffer` cannot find a delimiter). This predates the plan and is outside it.
