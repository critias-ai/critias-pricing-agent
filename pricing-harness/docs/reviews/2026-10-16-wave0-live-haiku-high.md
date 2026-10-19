# Wave 0 live run: Haiku 5.5 high, judged by Sol low

Date: 2026-10-16.

- **Analyst:** `anthropic/claude-haiku-5.5`, thinking high, through OpenRouter.
- **Judge:** `gpt-6.1-sol`, thinking low, through the OpenAI endpoint.
- **Code:** commit `8e06114`, plugin 0.4.9.
- **Scope:** 37 cases × 3 repeats = 111 runs, 3 at a time.

Run folder: `.cache/evals/live-2026-10-16T20-34-18-724Z`.

All 111 runs finished. No usage limit was hit on either connection, so nothing is left to run from this batch.

## Before the run

- **Judge oracle:** 30 of 30 expected verdicts after one fix. Its first pass found my hand-written "bad" reply for
  `retail-storage-advice` also broke R4, and Sol was right; the key was corrected (`8e06114`).
- **Runner:** it now marks provider usage limits and stops, instead of grading them (`c2c7aed`).

## Result

| Group                         | Runs passed (live) | After grader fixes |
| ----------------------------- | ------------------ | ------------------ |
| Routing (rt-\*)               | 31 of 33           | 31 of 33           |
| Outliers (retail-outliers-\*) | 7 of 9             | 7 of 9             |
| Edge cases (ec-\*)            | 16 of 24           | 16 of 24           |
| Context ladder (ladder-\*)    | 10 of 30           | 13 of 30           |
| Scenarios (sc-\*)             | 2 of 15            | 2 of 15            |
| **All**                       | **66 of 111**      | **69 of 111**      |

- **Consistency:** 16 of the 21 cases that save files gave the same figures on every repeat.
- **Effort:** about 12 model calls and 52 seconds per run.
- **Tokens, all 111 analyst runs:** 860k output, 30.1M cache reads, 4.55M cache writes and 3.5k uncached input. The
  harness prices Haiku 5.5 at $0 (not in Pi's price list), so the OpenRouter dashboard has the actual charge. Sol judge
  calls ran on the ChatGPT subscription.

## What the harness does well

- **Routing and intake: 31 of 33.** Setup, remember, correct and negative are 12 of 12: confirmed facts saved in the
  intake format, nothing unconfirmed saved, nothing reworded. Design, execute, scan, vague goals and visualize are 3 of 3.
- **Complete or contradictory context.**
  - Full context, no questions, file untouched: L3 3 of 3.
  - Two contradictory returns facts named, and the user asked: L7 3 of 3.
  - "We have no returns" challenged with the 46 return lines: L8 3 of 3 after the label fix.
- **Long conversations and follow-ups.**
  - A turn-2 assumption applied exactly at turn 18: EC-9 3 of 3.
  - The same question in turns 1 and 6 gave the same figures: EC-20 3 of 3.
  - A saved financial year was used, with the part month named: EC-5 3 of 3.
- **Outliers by peer group.** Storage-only and the switch to Kitchen are 3 of 3, with exact gaps.

## Where it fails

1. **Missing context gets assumed, not asked: L0 to L2, 0 of 9.** With little or no context, the analyst delivers a settled
   headline ("Result: gross margin fell in every category…") on net price with returns netted, and ends with an offer
   rather than a question. It never treats list price against net price as a choice, although on this data the choice
   flips Kitchen's 2025 direction (−2.4 pp on net, +3.3 pp on list). In one L2 run the user's "returns stay in the totals"
   was not saved. A column named `net_price` makes that choice look obvious, so L0 to L1 may partly test the data's
   naming rather than the analyst. The returns choice has no such excuse.
2. **Another company's context is adopted as the company's own: L5, 0 of 3.** Given an uploaded Brightwater context
   file, the analyst reported in USD on list price with returns excluded "as finance confirmed", and never checked the
   company name. This is the most serious failure in the run.
3. **Scenario replies leave out the parts the card requires: SC, 2 of 15.** The saved figures were usually exact. The
   replies, though:
   - answered at company or category level without naming the SKUs that need volume to grow (SC-3);
   - skipped K07's fixed-volume change, or the per-SKU range and fixed-mix caveat (SC-1, SC-2, SC-4);
   - in SC-5 (2 of 3), estimated an actual volume fall ("about 10.3%") from S03's promotion, which the card forbids,
     and gave the breakeven as about 11% rather than 13.07%.
4. **"Don't ask me anything" picks a basis silently: EC-18, 0 of 3.** It took `net_price` "as the columns are named"
   and presented the result as settled.
5. **Seasonal comparison: EC-16, 1 of 3.** Two runs explained a Q1 against Q4 fall without comparing Q1 2025 with
   Q1 2024.
6. **Smaller misses:**
   - EC-17 extrapolated next year's margin once ("trend continues… about 33.1%");
   - L6 over-asked once whether to keep the confirmed freight rule;
   - L9 kept returns in after the retraction once;
   - rt-recommend skipped evidence-ranking once.

## Grading faults this run exposed, now fixed (`a832166`)

- **Offers hidden behind a "Question:" label counted as blocking questions.** This marked one L6 run as over-asking and
  could count an offer as the question a case needs.
- **L8's count required the word "return" beside 46.** The analyst wrote "46 lines have zero or negative quantity".
- **L4's second turn didn't answer the basis question the analyst asked,** so the saved figures used the other basis. It
  also required an intake read when nothing was written. The analyst's L4 behaviour itself was good: it showed both
  treatments and asked before recording anything. The case should be re-run.
- **Breakeven asks said "the % change"**, and 6 runs saved fractions (−0.118) in `pct` columns. Every one of those runs
  also failed on something else, so no score changes. The asks now say "in percent (so −11.8 means an 11.8% fall)".

One judge verdict looks wrong: EC-8 run 1 failed R3 ("if it uses 45% at all, labels it as the user's") although the
reply never used 45%.

## Next

- Re-run L4 and the four sc-\* cases whose save asks changed: about 15 runs.
- Decide whether L0 to L2 should also hide the price choice behind neutral column names, such as `price_a` and
  `price_b`, so the test can't be passed or failed on naming.
- L5 and the scenario-reply gaps are harness or skill findings to act on, not test changes.

## Re-run of the changed cases (2026-10-17)

Same analyst, judge and plugin, commit `a832166`. Run folder: `.cache/evals/live-2026-10-17T07-48-14-248Z`.

| Case  | Before    | After     |
| ----- | --------- | --------- |
| L4    | 0 of 3    | 3 of 3    |
| SC-1  | 0 of 3    | 0 of 3    |
| SC-2  | 0 of 3    | 0 of 3    |
| SC-3  | 0 of 3    | 0 of 3    |
| SC-4  | 2 of 3    | 1 of 3    |
| **All** | **2 of 15** | **4 of 15** |

- **The grading fixes worked.** No saved-figure mismatches remain: every `pct` column is now in percent, and all five
  cases gave the same figures on every repeat (before: SC-1 and SC-2 runs disagreed). L4 passes 3 of 3.
- **Every remaining failure is a reply that leaves out what the card requires**, and the judge's reasons match the replies:
  - SC-1: names K07 as loss-making but never gives its gross-profit change at fixed volume (0 of 3).
  - SC-2: no run states the fixed-mix assumption or the per-SKU breakeven range; one says only "SKU-level breakevens
    will differ".
  - SC-3: no run names G06, K05 and S02 as needing volume to grow, or handles K07.
  - SC-4: two runs skip the fixed-mix caveat.
- These are harness or skill findings, not test faults; the cases stay as they are.
