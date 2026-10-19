# Thin analyst: one continuing session per conversation

Date: 2026-10-14. Branch `feat/thin-analyst` from `feat/data-findings` at `a8b4d7f`. Evidence: `docs/research/messy-data-determinism-2026-10-13/EXPERIMENT.md`, Experiments 5–7 (local, uncommitted); runners in `.cache/thin-run-2026-10-14/` (git-ignored).

## Why

Model inference is about 96% of wall time; tools are about 3%. Time grows with the number of model turns, what the model reads and what it must write. The current workflow spends most of that on the harness, not the analysis. In Experiment 4 the analyst read 86 KB, including harness source, before its first script ran 5½ minutes in. It then wrote a script with six required diagnostics and an `answer()` function, and the findings sweep timed out.

Experiments with one session, a 17 KB plain-text prompt and the pricing plugin as the method:

| Experiment | Result |
|---|---|
| 5, seeded pack | 583 s, named the pence-trap finding and asked (every earlier variant failed or fell for it) |
| 6, clean pack | 828 s, correct (22423, £139,548.15) |
| 7, follow-up in the same session | 0 reads, 2 of 2 scripts ran first time, analysis about 130 s |

Data notes and the hand-written index are not adopted. The notes cost 1–3 minutes per turn and saved nothing. The index is specific to one pack and crashed on messy data.

## Decisions (user, 2026-10-14)

1. **Follow-ups continue naturally.** Population, period and basis that the user confirmed earlier in the conversation carry over. When a metric definition (for example revenue) is not settled by confirmed context or by the user in this conversation, and the choice changes the answer, the agent asks one focused question naming the options. It does not assume.
2. **No independent verifier, no assurance labels.** "Double-check this" is an ordinary follow-up turn.
3. **The analyst records confirmed facts.** It uses the plugin's `pricing-intake` skill to write `.pricing/context.md`, only for facts the user explicitly confirmed.
4. **Charts and the interactive UI stay.** Claims and exploration bindings remain the transport for checked figures and charts.
5. **Branch.** `feat/thin-analyst` from `feat/data-findings`. The detectors stay; the findings-check machinery goes. `feat/data-findings` stays as the record.

## Rules for this work (ponytail ultra)

- Smallest complete change. Deletion beats addition. No new abstraction, option, flag, wrapper, compatibility layer or migration; this is a clean break.
- Reuse what exists: worker process, `execute_analysis` recording, steps, checkpoint freezing, `bindExploration`, `checkedFigures`, detectors, profiles.
- **Budget:** production additions (`src/`, `bundled/`, `scripts/`, `harness.config.json`; not tests or Markdown) ≤ 300 lines. Production lines must fall by at least 1,500 net. Measure with `git diff --numstat feat/data-findings`.
- Every new branch, loop or parser gets one small test. Removed behaviour loses its tests.
- No paid model calls, no push, no PR. Never commit `docs/research/messy-data-determinism-2026-10-13/`.
- Before calling the work done, run `/anthropic-skills:ponytail ultra` over the full diff and act on it.

## Target flow

```
question → orchestrator
  first turn of a session: profiles + findings (cached) → full prompt; later turns: question + deadline
  → worker: continue this conversation's analyst session (plugin skills, read/write/edit/bash/execute_analysis)
  → final assistant text = reply; optional emit_handoff(claims, exploration) from the last successful execution
  → controller: claims from a recorded execution, sources unchanged, holds have reasons, reply figures appear in executed output
  → seal checkpoint (if claims) → message: reply + checked figures or charts
```

Hard checks that stay in code:
- every delivered figure came from a script that ran;
- source files are unchanged;
- a held claim has a reason;
- writes are limited to the stage folder and `.pricing/context.md`.

The plugin owns the method.

## Tasks

Each task is one or more commits, with tests green at the end of each. Record test counts before Task 1.

### Task 0: branch and baseline

