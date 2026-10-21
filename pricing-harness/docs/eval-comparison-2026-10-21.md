# Eval comparison, 2026-10-21

Haiku 5.5 high and DeepSeek v4.1 flash 1017 high, both via OpenRouter; judge gpt-6.1-sol low; 3 repeats; graded with the current verifier and rubrics. **Haiku 234/333, DeepSeek 213/333.** Cases where both pass 3/3 are left out. "Fails on" counts runs with at least one failure of that kind.

Verdict: the harness issue is the context file and intake (ladder-l5, uci-1: both models fail the same way). Two runs were lost to infrastructure (uci-8, fo-2). Every other difference is a model limitation.

Runs: Haiku `.cache/evals/live-2026-10-20T19-08-53-241Z` (re-graded) and `live-2026-10-21T12-48-50-337Z` (olist-2, uci-5); DeepSeek `live-2026-10-21T11-35-03-963Z` and `live-2026-10-21T12-53-48-661Z`.

| Case | Haiku | DeepSeek | Haiku fails on | DeepSeek fails on | Note |
|---|---|---|---|---|---|
| aw-3-cost-margin | 1/3 | 0/3 | reasoning 2, saved figures 1 | saved figures 2, reasoning 2 |  |
| aw-4-reseller-discounts | 0/3 | 1/3 | reasoning 3 | reasoning 2 |  |
| aw-6-reseller-rise | 2/3 | 0/3 | reasoning 1, reply figure 1 | reasoning 2, saved figures 1 |  |
| duplicates | 2/3 | 3/3 | question 1 | - |  |
| ec-1-currency | 3/3 | 0/3 | - | reasoning 3, saved figures 3, question 2 | DeepSeek mis-converts EU trade revenue |
| ec-11-credits-timing | 1/3 | 1/3 | reasoning 2, reply figure 2 | reasoning 2, reply figure 2 |  |
| ec-12-kits | 2/3 | 1/3 | reasoning 1 | reasoning 2, question 1 |  |
| ec-16-seasonal | 2/3 | 3/3 | reasoning 1 | - |  |
| ec-17-forecast | 3/3 | 0/3 | - | reasoning 3 | DeepSeek gives a point forecast |
| ec-19-price-endings | 2/3 | 3/3 | reply figure 1 | - |  |
| ec-2-list-change | 0/3 | 0/3 | reasoning 3 | reasoning 3 | Both notice the list change, never test it |
| ec-3-free-lines | 1/3 | 1/3 | reasoning 2, saved figures 1 | saved figures 2 |  |
| ec-4-zero-base | 0/3 | 1/3 | saved figures 3, reasoning 1 | saved figures 2 |  |
| ec-6-thin-peers | 0/3 | 1/3 | reasoning 3, saved figures 1 | reasoning 2 |  |
| ec-8-pushback | 1/3 | 3/3 | reasoning 2 | - |  |
| fo-1-payout-tie | 1/3 | 2/3 | saved figures 1, reasoning 1 | reasoning 1, saved figures 1 |  |
| fo-2-mrr | 2/3 | 0/3 | reply figure 1 | reply figure 2, saved figures 2, provider/judge error 1 | MRR figures off; 1 run also lost to a judge overload |
| fo-3-cash-vs-mrr | 1/3 | 2/3 | reply figure 1, saved figures 1, reasoning 1 | reply figure 1 |  |
| fo-4-blended-cac | 2/3 | 3/3 | saved figures 1 | - |  |
| fo-5-channel-cac | 1/3 | 2/3 | reply figure 2, reasoning 1 | reasoning 1, reply figure 1 |  |
| fo-6-what-works | 0/3 | 3/3 | reasoning 3, saved figures 3 | - | Haiku ignores the payback definition |
| ladder-l0-none | 3/3 | 2/3 | - | reasoning 1 |  |
| ladder-l1-currency | 3/3 | 2/3 | - | reasoning 1 |  |
| ladder-l2-no-returns | 2/3 | 1/3 | reasoning 1 | reasoning 2 |  |
| ladder-l3-full | 2/3 | 2/3 | question 1 | question 1, saved figures 1 |  |
| ladder-l4-conflict | 3/3 | 0/3 | - | context file 3, reasoning 1 | DeepSeek edits context.md when it must not |
| ladder-l5-other-company | 0/3 | 0/3 | reasoning 3, skill not read 3, context file 3, question 1 | reasoning 3, context file 3 | **Harness:** both save the sister company to context unconfirmed |
| ladder-l6-buried | 1/3 | 2/3 | question 2 | question 1 |  |
| ladder-l8-data-contradicts | 2/3 | 2/3 | reply figure 1 | question 1 |  |
| ladder-l9-retraction | 2/3 | 3/3 | context file 1 | - |  |
| messy-conversation | 2/3 | 3/3 | saved figures 1 | - |  |
| numeric-format | 2/3 | 3/3 | question 1 | - |  |
| olist-3-freight-region | 3/3 | 2/3 | - | reasoning 1 |  |
| olist-4-margin | 3/3 | 0/3 | - | reasoning 3 | DeepSeek gives a margin without cost data |
| olist-5-vouchers | 2/3 | 3/3 | reply figure 1 | - |  |
| out-1-customers | 0/3 | 0/3 | reasoning 3 | reasoning 3, saved figures 1 |  |
| out-2-customers | 0/3 | 0/3 | saved figures 3, reasoning 2, provider/judge error 1 | reasoning 3, saved figures 3 | Both reach the same wrong peer median (98.996) |
| po-4-pocket-margin | 1/3 | 0/3 | saved figures 2 | saved figures 3 |  |
| po-5-product-margin | 3/3 | 2/3 | - | saved figures 1 |  |
| retail-cards-conversation | 3/3 | 1/3 | - | saved figures 2 | DeepSeek writes % as a fraction |
| retail-outliers-portfolio | 0/3 | 0/3 | reasoning 3 | reasoning 3 |  |
| retail-outliers-switch | 2/3 | 2/3 | saved figures 1 | saved figures 1 |  |
| retail-storage-advice | 0/3 | 1/3 | reasoning 3, reply figure 3 | reasoning 2 |  |
| rt-intake-setup | 3/3 | 2/3 | - | skill not read 1 |  |
| rt-triage-definition | 3/3 | 2/3 | - | reasoning 1 |  |
| rt-triage-vague | 3/3 | 2/3 | - | question 1 |  |
| s2-1-leakage | 1/3 | 0/3 | saved figures 1, reasoning 1 | reasoning 3, saved figures 1 |  |
| s2-2-policy | 3/3 | 0/3 | - | reasoning 3, saved figures 1 | DeepSeek miscounts approvals |
| s2-3-reps | 1/3 | 3/3 | reasoning 2 | - |  |
| s2-4-policy-proposal | 1/3 | 1/3 | reasoning 2 | reasoning 2 |  |
| s2-5-floor-correction | 3/3 | 2/3 | - | reasoning 1 |  |
| s3-2-price-churn | 2/3 | 0/3 | reasoning 1 | reasoning 3 |  |
| s3-3-grandfathered | 1/3 | 0/3 | reasoning 2 | reasoning 3 |  |
| s3-4-better-seats | 1/3 | 0/3 | reasoning 2 | reasoning 3 |  |
| s3-5-ltv-cac | 0/3 | 0/3 | reasoning 3 | reasoning 3 | Both miss the hidden paid-search cohort |
| sc-1-kitchen-cut | 2/3 | 3/3 | reasoning 1 | - |  |
| sc-3-cost-and-price | 2/3 | 2/3 | reasoning 1 | reasoning 1, saved figures 1 |  |
| sc-4-mixed | 1/3 | 1/3 | reasoning 2, saved figures 2 | saved figures 1, reasoning 1 |  |
| sc-5-actual-volume | 2/3 | 0/3 | reasoning 1 | reasoning 3, reply figure 1 |  |
| uci-1-bare | 0/3 | 0/3 | skill not read 3 | skill not read 3 | **Harness:** neither reads pricing-intake on a bare context |
| uci-3-price-or-mix | 2/3 | 2/3 | reasoning 1 | reasoning 1 |  |
| uci-4-country-gp | 1/3 | 0/3 | reasoning 2, saved figures 1 | saved figures 3, reasoning 2 |  |
| uci-5-losing-customers | 2/3 | 2/3 | reply figure 1 | reply figure 1, saved figures 1 |  |
| uci-6-top50-rise | 2/3 | 1/3 | reply figure 1 | reply figure 2, saved figures 2 |  |
| uci-7-competitor | 0/3 | 0/3 | reasoning 3, saved figures 3 | saved figures 3, reasoning 2 |  |
| uci-8-wholesale | 2/3 | 2/3 | saved figures 1 | provider/judge error 1 | **Infra:** 1 DeepSeek run hit an OpenRouter error |
| workbook-only | 2/3 | 0/3 | question 1 | question 3 | DeepSeek asks an unneeded question every run |
| wtp-1-quotes | 1/3 | 1/3 | reasoning 2 | reasoning 2, saved figures 1 |  |
| wtp-3-best-plan | 1/3 | 0/3 | reasoning 2 | reasoning 3 |  |
