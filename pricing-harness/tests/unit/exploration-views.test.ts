import {expect, it} from 'vitest';
import {explorationViews} from '../../src/ui/exploration/views.js';
import type {ExplorationResult} from '../../src/exploration.js';
const table = (id: string) => ({id, title: id, rowHeader: 'Row', columns: [], rows: []});
it('makes one card per chart and lists tables without a chart after them', () => {
  const result = {
    tables: [table('quarterly'), table('products')],
    charts: [
      {id: 'revenue', title: 'Revenue', kind: 'line', tableId: 'quarterly', series: []},
      {id: 'margin', title: 'Margin', kind: 'line', tableId: 'quarterly', series: []},
      {id: 'orphan', title: 'Orphan', kind: 'bar', tableId: 'missing', series: []},
    ],
  } as unknown as ExplorationResult;
  expect(explorationViews(result).map(v => [v.kind, v.id])).toEqual([
    ['chart', 'chart-revenue'],
    ['chart', 'chart-margin'],
    ['table', 'table-products'],
  ]);
});
