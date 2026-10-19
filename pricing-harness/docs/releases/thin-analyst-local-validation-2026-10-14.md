# Thin analyst: local validation, 2026-10-14

Branch `feat/thin-analyst`, from `feat/data-findings` at `a8b4d7f`. Plan: `docs/superpowers/plans/2026-10-14-thin-analyst.md`. Local checks only: no paid or live model call, no push, no PR. Reliability of the single-session flow against a live model is unproven.

## What changed

- One Pi session per conversation at `.pricing/workflow/<conversation>/analyst/`, compaction on. The orchestrator continues it while `sha256(bundle fingerprint + sorted source path and hash)` matches `state.json`; otherwise it starts fresh and sends the full first-turn prompt. A follow-up sends the question and the deadline.
- One analyst system prompt (the experiment prompt plus the three decisions of the plan) and a plain-text first-turn prompt. `data-analysis.md` shrank from 16 KB to 2 KB.
- Reply check: every number in the reply with three or more significant digits must match a number printed by a script that ran in the conversation, at the reply's precision. One follow-up in the same session, then a notice naming what is still unmatched.
- Slim sealing: the last successful execution's `handoff.json` is sealed only when each claim matches the checks that execution printed, approved claims have a value and known source paths, and held claims have a reason. A rejected handoff delivers the reply with a notice.
- Removed: coordinator, verifier, review routing, targeted review, analysis index, revision rounds, handoff repair, assurance labels and the "needs input" outcome, the `data-findings.json` check machinery, `emit_checks`, `findings_views`, `check_findings` and `sweep`.
- `harness.config.json`: `workflow.limits` is one block of `seconds`, `modelAttempts` and `toolCalls` (900, 100, 150). `workflow.policy` and `workflow.review` are gone.
- `execute_analysis` errors now say "killed after 120 s" or the exit code, with the stderr tail.

## Counts

| Suite | Before (`a8b4d7f`) | After |
|---|---|---|
| Vitest | 349 tests, 74 files | 168 tests, 55 files |
| Pytest | 63 | 41 |
| Browser (Playwright) | 14 | 13 |
| Typecheck, format check, build | pass | pass |

Removed tests covered removed behaviour only. New tests: reply figures (3), orchestrator flow (11), checkpoint sealing (5), session continuation (1), fixture-runner conversation continuity (1).

## Budget

`git diff --numstat feat/data-findings -- src bundled scripts harness.config.json`: 300 lines added, 3,078 removed, net -2,778. Budget: at most 300 added, at least 1,500 net removed.

## Zero-cost checks

- `src/headless.ts --status`: loads, resolves the configured model and lists the eight skills; the agent shows not ready only because no credential is configured here.
- The real worker, run through `StageRunner` with no credential, starts, builds the stage session for both `fresh: true` and `fresh: false`, emits its configuration event and stops at the missing API key. No model request is made.
- Session continuation: `tests/integration/session.test.ts` writes a message into a stage session, reopens it with `fresh: false` and gets the same session file and transcript with compaction on; `fresh: true` gets a new file.
- Fixture conversation: two questions through the controller with the offline fixture runner. The first request is `fresh: true`, the second is `fresh: false` with only the follow-up prompt.

## Deviations from the plan

- Tasks 1 to 5 are one commit. The prompts, session, orchestrator, reply check and helpers share one contract, so no earlier split keeps the suites green. The Python and data-guide change is its own commit.
- To stay within 300 added lines I dropped parts the plan did not ask for: per-stage metrics (`stage-metrics.ts`, `workflow.stages`, `firstVerifiedAnswerAt`, prompt hashes, `codeReuse`; the events stay in `events.jsonl`), the per-run `stage-result.json`, the check that the controller's own `run.json`, `conversation.json` and `state.json` are unchanged during a turn, and the `explorationNotice` for unbound views (the coverage note and the figures list remain).
- Claim values must equal the printed check exactly (before: 0.01). Each claim's evidence is all files frozen from its execution.
- Views bind only from an exploration descriptor the script hands off; the default fact tables for a request without one are gone, so the figures list covers that case. Conversations from earlier versions lose their rich messages on restore.
- `StageResult` carries only text; executions come from the controller-received events.
- The single limit block keeps the `PRICING_ANALYSIS_*` environment names.
- An interrupted run with a checkpoint now ends `no-verified-answer` (no `verified-partial`), because delivery happens in one step.
- The reply check skips a bare number from 1900 to 2100 as a year (`shortcut:` comment in the code).

## Known limits

- One run per experiment cell. Live reliability is unproven until the review runs.
- Long conversations depend on Pi compaction. An aborted turn can leave an unanswered tool call in the session; continuing from it has not been tried.
- The reply check matches printed numbers, so a model that prints a number only to satisfy it passes. Figures written as "£1.2m" or "12k" are not checked.
- Findings can still be missed when the agent misreads one (Experiment 5 named `F-9e59` only as `TOTAL`).
- Any change to a source starts a fresh session and wipes the analyst folder; checkpoints are kept.
- The write guard covers the `write` and `edit` tools; `bash` is not sandboxed, as before.
- A change to `.pricing/context.md` outside the analyst reaches the model only in a fresh session.
- `scripts/eval-configured.mjs` and `scripts/latency-report.mjs` still work; `eval-focused-workflow.mjs` was not run.
- The application-level chat session in `application.ts` remains and is out of scope.
