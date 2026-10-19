# `present` reference

1. Save the result: `query(sql, save="quarters.csv")`, or write a CSV from a script run with `execute_analysis`. Only files an executed query or script produced are accepted; a file you wrote with write or edit, or changed afterwards, is refused.
2. Call `present` once, after the figures are final:

```json
{
  "tables": [{
    "id": "quarters", "title": "Quarterly margin", "file": "quarters.csv",
    "rowKey": "quarter", "rowHeader": "Quarter",
    "columns": [
      {"key": "net_sales", "label": "Net sales", "unit": "GBP"},
      {"key": "margin_pct", "label": "Gross margin", "unit": "%"}
    ]
  }],
  "charts": [{"id": "margin", "title": "Gross margin by quarter", "kind": "line", "tableId": "quarters", "series": ["margin_pct"]}]
}
```

- `rowKey` names the column that identifies each row (unique, not blank); `rowLabel` optionally names a column to show instead. Column `key` is the CSV header; `unit` is `GBP`, `%`, `pp`, `bps`, `units`...
- A chart uses one to four columns of the same unit from one table, in the file's row order. Use a separate chart per unit.
- `kind` is `line`, `bar`, `stacked`, `waterfall` or `scatter`. A waterfall takes one column and `totals`, the row keys of its levels, drawn from zero; other rows are steps from the running total: `{"id": "bridge", "title": "Margin bridge, Q2 to Q3", "kind": "waterfall", "tableId": "bridge", "series": ["value"], "totals": ["q2", "q3"]}`. A scatter names `x`, a numeric column of any unit, for the horizontal axis.
- Limits: four tables and four charts; up to twelve columns and 1,000 rows per table. An invalid table or chart is left out and `present` says why.
- Order rows in the SQL; the view keeps the file's order.
