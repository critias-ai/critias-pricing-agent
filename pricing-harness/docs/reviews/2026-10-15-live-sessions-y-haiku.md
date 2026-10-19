# Three live sessions on Claude Haiku 5.5 (medium), 2026-10-15 (y-haiku-1/2/3)

Same setup and opening questions as [x-live (Sol)](2026-10-15-live-sessions-x-live.md): snapshot 31, `northbridge-test`,
stored context.md, three parallel sessions, person-played short lazy follow-ups. Model `anthropic/claude-haiku-5.5` via
OpenRouter, thinking medium, $4 cost cap per session (never reached). The Haiku 5.5 catalogue shim (Pi 1.0.4 has only 4.5)
was added to the experiment snapshot only, with prices $0.10 / $0.50 per million in/out. Cost figures use those prices.

| Session | Opening | Turns | Cost | Model calls | Sum of turn wall time |
|---|---|---|---|---|---|
| y-haiku-1 | quarterly sales, profit, margin | 13 | $0.122 | 63 | 414 s |
| y-haiku-2 | which products make the most money | 11 | $0.112 | 72 | 455 s |
| y-haiku-3 | why did margin drop recently | 12 | $0.117 | 58 | 441 s |

36 turns, $0.35 total, about $0.0097 per turn and 36 s per turn. Sol: about $0.25 and 260 s per turn. Stopped by me at
11-13 turns because the cap was nowhere near: at this rate $4 is about 400 turns. Context peaked at 135k tokens;
no compaction happened, so the compaction question is still untested on Haiku.

## The seven checks

1. **Script reuse: not applicable, SQL only.** Zero Python files were written in 36 turns. All work was `query` calls
   with views persisting (repeated-sql hook fired 4 times in session 1 and was followed). No wholesale rewrites.
2. **Rising complexity: held.** Escalated to a margin bridge, scenario grid with breakeven, customer price-gap
   against same-quarter average, size-matched premium bands, customer bridges. Turn time stayed 10-70 s.
   Later turns recalled earlier decisions: session 3 re-listed every exclusion and corrected its own earlier "7 of 11
   months" to 8; session 1's MD summary correctly split solid from provisional after 13 turns.
3. **Tool use consistent: yes.** Query, read, edit, present only; same pattern in all three sessions.
4. **Faster with context: flat.** Average first-token wait 2.0-3.8 s from turn 1 (33k) to turn 13 (135k). Cache share
   1.0 after turn 1. Calls per turn fell from 12-13 in turn 1 to 1-7 later, so turns got faster as the model reused
   what it had built (turn 13 took 10 s). This differs from Sol, where first-token wait rose to 14-19 s.
5. **Charts: delivered when asked, not volunteered.** Every explicit chart request produced a chart (bar, line);
   one `present` spec error (session 3, turn 9) was recovered in the same turn. About a third of turns presented a
   table or chart; turns not asking for one often returned prose and a table only.
6. **Hooks.** `skill-read` blocked twice in turn 1 of every session and twice more in session 2 turn 2, the same
   re-fire as on Sol. `same-rows/peer/offsets` notes most turns. `two-fails` fired in 3 late turns. No `brake-40`,
   no `slow-query`, no runaway or retry events: turns were too short for pacing hooks to matter.
7. **Other.**
   a. **Different basis than the finance export.** Session 1 built a "matched-cost" proxy (33.99% to 39.78% in Q1) that
      it states does not reconcile to finance (36.81% to 43.57%), then screened out about 90 product-period rows
      and reported +0.57 pp against Sol's +4.95 pp underlying. Its conclusion, "the Q1 gain largely disappears",
      differs from Sol's and rests on a rule (price 5x from median), not on a checked cause.
   b. **Wide rule-based removal.** Session 2 dropped 11,035 rows (net -£89k) by price-vs-median rule, disclosed it and
      asked for confirmation; when asked it showed that 9 of the top 10 products were unaffected and traced the one
      that mattered to two -9,360 units at £0.03 lines. Good recovery, but the first answer used the rule unprompted.
   c. **Needed a prompt to catch what Sol found unprompted.** The 4,000-unit £0 heart-holder line was not raised until
      the user said the number looked odd; Sol's session 2 raised it in its first answers.
   d. **A non-existent source was offered.** Session 3 offered to "check the approval log". When told there is none it
      replied that an `approval_log` view with 42 rows exists in the data and had not been checked. Worth confirming
      what that view holds.
   e. **Narrative that may mislead.** Session 3 explained three top gainers as "removal of a loss" when their 2011 value
      was nil costed sales; it corrected itself when asked (lost sales, not missing costs).
   f. **Nearly every turn ended with a question** to the user, usually one that could have carried a stated assumption.

