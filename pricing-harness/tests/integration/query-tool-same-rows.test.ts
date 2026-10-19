import {expect, it} from 'vitest';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {venvPython} from '../fixtures/venv-python.js';
import {join} from 'node:path';
import {createQueryTool} from '../../src/agent/workflow/query-tool.js';
import type {Execution} from '../../src/agent/workflow/contracts.js';

it('stops a statement that combines totals from different rows without recording it, then runs it when resent', async () => {
  const root = mkdtempSync(join(tmpdir(), 'same-rows-'));
  mkdirSync(join(root, 'files'));
  mkdirSync(join(root, 'stage'));
  writeFileSync(join(root, 'files/lines.csv'), 'product,qty,price\nA,2,1.50\nB,3,2.00\nC,1,\n');
  const executions: Execution[] = [];
  const made = await createQueryTool({
    pythonPath: venvPython,
    helperPath: join(process.cwd(), 'bundled/harness-tools/query_server.py'),
    root,
    stageDir: join(root, 'stage'),
    cache: join(root, 'cache'),
    sources: [{path: 'files/lines.csv', sha256: 'x'}],
    memory: '256MB',
    threads: 1,
    onExecution: e => executions.push(e),
    onRecorded: () => {},
  });
  try {
    const sql = 'SELECT sum(qty) * 10 - sum(price) AS d FROM lines';
    const run = async () =>
      ((await made!.tool.execute('t', {sql}, undefined, undefined, undefined as never)) as any).content[0].text;
    expect(await run()).toMatch(/^Not run: In d, 1 rows count in sum\(qty\) but not in sum\(price\)/);
    expect(executions).toHaveLength(0);
    expect(await run()).toContain('56.50');
    expect(executions).toHaveLength(1);
  } finally {
    made?.close();
  }
}, 60000);

it('keeps views across sessions on the same stage folder, as across turns of one conversation', async () => {
  const root = mkdtempSync(join(tmpdir(), 'persist-'));
  mkdirSync(join(root, 'files'));
  mkdirSync(join(root, 'stage'));
  writeFileSync(join(root, 'files/lines.csv'), 'product,qty,price\nA,2,1.50\nB,3,2.00\n');
  const open = () =>
    createQueryTool({
      pythonPath: venvPython,
      helperPath: join(process.cwd(), 'bundled/harness-tools/query_server.py'),
      root,
      stageDir: join(root, 'stage'),
      cache: join(root, 'cache'),
      sources: [{path: 'files/lines.csv', sha256: 'x'}],
      memory: '256MB',
      threads: 1,
      onExecution: () => {},
      onRecorded: () => {},
    });
  const ask = async (made: Awaited<ReturnType<typeof open>>, sql: string) =>
    ((await made!.tool.execute('t', {sql}, undefined, undefined, undefined as never)) as any).content[0].text;
  const first = await open();
  await ask(first, 'CREATE OR REPLACE TEMP VIEW big AS SELECT * FROM lines WHERE qty > 2');
  first!.close(); // the worker kills its session at the end of a turn; the next one opens straight away
  const second = await open();
  try {
    expect(await ask(second, 'SELECT count(*) AS n FROM big')).toContain('| 1 |');
  } finally {
    second?.close();
  }
}, 60000);

it('runs several statements in one call, each with its own result, and records the call once', async () => {
  const root = mkdtempSync(join(tmpdir(), 'batch-'));
  mkdirSync(join(root, 'files'));
  mkdirSync(join(root, 'stage'));
  writeFileSync(join(root, 'files/lines.csv'), 'product,qty,price\nA,2,1.50\nB,3,2.00\n');
  const executions: Execution[] = [];
  const made = await createQueryTool({
    pythonPath: venvPython,
    helperPath: join(process.cwd(), 'bundled/harness-tools/query_server.py'),
    root,
    stageDir: join(root, 'stage'),
    cache: join(root, 'cache'),
    sources: [{path: 'files/lines.csv', sha256: 'x'}],
    memory: '256MB',
    threads: 1,
    onExecution: e => executions.push(e),
    onRecorded: () => {},
  });
  try {
    const sql =
      'CREATE VIEW big AS SELECT * FROM lines WHERE qty > 2; SELECT nope FROM big; SELECT count(*) AS n FROM big';
    const text = ((await made!.tool.execute('t', {sql}, undefined, undefined, undefined as never)) as any).content[0]
      .text;
    expect(text).toMatch(/-- Statement 1: CREATE VIEW big[\s\S]*Created: big/);
    expect(text).toMatch(/-- Statement 2: SELECT nope FROM big\nError: Binder/);
    expect(text).toMatch(/-- Statement 3: SELECT count\(\*\) AS n FROM big\n\| n \|\n\|---\|\n\| 1 \|/);
    expect(executions).toHaveLength(1);
  } finally {
    made?.close();
  }
}, 60000);

it('fails a query at once after the SQL session has stopped, instead of waiting', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stopped-'));
  mkdirSync(join(root, 'files'));
  mkdirSync(join(root, 'stage'));
  writeFileSync(join(root, 'files/lines.csv'), 'product,qty\nA,2\n');
  const made = await createQueryTool({
    pythonPath: venvPython,
    helperPath: join(process.cwd(), 'bundled/harness-tools/query_server.py'),
    root,
    stageDir: join(root, 'stage'),
    cache: join(root, 'cache'),
    sources: [{path: 'files/lines.csv', sha256: 'x'}],
    memory: '256MB',
    threads: 1,
    onExecution: () => {},
    onRecorded: () => {},
  });
  made!.close(); // as when the process is killed, for example for lack of memory
  await new Promise(r => setTimeout(r, 200));
  await expect(made!.tool.execute('t', {sql: 'SELECT 1'}, undefined, undefined, undefined as never)).rejects.toThrow(
    /SQL session stopped/,
  );
}, 60000);
