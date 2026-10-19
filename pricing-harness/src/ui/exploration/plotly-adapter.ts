import type {ChartSpec, ResultTable} from '../../exploration.js';
export const escapePlotlyText = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export type PlotPalette = {series: string[]; text: string; grid: string};
export const DEFAULT_PALETTE: PlotPalette = {
  series: ['#2C6E7C', '#B8893C', '#C56A4F', '#86B8BE'],
  text: '#2E3F43',
  grid: '#D2D9DA',
};
export function buildPlotlyFigure(
  chart: ChartSpec,
  table: ResultTable,
  palette: PlotPalette = DEFAULT_PALETTE,
): {data: unknown[]; layout: Record<string, unknown>; config: Record<string, unknown>} {
  const unit = table.columns.find(column => column.key === chart.series[0])!.unit;
  const suffix = (u: string) => (u === '%' ? '%' : ` ${escapePlotlyText(u)}`);
  const labels = table.rows.map(row => escapePlotlyText(row.label));
  const values = (key: string) => table.rows.map(row => row.cells[key]?.value ?? null);
  const xColumn = chart.x ? table.columns.find(column => column.key === chart.x)! : undefined;
  const data = chart.series.map((key, index) => {
    const column = table.columns.find(item => item.key === key)!;
    return {
      type: chart.kind === 'line' || chart.kind === 'scatter' ? 'scatter' : 'bar',
      ...(chart.kind === 'line' ? {mode: 'lines+markers', connectgaps: false} : {}),
      ...(chart.kind === 'scatter' ? {mode: 'markers', text: labels} : {}),
      name: escapePlotlyText(column.label),
      x: xColumn ? values(xColumn.key) : labels,
      y: values(key),
      marker: {color: palette.series[index % palette.series.length]},
      customdata: table.rows.map(row =>
        row.cells[key]?.status === 'held' ? escapePlotlyText(row.cells[key]!.reason ?? 'Unavailable') : '',
      ),
      hovertemplate: xColumn
        ? `%{text}<br>%{x:,.2f}${suffix(xColumn.unit)}, %{y:,.2f}${suffix(unit)}<extra>%{fullData.name}</extra>`
        : `%{x}<br>%{y:,.2f}${suffix(unit)}<extra>%{fullData.name}</extra>`,
    };
  });
  let range: number[] | undefined;
  if (chart.kind === 'waterfall') {
    // Bars float on the running total; a row named in totals is a level drawn from zero and restarts the total.
    const trace = data[0] as Record<string, unknown> & {y: (number | null)[]};
    const totals = new Set(chart.totals ?? []);
    let running = 0;
    const base = table.rows.map((row, i) => {
      const value = trace.y[i] ?? 0;
      if (totals.has(row.key)) return (running = value), 0;
      return (running += value) - value;
    });
    trace.base = base;
    // Levels far from zero would flatten the steps, so the axis spans the levels and steps, as margin bridges do.
    const ends = table.rows.flatMap((row, i) => (totals.has(row.key) ? [] : [base[i]!])).concat(running);
    for (const [i, row] of table.rows.entries())
      ends.push(totals.has(row.key) ? (trace.y[i] ?? 0) : base[i]! + (trace.y[i] ?? 0));
    const [lo, hi] = [Math.min(...ends), Math.max(...ends)];
    if (lo > 0 && hi > lo) range = [Math.max(0, lo - (hi - lo) * 0.25), hi + (hi - lo) * 0.1];
    trace.marker = {
      color: table.rows.map((row, i) =>
        totals.has(row.key)
          ? palette.series[1 % palette.series.length]
          : (trace.y[i] ?? 0) < 0
            ? palette.series[2 % palette.series.length]
            : palette.series[0],
      ),
    };
  }
  return {
    data,
    layout: {
      autosize: true,
      height: 280,
      margin: {l: 64, r: 16, t: 8, b: 64},
      font: {family: '"Spline Sans Mono", ui-monospace, monospace', size: 11, color: palette.text},
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      ...(chart.kind === 'stacked' ? {barmode: 'relative'} : {}),
      xaxis: xColumn
        ? {
            title: {text: escapePlotlyText(`${xColumn.label} (${xColumn.unit})`)},
            automargin: true,
            gridcolor: palette.grid,
          }
        : {
            type: 'category',
            categoryorder: 'array',
            categoryarray: labels,
            automargin: true,
            gridcolor: palette.grid,
          },
      yaxis: {
        ...(range ? {range} : {}),
        title: {text: escapePlotlyText(unit)},
        ticksuffix: suffix(unit),
        automargin: true,
        gridcolor: palette.grid,
      },
      legend: {orientation: 'h', y: -0.32},
      showlegend: chart.kind !== 'waterfall',
      hovermode: 'closest',
    },
    config: {
      responsive: true,
      displaylogo: false,
      // Plotly 4 defaults this on; its "Share chart" button uploads the data to Plotly Cloud.
      showSendToCloud: false,
      showTips: false,
      scrollZoom: false,
      modeBarButtonsToRemove: ['toImage', 'select2d', 'lasso2d'],
      doubleClick: 'reset',
    },
  };
}
