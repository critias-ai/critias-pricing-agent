import {expect, it} from 'vitest';
import {existsSync} from 'node:fs';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {compactFindings, createFindingDetector, type DataFinding} from '../../src/agent/workflow/data-findings.js';
import {createFlow} from '../fixtures/workflow-flow.js';
import {venvPython} from '../fixtures/venv-python.js';
const python = venvPython;
const finding = (i: number): DataFinding => ({
  id: `F-${i}`,
  detector: 'parse',
  source: 'files/s.csv',
  column: 'amount',
  issue: 'decimal-comma',
  rows: 1,
  valueAtStake: 100 - i,
  valueColumn: 'amount',
  examples: ['1,5'],
  fix: null,
  exact: true,
});
it('keeps the largest findings within the prompt bound and reports the total', () => {
  const all = Array.from({length: 100}, (_, i) => finding(i));
  const compact = compactFindings({findingsDir: '/c', findings: all}, 2000);
  expect(compact.total).toBe(100);
  expect(compact.findings[0].id).toBe('F-0');
  expect(compact.findings.length).toBeLessThan(100);
  expect(JSON.stringify(compact.findings).length).toBeLessThanOrEqual(2000);
});
it('keeps findings from every detector when the bound cuts', () => {
  const ratio = Array.from({length: 60}, (_, i) => ({...finding(i), detector: 'ratio'}));
  const unique = {...finding(99), id: 'U', detector: 'uniqueness', valueAtStake: null};
  const compact = compactFindings({findingsDir: '/c', findings: [...ratio, unique]}, 2000);
  expect(compact.total).toBe(61);
  expect(compact.findings.map(f => f.id)).toContain('U');
});
it('keeps coverage gaps when the bound cuts findings', () => {
  const ran = {parse: 'ran', ratio: 'ran'};
  const coverage = [
    {source: 'files/a.csv', status: 'ran', valueColumns: [], detectors: ran},
    {source: 'files/b.csv', status: 'ran', valueColumns: [], detectors: {...ran, ratio: 'skipped: no key'}},
    {
      source: 'files/c.csv',
      status: 'skipped',
      reason: 'not UTF-8',
      valueColumns: [],
      detectors: {parse: 'skipped: not read'},
    },
  ];
  const all = Array.from({length: 100}, (_, i) => finding(i));
  const compact = compactFindings({findingsDir: '/c', findings: all, coverage}, 2000);
  expect(compact.gaps).toEqual(['files/b.csv: ratio skipped: no key', 'files/c.csv: not read (not UTF-8)']);
  expect(JSON.stringify({findings: compact.findings, gaps: compact.gaps}).length).toBeLessThanOrEqual(2000);
});
it('clips long strings instead of dropping the list', () => {
  const long = 'x'.repeat(5000);
  const first = {...finding(0), issue: 'y'.repeat(3000), examples: [long, long, long]};
  const compact = compactFindings({findingsDir: '/c', findings: [first, finding(1)]});
  expect(compact.total).toBe(2);
  expect(compact.findings).toHaveLength(2);
  expect(compact.findings.flatMap(f => [f.issue, ...f.examples]).every(s => (s?.length ?? 0) <= 80)).toBe(true);
});
it.skipIf(!existsSync(python))('detects findings in a real CSV with the bundled Python helper', async () => {
  const root = await mkdtemp(join(tmpdir(), 'findings-'));
  await mkdir(join(root, 'files'));
  const rows = Array.from({length: 40}, (_, i) => `${i + 1}.5,x`);
  await writeFile(join(root, 'files/s.csv'), ['amount,label', ...rows, '"1,5",x'].join('\n') + '\n');
  const detect = createFindingDetector(
    {pythonPath: python, bundledRoot: resolve('bundled'), workspaceRoot: root},
    join(root, 'cache'),
  );
  const result = await detect([
    {id: '1', name: 's.csv', relativePath: 'files/s.csv', bytes: 1, sha256: 'abc', addedAt: '', kind: 'csv'},
  ]);
  expect(result?.findings.map(f => [f.source, f.column, f.issue])).toEqual([
    ['files/s.csv', 'amount', 'decimal-comma'],
  ]);
});
it.skipIf(!existsSync(python))('reports the reason a detector failed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'findings-'));
  const detect = createFindingDetector(
    {pythonPath: python, bundledRoot: resolve('bundled'), workspaceRoot: root},
    join(root, 'cache'),
  );
  const message = await detect([
    {id: '1', name: 'm.csv', relativePath: 'files/m.csv', bytes: 1, sha256: 'abc', addedAt: '', kind: 'csv'},
  ]).then(
    () => '',
    (e: Error) => e.message,
  );
  expect(message).toMatch(/FileNotFoundError/);
  expect(message.length).toBeLessThan(300);
});
it('puts the findings and the bound-then-ask rule in the first prompt', async () => {
  const f = await createFlow({findData: async () => ({findingsDir: '/c', findings: [finding(0)]})});
  await f.run();
  expect(f.requests[0]!.prompt).toContain('"total":1,"findings":[{"id":"F-0"');
  expect(f.requests[0]!.prompt).toContain('/c/findings.json');
  expect(f.requests[0]!.prompt).toContain('show both results and ask');
});
it('runs without findings when detection fails', async () => {
  const f = await createFlow({
    findData: async () => {
      throw new Error('detector crashed');
    },
  });
  const result = await f.run();
  expect(result.outcome.kind).toBe('complete');
  expect(f.requests[0]!.prompt).not.toContain('Data findings');
});
