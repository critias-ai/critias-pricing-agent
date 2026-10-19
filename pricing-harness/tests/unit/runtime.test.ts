import {afterEach, describe, expect, it, vi} from 'vitest';
import {loadConfig} from '../../src/runtime.js';
import {checkRuntime, resolveModel, type HarnessConfig} from '../../src/runtime.js';
import {resolve} from 'node:path';
import {venvPython} from '../fixtures/venv-python.js';
const env = {
  PRICING_WORKSPACE: '/tmp/pricing test',
  PRICING_PROVIDER: 'openrouter',
  PRICING_MODEL: 'explicit/model',
  PRICING_PYTHON: '/usr/bin/python3',
};
describe('configuration', () => {
  it('reports only agent and Python readiness', async () => {
    const health = await checkRuntime(loadConfig({...env, PRICING_PYTHON: venvPython}));
    expect(health.python.ready).toBe(true);
    expect(Object.keys(health).sort()).toEqual(['agent', 'python']);
  });
  it('reads the per-turn limits from the environment and rejects invalid values', () => {
    const config = loadConfig({
      ...env,
      PRICING_ANALYSIS_SECONDS: '600',
      PRICING_ANALYSIS_MODEL_ATTEMPTS: '10',
      PRICING_ANALYSIS_TOOL_CALLS: '20',
    });
    expect(config.workflowLimits).toEqual({milliseconds: 600000, model: 10, tool: 20});
    for (const value of ['0', '-1', '1.5', 'invalid'])
      expect(() => loadConfig({...env, PRICING_ANALYSIS_SECONDS: value})).toThrow(/PRICING_ANALYSIS_SECONDS/);
  });
  it('requires an explicit model and interpreter', () => {
    expect(() => loadConfig({...env, PRICING_MODEL: ''})).toThrow(/PRICING_MODEL/);
    expect(() => loadConfig({...env, PRICING_PYTHON: 'python'})).toThrow(/absolute/);
  });
  it('uses bounded local defaults and an installation-relative bundle', () => {
    const config = loadConfig(env);
    expect(config.port).toBe(4317);
    expect(config.duckdbMemoryLimit).toBe('4GB');
    expect(config.bundledRoot).toMatch(/pricing-harness[\\/]bundled$/);
    expect(() => loadConfig({...env, PRICING_PORT: '-3'})).toThrow(/PRICING_PORT/);
    expect(() => loadConfig({...env, PRICING_PROVIDER: 'other'})).toThrow(/openrouter, openai/);
  });
  it('accepts an explicit reasoning level and rejects unknown values', () => {
    expect(loadConfig({...env, PRICING_THINKING_LEVEL: 'high'}).thinkingLevel).toBe('high');
    expect(() => loadConfig({...env, PRICING_THINKING_LEVEL: 'unknown'})).toThrow(/PRICING_THINKING_LEVEL/);
  });
});

describe('a model newer than Pi’s catalogue', () => {
  const config = {
    provider: 'openrouter',
    modelId: 'anthropic/claude-haiku-5.5',
    maxOutputTokens: 8000,
  } as HarnessConfig;
  afterEach(() => vi.unstubAllGlobals());
  it('takes its price from OpenRouter, at the dearest tier, in USD per million tokens', async () => {
    const pricing = {
      prompt: '0.0000001',
      completion: '0.0000005',
      input_cache_read: '0.00000001',
      input_cache_write: '0.000000125',
      overrides: [
        {
          min_prompt_tokens: 100000,
          prompt: '0.0000005',
          completion: '0.0000025',
          input_cache_read: '0.00000005',
          input_cache_write: '0.000000625',
        },
      ],
    };
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({data: [{id: config.modelId, pricing}]})));
    const {model} = await resolveModel(config);
    const expected = {input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625};
    for (const [k, v] of Object.entries(expected)) expect(model.cost[k as keyof typeof expected]).toBeCloseTo(v, 10);
  });
  it('keeps a zero price when OpenRouter cannot be reached', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    const {model} = await resolveModel(config);
    expect(model.cost).toEqual({input: 0, output: 0, cacheRead: 0, cacheWrite: 0});
  });
});
