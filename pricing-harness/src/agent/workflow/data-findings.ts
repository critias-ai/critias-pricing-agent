import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import type {HarnessConfig} from '../../runtime.js';
import type {SourceFile} from '../../contracts.js';
import {analysisEnvironment} from '../session.js';
const exec = promisify(execFile);
export type DataFinding = {
  id: string;
  detector: string;
  source: string;
  column: string;
  issue: string;
  rows: number;
  valueAtStake: number | null;
  valueColumn: string | null;
  examples: (string | null)[];
  fix: string | null;
  exact: boolean;
};
// Per source: whether it was read, its money-like columns, and what each detector did ('ran' or 'skipped: why').
export type Coverage = {
  source: string;
  status: string;
  reason?: string;
  valueColumns: string[];
  detectors: Record<string, string>;
};
export type DataFindings = {findingsDir: string; findings: DataFinding[]; coverage?: Coverage[]};
// Python caches findings by source content, so repeat runs are cheap; sources are passed workspace-relative.
export function createFindingDetector(
  config: Pick<HarnessConfig, 'pythonPath' | 'bundledRoot' | 'workspaceRoot'>,
  cacheRoot: string,
) {
  return async (sources: SourceFile[]): Promise<DataFindings | undefined> => {
    const tables = sources.filter(s => s.kind === 'csv' || s.kind === 'xlsx');
    if (!tables.length) return undefined;
    const script = join(config.bundledRoot, 'harness-tools/data_findings.py');
    const {stdout} = await exec(
      config.pythonPath,
      [script, '--cache', cacheRoot, ...tables.flatMap(s => ['--source', s.relativePath])],
      {
        cwd: config.workspaceRoot,
        timeout: 600000,
        maxBuffer: 64 * 1024 * 1024,
        env: analysisEnvironment(process.env),
      },
    ).catch((e: Error & {stderr?: string}) => {
      throw new Error(e.stderr?.trim().split('\n').pop() || e.message);
    });
    const {findingsDir, findings, coverage} = JSON.parse(stdout) as DataFindings;
    return {findingsDir, findings, coverage};
  };
}
// Prompt form: findings arrive largest value at stake first within each detector; interleave detectors so the cut falls on every
// detector's tail, clip long strings, and keep a prefix within maxChars. The full list stays on disk. Gaps (sources not read,
// detectors that could not run) always stay, so a silent skip never reads as a clean source.
export function compactFindings(result: DataFindings, maxChars = 12000) {
  const gaps = (result.coverage ?? []).flatMap(c => {
    const skipped = Object.entries(c.detectors).filter(([, v]) => v !== 'ran' && v !== 'skipped: not read');
    if (c.status !== 'ran') return [`${c.source}: not read (${c.reason})`];
    return skipped.length ? [`${c.source}: ${skipped.map(([d, v]) => `${d} ${v}`).join('; ')}`] : [];
  });
  const seen: Record<string, number> = {};
  const findings = result.findings
    .map(f => ({f, depth: (seen[f.detector] = (seen[f.detector] ?? 0) + 1)}))
    .sort((a, b) => a.depth - b.depth)
    .map(({f}) => ({...f, issue: f.issue.slice(0, 80), examples: f.examples.map(e => e?.slice(0, 40) ?? null)}));
  while (findings.length && JSON.stringify({findings, gaps}).length > maxChars) findings.pop();
  return {findingsDir: result.findingsDir, total: result.findings.length, findings, gaps};
}
export type CompactFindings = ReturnType<typeof compactFindings>;
