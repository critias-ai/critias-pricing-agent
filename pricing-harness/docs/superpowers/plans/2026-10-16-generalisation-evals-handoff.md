# Handoff: generalisation evals (continue in a fresh session)

Written 2026-10-16. Branch: `feat/thin-analyst`. HEAD: `27f7fa8`.

## Read these first, in this order

1. `docs/superpowers/plans/2026-10-16-generalisation-evals.md`: **the plan**, with 106 cases. Most of it is design.
   - Part 1: sources to keep or drop.
   - Part 2: data expansion and the synthetic sets S1 to S5.
   - Part 3: the test taxonomy (A to K), the matrix, the cases, the grading hardening, sections 3e to 3k.
   - Part 4: the day-0 deliverables.
   - Part 5: order and budget.
   - Parked section: elasticity.
2. `docs/superpowers/plans/2026-10-16-realistic-evals.md`: the prerequisite plan, steps 1 to 4 (natural prompts and a save turn, a held-out seed, a messy multi-file set, a rubric judge).
3. `docs/reviews/2026-10-16-findings-stress-baseline.md`: data findings before and after VERSION 7.
4. `docs/reviews/2026-10-16-generalisation-evals-adversarial-review.md`: the review that sections C and D of the plan absorbed.

## What is done

| Item | State |
|---|---|
| **D0-1** Card links from every `SKILL.md` | **Committed** in `9b2d703`. Plugin 0.4.9 in `bundled/`. `tests/unit/bundle.test.ts` checks the skill-to-card map, and that every card is linked from at least 2 skills. |
| **D0-2** `data_findings.py` VERSION 7 | **Committed** in `27f7fa8`. All 14 targeted gaps are closed (`tests/python/test_findings_generalise.py`). On Northbridge: 33/37 caught, 0 unexplained, 105 clean findings, each one reviewed. The stress runner is `tests/evals/findings/findings_stress.py`. |
| Suites at HEAD | 187 vitest, 76 pytest, typecheck and prettier on touched files: all pass. Three prettier warnings in files not touched here pre-date this work. |

## Decisions the user made (don't re-open them)

- **Elasticity is parked** as a later feature, along with the S1 pricing lab and price optimisation. Scenario tests use **breakeven volume at constant absolute gross profit**.
  - When it is picked up, `price-change-economics.md` must change first, because it forbids estimating elasticity from historical data.
  - Willingness-to-pay cases report **observed rates only**.
- **Sources:**
  - kept: UCI Online Retail II, AdventureWorks (CSV exports), Dunnhumby and Olist for the pilot; M5, Airbnb and Iowa in wave 3;
  - TheLook is a maybe;
  - dropped: EDGAR, TPC-DS, NYC taxi and the public benchmarks;
  - World Bank CPI and Open Prices are adjuncts only.
- **Excluded from this round:**
  - technical tests: spreadsheet export hazards, chart mechanics, wide files, files changing mid-session;
  - moral or legal tests: antitrust, acting beyond authority;
  - injection in data: tested later, in a separate run.
- **The old 300-line diff budget is dropped.** Code must pass **ponytail ultra** instead.
- **Day-0 gate:** no live (LLM) case runs on a source until `findings_stress.py` passes on it.
- **Product outlier tests** cover the whole portfolio and within one group. Planted outliers are at least 3% of sales and 10% of their group, with a gap of at least 1% of gross profit, so the materiality checks can't drop them. There is a tiny control SKU, G10, at about 0.2% of sales.

## What is not committed, on purpose

- `tests/evals/cases/*.json`, `tests/evals/{run,spec}.ts`, `tests/evals/keys/context-import.json` and `tests/unit/eval-verifier.test.ts`: **realistic-evals step 1** (natural prompts and a save turn), built earlier with the oracle passing 15/15. The user hasn't asked for it to be committed.
- Every plan, review and research doc listed under `??` in `git status`.
  - `docs/research/messy-data-determinism-2026-10-13/` must stay uncommitted.
  - Ask before committing the others.

## Next steps, in order

1. **Finish realistic-evals steps 2 to 4.** Step 1 is built but uncommitted. The step 4 rubric judge is needed for about half of the generalisation cases.
2. **Grader changes, from plan section 3b:**
   - `expectReads`: scored over the whole conversation, with must-not as the main assertion. The read data is already in `analyses/<run>/events.jsonl`.
   - `expectContext`: checks what got written to `context.md`.
   - labelled, signed `replyNumbers`;
   - the three-tier outlier key;
   - the no-NaN/Inf check on saved files;
   - judge hardening, and `expectQuestion` counting only blocking questions.
3. **Wave 0 data:** a `retail-outliers` seeded variant (a generator option on `make_retail.py`), with the plants from section 3i. Run `findings_stress.py` on it.
4. **Wave 0 cases:**
   - the context ladder L0 to L9 on retail;
   - the 11 routing cases (RT-*);
   - SC-1 to SC-5 and PO-1 to PO-3;
   - EC-4, EC-5, EC-8, EC-9, EC-16, EC-17, EC-18 and EC-20.

   Every case needs a solution script, and `npm run eval:oracle` must pass.
5. **Live wave 0, which needs explicit user approval, at most 5 runs at a time.** This includes the D0-1 before and after: run the routing cases on plugin 0.4.8 (a worktree at `066fc50`) and on 0.4.9.
6. **Wave 1:** generate S2 (B2B) and S3 (SaaS), pass the stress gate, then the cases. Then wave 2: fetch the real sources, with checksums and a manual download path for Dunnhumby, Kaggle and Airbnb.

## How to run things

- Python suite: `npm run test:python`. Vitest: `npx vitest run`. Typecheck: `npm run typecheck`.
- Stress runner, from `pricing-harness/`:

  ```bash
  .venv/bin/python -I tests/evals/findings/findings_stress.py northbridge workspace/northbridge-test --seeded workspace/northbridge-seeded --key .cache/seeded-pack/answer_key.csv --out .cache/findings-stress/<tag>
  ```

  It takes about 80 s.
  - Earlier results: `.cache/findings-stress/` (VERSION 6 baseline) and `v7c/` (final VERSION 7).
  - Synthetic scale files: `tests/evals/generators/make_scale.py <out>` writes them; make `<out>/wide` and `<out>/long` first. The script is in the working tree but not committed.

## Gotchas

- **The bundled plugin is ahead of the separate plugin repository.** The repository is at 0.4.7, with the bundled copy at 0.4.9. Back-port before pushing that repo.
- **macOS has no `timeout` command.**
- **In zsh, quote the `grep --include` glob:** `--include='*.ts'`.
- **The findings "after today" check depends on the run date,** but the findings cache is keyed by content.
- **The stress runner reads only a workspace's `files/` folder.** Northbridge workspaces also hold old run output in `analyses/` and `.pricing/`.
- **User preferences** (see memory): the simplest option; plain, direct explanations; correctness over agreement; no business assumptions in cleaning code. Don't push or open a PR unless asked, and no paid or live runs without explicit approval.
