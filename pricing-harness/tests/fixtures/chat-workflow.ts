// Offline provider boundary. The scripted analyst reads the uploaded CSV, writes result files, and presents them.
import {writeFile, readFile, readdir, mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join, relative} from 'node:path';
import {hashFile} from '../../src/workspace.js';
import type {Runner, Execution} from '../../src/agent/workflow/contracts.js';
import type {ExplorationSpec} from '../../src/exploration.js';
import {recordedSteps, replayEvents, syntheticSteps} from './recorded-steps.js';
export const fixtureCsv =
  'id,label,value,unit,reason\nrev_q1,Q1 revenue,10,GBP,\nrev_q2,Q2 revenue,20,GBP,\nmargin_q1,Q1 gross margin,36.09,%,\nmargin_q2,Q2 gross margin,,%,blank unit cost\n' +
  Array.from(
    {length: 60},
    (_, i) =>
      `product_${i + 1},${i === 59 ? '<b>Product 60</b>' : `Product ${i + 1}`},${[2, 10, 100][i] ?? i + 1},EA,\n`,
  ).join('');
export const chatFixtureSpec: ExplorationSpec = {
  schemaVersion: 1,
  tables: [
    {
      id: 'quarterly',
      title: 'Quarterly performance',
      rowHeader: 'Quarter',
      file: 'quarterly.csv',
      rowKey: 'quarter',
      rowLabel: 'label',
      columns: [
        {key: 'revenue', label: 'Revenue', unit: 'GBP'},
        {key: 'benchmark', label: 'Comparison', unit: 'GBP'},
        {key: 'margin', label: 'Gross margin', unit: '%'},
      ],
    },
    {
      id: 'products',
      title: 'Product units',
      rowHeader: 'Product',
      file: 'products.csv',
      rowKey: 'product',
      rowLabel: 'label',
      columns: [{key: 'units', label: 'Units', unit: 'EA'}],
    },
    {
      id: 'wide',
      title: 'Wide comparison table',
      rowHeader: 'Quarter',
      file: 'wide.csv',
      rowKey: 'quarter',
      rowLabel: 'label',
      columns: Array.from({length: 6}, (_, i) => ({
        key: `value${i}`,
        label: `Revenue comparison ${i + 1}`,
        unit: 'GBP',
      })),
    },
  ],
  charts: [
    {id: 'revenue', title: 'Quarterly revenue', kind: 'line', tableId: 'quarterly', series: ['revenue', 'benchmark']},
    {id: 'margin', title: 'Quarterly gross margin', kind: 'line', tableId: 'quarterly', series: ['margin']},
  ],
};
export function createChatFixtureRunner() {
  const counters = {submissions: 0, model: 0, tool: 0, render: 0, preview: 0};
  // Replay each recorded step list once per run.
  const replayed = new Set<string>();
  let asked = '';
  const runner: Runner & {counters: typeof counters} = {
    activeCount: 0,
    counters,
    execute: async (request, budget, signal, event) => {
      const root = request.config.workspaceRoot;
      const asking = request.prompt.match(/^(?:Follow-up question|Question): (.*)$/m)?.[1];
      if (asking !== undefined) {
        asked = asking;
        counters.submissions++;
      }
      const question = asked;
      counters.model++;
      budget.debit('model');
      event({type: 'debit', kind: 'model'});
      const usage = {input: 1, output: 1, cost: {total: 0}};
      budget.usage(usage);
      event({type: 'usage', usage});
      if (question.includes('handoff failure')) throw Error('ENAMETOOLONG /private/tmp/internal-handoff-123.45');
      if (signal.aborted) throw Error('cancelled');
      if (question.includes('slow'))
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 10000);
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(Error('cancelled'));
            },
            {once: true},
          );
        });
      if (signal.aborted) throw Error('cancelled');
      const replay = question.includes('Recorded')
        ? recordedSteps()
        : question.includes('Stepped')
          ? syntheticSteps
          : [];
      if (replay.length && !replayed.has(request.runId)) {
        replayed.add(request.runId);
        for (const {delayMs, event: step} of replayEvents(replay, 'analyse')) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          if (signal.aborted) throw Error('cancelled');
          event(step);
        }
      }
      await mkdir(request.stageDir, {recursive: true});
      const finish = (text: string, executions: Execution[] = []) => ({
        schemaVersion: 1 as const,
        sessionId: 'hidden-fixture',
        text,
        executions,
      });
      if (question.includes('Next fixture')) return finish('Which metric should I use?');
      if (question.includes('wrong number')) return finish('Synthetic revenue was £12,345.67 in total.');
      const csv = (await readdir(join(root, 'files'), {recursive: true})).filter(f => f.endsWith('.csv')).sort();
      const found = csv.find(f => f.endsWith('fixture.csv')) ?? csv[0];
      if (!found) throw Error('Upload fixture.csv first');
      const sourceRel = join('files', found);
      const exploration = question.includes('text only')
        ? undefined
        : question.includes('malformed views')
          ? ({tables: 'malformed'} as unknown as ExplorationSpec)
          : chatFixtureSpec;
      const rows = (await readFile(join(root, sourceRel), 'utf8'))
        .trim()
        .split('\n')
        .slice(1)
        .map(line => line.split(','));
      const value = (id: string) => rows.find(r => r[0] === id)?.[2] ?? '';
      const files: Record<string, string> = {
        'quarterly.csv': [
          'quarter,label,revenue,benchmark,margin',
          `q1,Q1 <b>literal</b>,${value('rev_q1')},${value('rev_q2')},${value('margin_q1')}`,
          `q2,Q2,${value('rev_q2')},${value('rev_q1')},${value('margin_q2')}`,
        ].join('\n'),
        'products.csv': [
          'product,label,units',
          ...rows.filter(r => r[0]!.startsWith('product_')).map(r => `${r[0]},${r[1]},${r[2]}`),
        ].join('\n'),
        'wide.csv': [
          'quarter,label,' + Array.from({length: 6}, (_, i) => `value${i}`).join(','),
          'q1,Q1 <b>literal</b>,' + Array.from({length: 6}, () => value('rev_q1')).join(','),
        ].join('\n'),
      };
      counters.tool++;
      budget.debit('tool');
      event({type: 'debit', kind: 'tool'});
      const script = join(request.stageDir, 'calculate.sql'),
        output = join(request.stageDir, `execution-${randomUUID()}.txt`);
      await writeFile(script, '-- offline fixture\n');
      await writeFile(output, `revenue 10 20\nmargin 36.09\nunits 2 10 100\n`);
      const ref = async (path: string) => ({path: relative(root, path), sha256: (await hashFile(path)).sha256});
      const record: Execution = {
        id: `fixture-${randomUUID()}`,
        script: await ref(script),
        output: await ref(output),
        success: true,
      };
      for (const [name, text] of Object.entries(files)) {
        await writeFile(join(request.stageDir, name), text + '\n');
        event({type: 'recorded', name, sha256: (await hashFile(join(request.stageDir, name))).sha256});
      }
      if (exploration) event({type: 'present', spec: exploration});
      event({type: 'execution', record});
      return finish(
        'Synthetic checked values: Q1 revenue £10; Q2 revenue £20; Q1 gross margin 36.09%. Q2 margin is unavailable because unit cost is blank. No line is priced ten times or a tenth of its median.' +
          (question.includes('Diagram')
            ? '\n\n```mermaid\nflowchart LR\n  A[Sales] --> B[Margin]\n```\n\n| Quarter | Revenue |\n|---|---|\n| Q1 | £10.00 |'
            : ''),
        [record],
      );
    },
  };
  return runner;
}
