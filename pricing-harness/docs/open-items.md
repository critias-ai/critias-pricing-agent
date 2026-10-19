# Open items

Recorded 2026-10-14 after the OpenRouter and OpenAI six-turn runs (`.cache/thin-analyst-multiturn-2026-10-14/`).

## Done on this branch

- Plugin 0.4.2: bound an open choice, then deliver with a range or ask; relative materiality test; `lints.json`.
- Hooks (`src/agent/workflow/nudges.ts`): SQL and edit error hints, block-once on copied or rewritten scripts, package installs blocked, `context.md` append-only, plugin lints on code and reply, pacing with a wrap-up nudge, thinking drops to `low` after the first success.
- `query` tool (`query_server.py`): typed views over every CSV, persistent views, `save` to a CSV, redefinition notice.
- `present` tool: tables and charts are columns of a result file an executed query or script wrote. Claims, handoff and the "Checked figures" list are gone.
- Compaction at 60 % of the window; a request cancelled for compaction counts as zero usage.

## Open

- Context diet: execute stdout is capped at 48k characters; a lower cap (about 8k, full output kept in the file) would slow context growth. Reasoning items are about 75 % of stored context.
- Pre-flight check that compaction keeps user-stated scenario assumptions (not in `context.md`); the default summary format was not inspected.
- Push plugin 0.4.2 (`Pricing_Plugin`, branch `v2`, local only; `origin` is at 0.4.0).
- `tests/evals/cases/*.json` and `scripts/eval-focused-workflow.mjs` still describe claims and handoffs; they are not run by `npm test` and were not updated.
- Run the six turns, cold and warm, on the final stack and compare with `.cache/.../oa2-*`.
- **Peer-ratio check covers SQL only (2026-10-15).** `peer_ratio.py` notes rows at least 5× or at most a fifth of their key's median when they carry ≥ 0.5 % of what a SQL statement sums or a created population holds. Figures computed in Python scripts (`execute_analysis`, `python3` in `bash`) are not checked yet; decide how to cover them (for example, check the CSV a script reads against the source rows it came from).
- The peer-ratio threshold (5×) and materiality (0.5 %) were set from `threshold_study.py` on the seeded pack and the Storage question only; recheck on other questions and datasets. A uniform currency slip (×1.17) is invisible to any ratio threshold.
- Plugin skill text (pricing-analyze step 2, shared rules) still describes the outlier check at 10× as a required model report; the harness now checks at 5×. Align during the methodology review.
- **context.md precedence over skill methods (open, 2026-10-15).** The plugin says confirmed company definitions, recipes and policies override knowledge-card defaults (`shared-rules.md`, `margin-drivers.md`); the harness prompt does not say it, and the required checks in `pricing-analyze` step 2 are skill text, not knowledge-card defaults. Untested: no run has had a `context.md` that sets a different method. Needs a test design (for example a turn that confirms a different bridge order) before wiring an explicit rule.
- **Adding a workspace file resets the analyst (2026-10-18).** The conversation key (`orchestrator.ts`) hashes the
  bundle fingerprint and every workspace file, so adding, removing or replacing any file makes the next turn start
  fresh: the analyst folder is deleted and earlier turns are forgotten, while the visible chat stays. Planned fix: keep
  the session when files are only added (every known file unchanged) and tell the analyst about the new files; reset
  only when a known file changed or went, or the bundle changed. Optionally seed a reset with a summary of earlier
  turns. Needs a live multi-turn re-run.
- **Returns note covers SQL only (2026-10-15).** `offsets.py` notes groups where negative rows offset at least half, but not all, of a whole-number sum; Python scripts are not checked, like the peer-ratio note.

## Harness and skill findings from evals (fix after all eval waves, then re-run everything)

Collected from wave 0 (`docs/reviews/2026-10-16-wave0-live-haiku-high.md`, re-run 2026-10-17) and the routing run
(`docs/reviews/2026-10-16-routing-live-haiku-high.md`). Analyst Haiku 5.5 high. Don't fix until every wave has run.

1. **Another company's context adopted as the company's own (L5, 0 of 3). Most serious.** An uploaded context file for
   a different company (Brightwater, USD, list price, returns excluded) was used without checking the company name.