## Sol vs Haiku, same questions
| | Sol low (x-live) | Haiku medium (y-haiku) |
|---|---|---|
| Turn time | 121-741 s | 10-70 s |
| Cost per turn (API-equivalent) | about $0.25 | about $0.01 |
| First figures reconcile to finance | yes | quarterly yes; later work on own proxy |
| Unprompted data-quality catches | 4,000-unit £0 line, pack-price keying errors | needed a nudge |
| Charts | one or more most turns | when asked |
| Python scripts | yes (sessions 1, 3) | none |

## Solo run, thinking high (z-haiku-high)

One session alone (no parallel load), Haiku 5.5, thinking high, snapshot 31, 6 turns on the product-ranking scenario of
y-haiku-2 with the same lazy follow-ups, and no hint at the heart-holder line or the keying-error lines.
Total 203 s of turn time, $0.034, 28 calls, context 33k to 64k.

| Turn | Ask | Wall s | Calls | $ | Avg first token s |
|---|---|---|---|---|---|
| 1 | which products make the most money | 50 | 7 | 0.010 | 2.5 |
| 2 | check with the implausible-price lines removed, top 10 with names and chart | 43 | 6 | 0.007 | 2.1 |
| 3 | main customers for the cakestand | 24 | 4 | 0.004 | 3.0 |
| 4 | no-ID vs named price over time, other top 5, worth | 39 | 5 | 0.006 | 2.7 |
| 5 | order-size split, list of dropped lines | 19 | 2 | 0.003 | 3.1 |
| 6 | competitor prices, stock, should we raise price | 29 | 4 | 0.004 | 3.1 |

**Speed.** Same as the three-parallel medium run: first token 2-3 s, turns 19-50 s, calls per turn falling from 7 to 2-4.
So the parallel load did not slow Haiku, and high thinking did not slow it either (turn 1: 50 s vs 69 s, 7 calls vs 13).
Sol's rising first-token wait was therefore not a property of long context in this harness; it was either the model or
the subscription path. A solo Sol run would settle it; not run.

**Unprompted catches.**
- Keying errors (22502 pack-priced lines, 84347): found in turn 2, before any prompt, shown ranking both ways and put to
  the user as a question. Medium found them only when the user questioned the ranking.
- Heart holder zero-price line: **not named**. The first answer ranked 85123A at £94,148 with no unit-basis or zero-price
  remark (medium did the same, Sol raised the unit question). It was removed silently by the price-outlier filter and
  the "positive quantity and positive value" rule in the price comparison (turn 4 shows £4.44 vs £2.69, the corrected
  figure), and turn 5 listed "returns and zero-value lines: excluded from the price comparison, I did not count them".
  The right number, but the user is never told a 4,000-unit £0 line exists.

**Hallucination.** None seen. Asked for competitor prices and stock (not in the data) it said both are absent, cited the
company brief and operations brief for why, and supplied the list prices that are in the pricing file. It also
declined to recommend raising the named price until the no-ID lines are explained. It did flag its own unreconciled count
(3,584 flagged lines in the data note vs 9,426 in its own query) rather than hiding it.

**Still open.** Same-turn question ending every answer; a 9,426-line price-outlier removal that is a rule, not a checked
cause; no chart unless asked (turns 3-6 had none because none was requested).
