# Unix audit: final review and implementation decisions

Date: 2026-10-11. Branch: `fix/unix-audit`.

## Outcome and review scope

The fresh final review found **no Critical, Important, or Minor issues** and returned **“Ready to merge? Yes.”** The implementation remains on its local branch, as requested; no merge, push, or pull request was performed.

The review covered the complete audit range from checkpoint `63d192394aade35294b455808762b4f3706b5412` through `f1992c64967e8ead9d4d868380d8c59f4b1d21c4`. The checkpoint preserves pre-existing latency-verification and exploration work; that earlier work was outside this audit review. The report commit contains documentation and tracking updates only, after the reviewed code.

A fresh `gpt-6-luna` reviewer with maximum reasoning performed the repeat review, following the project's model preference. The reviewer had no conversation history and inspected the implementation plan, decision ledger, full diff, and relevant source. A supplementary diff after the formatting commit helped separate substantive changes from Prettier output. The reviewer examined Task 1 configuration and package changes separately and treated generated formatting as formatting-only.

The reviewer checked plan alignment, controller and schema boundaries, failure privacy, retired features, defaults, extracted helpers, evaluation consolidation, packaging, documentation, and test coverage. The review was read-only: no files or Git state changed, and no suites or evaluation commands were rerun by the reviewer. The verification evidence in this report comes from the implementer's observed runs.

Sources: [implementation plan and execution history](../superpowers/plans/2026-10-11-unix-audit-fixes.md), [current architecture](../architecture.md), and [persistent project guide](../../../PROJECT_GUIDE.md).

## Implemented changes

| Area | Result |
|---|---|
| Formatting | Added Prettier 3.3.3, formatting commands, and formatted TypeScript and scripts. |
| Confirmed context | Save only planner-confirmed definitions as dated bullets; never save the raw question as a business fact. Compare complete trimmed entries when deduplicating. |
| Planner decisions | Take independent-review intent and cohort actions from the validated `WorkOrder`, replacing question-text regular expressions. Keep prior selected products by default. |
| Replacement cohorts | Require a nonempty list of nonblank product identifiers for executable `replace` requests in both the planner schema and controller. Permit clarification before analysis, repair malformed handoffs, and reject unresolved replacements before starting the analyst. |
| Failure explanations | Give safe public explanations for budget and verification failures. Preserve detailed reasons in run diagnostics. |
| Retired features | Remove legacy mode, visualizer contracts, render/preview counters, retired health entries, and their omitted controller caller. Retain useful rejection tests. |
| Defaults | Centralize built-in workflow limits, policy fallbacks, review thresholds, and thinking levels in `src/defaults.ts`. |
| Orchestration | Extract stage prompt and stage metrics helpers without changing their behavior. |
| Evaluation | Replace six one-off evaluation scripts with the configurable runner's `--manifest` option. Keep its validator intact. |
| Documentation and packaging | Add the current architecture page, mark the original HLD/LLD superseded, and stop packaging dated release logs. The release files themselves remain unchanged. |

## Initial review and resolution

The initial whole-audit review identified three Important findings. They were reproduced offline before any additional implementation.

| Finding | Reproduction | Final disposition |
|---|---|---|
| Substring deduplication lost a definition. | Existing `Revenue means net invoice revenue including freight` suppressed newly confirmed `Revenue means net invoice revenue`, without terminal punctuation. Output: `Definition dropped: true`. | Fixed in `f91b32c`. Exact matching against complete context lines strips surrounding whitespace and dash-bullet prefixes. Historical context remains append-only. |
| Replacement without identifiers removed the prior restriction. | A `replace` work order for `Use C instead` omitted `scope.cohort`. Output: `Replacement accepted without cohort: true`. | Fixed in `f1992c6`. Both schema and controller enforce replacement identifiers; clarification remains possible. |
| Slow planning could exhaust a quick request. | With a 1,200-second analysis allowance and 120-second quick allowance, analysis planning was still allowed at 180 seconds; selecting quick returned `deadline exhausted`. | Accepted by explicit owner decision. Planning and execution share one deadline, including quick requests. If insufficient in practice, adjust the overall allowance later. No clock separation or allowance increase was implemented. |