2. **Missing context is assumed, not asked (L0 to L2, 0 of 9).** With little or no context the analyst delivers a
   settled headline on net price with returns netted, and ends with an offer, not a question. List against net price
   flips Kitchen's 2025 direction. One L2 run didn't save the user's "returns stay in the totals".
3. **"Don't ask me anything" picks a basis silently (EC-18, 0 of 3).** It should still name the choice and label the
   basis as its assumption.
4. **Scenario replies leave out what the card requires (SC-1 to SC-4, 1 of 12 after the re-run).** Saved figures are
   exact; the replies miss:
   - K07 (sells below cost): breakeven doesn't apply, give its gross-profit change at fixed volume (SC-1, SC-3);
   - the fixed-mix assumption behind a group figure, and the per-SKU breakeven range (SC-2, SC-4);
   - the SKUs that need volume to grow rather than fall (SC-3: G06, K05, S02).
5. **Actual volume effect estimated from a promotion (SC-5, 2 of 3 failed).** "About 10.3%" fall estimated from S03's
   promotion, which the card forbids; breakeven given as about 11% instead of 13.07%.
6. **Seasonal comparison (EC-16, 1 of 3).** Explains a Q1 against Q4 fall without comparing Q1 2025 with Q1 2024.
7. **Smaller, one run each:** EC-17 extrapolated next year's margin; L6 re-asked a confirmed freight rule; L9 kept
   returns in after the user retracted them; rt-recommend skipped evidence-ranking.
8. **Harness tooling:** Haiku 5.5 is priced $0 (not in Pi's price list), so `--max-usd` can't stop a run; token totals
   are the only cost record.

9. **Data findings on the wave 1 data.** VERSION 8 (2026-10-17) fixed the case/format, date and partial-ratio misses:
   S2 10 of 11, S3 8 of 9 (`docs/reviews/2026-10-17-findings-stress-wave1.md`). Still open:
   - C029's `case` unit priced per each: needs quantity read against unit, a business rule;
   - scale labels are guesses (annual values labelled x12, x1e1 or x24);
   - `customer_id` flagged as a repeated document in snapshot and per-quarter tables;
   - one date fact repeated across every pair of date columns.
   - a money column whose values are 99% distinct counts as a key: two equal `spend` values in S3's `acquisition.csv` are
     flagged "duplicate-key conflicting".
   The mrr-with-discount identity is left to skills or the user. Business plants (policy, floor, rep spread) are the
   analyst's job.

10. **Wave 1 live findings (Haiku high, `docs/reviews/2026-10-17-wave1-live-haiku-high.md`):**
    - a user's mid-conversation correction (S2-5's floor) is used but never saved to `context.md` (0 of 3);
    - hidden cohorts within a group aren't looked for: S3-5 compared channels only and missed late-2024 paid search (0 of 3);
    - OUT-1 (with the 10-point rule, 0 of 3): finds the right customers and sees through the data faults, but doesn't look
      up each account's cause in the data it has (`contract_type`, the approver on each line) before advising, so the
      actions aren't matched to causes;
    - recommendations say "test it" without proposing a test (S3-4, 0 of 3);
    - customer mix not checked before blaming a rep (S2-3); an arithmetic slip (S3-2); a price-test result read as
      willingness to pay (WTP-3);
    - L2 still headlines before the returns basis is settled (0 of 3). Neutral price names fixed L0/L1 (2/3, 3/3).