`git switch -c feat/thin-analyst feat/data-findings`. Commit this plan and the two prompt files beside it (`docs: plan thin analyst`). Run `npm run typecheck`, `npm test`, `npm run test:python` and `npm run test:browser`, and record the counts.

### Task 1: the prompts

- `role-prompts.ts`: replace `sharedPrompt` and the three role prompts with one analyst system prompt. Start from `system` in `.cache/thin-run-2026-10-14/run-multi.ts` and add:
  - **Decision 1:** "Follow-ups continue this conversation: keep the population, period and basis the user confirmed earlier. If a metric's definition is not settled by confirmed context or by the user in this conversation and the choice changes the answer, do not pick one: ask one focused question naming the options."
  - **Decision 3:** "When the user confirms a business definition, record it in `.pricing/context.md` using the pricing-intake skill; record nothing the user has not confirmed."
  - **Decision 4:** "For figures worth showing, end the final script with `emit_handoff` (see the data guide); use analysis-visualize for charts and tables."
- `stage-prompt.ts`: replace the JSON envelope with the plain-text first-turn prompt from `run-multi.ts`:
  - question, working directory, Python, deadline, the 120 s execution limit;
  - confirmed context, source list, the data-access snippet with the reserved-word line;
  - the profiles file path, the compact findings with the "name it and ask" rule.

  Add a follow-up form with the question and deadline only. No `outputSchema`, `checkOutputSchema`, `remaining`, `scope` or `input`.
- `bundled/harness-tools/data-analysis.md`: cut from 16 KB to about 2 KB. Keep loading and attaching sources, `TRY_CAST`, the reserved words, `fetch_small_result` and `COPY` for large results, and one `emit_handoff` example with claims, a held claim with a reason, and exploration. Delete the diagnostics, review-routing, findings-treatment and handoff-packaging sections.
- Write profiles to a file per run (`.pricing/source-profiles.json`) instead of inlining them.

### Task 2: one continuing session per conversation

- `session.ts` and `worker.ts`: the analyst session lives at `.pricing/workflow/<conversation>/analyst/`. Use `SessionManager.continueRecent` on it, and `create` when the orchestrator asks for a fresh session. Turn compaction on for this session; stage mode currently disables it.
- Orchestrator: store `sessionKey = sha256(bundle fingerprint + sorted source path:sha256)` in `state.json`. If the key changed or there is no session, start fresh with the full prompt; otherwise continue with the follow-up prompt.
- Worker:
  - Delete `AnalystRevisions`, `finishHandoff`, `steerAnalystToFinalJson`, `assertAnalystToolCallAllowed`, `validateStageOutput` and `handoffContext`.
  - The stage result is the final assistant text plus the recorded executions.
  - Writes are allowed in the stage directory and at `paths.context`.
- `execute_analysis`: when a script fails, the tool error must say why: "killed after 120 s" or the exit code, plus the stderr tail. Experiment 4 lost minutes to a bare `Command failed:`.

### Task 3: the orchestrator

Rewrite `WorkflowOrchestrator.execute` as one stage per turn:
1. profiles and findings (keep the current error handling);
2. pick the fresh or continued session (Task 2);
3. run one analyst turn on one budget;
4. take the reply from the final text;
5. if the last successful execution wrote `handoff.json`, validate it and seal a checkpoint;
6. deliver the reply with checked figures or bound exploration, using the existing `checkedFigures` and `bindExploration`.

Validation (slim `validateNumericalEvidence` in `checkpoints.ts`). Keep:
- the claims come from the controller-recorded successful execution;
- stable source, script and output hashes;
- approved claims have values and known `sourcePaths`;
- held claims have a reason;
- claim values match the recorded checks.

Delete:
- scope comparison, required diagnostics, review-reason triggers and tasks;
- `resolvedRanking`, previous-checkpoint chaining and merging, and verifier-mode branches.

Remove `scope` and `previous` from `Checkpoint`, `loadCheckpoint` and the exploration result; restore matches on conversation and file hashes.

