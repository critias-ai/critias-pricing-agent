import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import type {HarnessConfig} from '../../runtime.js';
import type {SourceFile} from '../../contracts.js';
import {analysisEnvironment} from '../session.js';
const exec = promisify(execFile);
export type ColumnProfile = {
  name: string;
  inferredType: string;
  nonNull: number;
  blank: number;
  distinctApprox: number;
  castFailures: number;
  thousandsSeparatorValues: number;
  leadingZeroValues: number;
  exponentValues: number;
  min: string | null;
  max: string | null;
  topValues: {value: string; count: number}[];
};
export type SheetProfile = {
  schemaVersion: 1;
  sheet?: string | null;
  error?: string;
  rowCount?: number;
  columnCount?: number;
  profiledColumns?: number;
  columns?: ColumnProfile[];
};
export type SourceProfile =
  | {path: string; sha256: string; kind: SourceFile['kind']; profiles: SheetProfile[]}
  | {path: string; sha256: string; kind: SourceFile['kind']; error: string};
const memo = new Map<string, SourceProfile>();
// Profiles are parsing facts keyed by content hash; a failed profile never blocks analysis.
export function createSourceProfiler(
  config: Pick<HarnessConfig, 'pythonPath' | 'bundledRoot' | 'workspaceRoot'>,
  cacheRoot: string,
) {
  return async (sources: SourceFile[], signal?: AbortSignal): Promise<SourceProfile[]> => {
    const results: SourceProfile[] = [];
    for (const source of sources) {
      if (signal?.aborted) throw new Error('cancelled');
      if (source.kind !== 'csv' && source.kind !== 'xlsx') continue;
      const key = `${source.sha256}:${source.kind}`,
        known = memo.get(key);
      if (known) {
        results.push({...known, path: source.relativePath});
        continue;
      }
      try {
        const {stdout} = await exec(
          config.pythonPath,
          [
            join(config.bundledRoot, 'harness-tools/profile_source.py'),
            '--source',
            join(config.workspaceRoot, source.relativePath),
            '--cache',
            cacheRoot,
            '--format',
            source.kind,
          ],
          {timeout: 300000, maxBuffer: 16 * 1024 * 1024, env: analysisEnvironment(process.env), signal},
        );
        const profile: SourceProfile = {
          path: source.relativePath,
          sha256: source.sha256,
          kind: source.kind,
          profiles: (JSON.parse(stdout) as {profiles: SheetProfile[]}).profiles,
        };
        memo.set(key, profile);
        results.push(profile);
      } catch (error) {
        if (signal?.aborted) throw new Error('cancelled');
        // A failure is a fact about this content too: remember it so a hostile or huge file costs one attempt.
        const failed: SourceProfile = {
          path: source.relativePath,
          sha256: source.sha256,
          kind: source.kind,
          error: String((error as Error).message).slice(0, 300),
        };
        memo.set(key, failed);
        results.push(failed);
      }
    }
    return results;
  };
}
// Prompt form: one row per column under columnFields. Flags lists non-zero parsing counters and is omitted when none.
export const profileColumnFields = [
  'name',
  'inferredType',
  'nonNull',
  'blank',
  'distinctApprox',
  'min',
  'max',
  'sampleValues',
  'flags',
] as const;
type PromptSheet = Omit<SheetProfile, 'columns'> & {columnFields?: typeof profileColumnFields; columns?: unknown[][]};
export type PromptProfile =
  | {path: string; sha256: string; kind: SourceFile['kind']; profiles: PromptSheet[]}
  | {path: string; sha256: string; kind: SourceFile['kind']; error: string};
const flagNames = ['castFailures', 'thousandsSeparatorValues', 'leadingZeroValues', 'exponentValues'] as const;
const clip = (value: string | null) => (value !== null && value.length > 40 ? value.slice(0, 40) + '…' : value);
function encode(profiles: SourceProfile[], samples: number, maxColumns: number): PromptProfile[] {
  return profiles.map(p => {
    if (!('profiles' in p)) return p;
    return {
      ...p,
      profiles: p.profiles.map(({columns, ...sheet}) => {
        if (!columns) return sheet;
        const kept = columns.slice(0, maxColumns);
        return {
          ...sheet,
          ...(kept.length < columns.length ? {profiledColumns: kept.length} : {}),
          columnFields: profileColumnFields,
          columns: kept.map(c => {
            const flags = Object.fromEntries(flagNames.filter(k => c[k]).map(k => [k, c[k]]));
            const row: unknown[] = [
              c.name,
              c.inferredType,
              c.nonNull,
              c.blank,
              c.distinctApprox,
              clip(c.min),
              clip(c.max),
              c.topValues.slice(0, samples).map(t => clip(t.value)),
            ];
            return Object.keys(flags).length ? [...row, flags] : row;
          }),
        };
      }),
    };
  });
}
// Keep prompt size bounded: drop sample values before dropping columns of wide sheets.
export function compactProfiles(profiles: SourceProfile[], maxChars = 40000): PromptProfile[] {
  const size = (p: PromptProfile[]) => JSON.stringify(p).length;
  let current = encode(profiles, 5, Infinity);
  for (let samples = 4; samples >= 0 && size(current) > maxChars; samples--)
    current = encode(profiles, samples, Infinity);
  if (size(current) > maxChars) current = encode(profiles, 0, 50);
  return current;
}
