# Agent delivery repair: before/after evaluation — 8 October 2026

The repair phase **did not improve analytical delivery**. All five live submissions returned failure responses; none produced a verified numerical answer, checkpoint, report or chart. Compared with the same five messages in the earlier bounded run, submitted time increased from 849.4 to 1,290.2 seconds and SDK-estimated cost from USD0.05247 to USD0.09406. Short failure replies are not an improvement.

The local tickets were written and executed inline. Focused checks, typecheck and build pass. The final cache-provenance and connection-retry repairs were made **after** preserving the live batch and have no live replay. The application is not ready on the strength of these checks.

## Changes and verification

[Execution plan](../superpowers/plans/2026-10-08-agent-delivery-repair.md); [ticket index](../../../.scratch/agent-delivery-repair/README.md).

- **PH-09:** Fill omitted controller-owned schemaVersion; reject unsupported versions, empty business scope and malformed optional fields.
- **PH-10:** Use explicit filePath tool arguments; focus role guidance on supplied inventory and relevant references. Up to three claim groups share the original request budget. Each group must account for exact assigned operations, and the independent verifier must confirm which are complete or pending. Publish only checked groups; retain immutable earlier evidence after later interruption/clarification. Reject reused approved or held claim IDs. Repair stage-owned rendering to satisfy the bundled UUID/report.html contract.
- **PH-11:** Retain generated top-level Python/SQL code after the supervised stage ends. Offer stable candidates within the same population/basis and source corpus for inspection/adaptation; candidates cannot authorize cached answers. Every fresh execution still requires independent checking.
- **PH-12:** Run the separately labeled focused phase and preserve all results, including failures.
- **PH-13, discovered live:** Follow observed atomic cache renames only when final file identity matches the file actually read. The old recorder retained a deleted `.partial/source.duckdb` path and incorrectly failed a successful first-use calculation.
- **PH-14, discovered live:** Recognize the SDK's `Connection error.` as eligible for the existing single shared transient retry. Authentication/configuration errors remain ineligible; no budget/deadline reset.

Final verification: **43 focused tests in 12 files passed**, including actual bundled rendering, first-use cache preparation, replacement-file rejection, cumulative checkpoint/work-accounting, cancellation and usage accounting. The single synthetic workflow browser check passed at desktop/narrow widths after its fixture was updated to the stricter packet contract. Final typecheck and app build passed. No full Python/browser/evaluation/acceptance/scale suite, dependency upgrade, commit, push or deployment occurred. Existing changes and sample data were preserved.

## Live scope and evidence

Ran 8 October, **14:49:13–15:10:49 Europe/Berlin** (UTC receipts retained). Exact original F01-1, F02-1/2/3 and F05-1 prompts/fixtures; F01/F02 shared one fresh conversation, F05 started fresh. Fixed **OpenRouter openai/gpt-6-luna / high** in all ten actual stage configurations. Default request caps were recorded: quick 120s/12 model/20 tool, analysis 300s/24/60, report 600s/36/90; shared retry/correction maximum one and render/preview maximum two.

The new phase used a conservative **30-minute/USD1 admission limit**, sequentially once per message, with no supplemental submissions or automatic recovery messages. The old two-replay allowance remains exhausted. Cost is checked before another submitted turn; an in-flight inference can overshoot an estimate. No limit was approached here. SDK estimates are not provider billing guarantees, and native execution is not OS-isolated acceptance.

Evidence: [.cache/agent-delivery-repair-2026-10-08/2026-10-08T12-49-13.542Z-42320e27/](../../../.cache/agent-delivery-repair-2026-10-08/2026-10-08T12-49-13.542Z-42320e27/). It contains complete responses, every request/run/stage receipt, pre-turn snapshots, generated drafts, source/output state, actual model settings, usage reconciliation, metrics and independent reviews. Raw evaluator code/42 reproduced controls stayed separately under `preflight/evaluator/`, outside product inputs. No historical analysis code or expected results were seeded.

## Per-message outcomes

| Message | Seconds | SDK USD | Reply words | Result |
|---|---:|---:|---:|---|
| F01 group review | 242.639 | 0.017486 | 17 | Verification/finalization reserve; no packet/checkpoint |
| F02 top ten | 242.632 | 0.017705 | 17 | Same reserve stop; no packet/checkpoint |
| F02 Q2 diagnosis | 242.773 | 0.015598 | 17 | Same reserve stop despite executed calculation |
| F02 following-quarter recovery | 192.706 | 0.015332 | 19 | Packet rejected: invalid claim/evidence |
| F05 detailed scenario | 369.436 | 0.027935 | 20 | SDK `Connection error.`; no completed analyst packet |

Total batch wall time **1,296.435s (21.6min)**; submitted time **1,290.186s**. Total **USD0.094056745**, **76 model attempts, 102 tool calls, 90 response words**. Five coordinator stages took 85.972s/5 model calls/no tools; five analyst stages took 1,197.567s/71 calls/102 tools. Zero verifier/visualizer stages, retries, corrections, renders or previews. All SDK usage was available; 76 saved SDK assistant records reconcile exactly to controller cost, including four valid zero-cost abort/error records. Time to first verified answer is null for every message.

Full responses: [responses.md](../../../.cache/agent-delivery-repair-2026-10-08/2026-10-08T12-49-13.542Z-42320e27/responses.md).

## Before/after quality, continuity and presentation

