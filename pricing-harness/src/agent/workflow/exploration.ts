import {readFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {safePath} from '../../workspace.js';
import type {Checkpoint, FileRef} from './contracts.js';
import {
  CHART_KINDS,
  EXPLORATION_LIMITS,
  type ChartSpec,
  type ExplorationResult,
  type ExplorationSpec,
  type ResultCell,
  type ResultTable,
  type TableSpec,
} from '../../exploration.js';

const idPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const validId = (value: unknown): value is string => typeof value === 'string' && idPattern.test(value);
const nonblank = (value: unknown, max: number): value is string =>
  typeof value === 'string' && !!value.trim() && value.length <= max;
const issue = (message: string) => message.slice(0, 240);
const utf8Size = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

// Validates the description the analyst passed to `present`. An invalid table or chart is dropped with an issue.
export function normalizeExploration(raw: unknown): {spec?: ExplorationSpec; issues: string[]} {
  const issues: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {issues: ['Presentation must be an object']};
  const input = raw as {tables?: unknown; charts?: unknown};
  const rawTables = Array.isArray(input.tables) ? input.tables : [];
  const rawCharts = Array.isArray(input.charts) ? input.charts : [];
  if (rawTables.length > EXPLORATION_LIMITS.tables || rawCharts.length > EXPLORATION_LIMITS.charts)
    return {issues: ['Presentation exceeds the table or chart limit']};
  const tables: TableSpec[] = [];
  for (const [i, value] of rawTables.entries()) {
    const t = value as Partial<TableSpec> | null;
    const ok =
      t &&
      validId(t.id) &&
      nonblank(t.title, 160) &&
      nonblank(t.file, 256) &&
      nonblank(t.rowKey, 128) &&
      Array.isArray(t.columns) &&
      t.columns.length > 0 &&
      t.columns.length <= EXPLORATION_LIMITS.columns &&
      !tables.some(x => x.id === t.id) &&
      t.columns.every(c => nonblank(c?.key, 128) && nonblank(c?.label, 160) && nonblank(c?.unit, 40));
    if (!ok) {
      issues.push(
        `Table ${i + 1} is invalid: it needs a unique id, title, file, rowKey and 1 to 12 columns with key, label and unit`,
      );
      continue;
    }
    tables.push({
      id: t.id!,
      title: t.title!,
      rowHeader: nonblank(t.rowHeader, 160) ? t.rowHeader : (t.rowLabel ?? t.rowKey!),
      file: t.file!,
      rowKey: t.rowKey!,
      ...(nonblank(t.rowLabel, 128) ? {rowLabel: t.rowLabel} : {}),
      columns: t.columns!.map(c => ({key: c.key, label: c.label, unit: c.unit})),
    });
  }
  const charts: ChartSpec[] = [];
  for (const [i, value] of rawCharts.entries()) {
    const c = value as Partial<ChartSpec> | null;
    const table = tables.find(t => t.id === c?.tableId);
    const shown = (key: unknown) => !!table?.columns.some(col => col.key === key);
    const ok =
      c &&
      validId(c.id) &&
      nonblank(c.title, 160) &&
      CHART_KINDS.includes(c.kind!) &&
      table &&
      Array.isArray(c.series) &&
      c.series.length > 0 &&
      c.series.length <= (c.kind === 'waterfall' ? 1 : EXPLORATION_LIMITS.series) &&
      c.series.every(shown) &&
      new Set(c.series.map(s => table.columns.find(col => col.key === s)!.unit)).size === 1 &&
      (c.kind === 'scatter' ? shown(c.x) : c.x === undefined) &&
      (c.totals === undefined ||
        (c.kind === 'waterfall' && Array.isArray(c.totals) && c.totals.every(k => nonblank(k, 128)))) &&
      !charts.some(x => x.id === c.id);
    if (!ok) {
      issues.push(
        `Chart ${i + 1} is invalid: it needs a unique id, title, kind (${CHART_KINDS.join(', ')}), an existing tableId and ` +
          '1 to 4 series of one unit (a waterfall takes one series and optional totals; a scatter also names x)',
      );
      continue;
    }
    charts.push({
      id: c.id!,
      title: c.title!,
      kind: c.kind!,
      tableId: c.tableId!,
      series: [...c.series!],
      ...(c.kind === 'scatter' ? {x: c.x} : {}),
      ...(c.totals ? {totals: [...c.totals]} : {}),
    });
  }
  return {spec: tables.length ? {schemaVersion: 1, tables, charts} : undefined, issues};
}

// Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(field), (field = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) row.push(field), rows.push(row);
  return rows;
}

