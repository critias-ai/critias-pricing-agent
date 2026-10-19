import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {writeFile} from 'node:fs/promises';
import {join, relative} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Type} from 'typebox';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {hashFile} from '../../workspace.js';
import type {Execution, FileRef} from './contracts.js';
import {hookOff} from './nudges.js';

type Table = {name: string; rows: number; typed: boolean; columns: string[]};
type Reply = {
  id: number;
  ok: boolean;
  error?: string;
  columns: string[];
  rows: unknown[][];
  more: boolean;
  changed: {name: string; change: string}[];
  seconds: number;
  saved?: string | null;
  savedRows?: number | null;
  stopped?: string; // the same-rows check stopped the statement before it ran
  note?: string | null;
  batch?: (Omit<Reply, 'id' | 'batch'> & {sql: string})[]; // several statements in one call, each with its own outcome
};

const cell = (v: unknown) => (v === null ? 'NULL' : String(v).replace(/\|/g, '\\|').replace(/\n/g, ' '));

// What the model sees, and what the reply-figure check later reads from the recorded output.
export function formatResult(r: Pick<Reply, 'columns' | 'rows' | 'more' | 'changed'>): string {
  const lines: string[] = [];
  if (r.columns.length && r.rows.length) {
    lines.push(`| ${r.columns.join(' | ')} |`, `|${r.columns.map(() => '---').join('|')}|`);
    for (const row of r.rows) lines.push(`| ${row.map(cell).join(' | ')} |`);
    lines.push(
      r.more
        ? `(first ${r.rows.length} rows; more exist: aggregate, add LIMIT, or COPY (...) TO 'result.csv' for the full set)`
        : `(${r.rows.length} row${r.rows.length === 1 ? '' : 's'})`,
    );
  } else lines.push(r.columns.length ? '(0 rows)' : 'OK');
  for (const c of r.changed)
    lines.push(
      c.change === 'redefined'
        ? `Definition changed: ${c.name}. Figures from earlier answers that used it may no longer match; say so and restate them.`
        : `${c.change === 'created' ? 'Created' : 'Dropped'}: ${c.name}`,
    );
  return lines.join('\n');
}

export const catalogue = (tables: Table[]) =>
  tables.map(t => `- ${t.name} (${t.rows.toLocaleString('en-GB')} rows): ${t.columns.join(', ')}`).join('\n');

type Options = {
  pythonPath: string;
  helperPath: string;
  root: string;
  stageDir: string;
  cache: string;
  sources: FileRef[];
  memory: string;
  threads: number;
  onExecution: (record: Execution) => void;
  onRecorded: (name: string, sha256: string) => void;
};