Outcome: `complete` when a reply is delivered (a question to the user counts), otherwise `no-verified-answer` with the failure message. The run fails when the turn budget runs out; there is no keep-the-last-answer fallback (rejected earlier).

Delete:
- `coordinator.ts`, `review-policy.ts`, `targeted-review.ts`, `revisions.ts`, `analysis-index.ts`, `analyst-handoff.ts`, `handoff.ts`, `delivery.ts`;
- `context-notes.ts` and `read-policy.ts` if unused;
- most of `output-contract.ts`;
- `budget.ts` down to one per-turn limit;
- their tests.

### Task 4: reply figures appear in executed output

The one new piece of logic. After the turn, every number in the reply with at least 3 significant digits must match, at the reply's precision, a number in this conversation's successful execution outputs. Ignore commas, currency symbols and `%`; round the output values to the reply's decimal places.

If any are missing, send one follow-up in the same session: "These figures in your reply do not appear in any executed output: …. Recompute them with a script or remove them, then reply again." Then check again. If they're still missing, deliver with a notice naming the unchecked figures. This replaces the handoff-repair loop.

Add one unit test covering a match, a rounded match (139548.1458 against 139,548.15), and a miss.

### Task 5: Python helpers

- `harness_output.py`, `emit_handoff`: keep `claims` (id, label, value, unit, sourcePaths, status, reason), `results`, `exploration`, `coverage`, `holds` and the single-emit rule. Delete:
  - the parameters `scope`, `reply`, `diagnostics`, `completed_operations`, `pending_operations`, `review_reasons`, `supporting_checks`, `resolved_ranking`, `conn` and `answer`;
  - the `data-findings.json` block.

  Keep `emit_checks` only if something still uses it; otherwise delete it.
- `data_findings.py`: keep `detect` and the CLI. Delete `treated_view`, `sweep`, `findings_views`, `_same` and `check_findings`.
- Update `tests/python` to match.

### Task 6: UI

- Remove the assurance badge, `verifying`, `pendingClaims`, `corrections` and the assurance labels (`AssuranceBadge.tsx`, `outcome.ts`, `Message.tsx`, `Announcer.tsx`, `contracts.ts`).
- `run-view.ts`: one stage, `analyse`; drop `plan` and `verify` from `StepStage`.
- Keep charts, tables, exploration restore and the step list.
- Browser tests must pass. Adapt `tests/fixtures/chat-workflow.*` and `tests/browser/fixture-server.ts` to a single-stage runner.

### Task 7: settings and config

- `harness.config.json`: `workflow.limits` becomes one block `{seconds, modelAttempts, toolCalls}`.
- Delete `workflow.policy` and `workflow.review`; update `settings.ts`, `defaults.ts` and `runtime.ts`. Clean break, no migration.
- Keep `scripts/eval-configured.mjs` working if the changes are small; otherwise say so in the report. Don't rewrite it.

### Task 8: docs

Rewrite `docs/architecture.md` for the new flow (keep it short). Update `PROJECT_GUIDE.md` (summary and update log) and the README sections that describe the coordinator, verifier or assurance labels.

### Task 9: local verification

1. Typecheck, vitest, pytest, browser tests, `npm run build`, `npm run format:check`.
2. A zero-cost smoke test: run `src/headless.ts --status`. Run one fixture conversation through the browser fixture server with two turns, and check that the second turn continued the same session file.
3. Measure the diff budget.
4. Run `/anthropic-skills:ponytail ultra` over `git diff feat/data-findings` and fix what it finds.
5. Write `docs/releases/thin-analyst-local-validation-2026-10-14.md` with the counts, the budget and the known limits.

## Known limits to carry into the report

- One run per experiment cell; live reliability is unproven until the review runs.
- Long conversations depend on Pi compaction.
- Findings can still be missed when the agent misreads one (Experiment 5 named `F-9e59` only as `TOTAL`).
- The source-hash key starts a fresh session when any file changes.
- The app-level chat session in `application.ts` remains and is out of scope.
