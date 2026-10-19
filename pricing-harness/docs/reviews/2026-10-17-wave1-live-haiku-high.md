# Wave 1 live run: Haiku 5.5 high, judged by Sol low

Date: 2026-10-17.

- **Analyst:** `anthropic/claude-haiku-5.5`, thinking high, through OpenRouter.
- **Judge:** `gpt-6.1-sol`, thinking low, through the OpenAI endpoint.
- **Code:** commit `731e9f7`, plugin 0.4.9, data findings VERSION 8.
- **Scope:** the 13 wave 1 cases (S2 B2B and S3 SaaS) and the L0 to L2 re-run with neutral price names, 3 runs each.
  48 runs, all finished.

Run folder: `.cache/evals/live-2026-10-17T09-09-07-888Z`.

## Before the run

- **Free oracle:** 53 of 53.
- **Judge oracle:** 72 of 72, after one fix. My failing reply for S3-3 gave only the total uplift, so it also broke
  "sizes the uplift by plan", and Sol was right.

## Result

| Case                          |  Runs passed | Main reason for failures                                                                          |
| ----------------------------- | -----------: | ------------------------------------------------------------------------------------------------- |
| S2-1 leakage                  |       2 of 3 | One run didn't separate on-invoice from off-invoice layers.                                       |
| S2-2 policy breaks            |       2 of 3 | One run didn't give counts per approver.                                                          |
| S2-3 reps                     |       0 of 3 | Two runs didn't check customer mix; one failed a rubric item that was too narrow (fixed).         |
| S2-4 policy proposal          |       0 of 3 | A rubric item demanded R04 by name (too narrow, fixed).                                           |
| S2-5 floor correction         |       0 of 3 | **The corrected floor (cost + 15%) was never saved to `context.md`**, though every reply used it. |
| WTP-1 quotes                  |       2 of 3 | One run named selection without saying why.                                                       |
| OUT-1 customers               |       0 of 3 | C027 and C028 missing in every run; turn 2 acts before finding causes.                            |
| S3-1 MRR bridge               |   **3 of 3** |                                                                                                   |
| S3-2 price churn              |       2 of 3 | One run counted 1 churned customer instead of 18.                                                 |
| S3-3 grandfathered            |       0 of 3 | Mixed: one rubric item too literal (fixed); staging and sizing gaps in others.                    |
| S3-4 Better seats             |       0 of 3 | No concrete test proposed.                                                                        |
| WTP-3 Best plan               |       2 of 3 | One run read "customers pay up to £59" from the price test.                                       |
| S3-5 LTV/CAC                  |       0 of 3 | **The hidden late-2024 paid-search cohort was never found**: replies grouped by channel only.     |
| L0 none (neutral names)       |   **2 of 3** | Was 0 of 3 with `net_price`/`list_price`.                                                         |
| L1 currency (neutral names)   |   **3 of 3** | Was 0 of 3.                                                                                       |
| L2 no returns (neutral names) |       0 of 3 | Headline given before the returns basis was settled, as in wave 0.                                |
| **All**                       | **18 of 48** |                                                                                                   |

- **Consistency:** 11 of 13 cases that save files gave the same figures on every repeat. OUT-1 picked different
  customers each run; S3-5 run 1 read the churn definition differently (see below).
- **Effort:** about 12 model calls and 60 seconds per run.

## What the neutral names showed

Renaming the prices to `price_a` and `price_b` moved L0 from 0 of 3 to 2 of 3 and L1 from 0 of 3 to 3 of 3. So in wave 0
the analyst did treat the price choice as settled because a column was called `net_price`. L2 still fails 0 of 3: the
context defines the price, and the analyst still headlines before asking whether returns stay in.

## Harness and skill findings

1. **A correction isn't saved (S2-5, 0 of 3).** The user corrects the floor in turn 3. Every reply uses the new floor,
   but `context.md` keeps only the starting facts.
2. **A hidden cohort within a channel isn't looked for (S3-5, 0 of 3).** All runs compared channels and called paid
   search the weakest at about 3×. None split by sign-up period, so none found that July to December 2024 paid-search
   sign-ups cost twice as much (£1,228 against £594) and churned more than twice as often.
3. **Outliers ranked by money only (OUT-1).** Every run found C029, the unit-of-measure error. None listed C027 or C028,
   which sit 17 to 20 points below their size-matched peers but are worth only £7k to £8k. Turn 2 recommended fixing data
   or approvals before finding each account's cause. Two runs also listed C008 at 169% of list, which is a data fault
   (packs of 24 and ×10 prices), not a customer paying more.
   _This may partly be my test design:_ the question doesn't say whether a small account far below its peers counts as
   odd. **Decision needed:** keep C027 and C028 required, or require only C029.
4. **Recommendations without a concrete test (S3-4, 0 of 3).** Replies said the upside is "unproven until tested" but
   didn't propose one.
5. **Customer mix not checked before blaming a rep (S2-3, 2 runs).**
6. **Arithmetic slip (S3-2 run 2):** 1 churned customer instead of 18 in the increase arm.
7. **Price-test result read as willingness to pay (WTP-3 run 2).**
8. **L2: headline before the returns basis is settled (0 of 3, as in wave 0).**

## Test faults found and fixed after the run

These were fixed in the keys and checked again: free oracle 53 of 53, judge oracle 24 of 24 on the changed cases. The
48 live runs were **not** re-graded, so up to 5 failures above may be test faults. Those are S2-3 run 1, S2-4 runs 1 to 3
and S3-3 run 1.

- **S2-3 R1** required a standard deviation. Run 1 showed the spread as lines over each threshold. It now asks for
  figures comparing R04 with the other reps.
- **S2-4 R1** required R04 to be named. It now asks for the proposal to be grounded in figures from this data.
- **S3-3 R2** required "2024 sign-ups" wording. Run 1 said the test "covers non-grandfathered customers", which is the
  same point. The item now accepts either.
- **S3-5 churn:** "churned within those 12 months" was ambiguous for a customer billed for all 12 months who then left.
  Run 1 didn't count them, and the key did. The request now says "last billed month before their 12th month", and the
  key follows run 1's reading: paid search 13.0% in H1 against 32.1% in H2.

## OUT-1 re-run with the 10-point rule (same day)

The OUT-1 context now says a customer is out of line when its index is at least 10 points from its peers' median
(`c7873dd`). Free oracle 53 of 53; judge oracle 6 of 6. Run folder: `.cache/evals/live-2026-10-17T09-37-42-752Z`.

**0 of 3 runs passed, but the first turn is now right in every run.**

- **Turn 1:** every run listed C027, C028 and C029 with the right gaps, plus C008, C012 and C039, which the rule also
  covers.
- **Turn 2:** every run worked out that C008, C012 and C039 only look out of line because of faulty lines (prices about
  9× or 24× list), and held them back. That is good data handling.
- **Every run failed on finding each account's cause before acting:**
  - **C029:** run 1 said its case lines look invoiced at a per-each price, which is the cause. Runs 2 and 3 only said
    "check billing".
  - **C027:** no run used `contract_type` in `customers.csv`, where its 2018 legacy contract is recorded.
  - **C028:** no run checked who approved its discounts (its rep, R04, above the rep's 10% limit). Run 2 only said "needs a
    director sign-off on record".
  - With the causes not found, every run advised "validate first, don't reprice" rather than an action matched to each
    account. The judge's verdicts (R1, R2 and R3 failed) match the replies.
