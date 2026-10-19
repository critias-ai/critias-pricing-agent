import {DEFAULT_LIMITS, PROVIDERS, THINKING_LEVELS} from './defaults.js';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {dirname, isAbsolute, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ModelRuntime, type CreateAgentSessionOptions} from '@earendil-works/pi-coding-agent';
import {settingsForRuntime} from './settings.js';
import type {Limits} from './agent/workflow/budget.js';
export type HarnessConfig = {
  configFile?: string;
  workflowLimits: Limits;
  workspaceRoot: string;
  appRoot: string;
  bundledRoot: string;
  provider: string;
  modelId: string;
  thinkingLevel?: NonNullable<CreateAgentSessionOptions['thinkingLevel']>;
  pythonPath: string;
  port: number;
  maxUploadBytes: number;
  duckdbMemoryLimit: string;
  duckdbThreads: number;
  maxOutputTokens: number; // per model call, reasoning included
};
export type Capability = {ready: boolean; detail: string};
export type Health = {
  agent: Capability;
  python: Capability;
};
export function loadConfig(env: NodeJS.ProcessEnv = process.env): HarnessConfig {
  const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const settings = settingsForRuntime(env, appRoot);
  env = settings.env;
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} is required`);
    return value;
  };
  const absolute = (name: string) => {
    const value = required(name);
    if (!isAbsolute(value)) throw new Error(`${name} must be absolute`);
    return resolve(value);
  };
  const integer = (name: string, fallback: number, max = Number.MAX_SAFE_INTEGER) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > max)
      throw new Error(`${name} must be a positive integer <= ${max}`);
    return value;
  };
  const provider = required('PRICING_PROVIDER');
  if (!(PROVIDERS as readonly string[]).includes(provider))
    throw new Error(`PRICING_PROVIDER must be one of ${PROVIDERS.join(', ')}`);
  const thinkingLevel = env.PRICING_THINKING_LEVEL?.trim() || undefined;
  if (thinkingLevel && !(THINKING_LEVELS as readonly string[]).includes(thinkingLevel))
    throw new Error('PRICING_THINKING_LEVEL must be off, minimal, low, medium, high, xhigh or max');
  const workflowLimits = {
    milliseconds: integer('PRICING_ANALYSIS_SECONDS', DEFAULT_LIMITS.seconds) * 1000,
    model: integer('PRICING_ANALYSIS_MODEL_ATTEMPTS', DEFAULT_LIMITS.modelAttempts),
    tool: integer('PRICING_ANALYSIS_TOOL_CALLS', DEFAULT_LIMITS.toolCalls),
  };
  return {
    configFile: settings.configFile,
    workflowLimits,
    workspaceRoot: absolute('PRICING_WORKSPACE'),
    appRoot,
    bundledRoot: resolve(appRoot, 'bundled'),
    provider,
    modelId: required('PRICING_MODEL'),
    thinkingLevel: thinkingLevel as HarnessConfig['thinkingLevel'],
    pythonPath: absolute('PRICING_PYTHON'),
    port: integer('PRICING_PORT', 4317, 65535),
    maxUploadBytes: integer('PRICING_MAX_UPLOAD_BYTES', 2 * 1024 ** 3),
    duckdbMemoryLimit: env.PRICING_DUCKDB_MEMORY ?? '4GB',
    duckdbThreads: integer('PRICING_DUCKDB_THREADS', 4),
    maxOutputTokens: integer('PRICING_MAX_OUTPUT_TOKENS', 32000),
  };
}
// USD per million tokens, at the dearest of the model's prompt-length tiers, so a spending cap stops early, not late.
async function openRouterCost(id: string) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {signal: AbortSignal.timeout(10000)});
    const pricing = ((await response.json()) as {data: {id: string; pricing: Record<string, any>}[]}).data.find(
      m => m.id === id,
    )?.pricing;
    if (!pricing) return undefined;
    const tiers = [pricing, ...(pricing.overrides ?? [])];
    const price = (key: string) => Math.max(0, ...tiers.map(t => Number(t[key] ?? 0) * 1e6).filter(Number.isFinite));
    return {
      input: price('prompt'),
      output: price('completion'),
      cacheRead: price('input_cache_read'),
      cacheWrite: price('input_cache_write'),
    };
  } catch {
    return undefined;
  }
}
export async function resolveModel(config: HarnessConfig) {
  // Pi's own store on ~/.pi/agent/auth.json: it can save the refreshed token of a "Sign in with ChatGPT" login.
  const runtime = await ModelRuntime.create({modelsPath: null, allowModelNetwork: false});
  // An ID newer than Pi's bundled catalog (such as a new OpenRouter model) borrows the provider's connection settings
  // from a catalog entry of the same vendor (the part before "/"). Its price comes from OpenRouter's public model list;
  // anywhere else, or offline, it is unknown and cost estimates read zero.
  const known = runtime.getModels(config.provider);
  const vendor = config.modelId.split('/')[0] + '/';
  const template = known.find(m => m.id.startsWith(vendor)) ?? known[0];
  const model =
    runtime.getModel(config.provider, config.modelId) ??
    (template && {
      ...template,
      id: config.modelId,
      name: config.modelId,
      cost: (config.provider === 'openrouter' && (await openRouterCost(config.modelId))) || {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
    });
  if (!model) throw new Error(`No models known for provider ${config.provider}`);
  // A call that loops can otherwise stream to the model's own limit (128k tokens, about 11 minutes) before stopping.
  const capped = {...model, maxTokens: Math.min(model.maxTokens || config.maxOutputTokens, config.maxOutputTokens)};
  return {runtime, model: capped as NonNullable<CreateAgentSessionOptions['model']>};
}
export async function checkRuntime(config: HarnessConfig): Promise<Health> {
  const run = promisify(execFile);
  const check = async (code: string): Promise<Capability> => {
    try {
      await run(config.pythonPath, ['-c', code], {timeout: 15000, maxBuffer: 16384});
      return {ready: true, detail: 'Available'};
    } catch {
      return {ready: false, detail: 'Unavailable in configured Python; run the documented setup.'};
    }
  };
  const python = await check('import duckdb, pandas, openpyxl');
  let agent: Capability = {ready: false, detail: 'Model or provider credentials unavailable'};
  try {
    const {runtime} = await resolveModel(config);
    agent = {
      ready: runtime.hasConfiguredAuth(config.provider),
      detail: runtime.hasConfiguredAuth(config.provider)
        ? 'Configured; provider requests may still fail'
        : `Configure ${config.provider === 'openai' ? 'OPENAI_API_KEY' : 'OPENROUTER_API_KEY'} locally or Pi stored credentials`,
    };
  } catch (error) {
    agent.detail = (error as Error).message;
  }
  return {agent, python};
}
// Paths shown to the analyst use forward slashes: Git Bash on Windows drops unquoted backslashes, and Python and
// Windows both accept forward slashes.
export const toShellPath = (path: string) => (process.platform === 'win32' ? path.replaceAll('\\', '/') : path);
