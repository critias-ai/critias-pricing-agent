# Assistant UI step events: local validation

Date: 2026-10-12
Branch: `feat/assistant-ui-steps`
Result: Plan1 Tasks 1–8 are implemented and ready for user review. Tasks 1–7 gate results below are historical; Task8's current full suite passed 302/302 across 63 files, with typecheck, format check, and build passing. The whole-branch review found no Critical or Important findings; three non-blocking follow-ups belong to Plan2.

## Task commits

| Task | Commit | Result |
|---|---|---|
| 1: step contract and `EventView` | `39776e7` | Focused 5/5; full 293/293 across 60 files; typecheck passed. |
| 2: pure step logic | `abc2e57` | Focused 4/4; full 297/297 across 61 files; typecheck passed. |
| 3: worker events | `c0a38df` | Focused 10/10; typecheck passed. Full suite had 296/297 because `runs.test.ts:83` observed `called === 0` after 30 ms; isolated run passed 1/1. Task7 records the diagnosis and correction. |
| 4: orchestrator publication and persistence | `9f5104c` | Focused 3/3; integration 72/72 across 19 files; full 300/300 across 62 files; typecheck passed. |
| 5: remove legacy tool/ticker events | `24a78db` | Full 301/301 across 62 files; typecheck and formatting passed. |
| 6: assurance wording | `2844065` | Focused 8/8; full 301/301 across 62 files; typecheck and formatting passed. |
| 7: condition-based startup wait and this record | `d56990f` | Focused 1/1; full 301/301 across 62 files; all offline gates passed. |
| 8: sanitizer and recorded live step fixture | 244867e, 2a10646 | One approved paid DeepSeek/high run; exact 110/110 stream/persistence match; sanitizer regression; current full suite 302/302 across 63 files; typecheck, format check, and build passed; separate Task8 review approved with no findings. |

The Task7 startup-race explanation follow-up is dd044f2; the preceding Tasks 1–7 final review was preserved in 4cfa307.

## Task7 diagnosis and fix

The same failure appeared in the baseline full suite (290/291) and Task3 (296/297): `tests/unit/runs.test.ts:83` expected the injected runner call count to be one but observed zero after a fixed 30 ms sleep. The test passed in isolation. `RunController.start()` awaits source resolution/snapshotting, run-directory creation, metadata writes and conversation persistence before it calls `WorkflowOrchestrator.execute()`. It then attaches completion handlers without awaiting the workflow, so acceptance returns while that workflow continues in the background. `executeWithLog()` still performs asynchronous analysis-directory setup, context hashing, state loading and stage preparation before it invokes the injected runner. Under full-suite load, this background preparation can take longer than 30 ms; the fixed delay guessed at completion time.

Replaced the sleep and following count assertion with `vi.waitFor(() => expect(called).toBe(1), {timeout: 5000, interval: 10})`. This polls the exact condition the test needs with a bounded timeout. The deduplication equality, busy-state, rejected competing submit, cancellation, cancelled final state and preflight recovery assertions remain unchanged. Focused test: 1 file, 1 test passed.

## Task 7 final offline gates (historical; before Task 8)

All commands ran from pricing-harness after the Task7 test change. The repository formatter ran before these gates and reported every source, test, and script file unchanged. These are Task7 results and predate Task8; Task8 used a read-only format check without rerunning the repository-wide formatter.

| Gate | Result |
|---|---|
| `npx vitest run` | Exit 0; 62 files passed, 301 tests passed. |
| `npx tsc --noEmit` | Exit 0; no output. |
| `npm run format:check` | Exit 0; “All matched files use Prettier code style!” |
| `npm run build` | Exit 0; TypeScript and Vite build passed. Existing Plotly chunk warning: 1,211.66 kB exceeds 500 kB. |
| `npm run test:browser` | Initial sandboxed run exited 1 because tsx could not create its temporary IPC socket (`EPERM`). The escalation request was accepted; rerun passed all 6 Playwright tests in 16.2 s. |
| Manual fixture session snapshot | Escalated local fixture server and HTTP request succeeded. `/api/session` keys included `activeSteps` (along with `serverInstanceId`, `sequence`, `sessionId`, `busy`, `activeRun`, `messages`, `runs`, and `artifacts`). Server was stopped with Ctrl+C. |

The initial browser `EPERM` was a sandbox permission issue, not a test failure. The escalated browser and fixture checks completed; no permission-review rejection occurred. Playwright printed `NO_COLOR`/`FORCE_COLOR` environment warnings, with no effect on the results.

## Scope decisions and deviations

- Work stayed in the requested checkout on `feat/assistant-ui-steps`, following the inline-work preference and explicit branch instruction; no additional worktree isolation was used.
- Earlier parallel work followed the project preference for `gpt-6-luna` with maximum reasoning rather than role-based model selection; additional review rounds remained available if a reviewer found gaps. No further subagents were started for Task7.
- Work continued after the first full-suite timing failure because the isolated test passed and the failure was confined to its arbitrary delay. The recurrence in Task3 was retained as evidence and corrected here.
- Task3 used `modelActivity` for `tokenSeen`; the existing `model` field already held the resolved model, so behavior was unchanged. Task3 ran scoped Prettier before commit; the controller later ran full `npm run format`, which changed no code.
- Task4's initial RED surfaced the obsolete `onProgress` callback before the expected empty-steps assertion. GREEN validated the new `onStep` wiring. Its integration coverage checks the exact model-step count before `every()`, adds a third redaction/cap case, and caps safe fields after redaction because replacing a 9-character secret with the 10-character `[REDACTED]` marker can expand text.
- Task7 adds the diagnosed timing fix and persistent records beyond the original brief's formatting-only commit step. These are required for a reliable full-suite result and the repository's persistent project context.
- Browser coverage includes the previously deferred `tests/browser/chat-exploration.spec.ts:192` scroll assertion. That assertion may occur before delayed settlement; a passing browser run does not prove the timing condition. Carry it into the Plan2 browser rewrite for final reviewer triage; Task7 did not widen its fix to that assertion.

