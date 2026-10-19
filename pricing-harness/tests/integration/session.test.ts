import {expect, it} from 'vitest';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {ModelRuntime} from '@earendil-works/pi-coding-agent';
import {loadConfig} from '../../src/runtime.js';
import {validateBundle} from '../../src/agent/bundle.js';
it('loads only packaged skills despite ambient resources, then resumes a matching bundle', async () => {
  const {createPricingSession} = await import('../../src/agent/session.js');
  const root = await mkdtemp(join(tmpdir(), 'session '));
  await mkdir(join(root, '.pi/skills/unwanted'), {recursive: true});
  await writeFile(join(root, '.pi/skills/unwanted/SKILL.md'), '---\nname: unwanted\ndescription: ambient skill\n---\n');
  const runtime = await ModelRuntime.create({modelsPath: null, refreshOnCreate: false});
  const model = runtime.getModel('openrouter', 'openai/gpt-6-luna')!;
  const env = {
    PRICING_WORKSPACE: root,
    PRICING_PROVIDER: 'openrouter',
    PRICING_MODEL: model.id,
    PRICING_PYTHON: '/usr/bin/python3',
  };
  const config = loadConfig({...env, PRICING_THINKING_LEVEL: 'low'});
  const bundle = await validateBundle(config.bundledRoot, {requireVisualization: false});
  const handle = await createPricingSession({config, bundle, modelRuntime: runtime, model, fresh: true});
  expect(handle.session.getActiveToolNames().sort()).toEqual(['bash', 'edit', 'read', 'write']);
  expect(handle.session.thinkingLevel).toBe('low');
  expect(handle.session.systemPrompt).toContain('pricing-analyze');
  expect(handle.session.systemPrompt).not.toContain('unwanted');
  handle.manager.appendMessage({role: 'user', content: 'test seed', timestamp: Date.now()});
  handle.manager.appendMessage({
    role: 'assistant',
    content: [{type: 'text', text: 'seed complete'}],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0},
    },
    stopReason: 'stop',
    timestamp: Date.now(),
  });
  const id = handle.session.sessionId;
  handle.session.dispose();
  const resumed = await createPricingSession({
    config: loadConfig({...env, PRICING_THINKING_LEVEL: 'high'}),
    bundle,
    modelRuntime: runtime,
    model,
    fresh: false,
  });
  expect(resumed.session.sessionId).toBe(id);
  expect(resumed.session.thinkingLevel).toBe('high');
  resumed.session.dispose();
  const changed = await createPricingSession({
    config,
    bundle: {...bundle, fingerprint: 'changed'},
    modelRuntime: runtime,
    model,
    fresh: false,
  });
  expect(changed.session.sessionId).not.toBe(id);
  changed.session.dispose();
});
it('resolves role file tools inside the assigned stage directory', async () => {
  const {createPricingSession} = await import('../../src/agent/session.js');
  const root = await mkdtemp(join(tmpdir(), 'role-session-')),
    stage = join(root, 'analyses/stage');
  await mkdir(stage, {recursive: true});
  const runtime = await ModelRuntime.create({modelsPath: null, refreshOnCreate: false});
  const model = runtime.getModel('openrouter', 'openai/gpt-6-luna')!;
  const config = loadConfig({
    PRICING_WORKSPACE: root,
    PRICING_PROVIDER: 'openrouter',
    PRICING_MODEL: model.id,
    PRICING_PYTHON: '/usr/bin/python3',
    PRICING_THINKING_LEVEL: 'high',
  });
  const bundle = await validateBundle(config.bundledRoot, {requireVisualization: false});
  const handle = await createPricingSession({
    config,
    bundle,
    modelRuntime: runtime,
    model,
    fresh: true,
    stage: {directory: stage, systemPrompt: 'Scoped role fixture.', tools: [], toolNames: ['read', 'write']},
  });
  const write = handle.session.agent.state.tools.find(t => t.name === 'write')!;
  await write.execute('fixture', {path: 'result.txt', content: 'scoped'}, new AbortController().signal);
  const {readFile} = await import('node:fs/promises');
  expect(await readFile(join(stage, 'result.txt'), 'utf8')).toBe('scoped');
  await expect(readFile(join(root, 'result.txt'))).rejects.toThrow();
  handle.session.dispose();
});
it('continues a stage session across turns with compaction on, and starts over only when asked', async () => {
  const {createPricingSession} = await import('../../src/agent/session.js');
  const root = await mkdtemp(join(tmpdir(), 'stage-session-')),
    directory = join(root, '.pricing/workflow/chat/analyst');
  await mkdir(directory, {recursive: true});
  const runtime = await ModelRuntime.create({modelsPath: null, refreshOnCreate: false});
  const model = runtime.getModel('openrouter', 'openai/gpt-6-luna')!;
  const config = loadConfig({
    PRICING_WORKSPACE: root,
    PRICING_PROVIDER: 'openrouter',
    PRICING_MODEL: model.id,
    PRICING_PYTHON: '/usr/bin/python3',
  });
  const bundle = await validateBundle(config.bundledRoot, {requireVisualization: false});
  const open = (fresh: boolean) =>
    createPricingSession({
      config,
      bundle,
      modelRuntime: runtime,
      model,
      fresh,
      stage: {directory, systemPrompt: 'Analyst fixture.', tools: [], toolNames: ['read']},
    });
  const first = await open(true);
  expect(first.session.autoCompactionEnabled).toBe(true);
  first.manager.appendMessage({role: 'user', content: 'first question', timestamp: Date.now()});
  const file = first.manager.getSessionFile();
  first.session.dispose();
  const second = await open(false);
  expect(second.manager.getSessionFile()).toBe(file);
  expect(second.session.messages.map(m => m.role)).toEqual(['user']);
  second.session.dispose();
  const third = await open(true);
  expect(third.manager.getSessionFile()).not.toBe(file);
  expect(third.session.messages).toEqual([]);
  third.session.dispose();
});
