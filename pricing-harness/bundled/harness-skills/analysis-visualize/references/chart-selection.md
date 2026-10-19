# Chart selection

| The answer shows | Chart | How |
|---|---|---|
| A measure over periods | `line` | Rows are periods in date order; up to four series of one unit, such as cohorts |
| Items or segments compared or ranked | `bar` | Rows in rank order; signed values keep their sign |
| Parts of a whole across periods or segments | `stacked` | One column per part, one unit |
| A bridge from one level to another | `waterfall` | One column holding the start level, each signed step and the end level; name the start and end rows in `totals`. The steps must add up to the end |
| Two measures per item | `scatter` | `x` names the horizontal column; `series` the vertical one |
| A distribution of prices, discounts or margins | `bar` | Bin in SQL: bands as rows, a count or share as the column |
| Exact values, long lists, exclusions | table only | |

## Pricing analyses

| Analysis (knowledge card) | Chart |
|---|---|
| Margin drivers | `waterfall` from the start rate through each effect to the end rate; `bar` of the largest contributors to one effect |
| Price waterfall | `waterfall` from list price through each adjustment to pocket price |
| Price realization | `line` of the matched price change by period; `bar` by product or segment |
| Price-change economics, recurring scenarios | `bar` of scenarios side by side; `line` across the assumed response |
| Peer comparisons, segmentation | `scatter` of price against size or volume; `bar` of the binned distribution or of segment values |
| Discount governance | `bar` of the binned discount distribution; `stacked` share by approval band |
| Evidence ranking, value estimation | `bar` in rank order; `waterfall` from the reference value through each differentiator |
| Retail economics, hybrid offers | `stacked` mix by channel or component; `bar` of per-order or per-unit economics |
| Recurring metrics | `waterfall` from opening to closing MRR or ARR (new, expansion, contraction, churn); `line` of retention by month for up to four cohorts |
| Experiments and promotions | `bar` of treatment against control; `line` over the window |
| Renewals and migration | `stacked` cohort status by period |
| Metric verification | `bar` of the reported less the recomputed value by period |

A waterfall's levels and steps share one column; give it the levels' unit (a margin rate in %, its steps in pp). Rates come from totals when the metric calls for them; a mean of product percentages answers a different question. Do not infer causes from correlation. Avoid pies, 3D effects and more than four series. For populations beyond the limits, chart a useful summary and say what is left out.