### Task 8 deviations from the brief

- The ignored .env had no PRICING_WORKSPACE, so the run used a fresh temporary copy of the confirmed fictional/public pack and context.
- Captured stdout/stderr in a unique ignored .cache directory instead of the suggested .scratch path to avoid overwriting existing work.
- Extended sanitization for stable step IDs, temporary workspace paths, and clipped /Users… summaries; added CLI regression coverage for the actual fixture.
- Committed the sanitizer and test as 244867e while payload/destination approval was pending; after approval and the single run, committed the fixture as 2a10646 and durable Task8 docs as 6a119da.
- Added offline raw-source controls for 40/40 claim comparisons and 20/20 delivered table cells; these were outside the model workspace and required no paid calls.
- Used a read-only format check and did not run the repository-wide npm run format command, preserving the unrelated pre-existing dirty docs.

## Task 8 live run and Plan2 handoff

After explicit payload-and-destination approval, one run used the saved DeepSeek deepseek/deepseek-v4.1-flash model at high reasoning with the question: “Review how Lighting & Candles performed over the last five complete quarters.” The fresh workspace at /private/tmp/pricing-assistant-ui-steps-SbB2BX contained only the confirmed fictional Northbridge/public source pack and context. The controller matched all 25 staged source hashes and found no credential files. The run completed as 10b2aaa6-f328-4c96-8880-251332b90c1d in 151.108 seconds, with estimated SDK cost USD 0.078059928.

All 110 streamed step events match the 110 persisted records. The run captured 19 complete model lifecycles, 24 tool running → done pairs, two completed stages, and one skipped Verify stage; every tool was done and Verify was skipped, so the live run covers only the normal self-checked path. Settled activeSteps was empty. The sanitized fixture at tests/fixtures/recorded-steps.jsonl contains 110 events across 46 stable step IDs, preserves transitions and timestamps, and has no reviewed client/business names, financial figures, details, home paths, or machine paths. The fixture also covers the clipped /Users… fragment caused by the 60-character tool-summary cap.

The first two automatic approval reviews rejected the command because approval did not explicitly name the staged payload and OpenRouter destination. After the user replied “Yes, send this fictional test pack to OpenRouter once”, the same command was accepted; it was the only provider run. The approval trail is preserved at pricing-harness/.cache/assistant-ui-step-events-live-2026-10-12/run-b4fo8b/sdd-final/task-8-approval-rejection.md. Headless output, stderr, raw persisted events, source proof, verification/privacy reviews, analyst stage result, delivered handoff, and checkpoint are also preserved under that evidence directory.

An independent raw-source review was conducted outside the model workspace and was not sent to the model. All 40/40 claim comparisons passed, and all 20/20 delivered table cells checked passed, including three correct nulls; the Q3 margin remained held, three chart metadata items were reviewed, and assurance was self-checked. This bounded delivery review is not a complete narrative audit or browser chart-rendering review. One run does not establish reliability or general financial correctness.

Plan2 remains unchanged. Its proposed replayEvents() deduplicates final states and hardcodes model duration to 1 ms. Add deterministic retry and background active-Verify cases while preserving this authentic fixture's transitions and timing. Also carry forward the scroll-settlement assertion and running/cancelling versus retrying/compacting status questions. The separate step store should seed from snapshots and consume each event; keep synthetic replay distinct from recorded/live acceptance.

## Final whole-branch review

The final whole-branch review covered Tasks 1–8 on the fixed reviewed range and found no Critical or Important findings; the separate Task8 review also approved with no findings. Its durable report is [2026-10-12-assistant-ui-step-events-final-review.md](../reviews/2026-10-12-assistant-ui-step-events-final-review.md).

The independent controller gate chain at pricing-harness/.cache/assistant-ui-step-events-local-validation-2026-10-12/ is Task7 historical evidence: final-gates.log records Vitest 301/301 across 62 files, typecheck, format check, build, and browser 6/6 in 16.2 s. final-session.json records the idle snapshot with activeSteps empty. Task8's current full suite is 302/302 across 63 files; see the Task8 row and whole-branch review.

The three non-blocking Plan2 follow-ups are: add deterministic retry and background active-Verify cases because this run had all tools done and Verify skipped; await fixture settlement before checking scroll stability; and clarify whether retrying/compacting remain informational statuses. Preserve every step transition and measured duration during replay.

Plan2 should seed its separate step store from snapshot.activeSteps and consume every step event. Synthetic replay should remain distinct from recorded/live-worker acceptance.

Plan2 frontend/store and browser acceptance, deterministic retry/active-Verify replay, and past-run step retrieval remain outside Plan1 acceptance.
