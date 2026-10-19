# Luna high, 15-turn conversation, three live sessions (l-luna-1/2/3), 2026-10-16

Setup: gpt-6-luna, thinking high, OpenAI (ChatGPT subscription login), snapshot `app-snapshot-31-live` (HEAD 9f8cd18),
`northbridge-test` workspace with its stored context.md, three sessions in parallel (2 GB / 2 threads each), turns written
live by a person playing a pricing manager (short lazy sentences, same questions in the same order as
`script-15-turns.md`, answers to the agent's questions given in a few words). Driver `drive_live.py --minutes 150`,
analysis `analyse_x.py`. Costs are API-equivalent (token price x usage), not billed.

The script's turns 2-4 are answers to questions the agent did not ask this time, so each session got the category-drop
question (script turn 5) as its turn 2. Turns 1-13 follow script turns 1, 5-16; turn 14 was a natural follow-up to
the turn 13 answer; turn 15 is the script's optional "three board bullets" close.

| Session | Turns | Sum of turn wall time | API-equivalent cost | Model calls | Compactions | Ended |
|---|---|---|---|---|---|---|
| l-luna-1 | 15 | 3,411 s | $0.226 | 121 | 1 | closed by me after turn 15 |
| l-luna-2 | 15 | 4,225 s | $0.262 | 119 | 2 | closed by me after turn 15 |
| l-luna-3 | 15 | 4,157 s | $0.294 | 148 | 1 | closed by me after turn 15 |

All 45 turns completed (`run completed`). No provider limit, no timeout, no failed turn. About $0.017 per turn,
against about $0.25 per turn for Sol low on the shorter x-live questions.

## Per-turn wall time (s) and model calls

| Turn | Question (short) | S1 s / calls | S2 s / calls | S3 s / calls |
|---|---|---|---|---|
| 1 | quarterly view | 150 / 14 | 80 / 11 | 96 / 11 |
| 2 | categories behind the Q3 2011 drop | 324 / 15 | 759 / 22 | 359 / 21 |
| 3 | Storage & Org SKUs behind the drop, monthly rates | 559 / 18 | 363 / 10 | 579 / 30 |
| 4 | SKU 22502: price, volume or cost | 257 / 11 | 326 / 12 | 315 / 15 |
| 5 | top 3 SKUs by gross profit, chart | 567 / 19 | 386 / 8 | 416 / 13 |
| 6 | any odd month in those three | 301 / 10 | 214 / 6 | 255 / 12 |
| 7 | odd month: price/quantity/cost bridge | 97 / 4 | 154 / 8 | 168 / 4 |
| 8 | customers in that month | 168 / 5 | 102 / 4 | 121 / 6 |
| 9 | credits or returns that month | 88 / 3 | 151 / 4 | 125 / 5 |
| 10 | top-10 share, negative-GP SKUs | 98 / 3 | 293 / 6 | 381 / 9 |
| 11 | chart company GP Jan-Nov 2011 vs 2010 | 68 / 4 | 56 / 4 | 58 / 3 |
| 12 | price/volume/cost of that change | 477 / 8 | 796 / 14 | 265 / 6 |
| 13 | long-tail SKUs under 1% | 84 / 3 | 182 / 6 | 585 / 7 |
| 14 | follow-up on the long tail (differs per session, see below) | 131 / 3 | 243 / 3 | 398 / 5 |
| 15 | three board bullets | 43 / 1 | 121 / 1 | 35 / 1 |

Median turn: 150 s (S1), 214 s (S2), 265 s (S3). Fastest 35-56 s (a chart of already-built numbers, the bullets), slowest
567-796 s (a new derivation: turns 2, 3, 5, 12, 13). Wall time varied between sessions by up to 4.5x on the same
question (turn 10: 98 s vs 381 s; turn 13: 84 s vs 585 s).

## The seven checks

1. **Script reuse on drill-down: reuse across turns did not happen in the Python sessions, and one session used no
   Python at all.** S1 wrote no Python file in 15 turns (SQL `query` plus `present`, views persisted; `repeated-sql`
   fired in 8 turns and was followed). S2 wrote 6 scripts and S3 wrote 8, one new script per new question
   (`sku_22502_*`, `top3_*`, `company_gp_*`). Zero files rewritten wholesale; zero edits to a file written in an
   earlier turn; no script imports another. Edits happened only inside the turn that wrote the file (S3 turn 3: five edits
   to `storage_sku_drivers.py` after the first run). This differs from x-live, where a shared module was edited across
   turns 2-7. The cost of no reuse here was small (later new scripts took 2-10 calls), but each one re-derived the
   cost-covered base.
2. **Rising complexity and compaction: held.** Compaction fired when context reached about 160k: S1 in turn 8
   (161k to 68k), S2 in turn 6 (162k to 70k) and again during turn 15 (160k), S3 in turn 7 (161k to 66k).
   Questions that depended on pre-compaction facts were answered correctly after it: S1 turn 9 ("that SKU in that month")
   named 22502, June 2011 and the two cancellation lines without being told; S3 turn 8 (customers for "that SKU in that
   month") named customer 15098 and the 61 net units; all three kept the "keep flagged prices as recorded", "no
   allocation of customer-period adjustments", "82486 unranked" and "transaction-line basis" decisions for the rest of
   the session. The board bullets in turn 15 (S2 after its second compaction) used only numbers from earlier answers,
   checked against turns 10, 12 and 14. First call after a compaction missed the cache (cache share 0.65 for S1 turn 9,
   0.75 for S2 turn 7, 0.18 for S3 turn 7).
3. **Tool use consistent: within a session yes, across sessions no.** S1 used `query`, `read`, `edit`, `present`
   only (no `write`, `bash` or `execute_analysis`). S2 and S3 used `write` + `execute_analysis` for the bridge
   and scan questions and `query` for the rest. Both paths gave the same numbers wherever the method was the same.
4. **Faster as context is cached: no.** Cache share was 0.9-0.99 from turn 2, so cost per call fell (turn 15 cost $0.003-0.004), but
   average first-token wait rose from 4.5-7.6 s in turn 1 (25k tokens) to 15.7-16.7 s in turn 15 (116-160k) in all three. Turn 15 is one
   call with 1-2k output tokens, so that wait is mostly thinking before the first token. The earlier solo Luna high
   run showed 5.3-7.0 s up to 133k, so the parallel load (three sessions on one subscription) is the likelier
   cause here, not context alone. Turns got shorter later because they needed fewer calls (turn 1: 11-14 calls; turns 7-15: 1-9 calls),
   not because calls got faster.
5. **Charts: worked on every continuation, new chart each time.** At least one table and one chart in 11 (S1),
   12 (S2) and 14 (S3) of 15 turns. Turns without a `present` call were prose-only follow-ups (S1 turns 9, 13-15; S2 turns 9, 14, 15; S3
   turn 15) where no chart was needed. Kinds used: line, bar, waterfall. The waterfall was chosen unprompted for both bridge questions (turns 7 and 12) in all three
   sessions. One invalid `present` call (S3 turn 4), recovered in the same turn. No dropped-table or row-key
   notice in any of the 45 turns.
6. **Hooks: tuned about right; pacing hooks did their job, skill gate fired once more than needed.**
   - `skill-read`: 2 blocks in turn 1 of every session, 1 more in S3 turn 2, none after that. It no longer re-fires on follow-up turns as it did in x-live.
   - `brake-40` fired in 11 turns (S1 3, S2 3, S3 5), always on turns of 255-800 s. In S2 turn 12 the tool output carried "time left: 3 min. Wrap
     up now", and that turn ended with an answer stating a £7k residual, so the hook produced a bounded answer and not a cut-off.
   - `slow-query` fired in S2 turns 12 and 14 and S3 turns 2, 12, 13, 14 on long grouped queries; the turn that followed was no faster.
   - `repeated-sql` fired in 8 turns of S1 and was followed. `two-fails` fired only in S1 turn 1 (6 tool errors, 150 s). `error-hint` fired in S1 turns 1, 2, 3, 5 and 13 and S3 turn 3.
   - Tool errors in total: 15 (S1), 6 (S2), 9 (S3); most were in turns 1-3.
7. **Other.**
   a. **Same numbers where the method is fixed.** Quarterly table identical in all three. Q3 vs Q2 margin 40.65% vs 44.74%. SKU 22502
      bridge (price +£22,206, volume −£19,139 or −£21,962 on sales, cost −£30) identical. May to June 2011 bridge
      identical to the penny (price +£76,439.81, quantity −£37,908.68, cost £0). Top 3 SKUs 22502, 21931, 22326 with identical gross profit
      (£47,939.01 / £32,842.67 / £24,622.16). Top-10 share 33.13%. 29 negative-GP SKUs. Full-history long tail 4,442 SKUs (99.18%) in S2 and S3,
      4,450 (99.21%) in S1.
   b. **Where they diverged: choice of method, not arithmetic.** See the next section.
   c. **Keying-error line handled the same way in all three.** The £649.50 picnic-basket lines (22502) were raised unprompted (S2 in
      turn 2, S1 and S3 in turn 3 by asking) and then carried and flagged in later answers and in the board bullets, as instructed.
      The heart-holder 4,000-unit £0 line (85123A) and invoice C536757 never appeared, because this script never asks for an overall product ranking.
      It does not show the model missing them.
   d. **Unknown-customer lines were disclosed in turn 8 by all three** (99 units, £617.25).
   e. **Over-asking is much lower than in x-live.** Three of 15 turns per session ended on a question (S1 and S3: turns 2, 3, 5; S2: turns 2, 3, 9), each
      answerable in a few words ("keep as recorded"). x-live: 9 of 17.
   f. **Small wording inconsistencies inside a session.** S3 said "three flagged price lines totaling £39,619.50" in the bullets and "two
      flagged-price lines" in turn 8; the £39,619.50 is the two £649.50 lines, a third flagged line is separate (S1 said so in turn 7). S2 called
      the same lines "two transactions, 61 units" throughout.
   g. **Coverage figures differ per session** for "lines without usable cost" in the company-wide long-tail question: 2,500 lines / £121.8k (S1),
      3,314 / £133.1k (S2), 1,177 / £20.6k (S3). Each states its own figure and which SKUs it left out. None says why they differ.

## Where the three sessions differed (the variation)

| Question | S1 | S2 | S3 |
|---|---|---|---|
| Turn 2: largest category drag on Q3 margin | Storage & Org −2.23 pp, then Party −1.52 | Other Merchandise −1.21 pp, Storage −0.87 pp (excluded Shipping & Handling; showed scenario ranges −4.09 / −2.94 / −1.90 pp) | Storage & Org −2.21 pp, then Party −1.51 |
| Turn 12: Jan-Nov 2011 vs 2010 gross-profit change (+£241,024) | SKU-level bridge: price +£240k, volume/mix +£152k, cost −£166k, +£14.6k reconciliation to finance | Item-level: price +£262k, volume −£528k, mix −£35k, cost −£165k, new items +£996k, lost −£309k, £12k unallocated, £7k unreconciled | Company-aggregate midpoint: price +£644k, volume −£193k, cost −£211k, no residual |
| Turn 13: "long tail under 1%" | Storage & Org only: 231 SKUs, 44.11% | Company, Jan-Nov: 4,170 / 3,950 SKUs by absolute GP, 95.96% / 94.69% (also 3,788 / 3,619 positive-only, 101.94% / 96.54%) | Company, Jan-Nov: positive-only 3,788 / 3,619, 101.94% / 96.54% (over 100%) |
| Turn 14 (user follow-up) | "whole company?" gave 4,450 SKUs, 99.21%, plus an absolute-GP variant 4,917 SKUs, 96.19% | "full history? why over 100%?" gave 4,442 SKUs, 99.18%; explained the denominator is net | same follow-up: 4,442 SKUs, 99.18%, plus 96.29% of positive-SKU GP |

- **The price effect in turn 12 ranges from +£240k to +£644k** depending on aggregation level (SKU, item, company average), with the same total change.
  Each answer states its method, but none says another method would give a different price effect. A pricing manager comparing two runs would see a 2.7x
  difference in the headline number.
- **Scope drift on the long tail**: three sessions read "the long tail" as Storage & Organization (it was the last category in context), Jan-Nov (the last period
  asked about) and company-wide full history. A lazy user would not notice until the number looked odd. All three recovered in one follow-up.
- **Turn 2 category ranking** differs because S2 reconciled to the finance merchandise total by excluding Shipping & Handling and showing sensitivity;
  S1 and S3 kept it as a caveat. S2's answer is the one that reconciles exactly; it was also the slowest on that turn (759 s).

## How the model worked (practice evidence)

- Turn 1 was 11-14 calls with the skill-gate blocks and reads of the knowledge cards, then `query` calls and one `present`.
- A drill-down was typically 2-6 `query` calls and one `present`; a new derivation (bridge, anomaly scan) was one `write` + 1-3 `execute_analysis`
  runs (S2, S3) or 6-17 `query` calls (S1).
- Each answer led with the headline figure, then the basis and the flagged items, and the last line was a question only when a treatment decision was
  needed. Replies ran about 1,000 characters on average (15-16k characters over 15 turns).
- It referred to earlier user decisions by name ("as requested", "retained and flagged"), including after compaction.

## Open items from this run

1. Default method for price/volume/cost bridges: three sessions chose three aggregation levels. Either fix a default in the plugin (SKU level, with the
   mix and new/lost lines shown) or have the answer name the other levels and how much the price effect moves.
2. Ambiguous scope words ("the long tail", "that SKU") carry the last-used scope. A one-line statement of scope at the top of the answer would make the drift visible.
3. First-token wait rises 2-3x with context under three parallel sessions; a solo 15-turn run would show whether the rise is load or context.
4. Cross-turn script reuse did not occur; if reuse matters, the plugin needs a prompt to extend an earlier script, as `q1_shared.py` did in x-live.
5. Pre-existing and unchanged: the model gave different coverage counts for "lines without a usable cost" across sessions without explaining the difference.

## Not tested here
Solo timing (all three ran in parallel); a question that requires a number from before the first compaction beyond a restatement (the
turn 15 bullets restate numbers from turns 10-14, which were all after the early compactions); Luna low or max on the 15-turn script.
