import type {FileRef} from './agent/workflow/contracts.js';

// A table is a column selection from a result file written by an executed query or script.
export type ExplorationSpec = {schemaVersion: 1; tables: TableSpec[]; charts: ChartSpec[]};
export type TableSpec = {
  id: string;
  title: string;
  rowHeader: string;
  file: string; // CSV in the analyst's working folder
  rowKey: string; // column that identifies a row
  rowLabel?: string; // column shown as the row name; defaults to rowKey
  columns: {key: string; label: string; unit: string}[]; // key = CSV column header
};
export const CHART_KINDS = ['line', 'bar', 'stacked', 'waterfall', 'scatter'] as const;
export type ChartSpec = {
  id: string;
  title: string;
  kind: (typeof CHART_KINDS)[number];
  tableId: string;
  series: string[]; // y columns, one unit
  x?: string; // scatter: numeric column for the horizontal axis
  totals?: string[]; // waterfall: row keys drawn from zero as levels; other rows are steps from the running total
};
export type ResultCell = {value: number | null; status: 'approved' | 'held'; reason?: string; text?: string};
export type ResultTable = {
  id: string;
  title: string;
  rowHeader: string;
  columns: {key: string; label: string; unit: string}[];
  rows: {key: string; label: string; cells: Record<string, ResultCell>}[];
};
export type ExplorationResult = {
  schemaVersion: 1;
  runId: string;
  checkpoint: FileRef;
  coverage: string[];
  tables: ResultTable[];
  charts: ChartSpec[];
};

export const EXPLORATION_LIMITS = Object.freeze({
  tables: 4,
  charts: 4,
  columns: 12,
  rows: 1_000,
  cells: 5_000,
  series: 4,
  bytes: 1_048_576,
});
