# Adversarial review: generalisation evals plan

Date: 2026-10-16. Reviewer: a Sonnet subagent, read-only, with no model or network calls. Plan reviewed: `docs/superpowers/plans/2026-10-16-generalisation-evals.md`.

**Status:** these are suggestions only, and none has been applied to the plan. Two claims were spot-checked against the plugin and hold:
- shared-rules says missing values are left out of a figure and shown by count and value (so not a range);
- triage doesn't link margin-drivers.

## A. Top 10 missing tests

1. **Mixed currency and tax basis in one file.**
   - Setup: GBP, EUR and USD rows plus a dated FX table, some rows with no currency, and VAT-inclusive B2C lines mixed with ex-VAT B2B lines.
   - Tests: shared-rules §3, unresolved basis.
   - Catches: a silent sum across currencies.
   - Host: S2, or UCI trapped.
2. **List price and transaction price disagree, or the list basis changes mid-period.**
   - Catches: false "discount deepening" and false leakage.
   - Host: S2, AdvW-1 and AdvW-2.
3. **Zero-price, free-of-charge, sample and negative-price lines.**
   - Shared-rules: a recorded zero is real, while a missing value is unknown.
   - UCI has real zero-price rows.
4. **Zero or absent base period.**
   - New or discontinued SKUs make % change undefined and have no bridge baseline.
   - Catches: NaN or Inf in outputs, and new/lost being folded into price or volume.
5. **Period alignment.**
   - Covers: YTD vs a full prior year, part-months, 52/53-week years, and an April fiscal year vs "2025".
   - The fiscal-year fact is saved in RT-intake-remember but never used in a later answer.
6. **Tiny samples, one dominant customer, tied ranks.**
   - Covers: peer groups of 2 or 3, one customer over 60% of a segment, and ties in a top 5.
   - Today every peer set is large.
7. **Self-contradicting or retracted `context.md`.**
   - Two facts in the file conflict.
   - A confirmed fact contradicts the data.
   - The user retracts a confirmation, which collides with the append-only hook.
   - The file belongs to another company, or is very large.
8. **User pushes back on a correct answer, or gives a wrong number.**
   - Example: "I think margin was 45%, just use my figure."
   - The analyst should hold its figure and reconcile, not cave.
   - Today's correction cases only have a user who is right.
9. **Compaction in a 20+ turn conversation.**
   - Plant user-stated scenario assumptions that are not in `context.md`, and check them after compaction.
   - Check that measure names stay stable, and that earlier figures are restated when they move.
   - This is an open item.
10. **Unit-of-measure and pack changes against the 5× detector.**
    - Each vs case: unit price jumps 12× or 24×.
    - The analyst should normalise units, not exclude the rows.
    - Host: UCI, Iowa, S2.

## B. Further edge cases

- **Export hazards:**
  - subtotal and grand-total rows inside the data;
  - merged or two-row headers;
  - hidden sheets and rows;
  - Excel date serials;
  - DD/MM vs MM/DD dates;
  - trailing minus signs such as `12.5-`;
  - SKU IDs with leading zeros or trailing spaces;
  - case mismatches that drop rows in joins;
  - digit-leading keys.