Deduplication does not infer that one business definition supersedes another. Wrapped, multiline, or semantically equivalent statements can remain separate entries. Executable `replace` requests must enumerate identifiers; a broader contract for unrestricted group changes was not added.

## Verification evidence

| Stage | Observed result |
|---|---|
| Task 0 baseline | Build and typecheck exit 0; **261 Vitest tests across 53 files** pass. |
| Task 10, after approved corrections | **269 Vitest tests across 59 files**, **18 Python tests**, and **6 browser tests** pass; format, typecheck, and build exit 0. |
| Definition fix, Task 11 | Regression RED: **1 failed / 4 passed**, with the shorter definition absent. GREEN: **5/5** focused tests; typecheck exit 0; full suite **271/271**. |
| Cohort fix, Task 12 | Regression RED: **10 failed / 42 passed** at the intended controller, schema, repair, and integration gaps. Final focused GREEN: **52/52**. |
| Final full verification | **291/291 Vitest tests across 60 files**, **18/18 Python tests**, and **6/6 browser tests**; format, typecheck, and build exit 0. |

Final commands were:

```bash
npm run format:check
npm run typecheck
npm test
.venv/bin/python -m pytest tests/python -q
npm run build
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/browsers" npm run test:browser
```

The two review fixes added 22 test cases after Task 10. The final Vitest run needed no flaky-test rerun. Browser checks completed in 15.1 seconds. Vite's existing large-chunk warning and Playwright's existing `NO_COLOR`/`FORCE_COLOR` warnings were nonfatal; both commands exited 0.

The original audit-regression search had no matches. The packaging dry run printed `0` matches for `docs/releases`. Comparing the final code with the checkpoint shows no changes to `bundled/pricing-plugin/**`, Python files, `docs/releases/**`, or `.env`.

No application-provider or OpenRouter calls were made. The evaluation runner was exercised only with `--dry-run`, which reported `paidCalls: false`. These checks establish offline behavior; they do not establish live analysis quality or latency improvements.

## Departures from the original plan

Every functional departure below followed an explicit owner instruction after the issue was reported. The original Tasks 0–10 remained in order; the sequencing correction affected steps inside Task 3.

| Change | Reason and authorization |
|---|---|
| Checkpoint existing work before Task 0. | The original dirty-tree precondition failed. The owner authorized committing the existing work, rather than stashing or discarding it. Local business data stayed ignored and `.scratch/` remained untouched. |
| Repeat Task 1 formatting. | Prettier 3.3.3 needed a second pass for `server.ts`; the second and third outputs were identical. The owner authorized continuation after the failed check. |
| Correct Task 2's RED description. | The first assertion checked the missing definition before the raw-question assertion ran. The owner approved updating the Expected description; the original assertions stayed intact. |
| Move Task 3 Step 9 items 1–2 earlier. | Deleting `classifyBudget` before its caller caused an import/call failure. The owner approved moving caller removal and planning-budget initialization before the routing RED; routing changes stayed after that RED. |
| Replace unsafe Task 4 message interpolation. | The planned public budget message exposed paths and raw diagnostics. The owner approved fixed safe messages, revised unit expectations, and two privacy regressions. Existing integration privacy assertions stayed intact. |
| Expand Task 5 cleanup. | The plan omitted the deleted function's controller caller and unused visual contracts. The owner authorized their removal, retention of negative fixtures, and correction of the grep inventory. |
| Correct Task 10 formatting and browser assertion. | Two files needed formatting, and the browser test still expected retired public wording. The owner approved formatting only those files and replacing the stale assertion; its privacy assertion remained. |
| Add Tasks 11 and 12. | The owner authorized the two initial-review correctness fixes, their test-first implementation, and a second fresh full review. |
| Correct the new schema-test assertion. | TypeBox's conditional schema rejected correctly but reported generic wording. The owner approved checking rejection with `.toThrow()` rather than requiring `cohort` in the error. Validation was not weakened. |
| Add this report and persistent tracking updates. | The owner requested a document covering the clean review, decisions, and scope changes. The report is outside protected `docs/releases/`. |

