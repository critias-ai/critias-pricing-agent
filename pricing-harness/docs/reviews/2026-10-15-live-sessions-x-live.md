# Three live sessions, 2026-10-15 (x-live-1/2/3)

Setup: gpt-6.1-sol, thinking low, OpenAI (ChatGPT subscription login), snapshot `app-snapshot-31-live` (HEAD 9f8cd18),
`northbridge-test` workspace with its stored context.md, three sessions in parallel (2 GB / 2 threads each),
turns written live by a person playing a pricing manager, short lazy sentences. Driver `drive_live.py --minutes 150`,
analysis `analyse_x.py <run>`. Costs are API-equivalent (token price x usage), not billed.

| Session | Opening question | Completed turns | Ended |
|---|---|---|---|
| x-live-1 | quarterly sales, profit, margin | 6 (T7 failed) | usage limit, turn 7 |
| x-live-2 | which products make the most money | 8 (T9 failed) | usage limit, turn 9 |
| x-live-3 | why did margin drop recently | 3 (T4 failed) | usage limit, turn 4 |

All three ended the same minute (18:23:36-40 UTC) on the provider error "The ChatGPT user has reached their
Subscription Sharing usage limit". Not a harness fault. The user saw only "Could not produce a checked answer.
Retained analysis files are drafts." (finding 7a).

API-equivalent cost: x-live-1 $2.04 (7 turns, 2,005 s), x-live-2 $1.81 (9 turns, 1,951 s), x-live-3 $1.86 (4 turns, 1,981 s).
Completed turns averaged about $0.25; 116 / 115 / 93 model calls.

## Per-turn

| Session / turn | Wall s | Calls | $ | Context peak | Cache share | Avg first-token s | Question at end |
|---|---|---|---|---|---|---|---|
| 1 / 1 | 121 | 14 | 0.12 | 26k | .90 | 3.1 | yes |
| 1 / 2 | 371 | 32 | 0.38 | 75k | .97 | 5.6 | yes |
| 1 / 3 | 238 | 15 | 0.25 | 97k | .98 | 8.3 | yes |
| 1 / 4 | 476 | 23 | 0.54 | 144k | .98 | 13.5 | yes |
| 1 / 5 | 184 | 12 | 0.26 | 155k | .99 | 9.8 | no |
| 1 / 6 | 328 | 10 | 0.31 | 163k, compaction | .96 | 14.7 | no |
| 2 / 1 | 197 | 18 | 0.16 | 33k | .92 | 5.5 | yes |
| 2 / 2 | 129 | 13 | 0.11 | 45k | .97 | 5.1 | yes |
| 2 / 3 | 127 | 11 | 0.11 | 55k | .98 | 4.8 | no |
| 2 / 4 | 199 | 11 | 0.14 | 67k | .98 | 8.2 | no |
| 2 / 5 | 284 | 17 | 0.28 | 87k | .98 | 10.5 | yes |
| 2 / 6 | 157 | 11 | 0.18 | 97k | .99 | 8.5 | no |
| 2 / 7 | 347 | 14 | 0.32 | 122k | .98 | 17.8 | yes |
| 2 / 8 | 374 | 13 | 0.35 | 143k | .99 | 18.3 | no |
| 3 / 1 | 609 | 39 | 0.56 | 84k | .95 | 7.2 | yes |
| 3 / 2 | 355 | 16 | 0.35 | 118k | .98 | 12.6 | no |
| 3 / 3 | 741 | 24 | 0.68 | 163k, compaction | .97 | 15.7 | no |

9 of 17 completed turns ended on a question to the user.

## The seven checks

1. **Script reuse on drill-down: yes where Python is used, by editing a shared module.** x-live-1 wrote `q1_shared.py` in
   turn 2 and edited it in turns 3-7; each new question got a thin new script on top (`q1_category_analysis.py`,
   `q123_analysis.py`, `q3_price_volume_scenario.py`). No file was rewritten wholesale (0 rewrites in 17 turns).
   x-live-3 edited `margin_analysis.py` in turns 1, 3 and 4 but also wrote three new scripts in turn 3.
   x-live-2 wrote no Python at all (SQL queries and `present` only) and reused through SQL views; `repeated-sql`
   fired in turns 5 and 6 and the views persisted.