11. **Data findings on the wave 2 real data (`docs/reviews/2026-10-17-findings-stress-wave2.md`):**
    - a UTF-8 file with a byte-order mark is skipped with an unclear error, which also loses the domain check (Olist);
    - frequent non-product codes (`POST`, `DOT`, `M`, `D`, `S`) aren't rare shapes when product codes split between two
      shapes (UCI, 5,317 rows);
    - headerless files: two read silently with a data row as the header; the rest skipped without saying "no header";
    - no detector for: sheets/extracts that overlap, a month with no rows, a renamed code, missing values, placeholders;
    - noise: timestamps treated as keys, zip codes and line numbers treated as measures, line totals peer-checked by
      product, status labels as code shapes, cancellation invoices as parse failures;
    - reading a large workbook takes 237 s against 5.7 s for the same data as CSV.

    **VERSION 9 (2026-10-17), uncommitted.** The scorer (`tests/evals/findings/score_findings.py`) now credits each fault
    only to its intended detector, scores real faults on the clean copy, and counts noise there. Fixed, each with a test
    in `test_findings_generalise.py`: the BOM file is read (`utf-8-sig`), so Olist is 4/4 on real faults; shapes outside the
    common shapes that hold 95% of values are flagged, so UCI is 11/11; files whose first row holds a decimal or timestamp
    are skipped as "no header row" (all 13 raw AdventureWorks files; none of 159 headed files), and `+|` fields with `&|`
    row ends are named as a multi-character delimiter. Runtime unchanged. The query tool and profiler have the same BOM
    bug (`ImportOptions` default `utf-8`): workstream B.

    Left as method limits: Northbridge `price_decimal_shift` (2 rows at 4.6× and 4.99×, under 5×) and
    `quantity_extra_zeros` (quantity too spread for a peer check); Olist ×100 on products sold under 3 times; the
    AdventureWorks rekeyed order header (its lines are caught; a "repeated except keys" rule flagged most master-table rows).

    **Noise fixes, noted, not built (decide after seeing how VERSION 9 works out):**
    - A. Timestamps and decimal (money) columns treated as keys: Olist timestamps "duplicate-key conflicting" (2,738
      rows), S3 `spend`. Fix: a timestamp or decimal column is never a key.
    - B. Variable-length codes split into many shapes: AdventureWorks `CreditCardApprovalCode` and `PurchaseOrderNumber`,
      UCI/Northbridge `99999AA` product codes, Olist status and payment labels. Fix: read a run of digits or letters as one
      unit in the shape. Cost: a 6-digit code among 5-digit codes is no longer a shape finding (domain still catches it
      when there's a master).
    - C. Spelling variants in free-text columns (Olist review comments, about 6k rows). Fix: variants only where values
      repeat.
    - No generic rule found yet: numbers that aren't measures (zip codes, line numbers, photo counts), peer groups that
      don't describe the column (quantity vs order or customer, line totals vs product), repeated documents in snapshots
      and histories, AdventureWorks' real identical same-day baskets.
    - Real facts, not noise: UCI `C`/`A` invoices (mislabelled as parse failures), description spacing variants, far UCI
      prices; Olist approved after carrier/delivery, reviews before delivery, shipped after estimate; two AdventureWorks
      stores with one name.

    **Uncovered faults, noted, not built (proposed home):**
    - Overlapping extracts (UCI sheets, 22,523 rows): script, as a repeated-row check across sources with the same columns.
    - Empty months (UCI 2011-03 planted, Olist 2016-11): script, but needs a source-level note in coverage (no rows to flag).
    - Renamed codes (`22423` → `22423R`): skills; pairing a code with its description is a guess about meaning.
    - Missing values (UCI customer ID, Olist category): skills; the profiler already reports blanks per column.
    - Placeholders (`Unspecified`, a number or email as a city): skills; a judgement about meaning.
    - Also: Northbridge overlapping cost intervals and AdventureWorks fixed-width padding (script, small); sold after the
      sell-end date across two joins (skills); the ×1.17 currency slip (no detector).

Test-side, not a fix item: EC-8 run 1 judge verdict looks wrong (failed R3 although the reply never used 45%).

12. **Workbooks can't be queried (wave 2 smoke run, UCI-2).** The query tool attaches CSV sources only
    (`query_server.py` `attach_views`, `format='csv'`). A `.xlsx` upload is profiled and scanned for findings (about
    4 minutes for the 45 MB UCI workbook), but its sheets never become views, and reading the file from a script is
    refused by the "filter in SQL first" guard. The analyst correctly gave no figures. Any workbook upload is a dead end.
    **After the workbook fix:** redo the workbook tests: re-run UCI-2 live, and add a workbook-only case to the earlier
    sets (`csv-xlsx-parity` ships a CSV copy beside its workbook, so it never needed the workbook path).

13. **Wave 2 live findings (`docs/reviews/2026-10-17-wave2-live-haiku-high.md`, 22 of 57):**
    - the "no direct source reads" guard can be bypassed: a script converts the source to CSV in `/tmp`, copies it into
      the work folder, and the copy is queried (UCI-2 run 2);
    - headerless files can't be read even with their schema: no view, no way to pass column names, scripts blocked (AW-7);
    - user-stated rules not saved to `context.md` (Olist-5 0 of 3, UCI-8 2 of 3), as wave 1;
    - `pricing-intake` not read with a bare context (UCI-1, 0 of 3), though the answers were good;
    - causes not checked before advising on outlier accounts (AW-4, 0 of 3), as OUT-1.
    - Test side, fix before the re-run: AW-3 and UCI-2 keys store `margin_…` columns rounded to 4 decimals, but the
      grader uses an exact tolerance for "margin" columns, so no answer can pass them.

14. **More upload formats aren't checked (2026-10-17).** `src/files.ts:12` maps only `.csv` and `.xlsx` to table kinds,
    and data findings and source profiles take only those (`src/agent/workflow/data-findings.ts:36`). `.tsv`, a tab or
    pipe-delimited `.txt`, and `.xlsm` are never checked, although `data_findings.py` already reads them (delimited text
    as CSV, `.xlsm` sheets like `.xlsx`). `.xls`, `.json` and `.parquet` aren't read by any tool. Cheapest step: map
    `.tsv` and `.xlsm` in `files.ts`; check the query tool reads them too (it attaches CSV only, item 12).

15. **`pricing-intake` never fires on a bare or foreign context (2026-10-17, after plugin 0.4.10).** Targeted re-run
    `.cache/evals/live-2026-10-17T13-01-56-898Z`: UCI-1 0 of 3 (intake never read; replies otherwise good), L5 0 of 3
    (turn 1 calls the uploaded Brightwater file "your confirmed context"; intake opened only after the user's correction).
    Every run read analyze and a card, so the skill-read gate was satisfied without intake, and the new triage line ("when
    `context.md` is missing, belongs to another company or lacks a definition the request depends on, also run intake")
    was not acted on. Suspected link to the same fix: shared rules now count user-stated rules as confirmed, which may make
    a thin or foreign context look settled. Not fixed; needs tests to find the cause before changing anything (for example
    an A/B with and without the 0.4.10 shared-rules and triage lines on UCI-1, L0 and L5). Candidate fixes noted, not
    built: the skill-read gate also requires intake once per new conversation; the stage prompt says only `context.md`
    is confirmed and any other file must be checked with the user.

16. **Analysis rules that skill text has not fixed yet (2026-10-17, plugin 0.4.10, Haiku 5.5 high).** Every failing run
    read the skill or card holding the rule (`skills-read.json` in each run's stage folder).
    - **A/B on recommend (OUT-1, AW-4, 5 runs per arm):** arm A `.cache/evals/live-2026-10-17T15-12-13-294Z`, arm B
      `.cache/evals/live-2026-10-17T15-23-47-764Z`. Arm B moved "find each flagged item's cause" into step 1 and staging
      into step 4. OUT-1 0/5 both arms (R1-R3 fail every run); AW-4 1/5 in A, 0/5 in B. No effect; reverted to A. Both
      arms sometimes look causes up (A run 4 found C027's legacy contract and R04's self-approval), so the gap is finding
      all three causes and matching each action, not the lookup itself. The round-1 recommend lines (cause, staging,
      test spec) also show no measured gain against 0.4.9 (OUT-1 0/3 then 0/5).
    - **Unconfirmed definitions (EC-18 0/3):** the new required check in analyze step 2 did not make runs calculate on
      list price as well as net; one run asked about returns instead. L2 rose to 2/3. Run folder
      `.cache/evals/live-2026-10-17T15-17-24-366Z`.
    - **Hidden cohorts (S3-5 0/3):** turn 1 still splits 2024 by channel and segment only; the half-year split appears only
      when the save request asks for it.
    - **Scenarios:** bottom-up breakeven lifted SC-1 to 2/3 (run 3 is a real pass: the judge's quote joined two sentences,
      so the verbatim-quote check failed it) and SC-3 to 1/3; SC-3 still misses naming G06, K05 and S02 as needing growth.

17. **Same cases on Sol low (analyst and judge), 2026-10-17.** Run `.cache/evals/live-2026-10-17T15-33-11-021Z`; the
    judge refuses its own family, so the saved replies were graded afterwards with Sol low (`rejudged.json` there).
    Sol passes what Haiku fails on items 15 and 16: UCI-1 3/3 (reads intake every run), EC-18 3/3, SC-1 3/3, SC-3 2/3, and
    S3-5 finds the late-2024 paid-search CAC doubling every run. So those are mostly Haiku's limits, not missing method.
    Failing on both models: staging and risk weighing (OUT-1 runs 2-3 and every AW-4 run fail only R3); L2 and L5 give
    no question in turn 1 (L2 shows both returns treatments and says the movement "should wait for confirmation", but
    asks nothing); L5's context fails only on a note that the Brightwater file does not apply; S3-5 still fails R1 (the
    churn half of the cohort) and all three runs put partner 2024-H2 CAC at 364.84 against the key's 459.87.

18. **Staging and account-loss risk not weighed (R3 of OUT-1 and AW-4), on Haiku and Sol (2026-10-17).** Both models read
    `pricing-recommend` (which says "Stage changes, and weigh the risk of losing each account against the amount at
    stake") and stage their actions in order, but no reply sets what losing an account would cost against the money at
    stake. Sol OUT-1 run 2 is otherwise complete (causes for C027, C028, C029 matched to actions). Proposed, not built:
    make the rule concrete in recommend step 4 (for each change to an account, give the amount at stake and what losing
    the account would cost, its annual sales or contribution, and stage the change accordingly, for example at renewal),
    then A/B it on Haiku and Sol, 5 runs per arm. Possible test question, left as is: AW-4's best answer changes no
    reseller's terms, yet R3 still asks for the account-loss weighing.

    **Grader fix made with this item (turn-1 question check).** `acted` now counts only `write` and `edit`, not
    `present`: shared rules §3 and §5 ask the analyst to show the scenarios as a table and chart and then ask, which the
    old check failed (all six Sol L2/L5 runs). "Should I … or …?" now counts as a question, not an offer (Sol L5 runs 1
    and 2 asked "Should I apply the Brightwater rules here, or use a different basis?"). Re-scored by hand on run
    `.cache/evals/live-2026-10-17T15-33-11-021Z`: Sol L2 0/3 → 3/3; Sol L5 still 0/3 on the context check.
19. **Data findings miss the each-vs-case ×12 lines on the EC-10 data (2026-10-17, VERSION 9).** On
    `tests/evals/inputs/b2b-uom` the ratio detector reports "skipped: no key whose groups describe its numbers" on
    `invoices.csv`, so the 106 lines invoiced in cases (2.9% of rows, unit price ×12) get no finding; the plan (3j EC-10)
    expected an `x12` label. Likely cause: the detector switches itself off when more than 2% of rows sit far from the
    median. Not changed: the data stays as built, and the live EC-10 run tests whether the analyst finds them anyway.
20. **Wave 4 live baseline (2026-10-17, plugin 0.4.10).** Haiku 5.5 high, Sol low judge: 14 of 42 (run
    `.cache/evals/live-2026-10-17T17-33-49-507Z`, $3.69; EC-19 re-graded on the fixed key). Sol low as analyst on the 11
    failing cases: 9 of 33 after re-judging (`.cache/evals/live-2026-10-17T18-10-08-948Z/rejudged.json`, $5.76).
    - **Haiku only** (Sol passes): EC-1 3/3, EC-11 2/3, EC-12 2/3, EC-3 2/3.
    - **Both models fail, analysis depth:** EC-2 R2 (neither traces the deeper H2 2025 discount to the 186 lines left on
      the old list; both call the cause unproven), EC-6 (Haiku misses C041 setting Rail's reference; Sol drops T111 from
      the tie), PO-4 (Haiku takes the weighted median over lines, not products; Sol leaves out lines with no rebate row
      and asks, though its sensitivity case matches the key exactly).
    - **Likely test faults, to decide:** PO-5 (both models list 22423 and the same Bags products, within the 5-point
      hard-negative band copied from the synthetic case; on real data that band looks too tight); OUT-2 (the planted
      accounts' gaps, £433-£1,197, are smaller than natural UCI outliers, so both models discuss other customers and
      never reach the plants' causes); UCI-7 (Sol takes January-November 2011 from the context's like-for-like line for
      our average price, where the file ask says 2011).
    - **Analyst deviations on exact text and rounding:** EC-19 Sol rounds the 40% price up to the cent (to keep at least
      40%), the file ask says rounded; EC-2 Haiku run 1 wrote `2024 H1` for `2024-H1`.
    - **Key fixed:** EC-19 compared .99 prices with cent-rounded 40% prices; the plan says totals come from unrounded
      values ($16,753.41, not $16,726.43).
21. **Persistent failures traced (2026-10-17, after waves 0-4).** Test faults fixed (uncommitted): `verify.ts` gave
    `price_40_margin` the 1e-10 margin tolerance (EC-19, AW-5; Sol's cent-up 40% prices now pass); EC-19 scope "still
    on sale" was only in the save-turn ask (turn 1 now says "each bike we still sell"; both models gave $16,781.44 over
    all 68 bikes sold); S3-5 CAC "over their sign-up months" let Sol skip zero-sign-up months (364.84 vs 459.87;
    context now includes them); PO-4 context did not say a missing rebate row means no rebate (Sol left out 1,177 lines
    and asked) and "weighted … over all lines" allowed Haiku's line-level median (26.9237%); AW-4 R3 now passes a reply
    that changes no reseller's terms; OUT-1/OUT-2 R3 reworded to a checkable test (the judge failed "staged and weighed
    against the risk of losing the account"). Free oracle 84/84. Judge oracle on the three R3 cases and re-judging the
    saved replies wait for the ChatGPT usage limit. Skill gaps left for a decision: EC-2 (no card says to count lines
    still on the old list after a list change) and EC-6 R2 (no card says a dominant peer sets the reference). S3-5 R1's
    churn half left as is (12-month GP already nets churn; a possible rubric overreach).
    **Checked live (Haiku 5.5 high, DeepSeek v4.1 flash high judge, plugin 0.4.11, run
    `.cache/evals/live-2026-10-17T20-37-47-047Z`, $2.21).** Held: EC-19 3/3, EC-6 3/3 (dominant-peer line), S3-5 CAC
    (CSV right 3/3; R1 still Haiku's missing half-year split), AW-4 R3 (Sol replies 3/3 on re-judge). False: EC-2 (the
    186 old-list lines cannot be told apart in the published data: depth runs 0-36% with no gap, and only 9 of 966 H2
    lines repeat an earlier customer and sku price; the new waterfall line made run 3 claim no line was on the old
    list); OUT-1/OUT-2 R3 (the clearer wording still fails every saved reply, so the weighing is really missing).
    Incomplete: PO-4 reference now matches, but `pocket_margin_pct` gets the 1e-10 margin tolerance against a 4-dp key,
    and run 1 adds A110 with no out-of-line rule in the context. The DeepSeek judge returned empty answers on 3 calls
    (8,000 output tokens with high reasoning, `judge.ts`), so those grades are void.
    **Follow-up the same day.** EC-2 waterfall line removed (plugin 0.4.11 keeps only the peer line). `tolerance()` now
    checks pp/pct/share before margin/rate (PO-4's `pocket_margin_pct`), and the judge gets 32,000 output tokens. The
    live run re-graded (`regraded-deepseek-32k.json`, no empty answers): PO-4 2/3 (run 1 lists A110, no out-of-line rule
    in the context), EC-19 3/3, S2-5 3/3, EC-6 2/3 (R2 passes 3/3; run 3 fails R1, Marine "flags mirror each other"),
    S3-5 0/3 (R1, the half-year split Haiku never makes), AW-4 0/3 (R2 cause checks; run 1 R3 moves accounts without
    weighing the loss), OUT-1 0/3, EC-2 0/3 (R2 still asks for line attribution the data cannot show).
22. **Fixes for the two core weaknesses, tried 2026-10-17/18 (plugin 0.4.12, findings VERSION 10).**
    - **Unit errors in data findings (kept):** the ratio check labels ÷12 and ÷24 (17841's per-each lines read "x1e-1"
      before) and leaves ×12/×24/÷12/÷24 rows out of its 2% switch-off, so EC-10's 106 case lines are now flagged
      (91 ×12, 15 ×10). Over every eval input the only other change is relabelling; stress recall equal to VERSION 9
      (UCI 4/4, Olist 6/7, AdventureWorks 8/9 on both). Two pytest cases added.
    - **Reply lint `check-before-recommending` (no gain):** fires on 13 of 15 OUT-1/OUT-2/AW-4 runs and Haiku does run
      the lookups in the revision turn (for example C028's 59 rep-approved lines), but graded results did not move
      (Haiku 5.5 high, DeepSeek judge, run `.cache/evals/live-2026-10-17T21-51-07-769Z`, $2.68 against re-graded
      baselines): OUT-1 0/5 (baseline 0/13), OUT-2 0/5 (0/3), AW-4 2/5 (6/13), S2-4 4/5 (3/3), EC-10 5/5 (3/3).
      Causes named rose a little (OUT-1 all three in 2/5 against 1/13; C027's legacy contract 4/5 against 2/13), cost
      per OUT run rose about 60%.
    Decision (user, 2026-10-18): cause-finding before recommending is accepted as a model limit; the lint is removed
    and the plugin stays at 0.4.11 (peer line only). The detector fix stays.

23. **Founder unit-economics live run (fo-1 to fo-6, Haiku 5.5 high, Sol low judge, 1 repeat, 2026-10-19, 1 of 6,
    `.cache/evals/live-2026-10-19T11-58-09-763Z`).** Test faults fixed after the run: the fee sign was not stated (fo-1, fo-3), and the payout amount could
    be read as gross or net (fo-3). Analyst findings:
    - the SQL template linked from the recurring-metrics card was never opened (0 of 6); every case read only the card
      and the analyze skill;
    - confirmed time zones ignored: a fixed -1 hour offset for Berlin month ends, wrong in summer (fo-2); +2 hours added
      to a file the context says is already in Berlin time (fo-3); UTC month boundaries (fo-5);
    - the invoice period used instead of the line-item period the context names, then MRR given up as "not computable"
      (fo-3);
    - payback contribution taken as charge gross less fee, VAT included and not spread over the period, against the
      confirmed basis: Google payback month 27, expected 34 (fo-6);
    - a charge id shared by a charge and its refund or dispute read as "70 duplicated charges with conflicting values"
      (fo-3, fo-5);
    - untagged customers, organic ones included, split pro rata between Meta and Google to give a CAC (fo-5).
    - Re-run with 3 repeats (`.cache/evals/live-2026-10-19T12-22-09-322Z`, 4 of 18, $1.56 analyst, about $0.06 judge at
      API prices): fo-4 3 of 3, fo-1 1 of 3 (a second run failed only on the judge wanting "February"; R1 loosened after
      the run), fo-2, fo-3, fo-5, fo-6 0 of 3. Same causes as above, plus: fo-1 run 1 kept the duplicates; fo-3 never
      states December MRR (0 of 3) or that charges include VAT; fo-5 hedges the platform ranking on a pro-rata split of
      all untagged customers (0 of 3); fo-6 payback month 27-28 against 34, from charge gross less fee (3 of 3).
    - DeepSeek v4.1 flash 1017 high, same cases (`.cache/evals/live-2026-10-19T12-56-23-295Z`): 11 of 18 (Haiku 4 of 18). Failures both models share, so
      harness-side: the SQL template is never opened (0 of 36 runs); fo-5 R3 0 of 6, as the card lacks the template's
      point that tagged-only CAC is an upper bound whose ranking survives equal tagging; fo-2 1 of 6, with month-end MRR
      tested by date, so a renewal on the last day counts twice (both models' February 38,290.66), and the context's
      "covers the month end" does not say it is the instant the month ends. Haiku only: fo-6 contribution basis (0 of 3
      against 3 of 3), fo-3 explanations. Harness fix while testing: a model ID newer than Pi's catalogue now borrows
      settings from the entry with the longest shared ID prefix (DeepSeek had taken deepseek-chat's: no reasoning).
    - Fixed (user, 2026-10-19): SQL template deleted (never read); the card gains the month-end-instant rule and the
      linked-only CAC rule. DeepSeek re-run of fo-1, fo-2, fo-3, fo-5 (`.cache/evals/live-2026-10-19T13-27-45-999Z`): 4 of 12 as graded, 6 of 12 after
      re-judging with the fo-3 R1 and fo-5 R3 wording fixed to match the card. fo-2's month-end MRR is now right in all
      3 runs (one reply left the figure out); every fo-5 reply states the upper bound and stops splitting untagged
      customers. Left: dispute fees counted as disputes (fo-1 run 3; the context now says where they go, untested),
      fo-3 fee total wrong in one run, and one reply each missing the linked share or the ranking condition.