| Matched five-message comparison | Delivered numerical replies | Submitted seconds | SDK USD | Reply words |
|---|---:|---:|---:|---:|
| Historical originals, 7 October | 3 | 3,463.602 | 0.230011 | 866 |
| Initial bounded originals | 0 | 849.372 | 0.052470 | 107 |
| This repair phase | 0 | 1,290.186 | 0.094057 | 90 |

Historical group and detailed-request timeout recoveries remain separate: 1 supported reply, 1 failed recovery, 1,989.489s/USD0.286105/451 words. Historical top-ten, diagnosis and recovery originals delivered supported answers; this phase delivered none. Historical runs had provider/concurrency confounds, so these are descriptive comparisons, not causal A/B proof. Faster failure than history does not compensate for lost useful answers.

Continuity retained the Lighting scope, SKU 85123A and Q2→Q3 2011 interpretation through public history. Interrupted code was actually retained as candidates. Nevertheless no verified top-ten cohort/checkpoint existed, and no code reuse was recorded. Exact text matching of population/basis is conservative but can reject semantically compatible code when coordinator wording changes. Scope carryover and file retention alone do not establish successful conversation continuity.

There are **no published numerical calculations to grade as passed**. Independent raw controls re-ran successfully (42 checks). Nine numbers in the unpublished recovery draft agree with those controls, including Q2/Q3 revenue, units, margins and changes. Its two incorrect evidence paths and object-valued coverage claim correctly failed packet validation. Draft accuracy is not delivery. The initial group draft also unnecessarily withheld first-four-quarter margins after treating blank master selling-unit fields as unsupported despite the confirmed EA convention; that draft remains unscored.

**No live rendered charts exist to inspect** at desktop or 390px. This is unassessed visual quality, not a pass. F01 selected visualization but never reached it; F02 and F05 selected none. The synthetic browser/actual renderer checks establish mechanics only. Preserved historical chart reviews found 60 bar/trend values matching controls, with narrow title clipping and trend legend/axis overlap; historical hashes were rechecked unchanged, without rerendering those charts or running the full browser suite.

Integrity: 55 checks passed for source hashes, fresh unseeded workspaces, actual Luna/high settings, recorded input paths and 1,294 unchanged historical files. The evidence credential scan found zero configured-secret-value matches. The live bundle fingerprint was `62ab54d3d6356677e413f371346fc9aff8d32e822fb630ab82770be5f863b4d6`; the final unreplayed bundle is `757e258292ca76d78bd3f4ea279ccc60b9ed96365cc24de42b662e57e5fc6eb0`. Post-batch compiled changes are worker.js plus the new transient-error module; recorder provenance/version changes are recorded separately.

## Remaining failures and deferred limits

1. **No live delivery improvement.** Analysis still spends its allowance on preparation/code generation before returning a checkable packet. Early independently checked claim groups and complete multi-turn delivery remain demonstrated only by focused fixtures.
2. **Malformed analyst output has no structural repair path.** The recovery draft had correct numbers but invalid evidence/value shape and was rejected before the verifier. The single correction allowance was unused; do not weaken verification to accept that packet.
3. **No demonstrated live code adaptation, quick checked lookup or presentation.** Lexical compatibility and missing checkpoints impede reuse. Chart quality and detailed scenario completeness remain unvalidated.
4. **The final provenance/retry fixes have no live validation.** Their focused checks pass; the frozen failures remain the evaluation outcome. No tuning/replay loop was run.
5. F03/F04 were deliberately omitted from this tighter follow-up phase; their earlier failures remain. Formal isolated acceptance and scale verification remain pending.

Deferred minor implementation limits: candidate retention scans only top-level stage code; future evaluator runs still inherit local request-budget overrides (this phase's recorded limits equal defaults); full pre-turn snapshots include cache/session material and add I/O; the file-path schema imports the SDK-installed typebox dependency directly. No package changes were made.

## Execution decisions

The ledger records these rulings and their costs if wrong:

- Skip the ticket skill's extra approval quiz because the user requested tickets then execution; chosen granularity might differ from preference.
- Stay inline, preserve uncommitted files/ledger and make no commits/cleanup; this leaves one larger review surface, mitigated by the starting diff snapshot. Ignored scratch/evidence also needs backup if the checkout is removed.
- Use affected checks rather than the full suite; unrelated regressions remain untested.
- Treat this as a new five-message/30min/USD1 phase, preserving the exhausted prior allowance; omitted scenarios remain unvalidated here.
- Allow code adaptation across periods/cohorts only with matching population/basis and stable source corpus; inspection and fresh independent checking remain necessary.
- Keep the explicitly specified cost check before another turn; one in-flight estimate could overshoot.
- Resolve reviewer spec-precision concerns through explicit typed work accounting and a strict machine manifest; future changes must maintain those contracts as well as prose.
- Do not claim RED→GREEN for the evaluator configuration refactor, which had no observed failing pre-change test; negative manifest tests and dry run provide weaker evidence there.
- Fix the two mechanical live-discovered defects after the batch without replay; real delivery impact remains unknown.

Fresh Luna/max review findings about missing completion accounting, duplicate held IDs, malformed clarification and renderer integration were repaired with observed failing/passing focused regressions. Its cost-ceiling concern was resolved against the ticket's explicit admission-limit wording. Review did not itself run live models or checks. No readiness claim follows from the final green build.