// A long-lived DuckDB session per stage. Source CSVs and workbook sheets are typed views; the analyst's own views persist between calls.
export async function createQueryTool(o: Options): Promise<{tool: ToolDefinition; close: () => void} | undefined> {
  const csv = o.sources.filter(s => /\.(csv|xlsx|xlsm)$/i.test(s.path));
  if (!csv.length) return undefined;
  const child: ChildProcessWithoutNullStreams = spawn(
    o.pythonPath,
    [
      o.helperPath,
      '--root',
      o.root,
      '--stage',
      o.stageDir,
      '--cache',
      o.cache,
      '--sources',
      JSON.stringify(csv.map(s => s.path)),
      '--memory',
      o.memory,
      '--threads',
      String(o.threads),
      ...(hookOff('same-rows') ? ['--no-same-rows'] : []),
      ...(hookOff('peer-ratio') ? ['--no-peer-ratio'] : []),
      ...(hookOff('offsets') ? ['--no-offsets'] : []),
    ],
    {cwd: o.stageDir, stdio: ['pipe', 'pipe', 'pipe']},
  );
  let tail = '';
  child.stderr.on('data', b => (tail = (tail + b.toString()).slice(-1500)));
  const waiting = new Map<number, (r: Reply) => void>();
  let ready: (v: {tables: Table[]; notes: string[]}) => void;
  const started = new Promise<{tables: Table[]; notes: string[]}>((res, rej) => {
    ready = res;
    child.once('exit', () => rej(new Error(`SQL session stopped: ${tail || 'no output'}`)));
  });
  createInterface({input: child.stdout}).on('line', line => {
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // a malformed line must not crash the worker; the call then fails with the session's stderr
    }
    if (msg.ready) ready(msg);
    else waiting.get(msg.id)?.(msg);
  });
  let exited = false;
  const stopped = (id: number): Reply => ({
    id,
    ok: false,
    error: `SQL session stopped: ${tail || 'no output'}`,
    columns: [],
    rows: [],
    more: false,
    changed: [],
    seconds: 0,
  });
  child.once('exit', () => {
    exited = true;
    for (const [id, resolve] of waiting) resolve(stopped(id));
  });
  const {tables, notes} = await started;
  let next = 0;
  const call = (sql: string, save?: string) =>
    new Promise<Reply>(resolve => {
      const id = ++next;
      if (exited) return resolve(stopped(id)); // a later call must fail, not wait for a reply that never comes
      waiting.set(id, resolve);
      child.stdin.write(JSON.stringify({id, sql, save}) + '\n');
    });
  const tool: ToolDefinition = {
    name: 'query',
    executionMode: 'sequential',
    label: 'SQL query',
    description:
      'Run SQL (DuckDB) over the source data. Put several statements in one call, separated by semicolons: they run in order, each result comes back under its own header, and a failing statement does not stop the others. One call with several statements is much faster than several calls, even if a result goes unused. ' +
      'Work in fewer, larger steps: (1) reduce: in one call, build the item × period table the answer needs (quantity, sales, cost and any flags) and save it with `save`; (2) compute: one Python script over that small table prints every figure the answer needs; (3) revise: when the user corrects something, edit the reduction or the script and run it again rather than rebuilding step by step. ' +
      'Every source file (each sheet of a workbook) is already a typed view named after the file (and sheet). Views and tables you create stay available for the whole conversation (later calls, turns and follow-up questions), so answer follow-ups and drill-downs from them instead of rebuilding. ' +
      'Each result is limited to 100 rows and is recorded as evidence; a statement is stopped after 120 s. Python run with execute_analysis or python3 in bash is recorded too.\n' +
      `Views:\n${catalogue(tables)}${notes.length ? `\nNotes:\n${notes.map(n => `- ${n}`).join('\n')}` : ''}`,
    parameters: Type.Object({
      sql: Type.String({
        description: 'One or more SQL statements separated by semicolons. Write AS before every alias.',
      }),
      save: Type.Optional(
        Type.String({
          description:
            'File name ending in .csv. Writes the full result of a SELECT there, so `present` can show it as a table or chart.',
        }),
      ),
    }),
    execute: async (_id, args: any) => {
      const sql = String(args?.sql ?? '').trim();
      if (!sql) throw new Error('Expected an sql statement');
      const save = typeof args?.save === 'string' && args.save.trim() ? args.save.trim() : undefined;
      const reply = await call(sql, save);
      if (!reply.ok) throw new Error(reply.error);
      const parts = reply.batch ?? [reply];
      const shown = (r: Omit<Reply, 'id' | 'batch'>) =>
        !r.ok
          ? `Error: ${r.error}`
          : (r.stopped ??
            formatResult(r) +
              (r.saved ? `\nSaved ${r.savedRows?.toLocaleString('en-GB')} rows to ${r.saved}` : '') +
              (r.note ? `\n${r.note}` : ''));
      const text = reply.batch
        ? reply.batch
            .map((r, i) => `-- Statement ${i + 1}: ${r.sql.replace(/\s+/g, ' ').slice(0, 80)}\n${shown(r)}`)
            .join('\n\n')
        : shown(reply);
      if (parts.every(r => !r.ok)) throw new Error(text);
      // Nothing ran, so nothing is recorded as evidence.
      if (parts.every(r => !r.ok || r.stopped)) return {details: {}, content: [{type: 'text', text}]};
      const id = randomUUID();
      const scriptPath = join(o.stageDir, `query-${id}.sql`);
      const outputPath = join(o.stageDir, `execution-${id}.txt`);
      await writeFile(scriptPath, sql + '\n');
      await writeFile(outputPath, text + '\n');
      if (reply.saved) {
        const file = join(o.stageDir, reply.saved);
        o.onRecorded(reply.saved, (await hashFile(file)).sha256);
      }
      o.onExecution({
        id,
        script: {path: relative(o.root, scriptPath), sha256: (await hashFile(scriptPath)).sha256},
        output: {path: relative(o.root, outputPath), sha256: (await hashFile(outputPath)).sha256},
        success: true,
        accessed: csv,
      });
      return {details: {}, content: [{type: 'text', text}]};
    },
  };
  return {tool, close: () => child.kill('SIGKILL')};
}
