# Haiku 5.5 high, 15-turn conversation, three live sessions (h-haiku-1/2/3), 2026-10-16

Purpose: repeat the Luna-high run ([2026-10-16-luna-high-15-turns-x3.md](2026-10-16-luna-high-15-turns-x3.md)) on a different
model, everything else held fixed, to separate **model-level** behaviour from **harness-level** behaviour. What is the same
in both runs belongs to the harness; what differs belongs to the model.

Setup (identical to the Luna run except model and provider): `anthropic/claude-haiku-5.5` via OpenRouter, thinking high,
snapshot `app-snapshot-31-live` (HEAD 9f8cd18), `northbridge-test` with its stored context.md, three sessions in parallel
(2 GB / 2 threads each), a person playing a pricing manager (short lazy sentences, the same 15 questions in the same order,
agent questions answered in a few words). Launcher `start-h-haiku-high.sh`, helper `turn-h.sh`, analysis `analyse_x.py`.
Costs are API-equivalent at the $0.10 / $0.50 per million Haiku 5.5 prices used in the earlier Haiku reports.
The turn texts were the Luna ones; turn 14 was one shared question ("which number should I quote, 96% or 99%, and why
would a share be over 100%") because all three answers to turn 13 already covered the company-wide full history.

| Session | Turns | Sum of turn wall time | API-equivalent cost | Model calls | Peak context | Compactions |
|---|---|---|---|---|---|---|
| h-haiku-1 | 15 | 442 s | $0.103 | 68 | 127k | 0 |
| h-haiku-2 | 15 | 422 s | $0.098 | 67 | 125k | 0 |
| h-haiku-3 | 15 | 442 s | $0.100 | 70 | 126k | 0 |

All 45 turns completed. No error stop, no limit, no restart.

## Model-level versus harness-level

| Measure | Luna high (x3) | Haiku high (x3) | Belongs to |
|---|---|---|---|
| Sum of turn time | 3,411 / 4,225 / 4,157 s | 442 / 422 / 442 s | model (about 9x) |
| Cost per session | $0.226 / 0.262 / 0.294 | $0.103 / 0.098 / 0.100 | model (about 2.6x) |
| Model calls | 121 / 119 / 148 | 68 / 67 / 70 | model |
| First-token wait, turn 1 to turn 15 | 4.5-7.6 s rising to 15.7-16.7 s | 2.9-3.9 s, 2.7-3.0 s at turn 15 (range 1.7-4.8 s) | model or provider, not harness load or context (see check 4) |
| Compaction | 1-2 per session at about 160k | none, peak 127k | model (more tokens per turn on Luna) |
| Turns ending on a question | 2 / 2 / 3 of 15 | 15 / 10 / 15 of 15 | model |
| Turns with a table and chart | 11 / 12 / 14 | 6 / 4 / 6 | model |
| Chart kinds | line, bar, waterfall (waterfall unprompted on both bridges) | line, bar only; no chart on either bridge | model |
| `skill-read` gate blocks | 2 in turn 1, one extra in one session | 4 / 2 / 2 in turn 1, one more in turn 2 of two sessions | harness (same pattern) |
| Keying-error lines on 22502 (£649.50) raised unprompted | all three, turn 2-3 | all three, turn 3 | harness plus context card |
| Heart-holder £0 line, invoice C536757 | never reached | never reached | script never asks for an overall ranking |
| Cross-turn script reuse | none | none (one script each in S1 and S2, SQL otherwise) | harness: nothing prompts reuse |
| Bridge method fixed by the plugin | no: three methods, price effect +£240k to +£644k | no: price effect −£208k (S1, S3) and +£262k (S2) | harness |
| Bridge total ties to the finance +£241,024 | yes, in all three, with a stated residual | no: £221,221 / £226,081 / £221,406, gap disclosed, "not traced" | model |
| Scope drift on "the long tail" | three different scopes | none: all three went company-wide, full history | model |

## The seven checks

1. **Script reuse on drill-down: no, and little Python at all.** S1 and S2 wrote one script each (turn 12, the bridge);
   S3 wrote none. The drill-downs in turns 4 to 10 were 1 to 7 `query` calls on views built earlier, and `repeated-sql`
   fired only in S1 (turns 3, 14) and S3 (turns 1, 5). One file was edited twice inside its own turn (S2 turn 12). Same
   conclusion as Luna: the harness does not carry scripts across turns; here the SQL path makes that cost small
   (a drill-down takes 1 to 5 calls, 9 to 25 s).
2. **Complexity ramp and attention: held, but compaction was not reached.** Peak context was 125-127k, below the 160k
   compaction point, so the compaction question is untested on Haiku. Without compaction, recall was good: turn 9 named
   the June credit lines for "that SKU in that month" without being told, S2 turn 9 matched the 60-unit £4.95 sale to its
   credit, and the turn 15 bullets in all three reused earlier numbers.
3. **Tool use consistent: yes.** Almost all work was `query` (39-43 calls), `present` (5-7), `read` (4-5, the knowledge
   cards). One `write` + `execute_analysis` for the bridge in S1 and S2. S2 had 2 `edit`s, one failing.
4. **Faster as context is cached: flat, not rising.** Cache share was 1.0 from turn 1. First-token wait stayed at 2-4 s
   from turn 1 (39k) to turn 15 (127k) with three sessions running in parallel on the same machine. That rules out parallel
   load on the harness and context size up to 127k as the cause of Luna's rise to about 16 s; the rise is on the
   model or provider side. The earlier solo Luna run (5-7 s) fits that too, so the open item "load or context" is
   closed for the harness, not for Luna on a different provider. Turns got shorter (88 s in turn 2, 9 s in turn 15)
   because later questions needed fewer calls (10-11 in turn 1, 1-5 from turn 6).
5. **Charts: delivered where a chart was natural, not on bridges.** A table and chart appeared in turns 1, 2, 3, 4, 5, 11
   in S1 and S3, and turns 1, 2, 5, 11 in S2. No `present` error in any turn (Luna had one). Both bridge turns (7, 12) were
   tables in prose, with no waterfall, where Luna chose a waterfall unprompted every time. Continuation charts worked;
   the chart type chosen is the model's, and Haiku does not reach for the chart guidance on its own.
6. **Hooks: about right, fewer than on Luna because turns are short.** `skill-read` blocked in turn 1 (4, 2, 2) and again
   in turn 2 of S2 and S3, never later. `same-rows/peer/offsets` notes fired in 14 / 11 / 8 turns. `plugin-lint` fired
   in turns 3 and 12 of every session. `error-hint` 1 / 3 / 3, `repeated-sql` 3 / 0 / 2. No `brake-40`, no `slow-query`,
   no `two-fails`: no turn lasted over 90 s, so the pacing hooks never mattered. The tool-error count was 10 / 7 / 8
   (SQL errors, all recovered in the same turn).
7. **Other.**
   a. **Over-asking is the clearest model-level difference.** Nearly every Haiku answer ends in a "**Question:**" line
      (15 / 10 / 15 of 15 turns against 2 / 2 / 3 on Luna). Many are offers of a next scenario ("restate with the two June
      lines excluded?") that a lazy user would just ignore; I ignored most and the next question was still answered.
      A few are real decisions (are the £649.50 lines genuine?). Luna asked only when a treatment was needed.
   b. **Good unprompted data-quality handling.** All three raised the £649.50 lines in turn 3, said the Storage drop
      depends on them, and kept them as recorded. S2 and S3 added the as-recorded versus excluded numbers at once (Storage
      Q2 margin 47.70% or 37.76%, change −8.74 pp or +1.20 pp). S1 showed that only after the SKU question in turn 4.
      Unknown-customer lines (35 lines, 99 units, £617) were disclosed in turn 8 by all three.
   c. **Arithmetic and wording slips that Luna did not have.**
      - S1 turn 11 gave Jan-Nov net sales of £10.4m (2011) and £9.2m (2010). The quarterly table in turn 1 gives about £8.6m and £8.4m,
        and S3 stated £8.59m / £8.39m.
      - S3 turn 8 gave customer 15098 as 96.8% of the June sales; £39,620 of £40,298 is 98.3%.
      - S3 turn 6 opened "three months stand out" and then listed seven.
      - S3 turn 13 said the positive-profit tail was "more than the overall total" (£8.31m against £8.38m, so it is not).
        It corrected that in turn 14 when I asked why a share would be over 100%.
      - S2 turn 15, bullet 3 paired "4,450 SKUs" (positive-profit tail) with "96.19%" (net basis including 465 loss-making SKUs, which is 4,915 SKUs).
   d. **Bridge totals do not tie to the finance export.** Luna's three answers all started from the finance +£241,024 and showed a residual.
      Haiku's turn 12 built from sales lines and reported +£221,221 (S1), +£226,081 (S2), +£221,406 (S3), disclosing a £15-20k gap
      "not traced". S1 had quoted +£241,024 (6.83%) in turn 11 and then used £221k in turn 12, so two totals sit one turn apart.
   e. **Price effect sign differs by method.** S1 and S3 (volume at 2010 unit margin, price on 2011 quantity, same formula) give price −£208k,
      volume −£109k, cost −£149k, new items +£794k. S2 splits mix out and gives price +£262k, volume −£523k, mix −£39k, cost −£165k, new
      +£999k, within about £5k of Luna S2 on every line. Both are "item level". The sign flip is not explained by any session and none mentions that
      another convention gives the opposite sign.
   f. **Different contribution convention in the SKU drill-down.** S1 and S2 gave 22502 as −16.81 pp of the Storage drop (top 10 sum −20.6 pp,
      other SKUs +11.9 pp); S3 gave −8.26 pp and Luna gave −8.65 pp, with the top 10 reconciling to the category. Both conventions sum to the
      −8.74 pp total, but a reader sees −16.8 pp attributed to one SKU against a category change of −8.7 pp.
   g. **Same numbers where the method is fixed.** Quarterly table identical to Luna's. Q3 against Q2 margin 40.65% / 44.74% (finance) and
      40.70% / 44.76% (lines). Top 3 SKUs and their gross profit (£47,939 / £32,843 / £24,622), top-10 share 33.13%, 29 negative-profit SKUs
      (−£15,188), the May to June 2011 bridge (price +£39,299, quantity −£768, cost £0, total +£38,531), long tail 96.19% net and 99.21%
      positive-only. All three Haiku sessions said to quote 96.19%; Luna S2 and S3 said 99.18%.

## How the model worked (practice evidence)

- Turn 1: 10-11 calls (the skill-gate blocks, reads of the knowledge cards, 5-8 queries including a few SQL errors, one chart).
  The answer went to the finance export and did not ask about basis or missing costs, unlike Luna.
- Drill-down: 1-5 `query` calls and one `present` where a chart was asked for. Answers averaged about 1.9-2.1k characters, against
  about 1.1k on Luna and led with a "Result:" line or a bold headline, then the table, then a caveats list.
- It cited the user's earlier decision ("kept as recorded, flagged") in every later answer on 22502 and put the same caveat in the board bullets.
- Caveats ran at 3-5 bullets per answer, including "costs are landed-cost estimates, not audited" every time; a lazy user will stop reading them.

## What this says about the harness

Harness-level, confirmed on a second model:
1. **No default bridge method in the plugin.** Both models vary: three methods on Luna, two on Haiku (with an opposite price-effect sign).
   Fixing one convention in the plugin (item-level, volume at prior-year margin, price on current quantity, mix and new/lost shown as separate lines,
   tied to the finance total with a stated residual) would remove the largest run-to-run difference. Same for the SKU-contribution convention.
2. **No reuse of earlier scripts across turns.** Cost is small on a SQL-first path; it matters more on Luna, where each new question wrote a new script.
3. **Scope is implicit.** Haiku read "the long tail" as company-wide full history in all three sessions; Luna drifted to three scopes. A one-line scope statement
   at the top of each answer would make either reading visible.
4. **The skill-read gate** costs 2-4 blocked calls in turn 1 of every session on every model. It no longer re-fires after turn 2.
5. **Charts work on continuation turns on both models**; no row-key or dropped-table notice in 90 turns.
6. **Parallel load on the harness is not what slows a model:** Haiku's first token did not rise with three sessions and 127k tokens.

Model-level: speed and cost, over-asking, chart volunteering and waterfall choice, reconciling the bridge to the finance figure, and the small arithmetic slips.

## Open items

1. Fix a default bridge and SKU-contribution convention in the plugin (above). This is the one item that shows up in both runs.
2. Have the answer say when another common convention would change a headline figure's sign, as for the price effect.
3. Haiku ends almost every turn on a question: a hook or the plugin's closing rule could ask for a stated assumption instead, as Luna does unprompted.
4. A fixed bridge total versus the finance export: tie out, or say why the line-level basis cannot.
5. Compaction on Haiku is untested; it needs a longer script (about 25 turns) to pass 160k.
6. Add a cheap self-check before the final answer for shares and sums (the 96.8% and "more than the total" slips were caught only when asked).

## Not tested

Haiku low or medium on this script; a solo Haiku run (parallel did not slow it, so not needed for speed); a solo Luna run to separate
Luna's first-token rise from the provider.
