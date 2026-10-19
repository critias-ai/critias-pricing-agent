---
name: price-change-economics
description: "Knowledge card. Use when sizing a proposed price change: conditional impact on revenue and contribution, and breakeven volume."
---

# Economics of a proposed price change

## Before sizing

- Apply [metric verification](../metric-verification.md) to establish eligibility, period, comparable realized-price basis and relevant costs.
- Proposed prices are assumptions.
- List-to-net or pocket proposals need supported discount and rebate mappings.
- Missing quantities or realization evidence limit revenue sizing. Missing relevant costs limit contribution and profit sizing.
- These linear formulas need comparable mappings. Use [recurring scenarios](recurring-scenarios.md) for tiers, commitments, renewal horizons or package changes.

## Fixed-volume base

- When future demand response is unknown, use prior-period item quantities `q0_i` on both sides.
- Use prior realized baseline prices `p_base_i`, or a documented current effective baseline explicitly named against the same quantities.
- With assumed proposed realized prices `p_prop_i`:

```text
Baseline revenue = Σ q0_i × p_base_i
Proposed revenue = Σ q0_i × p_prop_i
Price-only difference = Σ q0_i × (p_prop_i − p_base_i)
```

- State period, coverage, units and currency, and the fixed volume and mix.
- Disclose unmatched or new items, missing history and exclusions.
- Use supported subsets where quantities are missing.

## Contribution

- Recorded COGS or allocated overhead are not automatically relevant incremental or avoidable costs.
- With defined unit costs:

```text
Baseline contribution = Σ q0_i × (p_base_i − c_base_i)
Proposed contribution = Σ q0_i × (p_prop_i − c_prop_i)
Contribution difference = price-only difference − Σ q0_i × (c_prop_i − c_base_i)
```

- When proposed costs are supplied, the principal planning case must include comparable current and proposed costs, with their coverage and effective periods.
- Fixed quantities do not imply unchanged unit costs. Fixed-price items can still incur cost changes.
- Resolve unclear cost meaning or applicability with the user before the affected case.
- A frozen-cost, price-only counterfactual may sit alongside the joint price-and-cost case, not replace it.
- With explicitly unchanged costs, revenue and contribution differences are equal before incremental action costs. Otherwise, separate price and cost effects.
- Subtract supported implementation costs for a defined profit measure.
- Recompute margin rates from scenario totals.

## Volume response

- Keep quantity-response sensitivities separate and explicit.
- Use the same eligible basket, currency and cost basis for baseline, proposal, downside and breakeven.
- Never silently divide a subset gain by a company-wide baseline.
- State how relevant variable and fixed costs and adjustments respond.
- Historical price-volume association does not identify elasticity.
- Distributor shipments do not establish end-user demand.

**Breakeven for one product**, with unchanged incremental fixed costs, `CM0 = p0 − c0` and absolute unit price and cost changes `Δp, Δc`:

```text
Contribution-preserving Δq / q0 = −(Δp − Δc) / (CM0 + Δp − Δc)
```

- Requires consistent units and positive proposed unit contribution.
- **Several items or a group:** work bottom-up, item by item, before any group figure:
  - each item's breakeven with the formula above;
  - an item whose proposed unit contribution is zero or negative has no breakeven: calculate its gross-profit change at fixed volume instead;
  - an item whose `Δp − Δc` is negative needs volume to grow, so its breakeven is a rise.
  Then calculate the group figure at fixed mix.
- Changed capacity or fixed costs, nonpositive contribution or portfolio mix need another scenario.
- This describes breakeven only. Future response needs separate evidence: a promotion or past price-volume movement does not give it ([experiments and promotions](experiments-and-promotions.md)). Offer breakeven and a way to find out, such as a price test.

## Report

- State that a group figure holds the item mix as it was.
- Give the range of per-item breakevens next to a group figure.
- Where proposed unit contribution is zero or negative, breakeven does not apply: give the item's gross-profit change at fixed volume instead.
- Name the items whose volume must grow, not fall, to keep contribution.
