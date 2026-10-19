# Thin analyst: code review and live evaluation, 2026-10-14

Branch `feat/thin-analyst`, from `feat/data-findings` at `a8b4d7f`, six commits. Plan: `docs/superpowers/plans/2026-10-14-thin-analyst.md`. Local checks: `docs/releases/thin-analyst-local-validation-2026-10-14.md`. Evidence for the live runs is in `.cache/thin-analyst-acceptance-2026-10-14/` (git-ignored).

**One run per cell.** Three conversations on one model. They show large effects only; they do not show reliability.

## Scope changes made at run time

- The review prompt listed Luna and DeepSeek at $0.10 per conversation. The user chose Luna only, at $0.20 per conversation and $0.60 in total. DeepSeek was not run.
- Spend: $0.1283 (run 1 $0.0374, run 2 $0.0407, run 3 $0.0502).

## Part 1: code review (no model calls)

### Budget and checks

| Check | Result |
|---|---|
| Production lines added (`src/`, `bundled/`, `scripts/`, `harness.config.json`) | 300 (limit 300) |
| Production lines removed | 3,078 |
| Net | −2,778 (limit at most −1,500) |
| Branch base | `a8b4d7f`, the tip of `feat/data-findings` |
| `npm run typecheck`, `npm run build`, `npm run format:check` | pass |
| Vitest | 168 passed, 55 files |
| Pytest | 41 passed |
| Playwright (browser) | 13 passed |
| Two-turn fixture conversation (fixture server, Playwright) | two assistant messages, three charts, two tables, two exploration blocks, 2 submissions. The step list is covered by the existing "Stepped synthetic" browser test, which passes; the "Explore synthetic" fixture has no steps by design |

### User decisions against code and prompt

| Decision | Where | Result |
|---|---|---|
| Follow-ups ask when a metric is unsettled | `analystPrompt`, `role-prompts.ts`/`stage-prompt.ts` | present; observed live in runs 1–3 |
| No verifier, no assurance labels | grep over `src/`, `bundled/` | none left in production code; stale `assurance` fields remain in two test fixtures |
| Context writes through pricing-intake, confirmed facts only | prompt; write guard allows `.pricing/context.md` | present; observed live in run 3 |
| Charts and interactive UI work | browser tests, fixture check | work from a valid exploration; see defect L1 for the live case |
| Branch base | `git merge-base` | correct |

### Findings (`/code-review high`, then an ultra-ponytail pass)

No Critical or Important finding, so no fix commits. Listed, not fixed:

| # | Sev | Where | Finding |
|---|---|---|---|
| 1 | Minor | `reply-figures.ts:12` | A fraction printed as `0.1234` and written as "12.34%" counts as unverified. The cost is one extra model turn and a notice; it did not fire live |
| 2 | Minor | `orchestrator.ts:140` | Only the last successful execution is sealed. An exploratory last script drops an earlier script's handoff with no notice |
| 3 | Minor | `worker.ts:105` | The output file is written before `audit.success`; a script that calls `sys.exit(0)` leaves an output the reply check still accepts |
| 4 | Minor | `session.ts:42` | Compaction is on for the analyst session. Its model call may bypass the budget gate and the cost counters; not exercised, no run reached compaction |
| 5 | Minor | `worker.ts:50` | The `.pricing/context.md` write skips the symlink guard that every other path gets |
| 6 | Minor | `delivery.ts:1` | The plan listed it for deletion; one function remains with regex alternatives for removed stop reasons |
| 7 | Minor | `tests/unit/checked-figures.test.ts:9`, `browser-state.test.ts:50,60`, `recorded-output.test.ts:37` | Fixtures keep the removed `assurance` and `reviewReasons` fields |
| 8 | Minor | `scripts/eval-focused-workflow.mjs:276` | Still tests for the removed `verified-partial` outcome |
| 9 | Minor | `steps.ts:6`, `run-view.ts:3` | Single-key stage maps left from three stages |

## Part 2: live runs

Setup: the real app headlessly (`src/headless.ts`), fresh copies of `workspace/northbridge-seeded` and `workspace/northbridge-test`, `openai/gpt-6-luna`, `high`, three conversations in parallel in separate workspaces. Driver `drive.py` (cap polling from the session files, one JSON `submit` line per turn, waits for `turn_end`); analysis `analyse.py`. Run 3 used the prescribed test answer once, automatically, on the first reply that asked a question.

