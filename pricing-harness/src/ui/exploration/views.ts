import type {ChartSpec, ExplorationResult, ResultTable} from '../../exploration.js';
export type ExplorationView =
  | {kind: 'chart'; id: string; chart: ChartSpec; table: ResultTable}
  | {kind: 'table'; id: string; table: ResultTable};
// One card per chart (its data behind a toggle); tables no chart uses follow as plain cards.
export function explorationViews(result: Pick<ExplorationResult, 'charts' | 'tables'>): ExplorationView[] {
  const charts = result.charts.flatMap(chart => {
    const table = result.tables.find(t => t.id === chart.tableId);
    return table ? [{kind: 'chart' as const, id: `chart-${chart.id}`, chart, table}] : [];
  });
  const charted = new Set(charts.map(view => view.table.id));
  return [
    ...charts,
    ...result.tables
      .filter(table => !charted.has(table.id))
      .map(table => ({kind: 'table' as const, id: `table-${table.id}`, table})),
  ];
}
