import {afterEach, expect, it} from 'vitest';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {loadConfig} from '../../src/runtime.js';
const dirs: string[] = [];
const fixture = (value: unknown) => {
  const dir = mkdtempSync(join(tmpdir(), 'pricing-settings-'));
  dirs.push(dir);
  const path = join(dir, 'settings.json');
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value));
  return path;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, {recursive: true, force: true});
});
const base = {PRICING_WORKSPACE: '/tmp/pricing-settings', PRICING_PYTHON: '/usr/bin/python3'};
const settings = {
  schemaVersion: 1,
  model: {provider: 'openrouter', id: 'deepseek/deepseek-v4.1-flash', thinkingLevel: 'high'},
  workflow: {limits: {seconds: 600, modelAttempts: 100, toolCalls: 60}},
  runtime: {port: 4318, duckdbMemory: '2GB', duckdbThreads: 2},
};
it('keeps the shipped per-turn budget and call caps', () => {
  const config = loadConfig({...base, PRICING_CONFIG_FILE: resolve('harness.config.json')});
  expect(config.workflowLimits).toEqual({milliseconds: 900000, model: 100, tool: 150});
});
it('loads model and budgets from one file and allows an explicit one-off environment override', () => {
  const path = fixture(settings);
  const config = loadConfig({...base, PRICING_CONFIG_FILE: path});
  expect(config.modelId).toBe('deepseek/deepseek-v4.1-flash');
  expect(config.thinkingLevel).toBe('high');
  expect(config.port).toBe(4318);
  expect(config.duckdbMemoryLimit).toBe('2GB');
  expect(config.workflowLimits).toEqual({milliseconds: 600000, model: 100, tool: 60});
  expect(
    loadConfig({
      ...base,
      PRICING_CONFIG_FILE: path,
      PRICING_MODEL: 'openai/gpt-6-luna',
      PRICING_ANALYSIS_SECONDS: '900',
    }).workflowLimits.milliseconds,
  ).toBe(900000);
  expect(loadConfig({...base, PRICING_CONFIG_FILE: path, PRICING_MODEL: 'openai/gpt-6-luna'}).modelId).toBe(
    'openai/gpt-6-luna',
  );
});
it('applies file edits on the next load without rebuilding', () => {
  const path = fixture(settings);
  loadConfig({...base, PRICING_CONFIG_FILE: path});
  writeFileSync(
    path,
    JSON.stringify({...settings, workflow: {limits: {seconds: 700, modelAttempts: 40, toolCalls: 50}}}),
  );
  expect(loadConfig({...base, PRICING_CONFIG_FILE: path}).workflowLimits).toEqual({
    milliseconds: 700000,
    model: 40,
    tool: 50,
  });
});
it('rejects malformed, unknown and invalid file settings instead of silently ignoring typos', () => {
  for (const bad of [
    '{',
    {...settings, workflow: null},
    {...settings, secret: 'no'},
    {...settings, workflow: {limits: {second: 600}}},
    {...settings, workflow: {limits: {seconds: 0}}},
    {...settings, runtime: {port: '4318'}},
  ])
    expect(() => loadConfig({...base, PRICING_CONFIG_FILE: fixture(bad)})).toThrow(/config|settings/i);
  expect(() => loadConfig({...base, PRICING_CONFIG_FILE: '/tmp/pricing-settings-does-not-exist.json'})).toThrow();
});
it('rejects retired workflow settings', () => {
  for (const workflow of [{mode: 'bounded'}, {policy: {retry: 1}}, {review: {}}, {limits: {analysis: {seconds: 600}}}])
    expect(() => loadConfig({...base, PRICING_CONFIG_FILE: fixture({...settings, workflow})})).toThrow(
      /Unknown settings key|Invalid settings/,
    );
});
