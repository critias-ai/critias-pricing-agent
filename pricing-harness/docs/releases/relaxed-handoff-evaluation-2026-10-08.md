# Relaxed analyst handoff evaluation — 8 October 2026

The smaller handoff accepts the two previously failed saved packages locally. One fresh Luna/high run still delivered no verified answer: its repaired package used absolute script paths that the first implementation did not match to relative execution records. That defect is now fixed and the repaired live package passes local replay. The final version has not had another paid live run.

## Implemented behavior

Analysts supply `claims`, `code` and `results`; coverage and holds are optional. Controller-owned scope, schema metadata and calculation identity are attached from the work order and successful recorded execution. Additional producer metadata is ignored. Methods remain in skills; no analytical query library or additional agent layer was added.

Unreadable or malformed optional results are excluded and disclosed. A claim retaining readable evidence continues; a claim with no readable evidence is excluded from approval. If no claims remain, or no unchanged successful execution supports the code, the existing bounded repair receives the collected problems. Missing values are never converted to zero. Invalid JSON remains invalid evidence.

The verifier independently recomputes against raw sources on the confirmed scope and decides completed task IDs supplied by the controller. Analyst task descriptions do not govern routing. Omitted, unknown or contradictory verifier task completions leave the relevant work pending rather than discard checked numbers. Existing numerical corrections, immutable checkpoints, source hashes, cache scope checks and actual chart inspection remain in place.

Final path handling accepts absolute or relative paths inside the workspace, resolves filesystem aliases and stores canonical relative paths. Escape checks and recorded script/output hashes still apply.

The live build was workflow **1.0.9**. Post-run path normalization and conservative task bookkeeping are workflow **1.0.10**. The saved app model remains DeepSeek V4.1 Flash/high; this experiment used the existing explicit **openai/gpt-6-luna/high** override. Analysis/report limits remain 600 seconds, including a 180-second verification/finalization reserve, 100 model calls, two shared analyst revision rounds and the existing retry/repair/correction caps.

## Local verification

- Test-first reproductions failed on required metadata, literal scope/task matching and then absolute-path execution matching before their fixes.
- Final verification: **78 focused tests in 13 files**, **one affected browser test**, typecheck and application build passed. No full suite, dependency upgrade or scale benchmark ran.
- Before live submission, both saved packages from `2026-10-08T17-53-29.661Z-494de9be` passed the new receiving checks: **nine claims and seven readable results each**, with the invalid optional `summary.json` excluded. The minimal candidate also passed. Missing execution and changed code remained rejected; **35 original evidence files** were unchanged. This replay accepted candidates; it did not approve their numbers.
- Focused workflow/checkpoint tests reject wrong numbers, a wrong-period calculation and changed raw sources. Other tests preserve null-cost holds, scope-sensitive cache reuse, checked partial answers, correction handling and conversation continuity. Missing completion cannot mark a request complete.
- After the live failure, its repaired packet passed local replay with **six claims and two result files**, unchanged claim values and unchanged original evidence. Paths were normalized without editing the generated files.

Replay scripts are `.scratch/relaxed-handoff/replay.mjs` and `replay-live.mjs`. Initial replay evidence is `.cache/relaxed-handoff-replay-2026-10-08/2026-10-08T18-22-14.529Z/`; final replay evidence is `.cache/relaxed-handoff-replay-2026-10-08/2026-10-08T20-47-47.659Z/`. The repaired live packet replay is recorded in the live evaluator directory below. Local replays made zero model calls. Browser execution required local socket access outside the filesystem sandbox and passed after escalation.

## Fresh live run and comparison

Exactly one message was submitted in a new source-only workspace:

> Review how Lighting & Candles performed over the last five complete quarters.

Confirmed context and source inputs matched the previous two-round trial. No old analysis, expected results or evaluator controls were supplied to the model. Native execution is exploratory evaluation, not operating-system isolation.

| Measure | Previous two-round trial | Relaxed handoff live trial |
|---|---:|---:|
| Workflow version during paid run | 1.0.8 | 1.0.9 |
| Request duration | 273.988s | 207.073s |
| SDK-estimated cost | $0.03410677 | $0.02800481 |
| Model / tool calls | 21 / 26 | 17 / 22 |
| Analyst script lines / bytes | 219 / 16,408 | 157 / 13,546 |
| Successful analyst executions | 3 | 2 |
| Shared revision rounds / handoff repairs | 2 / 1 | 2 / 1 |
| Public response words | 18 | 18 |
| Verified answers / charts | 0 / 0 | 0 / 0 |

Duration fell 24.4%, estimated cost 17.9%, script lines 28.3% and script bytes 17.4%. These are descriptive observations across single runs, not an isolated causal experiment. **Delivered quality did not improve: both returned a failure rather than the requested analysis.** There is no time to first verified answer. Live multi-turn continuity and rendered chart quality remain untested in this run; browser fixtures establish transport behavior only.

The coordinator used 14.326 seconds and the analyst 191.455 seconds. The analyst repaired a reserved SQL alias (`rows`), encountered an unavailable generic `python` executable, then produced correct cost-covered calculations. Its first package cited JSON containing `NaN` and absolute paths. The aggregate rejection identified both evidence and execution-match problems. During repair, the second revision failed because a pandas `Timestamp` was not JSON serializable; the revision mechanism restored the last successful script and results. The analyst then selected readable CSV/execution-text evidence and explicitly held complete-scope margins. Its final package was rejected solely because of absolute-versus-relative script identity. The shared handoff repair was exhausted with **393.175 seconds, 83 model calls and 38 tool calls remaining**. No independent verifier or visualizer started; there were no provider connection errors.

Complete public response:

> I could not independently verify an answer within this request: handoffRepair budget exhausted. Retained analysis files are drafts.

## Independent quality review and remaining failures

Fresh evaluator calculations against the raw sources passed **196/196 comparisons** covering quarterly/full-window totals, cost-covered revenue/COGS/profit/margins, consecutive and endpoint movements, displayed values and invoice arithmetic. This is evaluator verification of drafts, not a product checkpoint. The two malformed JSON artifacts remain recorded as separate serialization failures.

The final packet correctly holds full-population Q3 2011 and full-window margins: **53 observations for SKU 84596L have unavailable costs**, covering **£163.33 signed revenue**. Supported subset margins are explicitly labeled; no missing cost is treated as zero. There were no rendered charts or published artifacts to inspect.

Integrity checks passed **61/61**, including original/source-workspace hashes, fresh inputs, model settings, complete SDK usage/cost reconciliation, excluded evaluator inputs and the two-round restoration. Costs are SDK estimates rather than provider billing guarantees.

Remaining limitations:

1. Final workflow 1.0.10 admits the repaired live packet locally, but successful live independent verification, final response and chart rendering remain unproven. No second paid submission was made.
2. The generated JSON still contains `NaN`, and the attempted serializer repair failed on `Timestamp`. The alternative evidence permits handoff but does not fix those files.
3. Full-scope affected margins require the missing source cost; this is a legitimate data limitation.
4. The verifier's executed numerical/visual contracts remain essential and could expose further issues once reached. This trial cannot establish their live performance.

Live evidence: `.cache/configured-agent-evaluations/2026-10-08T20-33-54.133Z-b56e623f/`, including complete response, stage sessions, both submitted packages, `evaluator/draft-review.json`, `integrity.json`, `accepted-handoff-2.json` and `post-live-path-replay.json`. Historical evidence is unchanged. No commit, push, deployment or model-baseline change was made.