// Builds delivered tables from the checkpoint's frozen result files; values are the file's, never the model's.
export async function bindExploration(
  root: string,
  checkpoint: Checkpoint,
  ref: FileRef,
): Promise<{result?: ExplorationResult; issues: string[]}> {
  const issues: string[] = [];
  const normalized = normalizeExploration(checkpoint.exploration);
  issues.push(...normalized.issues);
  if (!normalized.spec) return {issues};
  const tables: ResultTable[] = [];
  let cells = 0;
  for (const table of normalized.spec.tables) {
    const frozen = checkpoint.files.find(f => f.name === table.file);
    if (!frozen) {
      issues.push(issue(`Table ${table.id}: result file ${table.file} was not recorded`));
      continue;
    }
    const grid = parseCsv(await readFile(await safePath(root, frozen.path), 'utf8'));
    const header = grid[0] ?? [];
    const index = (name: string) => header.indexOf(name);
    const missing = [table.rowKey, ...(table.rowLabel ? [table.rowLabel] : []), ...table.columns.map(c => c.key)].find(
      name => index(name) < 0,
    );
    if (missing) {
      issues.push(issue(`Table ${table.id}: column ${missing} is not in ${basename(table.file)}`));
      continue;
    }
    const body = grid.slice(1);
    if (body.length > EXPLORATION_LIMITS.rows) {
      issues.push(issue(`Table ${table.id}: ${body.length} rows exceed the ${EXPLORATION_LIMITS.rows} row limit`));
      continue;
    }
    const keys = new Set<string>();
    let invalid = '';
    const rows = body.map(r => {
      const key = (r[index(table.rowKey)] ?? '').trim();
      if (!key || keys.has(key)) invalid = `Table ${table.id}: row key column ${table.rowKey} is blank or repeats`;
      keys.add(key);
      const cellsOut: Record<string, ResultCell> = {};
      for (const column of table.columns) {
        const text = (r[index(column.key)] ?? '').trim();
        if (text === '') cellsOut[column.key] = {value: null, status: 'held', reason: 'blank in the result file'};
        else if (Number.isFinite(Number(text))) cellsOut[column.key] = {value: Number(text), status: 'approved'};
        else cellsOut[column.key] = {value: null, status: 'approved', text: text.slice(0, 200)};
      }
      const label = table.rowLabel ? (r[index(table.rowLabel)] ?? '').trim() || key : key;
      return {key, label, cells: cellsOut};
    });
    cells += rows.length * table.columns.length;
    if (invalid) issues.push(issue(invalid));
    else if (cells > EXPLORATION_LIMITS.cells) issues.push(issue(`Table ${table.id}: cell limit exceeded`));
    else
      tables.push({
        id: table.id,
        title: table.title,
        rowHeader: table.rowHeader,
        columns: table.columns,
        rows,
      });
  }
  const valid = new Set(tables.map(t => t.id));
  const charts = normalized.spec.charts.filter(chart => {
    if (!valid.has(chart.tableId)) {
      issues.push(issue(`Chart ${chart.id} omitted because its table is unavailable`));
      return false;
    }
    const rows = tables.find(t => t.id === chart.tableId)!.rows;
    const text = [...chart.series, ...(chart.x ? [chart.x] : [])].find(key =>
      rows.some(r => r.cells[key]?.text !== undefined),
    );
    const unknown = chart.totals?.find(key => !rows.some(r => r.key === key));
    if (!text && !unknown) return true;
    issues.push(
      issue(
        text
          ? `Chart ${chart.id} omitted because ${text} holds text, not numbers`
          : `Chart ${chart.id} omitted because total row ${unknown} is not a row key of its table`,
      ),
    );
    return false;
  });
  if (!tables.length) return {issues};
  const result: ExplorationResult = {
    schemaVersion: 1,
    runId: checkpoint.runId,
    checkpoint: structuredClone(ref),
    coverage: [],
    tables,
    charts,
  };
  if (utf8Size(result) > EXPLORATION_LIMITS.bytes) return {issues: [...issues, 'Presentation exceeds 1 MiB']};
  return {result, issues};
}
