# Realistic evals: plan

Date: 2026-10-16. Branch: feat/thin-analyst. Status: steps 1 to 4 built, uncommitted; free oracle 18/18 on seed 7 and 6/6 on the holdout. Not yet run: the paid judge oracle (`--oracle --judge`) and every live check.

**Built differently from the draft:** in step 4, the draft's first rubric item was wrong. S03's promotion is not Storage's main driver: Storage gross profit fell £14,559, losing S08 took £12,396 and new S09 added £6,255, while S03 fell only £1,350. The rubric in `private/retail-storage-advice.json` uses those figures. In step 2, retail-tail-share got no solution, because its key grades no file. In step 3, the margin columns are `gm_pct` (0.01 tolerance), and `yearly.csv` gained a `rebates` column.

## Why

A review of the 19 cases in `tests/evals/cases` found:

- **The prompts read like specifications, not like a person.**
  - 12 of the 19 cases repeat one dictated block: "For all supplied eligible product/year rows in group X … Save complete results.csv with columns …".
  - Every graded prompt names the output file, its columns and its rows.
- **Several prompts give the trap away.** Examples:
  - "do not replace it with zero" (missing-cost);
  - "Confirm whether repeated transaction IDs are duplicates" (duplicates);
  - "Clarify inconsistent numeric formatting" (numeric-format).
- **The data is clean.**
  - The retail set is one tidy CSV of 1,175 rows.
  - `context.md` already confirms every definition.
  - Duplicates, mixed formats and missing costs appear only in toy files of 2 to 4 rows.
- **Only closed questions are graded.**
  - No case asks "why" or "what should we do", so the recommend and design skills are not exercised.
  - At most 4 of the 17 knowledge cards are needed: margin-drivers, price-realization, price-change-economics and retail-economics.
- **The question checks are weak.**
  - `expectQuestion` passes on any "?" in the reply.
  - context-import has no check at all.
- **There is no held-out data.**
  - The cards were tuned against the seed-7 retail set, for example the single-item line added after the S03 miss.
  - A pass on that set can't tell real improvement from fitting the set.

## Order

1. Natural prompts with a runner-added save turn. Steps 2 and 3 use it.
2. Held-out data seed. Small, and independent of the rest.
3. Messy multi-file dataset.
4. Open-ended case with a judged rubric. This is the only step that adds a paid grading call.

Every step ends with `npm run eval:oracle` passing. Live runs need your approval first, at no more than 5 runs at a time.

## 1. Natural prompts with a runner-added save turn

**Idea:** the people turns are written as a manager would speak and never mention files. After the last people turn, the runner sends one save turn that asks for the files the grader reads. Grading stays exact, and the conversation stays natural up to that point.

- **`spec.ts`:** `CsvCheck` gets `ask: string`, a plain request for that file. Example: `"price_change.csv with columns measure,pct and one row price_change: the 2024 to 2025 price change you gave me"`.
- **`run.ts`:**
  - after the last turn, if any check has `ask`, send one more turn:
    `"Thanks. For my records, please save these, using the figures you already gave me: " + asks joined with "; "`;
  - its reply is not scored as a people turn.
  - `expectQuestion` indices still refer to people turns.
- **`verify.ts`:** no change. The files are read the same way.
- **Cases:**
  - Rewrite the retail turns to drop file and column wording, then move that wording into `ask`. Cases: retail-bridge, retail-bridge-conversation, retail-cards-conversation, retail-sku-contribution, retail-tail-share.
  - Replace the 12 dictated margin prompts with short plain questions. For example: "Which products in group X are out of line with the group's margin, and which are big enough to look at?" The thresholds and definitions stay in that case's `context.md`, where a company would have them.
  - Remove the trap hints from missing-cost, duplicates, numeric-format and context-import. For example, duplicates becomes "What's our margin on this?"
- **Tighten the question check:**
  - a turn with `expectQuestion` passes only if its reply contains "?" and makes no `present` call or file write in that turn;
  - context-import gets `expectQuestion: true`.
- **Risk:** the save turn comes at the end, so the analyst may recompute instead of repeating its earlier answer. That is acceptable, and the grader checks the saved figures either way.
- **Done when:**
  - the oracle passes;
  - 5× Haiku high on retail-cards-conversation, compared with today's 5/5. A drop shows what the dictated wording was propping up.

## 2. Held-out data seed

**Idea:** the same retail generator with a different seed. All prices, costs, quantities, customers and returns change, but the trap structure stays the same: S03 promotion, K07 loss, G06 cost rise, S08 and K08 lost, S09 and G09 new, and a large June order. The prompts that name S03 or Storage still make sense.

- **`make_retail.py`:**
  - optional second argument: the seed, default 7;
  - the seed-7 output must stay byte-identical, so check it with `cmp` against the current `sales.csv`.
- **Data:** generate `inputs/retail-holdout/` with seed 11 and the same `context.md`.
- **No stored keys.**
  - `run.ts --holdout` runs only cases whose `inputDir` is `../inputs/retail` and that have a `solution`. It swaps in the holdout directory.
  - Expected files come from running the solution on the holdout data at grading time.
  - `moneyTolerance` comes from the main key, and `replyNumbers` are skipped.
  - The solution is the key, so there is nothing to leak.
