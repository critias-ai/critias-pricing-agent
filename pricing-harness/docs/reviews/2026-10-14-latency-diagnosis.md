# Latency diagnosis, final stack, 2026-10-14

Runs (OpenAI `gpt-6-luna`, one run each, so large effects only). Evidence: `.cache/thin-analyst-multiturn-2026-10-14/oa3-*`, `oa4-skills-low`.

| Run | Wall | Cost | Calls | Model s (first token / generation) | Tool s |
|---|---|---|---|---|---|
| Analysis 6 turns, cold, low | 793 s | $0.08 | 76 | 797 (423 / 373) | about 0 |
| Analysis 6 turns, warm, high | 1,256 s | $0.13 | 82 | 955 (423 / 532) | 301 |
| Other skills 7 turns, cold, low | 249 s | $0.02 | 29 | n/a | small |

## What the time is

1. **Model wall time is 76 to 100 %.** Generation runs at 150 to 185 tokens/s; waiting for the first token is 45 to 65 % of model time. That wait is a per-request floor, not a function of context: in the warm/high run the median first-token wait was 5.1 s at 0 to 30k tokens, 4.5 s at 30 to 60k, 4.0 s at 60 to 90k, 4.9 s at 90 to 120k and 4.8 s at 120 to 150k (77 calls, prefix cache hits). So the 125k context costs money and compaction risk, not seconds. Seconds come from the number of calls (about 5 s floor each) and from generated tokens (78k output tokens, a third of them reasoning).
2. **Round trips.** About 10 s per call, 76 to 82 calls. Most calls are one query each.
3. **Slow turn is the first heavy derivation, not a fixed turn.** Cold/low turn 3 (311 s) and warm/high turn 2 (537 s) are where the agent first builds cost-matched lines from the raw tables. Later turns reuse it (66 to 180 s).
4. **Investigation breadth.** Cold/low turn 3: about 10 of 19 queries chase a £0.71 duplicate adjustment against the finance pack. The materiality rule shapes the answer, not the effort.
5. **Query latency (warm/high only).** 220 s of turn 2. The slowest query took 71 to 81 s because both join keys were wrapped in `UPPER()`; without it the same query takes 11 s. Materialising the typed views changed nothing (79 s).
6. **Other skills are not slow.** 20 to 35 s per turn; the scan with data took 102 s. A scan turn crashed on `NaN` in a query result (fixed).

## Next, in order of expected gain per change (all general)

1. Let `query` take several independent statements per call (fewer round trips).
2. Slow-query hook: report the seconds; on more than 20 s hint at functions on join keys and at `CREATE TABLE ... AS` for a view used repeatedly.
3. Effort brake: a nudge at about 40 % of the time budget (or after N queries with nothing delivered): deliver on the stated basis with the range.
4. Context diet: cap script stdout (full output stays in the file). Data above says this saves cost, not time; the time lever is fewer calls and fewer generated tokens.
6. Read-only calls: 13 of 77 calls (17 %) only read files, mostly skills and `context.md` that were already in context (`context.md` read 7 times in 6 turns, `pricing-analyze` 5 times). A hook cannot save those round trips, so the follow-up prompt states what is already in the conversation.
7. Repeated SQL: the same 500 to 1,500 character CTE (`cls`, `cost_candidates`) is rewritten in most queries of a heavy turn, which is generation time. A hook points at the persistent views.
5. Repeat each script 3 times before judging; run-to-run spread is as large as most single effects.

## Benchmarks to keep

`script-6-turns.json` (cold/low, warm/high) and `script-skills-7-turns.json` (cold/low). Per turn: wall, model s (first token, generation), tool s, calls, output tokens, cost, views shown.