- **Files changing mid-conversation:** a corrected or overlapping file uploaded mid-conversation, which makes persistent views stale; a cost file arriving in turn 4; a file removed mid-session.
- **Credits and rebates:** credit notes with no matching invoice, partial credits, and a rebate paid a quarter later.
- **Bundles:** bundles split across lines, and kits sold as a single SKU.
- **Distorted rankings:** negative-margin groups, and a top-margin ranking led by a tiny-volume SKU.
- **Mix:** a revenue rise that comes from mix alone while like-for-like is flat (Simpson's paradox).
- **Costs:** a cost change mid-period where the as-of date matters, and standard cost vs actual cost.
- **Other pricing models:** rate-card or hourly services, and marketplace take-rate.
- **Seasonality:** seasonal comparisons such as Q4 vs Q1 or Black Friday pull-forward, and a promotion that overlaps a price change.
- **Forecasts:** "What will margin be next year?" It should give scenarios only, not a forecast.
- **Requests beyond authority:** "apply these prices", "draft the customer letter", "mark this approved".
- **Pressure not to ask:** "Don't ask, just do it" when the basis is material, and impatient or non-expert users.
- **Injection in the data:** instructions in a free-text notes column, and formula-like cells.
- **Off-topic or risky prompts:** questions outside pricing, and antitrust prompts such as "match the competitor price lists".
- **Competitor file differences:** a different pack size, VAT basis or currency.
- **File shape:** very wide files (200+ columns), and single-row answers.
- **Misleading columns:** columns that look like price but aren't (list, net, MSRP), and two cost columns (standard and landed).
- **Charts:**
  - a pie with 40 slices;
  - a chart that disagrees with its table;
  - a truncated axis;
  - negative bars;
  - stale charts after a correction;
  - a chart asked for before any result exists.
- **Rounding:** rounded rows vs rounded totals, and price endings in recommendations.
- **Repeatability:** the same question twice in one session must give the same numbers.

## C. Grading and design weaknesses

- **The outlier key has an implicit cutoff.** Plants at 27% and 55% sit inside the natural 24% to 55% spread, so a correct extra flag counts as a false positive.
  - Fix: three tiers (required plants, penalised hard negatives, ignored ambiguous SKUs).
  - Also publish the gap definition: median or mean, weighted or not, self included or excluded.
- **`replyNumbers` matches absolute values.** Small numbers match by accident, a dumped table hits every key, and sign errors pass. Fix: require a number next to its label, with the sign.
- **`expectReads` can be gamed.** A model can bulk-read every card. Skills loaded in turn 1 aren't re-read later, so a per-turn check fails good behaviour. Fix:
  - check at conversation level;
  - make must-not the main assertion;
  - cross-check with a figure that only that card produces.
- **Clean vs trapped runs.**
  - Add a must-not-claim-anomaly check on clean runs.
  - Detectors cover SQL only, so put traps where both the SQL and Python paths meet them.
- **Oracle conventions embed assumptions.** Examples: SC-2's group breakeven with uniform volume scaling, UCI-3's matching basis, and where L6's freight is applied. Fix: state the basis in the prompt or context, or accept a set of valid variants.
- **The judge can be fooled.** Problems:
  - the judge is from the same model family;
  - the planted truth isn't passed to the judge;
  - must-not items can be passed with boilerplate hedging.

  Fix: give the judge the answer key, require quoted evidence, and spot-check it with deliberately wrong replies.
- **`expectQuestion` is binary.** A harmless "Want a chart?" at L3 counts as over-asking. Fix: score only blocking questions about a basis.
- **Holdout leakage.**
  - A second seed shares the generator's structure.
  - Dunnhumby weeks 53 to 102 aren't independent of weeks 1 to 52.
  - The prompts are in the repo.

  Fix: a holdout with a different shape or industry, and holdout wording kept outside the repo.
- **The budget ignores variants.** Clean/trapped, bare/confirmed and holdout copies probably make the real total 2 to 3 times the 260 runs.
- **Fetch reproducibility.** Dunnhumby, M5 and Airbnb need a login or move between snapshots. Fix: pin checksums and keep a manual download path.
- **The materiality control may not be immaterial.** The G09 control (0.9% of sales) sits above the 0.5% peer-ratio share, so it may not count as immaterial.

## D. Inconsistencies and conflicts with the cards

- **Demand-response measurement is still in the plan despite the park:**
  - WTP-1's "true 50%-win price";
  - WTP-3's rates by price point;
  - Dunn-4's "price-sensitive households";
  - M5-2's volume after price changes.

  These conflict with K2's "doesn't estimate demand response".
- **K2's "margin range, not a point" contradicts shared-rules §6.** That section puts the point figure on covered lines first, then the uncovered count and value.
- **L0 conflicts with shared-rules §3.** The L0 row expects several questions plus a provisional figure. §3 says: hold the headline and ask one focused question when the basis changes the conclusion.
- **L1 "asks only returns" is brittle.** Missing cost is also material.
- **The ×1.17 currency slip is invisible to the detector** (per open-items). The trapped must-mention list fails by design unless the analyst finds it by comparing customers.
- **OUT-1's planted pattern contradicts its rubric.** The plant is small customers below larger ones, but the rubric sizes the gap against size-matched peers. The reasons (legacy contract, rep, data error) need supporting columns in S2.
- **OUT-1 turn 3 conflicts with pricing-execute.** Execute treats unknown owners as an open decision, so "owner and timing per action" is too strict.
- **The card × skill table claims links the skills don't make:**
  - triage → margin-drivers;
  - intake → metric-verification;
  - scan → waterfall and realization;
  - recommend → peer-comparisons and governance.

  "S4 vague variant" and "retail-storage-advice" aren't cases defined in this plan.
- **S3 at L0** is claimed in the card table but isn't in §3e.
- **Some matrix marks have no backing case:**
  - E3 ○ on AdvW, S2, S3 and S4;
  - B5 ● on S2;
  - G2 ● on Iowa;
  - J6 and J3 ● on Airbnb;
  - C1 ● on M5;
  - A5 ● on Olist;
  - J5 ○ on S4.
- **RT-triage-definition:** the triage skill wants a general answer labelled as general, so the rubric should require that label.
- **RT-intake-setup:** define what counts as confirmation.
- **L4 and L6 depend on the open item** about context.md precedence over skill methods, so they may fail for that known gap. Mark them as such.
- **SC-1 and SC-3 on K07.** A price rise can make proposed contribution positive while CM0 is below 0. The formula then returns a number with no meaning. Specify the expected answer.