## Decision record and tradeoffs

This is the complete ruling record in decision order, including earlier rulings later superseded. Repeated review dispositions are included so that no behavior set aside by a reviewer disappears from the record.

| # | Decision and reason | Cost or limit |
|---|---|---|
| 1 | Use the requested checkout and `fix/unix-audit` branch; no additional worktree. | Isolation is by branch only. |
| 2 | Correct Task 2's Expected failure description to the first executed assertion, with owner approval. | Only the recorded RED description changes. |
| 3 | Move the deleted Task 3 caller and planning-budget initialization earlier, with owner approval. | Analysis planning starts before the routing RED; routing still follows its RED. |
| 4 | Use fixed safe public failure messages and retain detailed run diagnostics. | Investigating unexpected failures requires diagnostics. |
| 5 | Remove the omitted controller caller and unused visual types; keep rejection fixtures. | External TypeScript consumers of removed types may need migration; stored historical JSON is unchanged. |
| 6 | Format only the two files flagged at Task 10, with owner approval. | Formatting-only changes. |
| 7 | Review the original audit plus pending final diff before the completion commit; choose its message because Task 10 supplied none. | Bookkeeping and commit sequencing differ; verified behavior is unchanged. |
| 8 | Initially leave all three review findings open until a plan amendment. | Their definition, scope, and timeout risks remained until subsequent decisions; fixes 1 and 2 and decision 14 supersede this open status. |
| 9 | Retain detailed startup errors for Task 5's local troubleshooting requirement. | Local diagnostics can include paths or exception text; no concrete secret exposure was found. |
| 10 | Keep the retired verifier/visual-operation rejection removed; no active caller was found. | A future caller needs an appropriate active-operation rule. |
| 11 | Leave hash caches, source-read integrity, and background verification unchanged as explicit owner decisions. | Existing integrity/performance and early-delivery tradeoffs remain. |
| 12 | Leave settings round-trip and duplicate-validation cleanup excluded. | Conversion overhead and duplicated checks remain. |
| 13 | Leave routing extraction and unused bundled pricing skills to separate follow-ups. | Orchestration complexity and unused skill-list entries remain. |
| 14 | Keep one shared deadline, including quick planning, by explicit owner decision. | Planning can consume the quick allowance; a later overall-limit increase may be needed. |
| 15 | Deduplicate trimmed complete context lines, stripping dash bullets, while preserving history. | Wrapped or semantically equivalent definitions may append separately; semantic supersession needs an explicit policy. |
| 16 | Enforce executable replacement in schema and controller, exempting valid clarification. | Executable replacement requires enumerated identifiers; unrestricted group changes need a future contract. |
| 17 | Check schema rejection behavior rather than TypeBox wording, with explicit owner approval. | Error wording is not asserted; invalid and valid behaviors remain covered. |
| 18 | Run a second fresh full review because the owner explicitly requested it. | One additional reviewer pass. |
| 19 | Reaffirm the shared deadline when the repeat reviewer set it aside. | The accepted quick-timeout tradeoff remains. |
| 20 | Reaffirm all explicit exclusions in the repeat review. | Existing integrity/performance, early-delivery, conversion, duplication, and complexity tradeoffs remain. |
| 21 | Reaffirm detailed local startup errors after the repeat review found no concrete secret exposure. | Local diagnostics can contain paths or exception text. |
| 22 | Reaffirm removal of the unreachable verifier/visual-operation rejection. | Future callers need an active-operation rule. |
| 23 | Treat generated Prettier output as formatting; inspect Task 1 configuration and package changes separately. | A semantic change hidden in bulk formatting could escape manual inspection; baseline tests and typecheck passed. |

