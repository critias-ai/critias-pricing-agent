Review the thin-analyst implementation, then run the live acceptance runs.

Repository: the repository root (the app is in `pricing-harness/`), branch `feat/thin-analyst`, compared with `feat/data-findings`. Read:
- the plan, `pricing-harness/docs/superpowers/plans/2026-10-14-thin-analyst.md`;
- the local validation report, `pricing-harness/docs/releases/thin-analyst-local-validation-2026-10-14.md`;
- `PROJECT_GUIDE.md` and `PROJECT_GUIDE.local.md`;
- Experiments 5–7 in `pricing-harness/docs/research/messy-data-determinism-2026-10-13/EXPERIMENT.md`, as the baseline to compare against.

Invoke `/anthropic-skills:ponytail ultra` at the start and keep it active.

## Part 1: code review (no model calls)

1. Recompute the diff budget yourself. Production additions must be ≤ 300 lines and the net change at least −1,500, using `git diff --numstat feat/data-findings` over `src/`, `bundled/`, `scripts/` and `harness.config.json`.
2. Run `/code-review high` on the branch diff, then a `/anthropic-skills:ponytail ultra` pass. Look for:
   - dead code the deletion missed (unused exports, config keys, types, CSS, test fixtures);
   - new abstractions or options nobody asked for;
   - shims kept for removed behaviour;
   - hard checks the plan requires that went missing: figures from recorded executions, unchanged sources, held reasons, the write limits, the reply-figure check.
3. Check each user decision in the plan against the code and the prompt text:
   - follow-ups ask when a metric is unsettled;
   - no verifier and no assurance labels;
   - context writes go through pricing-intake, confirmed facts only;
   - charts and the interactive UI work;
   - the branch base is right.
4. Run typecheck, vitest, pytest, browser tests, build and the format check. Open the app with the browser fixture server and confirm that a two-turn fixture conversation renders a chart, a table and the step list.
5. Report findings by severity with file:line. Fix only Critical and Important ones, in separate commits that each have a regression test. List the rest.

## Part 2: live runs (paid; ask before spending)

Before any paid call, show the user the run list, the estimated cost of about $0.40–0.60 and the caps, and wait for a clear yes.

Setup:
- Drive the real app headlessly (`src/headless.ts`) on fresh copies of `workspace/northbridge-seeded` and `workspace/northbridge-test`. Copy `files/`, `.pricing/context.md` and `.pricing/files.json`; use `cp -Rc` for `.pricing/data-cache`.
- Use `openai/gpt-6-luna` and `deepseek/deepseek-v4.1-flash`, both at high reasoning.
- Cap each conversation at $0.10, polling cost from the session files the way `docs/research/.../prototype/run_experiment.py` does. Never run two conversations in one workspace.
- For multi-turn runs, write a small driver that sends one `{"type":"submit","request":{...}}` line on stdin, waits for `turn_end`, then sends the next. Put the driver in `.cache/thin-analyst-acceptance-2026-10-14/`, not in the repo.

Runs, for each model:
1. **Seeded pack, "what sku had the highest absolute gross margin".** Pass: the answer is 22423 at £139,548.15, or it names the pence-trap finding on 85123A and asks how to treat it, and it never presents 85123A as the answer without that. Duplicate-key trap avoided.
2. **Clean pack, the same question.** Pass: 22423 at £139,548.15, or that figure with the POST question.
3. **Clean pack, three-turn drilldown in one conversation:**
   1. "how did each product group perform on revenue and gross margin over the full period?"
   2. "show me the top 10 skus by revenue"
   3. "which of those are underperforming on margin and why?"

   If the agent asks a definition question, reply once with this test answer: "Use merchandise invoice-line sales before rebates as revenue, and exclude POST from SKU rankings." This is a test answer for the synthetic pack, not a business decision. Pass:
   - it asks rather than assumes when revenue is unsettled;
   - after the answer, it records the confirmation in `.pricing/context.md` and later turns keep scope, period and metric;
   - turns 2–3 continue the same session file with few or no re-reads;
   - at least one chart or table renders from bound claims.

For every run, record:
- wall time, cost, model calls, reads, executions and their success rate;
- time to the first successful execution;
- the full reply;
- whether every reply figure appears in executed output (check independently, at the reply's rounding);
- the session file used by each turn.

Compare with Experiments 5–7 and with the old workflow's results in `EXPERIMENT.md`. One run per cell shows large effects only; say so.

Write `pricing-harness/docs/releases/thin-analyst-live-evaluation-2026-10-14.md` with the tables, the pass or fail of each run with reasons, the defects found, and the recommended next step. Keep evidence in `.cache/thin-analyst-acceptance-2026-10-14/` (git-ignored). Commit only the report. No push, no PR, and never commit the research folder. Update `PROJECT_GUIDE.local.md`.