Both workspaces' `context.md` already confirmed "absolute margin ranking" and "gross profit as the margin layer" (2026-10-12). Neither defines revenue.

### Results

| | Run 1: seeded, top margin SKU | Run 2: clean, top margin SKU | Run 3: clean, three-turn drilldown |
|---|---|---|---|
| Wall | 690 s | 644 s | 770 s (turns 90 + 363 + 286 + 31 s) |
| Cost | $0.037 | $0.041 | $0.050 |
| Model calls | 25 | 23 | 32 |
| `read` calls | 11 | 10 | 22 (turn 1: 15; answer turn: 7; turns 2–3: 0) |
| `execute_analysis` (ok) | 10 (6), 60 % | 8 (6), 75 % | 8 (6), 75 % (turn 1: 0; answer 3 of 3; top 10: 3 of 5; margin: 0) |
| Failures | 3 exit code 1, 1 killed after 120 s | 1 exit code 1, 1 killed after 120 s | 2 exit code 1 |
| First successful execution | 85 s | 69 s | 63 s after the answer; 127 s in the top-10 turn |
| Session files used | 1 | 1 | 1, by all four turns |
| Run outcome | complete | complete | complete ×4 |
| Checkpoint sealed | 1 (0 claims, 1 held) | 1 (3 claims, 1 held) | 1 (10 claims, 0 held), on the top-10 turn |
| Reply-figure notice | none | none | none |
| Independent figure check (3+ digits, reply's precision) | 6 of 6 appear in executed output | 5 of 5 | 18 of 18 (turn 2); turns 1, 3 and answer turn had none |

### Pass or fail

**Run 1, seeded pack: PASS.** The reply holds the answer and names the pence-trap finding (`F-bc97…`, 83 flagged price rows). It says that removing them changes the provisional leader from 85123A (£158,138.12) to 22423 (£139,328.17), and asks how to treat them. It also names the `TOTAL` record (`F-0ca…`, `F-9e5…`) and the unallocated `ALL` rebates. 85123A is never presented as the answer without the finding. The 22423 figure is £139,328.17, not £139,548.15: the £220 difference is the trailing-space rows (`F-9e59…`), which it described as the `TOTAL` record, the same gap as in Experiment 5. Reply wording "Result: held pending one basis confirmation" leads with 85123A as "provisional leader"; a reader who skims could take it as the answer.

**Run 2, clean pack: FAIL.** The reply states no SKU and no margin. It asks whether `POST` and `TEST001` count as merchandise ("all 2,122 `POST` lines" lack costs) and lists the held claim. The pass rule needed 22423 at £139,548.15 or that figure with the POST question; no figure was given. Experiment 6 answered this same question correctly on the same pack. Its own executions printed `22423 … gross profit GBP=139548.1458` (runner-up beside it) in all five recorded outputs, so it had the answer and withheld it from the reply.

**Run 3, clean drilldown: FAIL on one of five criteria.**

| Criterion | Result |
|---|---|
| Asks rather than assumes when revenue is unsettled | pass: turn 1 asked about rebates and merchandise sales after 90 s and no execution |
| After the answer, records the confirmation in `.pricing/context.md` | pass: two confirmed facts added with scope, date and source, plus a change-log line |
| Later turns keep scope, period and metric | pass: turns 2 and 3 restate full period, pre-rebate revenue, POST excluded |
| Turns 2–3 continue the same session file with few or no re-reads | pass: one session file, 0 reads in both turns |
| At least one chart or table renders from bound claims | **fail**: see L1. The sealed checkpoint has 10 claims and a "Checked figures" list was delivered, but no chart or table rendered |

Other observations on run 3:
- The first deliverable never arrived. After the test answer the agent asked a second question (how to treat six findings) and held the product-group totals. The driver sent only one test answer, so that question went unanswered and the top-10 turn proceeded "as recorded" with the caveat and a repeated question.
- Turn 3 ("which of those are underperforming on margin and why?") asked what "underperforming" means (absolute gross profit or margin rate, and against what). Defensible, since the confirmed fact covers ranking rather than underperformance, but it delivered nothing in 31 s.

### Against earlier experiments

| Run | Wall | Cost | Calls | First ok execution | Outcome |
|---|---|---|---|---|---|
| Old workflow, Luna (3 attempts) | 746 / 70 / 822 s | — | — | — | held / asked / held; 0 correct and certified |
| Old workflow with code checks, Luna | 190 s, 310 s | $0.019 to $0.036 | — | — | 2 correct and certified |
| Exp. 5, thin session, seeded | 583 s | $0.065 | 47 | 165 s | answered and asked (pence trap named) |
| Exp. 6, thin session, clean | 828 s | $0.063 | 50 | 165 s | 22423 £139,548.15, asked POST |
| Exp. 7 A1 / A2 (continued) | 659 s / 372 s | $0.063 / $0.027 | 32 / 7 | — | answered; follow-up with 0 reads |
| **This branch, run 1 (seeded)** | 690 s | $0.037 | 25 | 85 s | named pence trap and asked |
| **This branch, run 2 (clean)** | 644 s | $0.041 | 23 | 69 s | asked POST, no figure |
| **This branch, run 3** | 770 s over 4 turns | $0.050 | 32 | 63 / 127 s | asked, recorded, top 10 table; no chart/table |

Reading, on single runs:
- Cost per conversation ($0.04) and calls (23–25) are lower than Experiments 5–6 ($0.063–0.065, 47–50 calls). Wall time is in the same 600–830 s band as before, so the run-to-run spread Experiment 6 measured covers it.
- First successful execution came earlier (63–85 s against 165 s).
- Execution success rate is 60–75 %, the same as before (Exp. 5: 4 of 16; Exp. 6: 5 of 13). Failures are the model's own script errors and one 120 s kill per conversation. The new error text ("killed after 120 s", exit code and stderr tail) appears in the tool results as intended.
- The continued session worked: turns 2–3 of run 3 made no reads.
- The old workflow with code checks was faster on the one correct case (190–310 s) but depended on a pack-specific index, which the research rejected.

## Defects found

| # | Sev | Defect | Evidence |
|---|---|---|---|
| L1 | **Important** | A table-only exploration is dropped. `normalizeExploration` (`src/agent/workflow/exploration.ts:137`, and the strict twin at line 24) requires a `charts` array. The analyst followed `analysis-visualize/references/in-chat-exploration.md`, built a valid one-table descriptor, and the checkpoint recorded `explorationIssues: ["Exploration description has an unsupported shape or version"]`. The user saw a markdown table written by the model and a "Checked figures" list, with no interactive table. The skill's JSON example contains `charts` but does not say it is required. This validation is unchanged from `feat/data-findings`; the thin analyst exposes it because it hands the descriptor over once, with no repair round | `r3-drill-luna` checkpoint `c720a669…`, handoff `top10_skus.py` line 78 |
| L2 | Important | The dependent skill reference `in-chat-exploration.md` still shows the old handoff packet (`claims` with `evidence`, `code`, `results`) rather than `emit_handoff(claims=…, results=…, exploration=…)`. The analyst coped but spent a read on it | same file |
| L3 | Moderate | Over-asking blocks first deliverables. In run 2 the model computed 22423 at £139,548.15 in every execution, then withheld the whole answer for a POST/TEST001 question. In run 3 two questions came before any product-group number. Both follow the plan ("ask when a metric is unsettled", "name a finding and ask") but together they leave the user with no number. A figure computed on a stated basis, with the question attached, matches the pass rule and what Experiment 6 produced | runs 2, 3 |
| L4 | Minor | The reply-figure check passes a figure that merely appears somewhere in executed output, and run 2 held a figure while the check had nothing to do. It never fired in 3 runs, so it is untested live (a notice or recheck turn was not observed) | all runs |
| L5 | Minor | Wall time per conversation is not lower than the thin prototype's. Time goes to cost-coverage checks and findings analysis before the first answer, as in Experiment 5 | runs 1–2 |

## Recommended next step

1. Fix L1 and L2 first (small, local): make `charts` optional (default `[]`) in both normalizers with one regression test for a table-only descriptor, and update `in-chat-exploration.md` to the `emit_handoff` shape and say charts are optional. This is the only defect that blocks an acceptance criterion by itself.
2. Then re-run run 3 and runs 1–2 with the same driver, on Luna, and add DeepSeek (not run here).
3. Decide L3 with the user: whether, when the agent must ask, it should also compute the figure on the stated basis and show it with the question. Experiment 6 shows the model can; the current prompt lets it hold everything.
4. Leave findings 1–9 of Part 1 for a cleanup commit after the re-runs.

Not checked: DeepSeek; compaction under a long conversation; a reply that triggers the figure recheck; an aborted continued turn; real credentials with a real company's data.