The repeat reviewer set aside exactly the behaviors recorded in decisions 19–23. Required recommendations: none. Deferred Minor findings: none.

## Unexpected outputs and corrections

| Stage | Actual output or behavior | Resolution |
|---|---|---|
| Task 0 | Dirty files beyond the plan and `.scratch/`. | Stopped; owner authorized checkpoint `63d1923`. |
| Task 1 installation | `ENOTFOUND registry.npmjs.org`. | Identical command succeeded with approved escalation. |
| Task 1 formatting | `[warn] src/server.ts`. | Owner-approved second formatting pass stabilized output. |
| Known flaky test | `tests/unit/runs.test.ts` reported `expected +0 to be 1` when it was the sole failure. | Each isolated rerun passed; the test was not edited. |
| Task 2 RED | Failed at `toContain('- Revenue means net invoice revenue.')`, before the expected raw-question assertion. | Owner approved correcting the Expected description, then the RED was confirmed again. |
| Task 3 RED | `TypeError: (0 , classifyBudget) is not a function`. | Owner approved earlier caller removal; routing RED then failed at the intended assertions. |
| Task 4 full suite | Public message exposed `ENAMETOOLONG /private/var/folders/ks/93d8rcl53rn2cgtgbcdn0txc0000gn/T/workflow-1gSQlW/bad-result-123.45`. | Safe-message privacy regressions failed first, then passed after the approved fix. |
| Task 5 grep | Found `assertBoundedWorkflow` import/call, visualizer types, and negative fixtures beyond the expected inventory. | Owner approved omitted cleanup and retained fixtures. The controller first reproduced `assertBoundedWorkflow is not a function`. |
| Task 10 formatting | Warnings for `src/agent/workflow/output-contract.ts` and `tests/unit/delivery.test.ts`. | Owner-approved formatting of those two files. |
| Task 10 browser | `element(s) not found` after 5000 ms for `/I could not independently verify/`; 5 passed / 1 failed. | Owner-approved assertion replacement; fresh run passed 6/6. |
| Task 12 focused GREEN | 50 passed / 2 failed: expected `/cohort/`, received `/ must match "then" schema`. | Stopped; owner approved assertion-only correction; final focused run passed 52/52. |
| Follow-up bookkeeping | `zsh:1: no such file or directory: .superpowers/sdd/2026-10-11-unix-audit-fixes/progress.md`. | Corrected the append's working directory. Code and tests were unaffected. |

While authoring Task 12, its new integration test initially used an unexecuted `failed` outcome assertion. Before the GREEN run, that assertion was corrected to the established `no-verified-answer` contract; the analyst-not-started assertion stayed intact. No original assertion was changed by this correction.

## Commit record

| Commit | Purpose |
|---|---|
| `63d1923` | Preserve existing latency-verification and exploration work before the audit baseline. |
| `7acc0eb` | Add Prettier and format TypeScript/scripts. |
| `d1eb846` | Save planner-confirmed definitions instead of raw questions. |
| `a02e2d5` | Take review and cohort decisions from the work order. |
| `5a3206c` | Explain failures with safe public messages. |
| `3802038` | Remove retired features and omitted callers/contracts. |
| `97f8db4` | Centralize built-in defaults. |
| `24bec84` | Extract stage prompt and metrics helpers. |
| `65e9271` | Consolidate evaluation scripts behind `--manifest`. |
| `0b3caf8` | Add current architecture documentation and packaging changes. |
| `a96d81e` | Align the browser assertion and record verification/initial review. |
| `464339d` | Record the shared-deadline owner decision. |
| `f91b32c` | Deduplicate complete confirmed definitions. |
| `f1992c6` | Reject executable cohort replacement without identifiers. |

This report and completed tracking records use the separate commit message `docs: record unix audit final review and implementation decisions`.
