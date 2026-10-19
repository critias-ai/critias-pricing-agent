---
name: analysis-visualize
description: Show an answer's figures in the chat as a table with a chart. Use for any series over time, ranking, bridge, breakdown, distribution or comparison of two measures.
---
# In-chat tables and charts

Users read a chart faster than a column of numbers. When an answer has a series over time, a ranking, a bridge, a breakdown, a distribution or two measures to compare, `present` it as a table with a chart, even when the figures are also in the reply. Text alone is enough only for one or two figures.

1. Save the final result as a CSV with the query tool's `save` option, or write it from a script. Order the rows as the chart should show them.
2. Pick the chart from [chart selection](references/chart-selection.md).
3. Call `present` once, after the figures are final ([reference](references/in-chat-exploration.md)). Values are read from the file, so they are exactly what the query or script produced.

Keep scope, period, ranking cohort and order in the title. Use a separate chart for each unit. A percentage column holds percentage numbers (36.09 means 36.09%); percentage points and bps are different units. A blank cell shows as unavailable, never as zero.
