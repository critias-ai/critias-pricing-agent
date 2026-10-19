import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {beforeAll, expect, it} from 'vitest';
import type {ExplorationResult} from '../../src/exploration.js';
import {selectTableRows} from '../../src/ui/exploration/table-state.js';
import {formatValue} from '../../src/ui/exploration/format.js';
import {buildPlotlyFigure} from '../../src/ui/exploration/plotly-adapter.js';
import {bindExploration} from '../../src/agent/workflow/exploration.js';
import {explorationCheckpoint} from '../fixtures/exploration.js';
let cached: ExplorationResult;
const result = () => structuredClone(cached);
beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'ui-'));
  cached = (await bindExploration(root, await explorationCheckpoint(root), {path: 'c', sha256: 'a'.repeat(64)}))
    .result!;
});
it('sorts canonical numbers and keeps unavailable cells last in either direction', () => {
  const table = result().tables[0]!;
  table.rows = [2, 10, 100, null].map((value, i) => ({
    key: `r${i}`,
    label: `Row ${i}`,
    cells: {revenue: {value, status: value === null ? 'held' : 'approved'}},
  }));
  expect(
    selectTableRows(table, {query: '', page: 1, sort: {key: 'revenue', direction: 'asc'}}).rows.map(
      r => r.cells.revenue?.value,
    ),
  ).toEqual([2, 10, 100, null]);
  expect(
    selectTableRows(table, {query: '', page: 1, sort: {key: 'revenue', direction: 'desc'}}).rows.map(
      r => r.cells.revenue?.value,
    ),
  ).toEqual([100, 10, 2, null]);
});
it('searches the entire delivered table, clamps pages, preserves source order and handles empty matches', () => {
  const table = result().tables[0]!;
  table.rows = Array.from({length: 60}, (_, i) => ({
    key: `r${i}`,
    label: `Product ${i + 1}`,
    cells: {revenue: {value: i + 1, status: 'approved'}},
  }));
  const before = structuredClone(table);
  expect(selectTableRows(table, {query: '', page: 1}).rows).toHaveLength(25);
  expect(selectTableRows(table, {query: 'product 60', page: 3})).toMatchObject({
    filtered: 1,
    total: 60,
    page: 1,
    pages: 1,
    rows: [{label: 'Product 60'}],
  });
  expect(selectTableRows(table, {query: 'missing', page: 3})).toMatchObject({
    filtered: 0,
    total: 60,
    page: 1,
    pages: 1,
    rows: [],
  });
  expect(table).toEqual(before);
});
it('formats canonical percent, point, basis-point and currency units without changing their scale', () => {
  expect(formatValue(36.09, '%')).toBe('36.09%');
  expect(formatValue(-4.75, 'percentage points')).toBe('-4.75 percentage points');
  expect(formatValue(500, 'bps')).toBe('500 bps');
  expect(formatValue(10, 'GBP')).toBe('£10.00');
  expect(formatValue(2, 'EA')).toBe('2 EA');
  expect(formatValue(null, '%')).toBe('Unavailable');
});
it('builds fixed local Plotly recipes from bound canonical values with explicit gaps and literal labels', () => {
  const r = result();
  const table = r.tables[0]!;
  table.rows[0]!.label = '<img src="https://example.com/remote">';
  const figure = buildPlotlyFigure(r.charts[1]!, table);
  const trace = figure.data[0] as any;
  expect(trace.y).toEqual([36.09, null]);
  expect(trace.x[1]).toBe('Q2');
  expect(trace.x[0]).toContain('&lt;img');
  expect(trace.connectgaps).toBe(false);
  expect(trace.hovertemplate).toContain('%');
  expect(figure.config).toMatchObject({displaylogo: false, showSendToCloud: false, responsive: true, showTips: false});
  expect(figure.config.modeBarButtonsToRemove).toContain('toImage');
});
it('floats waterfall steps on the running total and draws total rows from zero', () => {
  const table = result().tables[0]!;
  table.rows = [
    ['start', 37.76],
    ['price', 1.64],
    ['cost', -1.17],
    ['end', 38.23],
  ].map(([key, value]) => ({
    key: key as string,
    label: key as string,
    cells: {margin: {value: value as number, status: 'approved'}},
  }));
  const chart = {
    id: 'b',
    title: 'B',
    kind: 'waterfall' as const,
    tableId: 'quarterly',
    series: ['margin'],
    totals: ['start', 'end'],
  };
  const trace = buildPlotlyFigure(chart, table).data[0] as any;
  expect(trace.type).toBe('bar');
  expect(trace.y).toEqual([37.76, 1.64, -1.17, 38.23]);
  expect(trace.base.map((b: number) => +b.toFixed(2))).toEqual([0, 37.76, 39.4, 0]);
  const [lo, hi] = (buildPlotlyFigure(chart, table).layout.yaxis as any).range;
  expect([lo > 37, lo < 37.76, hi > 39.4]).toEqual([true, true, true]);
});
it('plots a scatter against a numeric x column with row names on hover', () => {
  const r = result();
  const chart = {id: 's', title: 'S', kind: 'scatter' as const, tableId: 'quarterly', series: ['margin'], x: 'revenue'};
  const figure = buildPlotlyFigure(chart, r.tables[0]!);
  expect(figure.data[0]).toMatchObject({type: 'scatter', mode: 'markers', x: [10, 20], text: ['Q1', 'Q2']});
  expect((figure.layout.xaxis as any).type).toBeUndefined();
});
it('stacks bars for parts of a whole', () => {
  const r = result();
  const chart = {id: 'p', title: 'P', kind: 'stacked' as const, tableId: 'quarterly', series: ['revenue']};
  expect(buildPlotlyFigure(chart, r.tables[0]!).layout.barmode).toBe('relative');
});
it('applies the theme palette and the compact height', () => {
  const r = result();
  const figure = buildPlotlyFigure(r.charts[1]!, r.tables[0]!, {series: ['#111111'], text: '#222222', grid: '#333333'});
  expect((figure.data[0] as any).marker.color).toBe('#111111');
  expect(figure.layout).toMatchObject({
    height: 280,
    font: {color: '#222222'},
    xaxis: {gridcolor: '#333333'},
    yaxis: {gridcolor: '#333333'},
  });
});
