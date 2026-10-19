import {PROVIDERS, THINKING_LEVELS} from './defaults.js';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export type HarnessSettings = {
  schemaVersion: 1;
  model?: {provider?: string; id?: string; thinkingLevel?: string};
  runtime?: {port?: number; maxUploadBytes?: number; duckdbMemory?: string; duckdbThreads?: number};
  workflow?: {limits?: {seconds?: number; modelAttempts?: number; toolCalls?: number}};
  evaluation?: {
    manifestPath: string;
    evidenceFolder: string;
    maxBatchSeconds: number;
    maxEstimatedCostUSD: number;
    model?: {provider: string; id: string; thinkingLevel: string};
  };
};
function object(value: unknown, path: string, keys: string[]): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`Invalid settings object: ${path}`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw Error(`Unknown settings key: ${path}.${key}`);
  return value as Record<string, any>;
}
function number(value: unknown, path: string, min = 1, integer = true) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || (integer && !Number.isSafeInteger(value)))
    throw Error(`Invalid settings number: ${path}`);
}
function text(value: unknown, path: string) {
  if (typeof value !== 'string' || !value.trim()) throw Error(`Invalid settings text: ${path}`);
}
export function readHarnessSettings(path: string): HarnessSettings {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw Error(`Cannot read valid config JSON: ${path}`);
  }
  const s = object(raw, 'config', ['schemaVersion', 'model', 'runtime', 'workflow', 'evaluation']);
  if (s.schemaVersion !== 1) throw Error('Invalid config.schemaVersion');
  const model = (m: unknown, path: string) => {
    const o = object(m, path, ['provider', 'id', 'thinkingLevel']);
    for (const [key, value] of Object.entries(o)) text(value, `${path}.${key}`);
    if (o.provider !== undefined && !(PROVIDERS as readonly string[]).includes(o.provider))
      throw Error(`Invalid settings ${path}.provider`);
    if (o.thinkingLevel !== undefined && !(THINKING_LEVELS as readonly string[]).includes(o.thinkingLevel))
      throw Error(`Invalid settings ${path}.thinkingLevel`);
  };
  if (s.model !== undefined) model(s.model, 'model');
  if (s.runtime !== undefined) {
    const r = object(s.runtime, 'runtime', ['port', 'maxUploadBytes', 'duckdbMemory', 'duckdbThreads']);
    for (const [k, v] of Object.entries(r)) k === 'duckdbMemory' ? text(v, `runtime.${k}`) : number(v, `runtime.${k}`);
    if (r.port > 65535) throw Error('Invalid settings runtime.port');
  }
  if (s.workflow !== undefined) {
    const w = object(s.workflow, 'workflow', ['limits']);
    if (w.limits !== undefined)
      for (const [k, v] of Object.entries(
        object(w.limits, 'workflow.limits', ['seconds', 'modelAttempts', 'toolCalls']),
      ))
        number(v, `workflow.limits.${k}`);
  }
  if (s.evaluation !== undefined) {
    const e = object(s.evaluation, 'evaluation', [
      'manifestPath',
      'evidenceFolder',
      'maxBatchSeconds',
      'maxEstimatedCostUSD',
      'model',
    ]);
    text(e.manifestPath, 'evaluation.manifestPath');
    text(e.evidenceFolder, 'evaluation.evidenceFolder');
    number(e.maxBatchSeconds, 'evaluation.maxBatchSeconds');
    number(e.maxEstimatedCostUSD, 'evaluation.maxEstimatedCostUSD', Number.MIN_VALUE, false);
    if (e.model !== undefined) {
      model(e.model, 'evaluation.model');
      for (const k of ['provider', 'id', 'thinkingLevel']) text(e.model[k], `evaluation.model.${k}`);
    }
  }
  return s as HarnessSettings;
}
export function settingsForRuntime(env: NodeJS.ProcessEnv, appRoot: string) {
  const chosen = env.PRICING_CONFIG_FILE;
  const path = chosen ? resolve(chosen) : resolve(appRoot, 'harness.config.json');
  const settings = chosen === '' || (!chosen && !existsSync(path)) ? undefined : readHarnessSettings(path);
  const values: NodeJS.ProcessEnv = {};
  const put = (key: string, value: unknown) => {
    if (value !== undefined) values[key] = String(value);
  };
  for (const [key, value] of Object.entries(settings?.model ?? {}))
    put({provider: 'PRICING_PROVIDER', id: 'PRICING_MODEL', thinkingLevel: 'PRICING_THINKING_LEVEL'}[key]!, value);
  for (const [key, value] of Object.entries(settings?.runtime ?? {}))
    put(
      {
        port: 'PRICING_PORT',
        maxUploadBytes: 'PRICING_MAX_UPLOAD_BYTES',
        duckdbMemory: 'PRICING_DUCKDB_MEMORY',
        duckdbThreads: 'PRICING_DUCKDB_THREADS',
      }[key]!,
      value,
    );
  for (const [key, value] of Object.entries(settings?.workflow?.limits ?? {}))
    put(`PRICING_ANALYSIS_${key.replace(/[A-Z]/g, c => '_' + c).toUpperCase()}`, value);
  return {env: {...values, ...env}, configFile: settings ? path : undefined};
}
