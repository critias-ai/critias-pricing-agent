Implement the thin-analyst plan in the pricing harness.

Repository: the repository root (the app is in `pricing-harness/`). Plan: `pricing-harness/docs/superpowers/plans/2026-10-14-thin-analyst.md`. Read it fully before touching code. Also read `PROJECT_GUIDE.md`, `PROJECT_GUIDE.local.md` and `pricing-harness/docs/architecture.md`.

Background: Experiments 5–7 in `pricing-harness/docs/research/messy-data-determinism-2026-10-13/EXPERIMENT.md` showed the following. One continuing analyst session with a short text prompt and the bundled pricing plugin answered where the full coordinator → analyst → controller → verifier workflow timed out. The working prototype is `pricing-harness/.cache/thin-run-2026-10-14/run-multi.ts`; port its prompts, don't reinvent them. The user's five decisions are in the plan and are settled; don't reopen them.

How to work:
- Invoke `/anthropic-skills:ponytail ultra` at the start and keep it active for the whole session. The smallest complete change wins: deletion beats addition, with no new abstraction, option, wrapper, flag, compatibility layer or migration. Reuse what the plan names: the worker process, `execute_analysis` recording, steps, checkpoint freezing, `bindExploration`, `checkedFigures`, detectors, profiles. Push back on any part of the plan the need does not justify, and say why in the report, not silently.
- Budget: production additions ≤ 300 lines, and production lines down at least 1,500 net, measured with `git diff --numstat feat/data-findings` over `src/`, `bundled/`, `scripts/` and `harness.config.json`. Check after each task. If a task would break the budget, stop and say so.
- Follow the tasks in order. Work test-first for new behaviour (session continuity, the reply-figure check, slim sealing). Delete the tests of removed behaviour; don't keep them alive with shims. Keep tests green at the end of every task, and use small conventional commits that end with the attribution line from your system reminder.
- Work inline. If you delegate, follow the delegation limits in `PROJECT_GUIDE.md`.
- Grep every caller before deleting or changing an exported function. The plan lists likely-dead modules; confirm before deleting.

Hard limits:
- Work only on `feat/thin-analyst`, created from `feat/data-findings`. No push, no PR.
- No paid or live model calls. The live runs belong to a separate review session.
- Never commit `pricing-harness/docs/research/messy-data-determinism-2026-10-13/` or anything under `.cache/`.
- Keep the hard checks the plan lists: figures come from recorded executions, sources are unchanged, holds have reasons, writes stay in the stage folder and `.pricing/context.md`. Never cut validation at a trust boundary.

Finish with plan Task 9:
- all local suites, build and format check;
- the zero-cost two-turn fixture check that the second turn continued the same session file;
- the diff budget;
- a `/anthropic-skills:ponytail ultra` pass over the whole diff, acted on;
- `pricing-harness/docs/releases/thin-analyst-local-validation-2026-10-14.md`.

Then report:
- what changed, with production lines added and removed;
- test counts before and after;
- every deviation from the plan and why;
- what you did not verify.

Update `PROJECT_GUIDE.local.md` with the outcome.
