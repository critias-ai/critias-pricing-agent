import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {explorationCheckpoint, quarterlyExploration} from '../fixtures/exploration.js';
import {bindExploration, normalizeExploration, parseCsv} from '../../src/agent/workflow/exploration.js';

const ref = {path: 'checkpoints/c.json', sha256: 'a'.repeat(64)};
const root = () => mkdtemp(join(tmpdir(), 'expl-'));

describe('file-bound exploration', () => {
  it('normalizes a valid description and a table-only one', () => {
    expect(normalizeExploration(quarterlyExploration)).toEqual({spec: quarterlyExploration, issues: []});
    const {charts: _charts, ...tableOnly} = quarterlyExploration;
    expect(normalizeExploration(tableOnly).spec).toEqual({...quarterlyExploration, charts: []});
  });

  it('drops invalid tables and charts with a reason and keeps the rest', () => {
    const bad = structuredClone(quarterlyExploration);
    bad.tables.push({...bad.tables[0]!, id: 'second', columns: []});
    bad.charts.push({id: 'x', title: 'X', kind: 'line', tableId: 'missing', series: ['revenue']});
    bad.charts.push({id: 'mixed', title: 'M', kind: 'bar', tableId: 'quarterly', series: ['revenue', 'margin']});
    const out = normalizeExploration(bad);
    expect(out.spec?.tables.map(t => t.id)).toEqual(['quarterly']);
    expect(out.spec?.charts.map(c => c.id)).toEqual(['revenue-trend', 'margin-trend']);
    expect(out.issues).toHaveLength(3);
    expect(normalizeExploration({tables: 'no'}).spec).toBeUndefined();
  });

  it('accepts stacked, waterfall and scatter charts and refuses their misuse', () => {
    const good = structuredClone(quarterlyExploration);
    good.charts = [
      {id: 'parts', title: 'P', kind: 'stacked', tableId: 'quarterly', series: ['revenue']},
      {id: 'bridge', title: 'B', kind: 'waterfall', tableId: 'quarterly', series: ['margin'], totals: ['q1']},
      {id: 'spread', title: 'S', kind: 'scatter', tableId: 'quarterly', series: ['margin'], x: 'revenue'},
    ];
    const out = normalizeExploration(good);
    expect(out.issues).toEqual([]);
    expect(out.spec?.charts[2]).toMatchObject({x: 'revenue'});
    const bad = structuredClone(quarterlyExploration);
    bad.charts = [
      {id: 'nox', title: 'N', kind: 'scatter', tableId: 'quarterly', series: ['margin']},
      {id: 'two', title: 'T', kind: 'waterfall', tableId: 'quarterly', series: ['margin', 'margin']},
      {id: 'linetotals', title: 'L', kind: 'line', tableId: 'quarterly', series: ['margin'], totals: ['q1']},
    ];
    expect(normalizeExploration(bad).spec?.charts).toEqual([]);
    expect(normalizeExploration(bad).issues).toHaveLength(3);
  });

  it('omits a waterfall whose total row is not in the table', async () => {
    const r = await root();
    const checkpoint = await explorationCheckpoint(r);
    checkpoint.exploration!.charts = [
      {id: 'bridge', title: 'B', kind: 'waterfall', tableId: 'quarterly', series: ['revenue'], totals: ['q9']},
    ];
    const out = await bindExploration(r, checkpoint, ref);
    expect(out.result!.charts).toEqual([]);
    expect(out.issues.join(' ')).toMatch(/total row q9/);
  });

  it('accepts ids that start with a digit', () => {
    const spec = structuredClone(quarterlyExploration);
    spec.tables[0]!.id = '2009_q4';
    spec.charts = [];
    expect(normalizeExploration(spec).issues).toEqual([]);
  });

  it('reads CSV values from the frozen file, with blanks held', async () => {
    const r = await root();
    const out = await bindExploration(r, await explorationCheckpoint(r), ref);
    expect(out.issues).toEqual([]);
    const rows = out.result!.tables[0]!.rows;
    expect(rows.map(x => [x.key, x.label])).toEqual([
      ['q1', 'Q1'],
      ['q2', 'Q2'],
    ]);
    expect(rows[0]!.cells).toEqual({
      revenue: {value: 10, status: 'approved'},
      margin: {value: 36.09, status: 'approved'},
    });
    expect(rows[1]!.cells.margin).toEqual({value: null, status: 'held', reason: 'blank in the result file'});
    expect(out.result!.charts).toHaveLength(2);
  });

  it.each([
    ['a missing column', 'quarter,label,revenue\nq1,Q1,10\n', /column margin is not in/],
    ['a repeated row key', 'quarter,label,revenue,margin\nq1,Q1,1,1\nq1,Q1b,2,2\n', /blank or repeats/],
  ])('omits the table and its charts for %s', async (_name, csv, issue) => {
    const r = await root();
    const out = await bindExploration(r, await explorationCheckpoint(r, csv), ref);
    expect(out.result).toBeUndefined();
    expect(out.issues.join(' ')).toMatch(issue);
  });

  it('shows a text value as text and leaves charts of that column out', async () => {
    const r = await root();
    const out = await bindExploration(
      r,
      await explorationCheckpoint(r, 'quarter,label,revenue,margin\nq1,Q1,ten,1\n'),
      ref,
    );
    expect(out.result!.tables[0]!.rows[0]!.cells.revenue).toEqual({value: null, status: 'approved', text: 'ten'});
    expect(out.result!.charts.every(c => !c.series.includes('revenue'))).toBe(true);
    expect(out.issues.join(' ')).toMatch(/revenue holds text/);
  });

  it('parses quoted fields, doubled quotes and CRLF', () => {
    expect(parseCsv('a,b\r\n"x,1","say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x,1', 'say "hi"'],
    ]);
  });
});
