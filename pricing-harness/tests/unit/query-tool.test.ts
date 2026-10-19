import {expect, it} from 'vitest';
import {catalogue, formatResult} from '../../src/agent/workflow/query-tool.js';

it('formats rows as a table and says when more exist', () => {
  const text = formatResult({
    columns: ['q', 'sales'],
    rows: [
      ['2010Q1', '1,884.10'],
      [null, 5],
    ],
    more: false,
    changed: [],
  });
  expect(text).toBe('| q | sales |\n|---|---|\n| 2010Q1 | 1,884.10 |\n| NULL | 5 |\n(2 rows)');
  expect(formatResult({columns: ['a'], rows: [[1]], more: true, changed: []})).toContain('more exist');
});
it('reports empty results, statements and view changes', () => {
  expect(formatResult({columns: ['a'], rows: [], more: false, changed: []})).toBe('(0 rows)');
  expect(formatResult({columns: [], rows: [], more: false, changed: [{name: 'merch', change: 'created'}]})).toBe(
    'OK\nCreated: merch',
  );
  expect(formatResult({columns: [], rows: [], more: false, changed: [{name: 'merch', change: 'redefined'}]})).toMatch(
    /Definition changed: merch.*restate/,
  );
});
it('lists views with their columns', () => {
  expect(catalogue([{name: 'sales', rows: 1200, typed: true, columns: ['id', 'qty']}])).toBe(
    '- sales (1,200 rows): id, qty',
  );
});