2. **Complexity ramp: held up.** Escalation went from a quarterly table to margin bridge, category drill, three-quarter
   repeat, price/volume scenario (x-live-1), and from a product ranking to a no-ID vs named price gap, order-size
   matching, size-matched premiums (x-live-2). Earlier decisions survived: in x-live-2 turn 6 the analyst listed all
   four earlier keying-error lines by invoice and line id, without compaction at 97k context. x-live-1 compacted once
   (turn 6, 163k tokens) and x-live-3 once (turn 3, 163k); both summaries kept the goal, the user's confirmed
   treatments and the handling rules, and the following turns used them correctly. Not tested: a question
   that depends on a number from before a compaction (x-live-1 turn 7 would have, but hit the limit).
3. **Tool use consistent within a session: yes. Across sessions the path differed.** x-live-2 never used
   `execute_analysis` or `write`: only `query`, `read`, `edit`, `present`. x-live-1 and x-live-3 used
   `bash`, `write`, `edit`, `execute_analysis` for the same kind of question. Both worked.
4. **Faster as context is cached? No.** Cache share is 0.95-0.99 from turn 2, so cost per call falls, but wall time
   did not: a turn is dominated by call count and first-token wait, and the wait rose from 3-5 s per call at 26k
   context to 14-19 s at 120-160k (x-live-1: 3.1, 5.6, 8.3, 13.5, 9.8, 14.7; x-live-2: 5.5 -> 18.3). That contradicts
   the earlier "flat vs context size" result (4-5 s from 13k to 125k). Three sessions ran in parallel on one
   subscription and the limit was reached, so load may explain it. Needs one solo run to separate the two.
5. **Charts: worked on every completed turn.** 17 of 17 completed turns presented at least one table and one chart,
   and a new chart each time (bar, line, waterfall). Two invalid `present` specs in x-live-2 (turn 2 and 9: table or
   chart missing id/columns). Turn 2's recovered in the same turn; turn 9 failed the same minute the limit hit.
6. **Hooks: mostly quiet, one wasteful.** `same-rows/peer/offsets` notes fire most turns (informational).
   `brake-40` fired in 5 turns of long runs (correct). `slow-query`, `source-read`, `plugin-lint`,
   `error-hint`, `repeated-sql` once or twice. **`skill-read` fired its 2 blocks on turns 1, 2 and 3 in x-live-2
   and on turns 1 and 2 in x-live-1**: the follow-up turn re-opens the gate because the model reads
   `metric-verification.md` (a preloaded card) and that does not count, so it needs a non-preloaded card first.
   Each block costs 2 extra model calls (10-30 s). Fix: spend the gate once per conversation, or count preloaded cards.
7. **Anything else.**
   a. **A provider usage limit is reported as "Could not produce a checked answer".** The error text is in the session
      log only. The user should be told the real cause and that retrying will not help until the limit resets.
   b. **Over-asking is back in the first turns.** x-live-1 turns 1-4 and x-live-2 turns 1, 2, 5, 7 each ended on a
      question; most were answerable with a stated assumption (period, whether to keep a flagged line). The model also
      delivered the figures before asking, so it was not blocking, but a lazy user has to type an answer each time.
   c. **Same flagged line, different handling per session.** The £649.50 picnic-basket lines were presented as a
      "60 pieces, needs validation" caveat in x-live-1 and as exclusion candidates in x-live-2. Each followed its
      own conversation; the stored context.md confirmed them only for 22502 at that price in other tests.
   d. **Headline numbers moved between turns when a treatment was added** (x-live-1: Jan-Nov sales +2.3% to +1.9%, margin
      +1.85pp to +1.59pp after dropping the keying errors). It was stated as superseding, which is correct.
   e. **Slowest turns are the ones with the new data-quality derivation** (x-live-3 turn 3 741 s, x-live-1 turn 4 476 s),
      not the ones with the longest context.

## Not completed
Turns beyond 6 / 8 / 3 and anything needing the sessions to continue (long-tail share, year-on-year price/volume/cost
split, board bullets from established numbers after compaction). Sessions cannot be resumed by the driver (it clears
the run folder at start); the workspaces under `x-live-N/ws` are intact.
