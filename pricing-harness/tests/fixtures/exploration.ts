import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import type {ExplorationSpec} from '../../src/exploration.js';
import type {Checkpoint} from '../../src/agent/workflow/contracts.js';
import {hashFile} from '../../src/workspace.js';

export const quarterlyCsv = 'quarter,label,revenue,margin\nq1,Q1,10,36.09\nq2,Q2,20,\n';

export const quarterlyExploration: ExplorationSpec = {
  schemaVersion: 1,
  tables: [
    {
      id: 'quarterly',
      title: 'Quarterly performance',
      rowHeader: 'Quarter',
      file: 'quarters.csv',
      rowKey: 'quarter',
      rowLabel: 'label',
      columns: [
        {key: 'revenue', label: 'Revenue', unit: 'GBP'},
        {key: 'margin', label: 'Gross margin', unit: '%'},
      ],
    },
  ],
  charts: [
    {id: 'revenue-trend', title: 'Revenue trend', kind: 'line', tableId: 'quarterly', series: ['revenue']},
    {id: 'margin-trend', title: 'Margin trend', kind: 'line', tableId: 'quarterly', series: ['margin']},
  ],
};

// A frozen checkpoint whose result file really exists under `root`.
export async function explorationCheckpoint(root: string, csv = quarterlyCsv): Promise<Checkpoint> {
  const path = '.pricing/workflow/conversation-1/checkpoints/checkpoint-1/0-quarters.csv';
  await mkdir(dirname(join(root, path)), {recursive: true});
  await writeFile(join(root, path), csv);
  return {
    schemaVersion: 2,
    id: 'checkpoint-1',
    runId: 'run-1',
    conversationId: 'conversation-1',
    sources: [],
    files: [{name: 'quarters.csv', path, sha256: (await hashFile(join(root, path))).sha256}],
    createdAt: '2026-10-09T00:00:00.000Z',
    exploration: structuredClone(quarterlyExploration),
  };
}
