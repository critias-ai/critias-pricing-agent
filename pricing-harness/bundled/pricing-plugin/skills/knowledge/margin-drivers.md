---
name: margin-drivers
description: "Knowledge card. Use for any margin or gross-profit bridge: splitting a change into price, volume or quantity, mix, cost and new or lost item effects, for the whole business, a category or a single item. Holds the project bridge formulas."
---

# Explain a margin movement with supported drivers

## Examine the drivers

- Verify both endpoints first.
- Then examine consistent realized prices, unit costs and product, customer and geographic composition.
- A uniform volume change need not change a margin rate. Composition, tiers or cost behavior can.
- Distinguish unit costs from allocations.
- Distinguish higher total COGS from unit-cost inflation.

## Build the bridge

- Revenue variance differs from margin-rate variance.
- Reconcile contributions to the verified movement before rounding.

**Project convention for a margin bridge by item:** use it unless a confirmed company recipe says otherwise. Items are the finest comparable unit the data supports, such as a product, SKU or product-customer pair.

**Common items:** items with positive quantity in both periods, on the headline's lines and its sales and cost definitions. For each common item in a period: quantity `q`, unit price `p` = sales / `q`, unit cost `c` = cost / `q`, unit margin `u = p − c`, and quantity share `x = q / V`, with `V = Σq`. A bar is the average of the two periods.

```text
Volume = (V₂ − V₁) × (Σx₁u₁ + Σx₂u₂) / 2
Mix    = V̄ × Σ (x₂ − x₁) × ū
Price  = V̄ × Σ x̄ × (p₂ − p₁)
Cost   = −V̄ × Σ x̄ × (c₂ − c₁)
New    = margin of items that are not common, in period 2
Lost   = −margin of items that are not common, in period 1
```

- **A single item, such as one SKU's price, quantity and cost effects, is the same bridge with one item:** price = `q̄ × (p₂ − p₁)`, volume or quantity = `(q₂ − q₁) × ū`, cost = `−q̄ × (c₂ − c₁)`, and no mix. Do not weight by either period's quantity alone.
- The six effects add up exactly to the change in gross margin. Both periods weigh equally, so there is no calculation order and no interaction term.
- **Report each effect in percentage points of the margin rate:** `(E − R₁ × F) / S₂`. `E` is its effect on margin above. `F` is its effect on sales: the same formula with `p` in place of `u`, zero for cost, and the items' sales for new and lost. `R₁` is the period-1 margin rate and `S₂` the period-2 sales. These add up exactly to the rate change. Give money amounts only when asked.
- An item's contribution to mix, price or cost is its term in that sum, converted the same way. "Contributed most" means the largest contributions in the effect's direction: give their total, their share of the effect and the offset from all other items.
- **Flag, without treating:** items with zero or negative quantity in either period (they fall under new or lost), and common items whose returns offset at least half of the quantity sold in a period (their unit price and cost are unreliable). Give each group's count and contribution. Apply the treatment confirmed in context.md, or else ask (shared rules, section 3).
- Amounts that cannot be assigned to an item, such as an unallocated rebate pool, get their own line, or a range when their treatment is open.
- Use the same method for other dimensions, such as customer or channel, and say which dimension you used.
- An unexplained residual is a remaining reconciliation gap, possibly from missing factors, data or calculation errors. Show it separately.

## Judge each hypothesis by its share

- For each factor, give its signed contribution in points and its share of the verified movement.
- Choose your own words for how far the evidence supports each hypothesis. Always give the figures with them, so readers can judge for themselves.
- A factor moving in the opposite direction to the movement does not explain it, however large it is.

## Separate attribution from cause

- Accounting attribution establishes what changed.
- Commercial causation needs supporting contracts, adjustments, policy or behavior.
- A lower realized price alone does not establish increased discounting.
- If causes remain unsupported, state the limit and the relevant next investigations.