- **Add solution branches** for the two retail cases that lack one: retail-bridge-conversation (s03_bridge, bridge) and retail-tail-share. This gives them oracle cover too.
- **Rule, recorded in `docs/acceptance.md`:** run holdout only to confirm a finished change, never while editing cards or skills.
- **Limit:** the traps sit on the same SKUs. If cards start naming patterns, a second holdout with different traps is the upgrade.
- **Done when:** seed-7 data is identical, and the oracle passes on both seeds.

## 3. Messy multi-file dataset

**Idea:** the generator first builds a clean truth, then writes it as several messy exports. The solution script applies the cleaning rules the user confirms in the conversation and must reproduce the clean truth exactly. The oracle proves that cleaning by construction.

**Generator:** `make_messy.py <out dir> [seed]`, reusing the retail generator's SKU model. It writes:

| File | What is messy |
|---|---|
| `sales_2024.csv` | Today's schema. Its December rows also appear in the 2025 export (an overlapping extract). |
| `Sales Export 2025.csv` | Renamed columns (`Qty`, `Net Price`). Dates as DD/MM/YYYY. Prices as text such as `"£1,234.50"`. No cost column. |
| `unit_costs.csv` | `sku,effective_from,unit_cost`. Costs change mid-year, so they need an as-of join. Two SKUs have no cost for one quarter. |
| `products.csv` | Category per SKU. One SKU renamed in 2025 (K03 → K03B), with an `old_sku` column. |
| `rebates_2025.csv` | Quarterly off-invoice rebates by customer, which don't sit on any invoice line. |

- **Context:** `context.md` holds only "These are our exports; currency GBP." Nothing is confirmed.
- **Case `messy-conversation`:**
  1. "Here's our sales data for the last two years. What happened to our margin?" `expectQuestion`: it should ask about the overlap, the missing costs and the rebates before giving a margin.
  2. The user confirms in plain words:
     - the December overlap is the same sales;
     - K03B is K03;
     - leave missing-cost lines out of margin, but say how much;
     - rebates come off gross profit, at company level only.
  3. "So what was gross margin each year, and how much did rebates take off 2025?"
  4. "Which category got hurt most?"
  5. Save turn (step 1): `yearly.csv` (year, net_sales, gross_profit, margin_pct, excluded_sales) and `category.csv` (category, margin_2024, margin_2025).
- **Solution:** `solutions/messy.py` applies exactly the confirmed rules. Its oracle asserts the result equals the generator's clean truth, minus the excluded lines.
- **Check against your rule:** this follows "no business assumptions in cleaning code". The treatments are the user's answers in turn 2. Neither the harness nor the cards decide them.
- **Done when:** the oracle passes and the seed-7 truth reconciles to the penny.

## 4. Open-ended case with a judged rubric

**Idea:** a "why, and what should we do" question on the retail data. Every figure stated is checked exactly, as today. The reasoning is checked against a short rubric by a judge model.

- **Case `retail-storage-advice`:** two turns.
  1. "Storage feels weaker this year. What's going on?"
  2. "What would you do about it?"
- **Key, in `keys/`:**
  - `replyNumbers` for the figures the reply must contain;
  - a new `rubric` field holding 5 to 7 items, each `{id, text, kind: "must" | "must_not"}`. Draft items, to be finalised once the solution's figures are known:
    - must: names the S03 Q2 promotion (price about −30%, quantity about +60%) as the main driver, with its share of the change;
    - must: separates new and lost SKUs (S08 lost, S09 new) from like-for-like change;
    - must: keeps attribution apart from cause (it does not say the promotion "failed" without evidence);
    - must: ties any price recommendation to a breakeven volume or says it is conditional;
    - must: orders recommendations by strength of evidence;
    - must_not: treats one promotion's response as a measured elasticity;
    - must_not: gives a figure that contradicts the bridge.
- **Judge:** `tests/evals/judge.ts`.
  - It makes one model call per run with the two replies and the rubric.
  - It asks for JSON: `[{id, pass, quote}]`. A pass must quote the reply, and a pass without a quote counts as a fail.
  - The judge model comes from `PRICING_JUDGE_MODEL` and must differ from the analyst model. Reuse `resolveModel` from `src/runtime.ts`; I'll check the call path when building it.
  - Thinking off.
- **The judge's own oracle.** Two hand-written replies sit in `keys/`: one that should pass every item and one that should fail exactly three.
  - `npm run eval:oracle -- --judge` grades both, and must give the expected result 3 times out of 3.
  - This is the only paid part of the oracle, so it stays behind its flag.
- **Report:** per run, the rubric item ids that failed, with the quotes. Consistency is read as "same items fail across repeats".
- **Risk:** judges are noisy. The oracle replies detect drift, and the exact figure checks still carry most of the weight.
- **Done when:** the judge oracle gives 3/3, and then 5× Haiku high and 5× Luna high (approval needed) are reported item by item.

## Not in this plan

- More data volume (100k+ rows). The DuckDB path already handles it, and it tests speed, not judgement.
- More cards covered: waterfall, discount governance, recurring. Those need different data shapes (list, invoice and pocket prices; subscriptions). That is the next dataset after this one if you want it.
- Mid-conversation corrections ("no, I meant excluding returns"). This is cheap to add as a sixth turn in `messy-conversation` once step 3 exists.
