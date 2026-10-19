import {expect, it} from 'vitest';
import {compactProfiles, profileColumnFields, type SourceProfile} from '../../src/agent/workflow/source-profiles.js';
const column = (i: number) => ({
  name: 'c' + i,
  inferredType: 'text',
  nonNull: 1,
  blank: 0,
  distinctApprox: 1,
  castFailures: 0,
  thousandsSeparatorValues: 0,
  leadingZeroValues: 0,
  exponentValues: 0,
  min: null,
  max: null,
  topValues: [
    {value: 'v'.repeat(50), count: 1},
    {value: 'w', count: 1},
    {value: 'x', count: 1},
  ],
});
const source = (path: string, columns: number): SourceProfile => ({
  path,
  sha256: 's',
  kind: 'csv',
  profiles: [
    {
      schemaVersion: 1,
      rowCount: 1,
      columnCount: columns,
      profiledColumns: columns,
      columns: [...Array(columns).keys()].map(column),
    },
  ],
});
it('encodes each column as one row under a field header, keeping every statistic', () => {
  const [compact] = compactProfiles([source('files/a.csv', 1)], 1_000_000) as any;
  const sheet = compact.profiles[0];
  expect(sheet.columnFields).toEqual(profileColumnFields);
  expect(sheet.columns[0]).toEqual(['c0', 'text', 1, 0, 1, null, null, ['v'.repeat(40) + '…', 'w', 'x']]);
  expect(sheet.rowCount).toBe(1);
});
it('keeps non-zero parsing counters as flags on the row', () => {
  const profile = source('files/a.csv', 1) as any;
  profile.profiles[0].columns[0].castFailures = 3;
  const [compact] = compactProfiles([profile], 1_000_000) as any;
  expect(compact.profiles[0].columns[0].at(-1)).toEqual({castFailures: 3});
});
it('drops sample values before columns to stay inside the prompt budget', () => {
  const profiles = [source('files/a.csv', 300)];
  const compact = compactProfiles(profiles, 20000) as any;
  expect(JSON.stringify(compact).length).toBeLessThanOrEqual(20000);
  expect(compact[0].profiles[0].columns.length).toBe(300);
  expect(compact[0].profiles[0].columns[0][7]).toEqual([]);
});
it('honours the budget across many moderate-width sources by trimming samples, not columns', () => {
  const profiles = [...Array(15).keys()].map(i => source(`files/s${i}.csv`, 30));
  const compact = compactProfiles(profiles, 40000) as any;
  expect(JSON.stringify(compact).length).toBeLessThanOrEqual(40000);
  for (const p of compact) expect(p.profiles[0].columns.length).toBe(30);
});
it('trims wide sheets only when samples alone cannot meet the budget', () => {
  const compact = compactProfiles([source('files/a.csv', 300)], 6000) as any;
  expect(compact[0].profiles[0].columns.length).toBe(50);
  expect(compact[0].profiles[0].profiledColumns).toBe(50);
});
it('passes profile errors through unchanged', () => {
  const failed: SourceProfile = {path: 'files/b.csv', sha256: 's', kind: 'csv', error: 'unreadable'};
  expect(compactProfiles([failed])).toEqual([failed]);
});
