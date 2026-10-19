import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {main} from './eval-focused-workflow.mjs';
const appRoot = resolve(import.meta.dirname, '..');
export function validateConfiguredManifest(m) {
  if (
    m.schemaVersion !== 1 ||
    m.execution !== 'sequential' ||
    m.automaticRecoveryMessages !== 0 ||
    !Array.isArray(m.scenarios) ||
    !m.scenarios.length
  )
    throw Error('Configured evaluation requires sequential scenarios with no automatic recovery messages');
  const turns = [];
  const ids = new Set();
  for (const s of m.scenarios) {
    if (
      typeof s.id !== 'string' ||
      !/^F\d+$/.test(s.id) ||
      ids.has(s.id) ||
      typeof s.workspaceGroup !== 'string' ||
      !/^[a-zA-Z0-9_-]+$/.test(s.workspaceGroup) ||
      typeof s.warm !== 'boolean' ||
      !Array.isArray(s.messages) ||
      !s.messages.length ||
      s.messages.some(p => typeof p !== 'string' || !p.trim())
    )
      throw Error('Invalid configured evaluation scenario');
    ids.add(s.id);
    turns.push(
      ...s.messages.map((prompt, i) => ({
        scenario: s.id,
        workspaceGroup: s.workspaceGroup,
        warm: s.warm,
        prompt,
        message: i + 1,
        after: s.after,
      })),
    );
  }
  if (turns.length !== m.plannedMessages) throw Error('Configured evaluation message count differs from manifest');
  return turns;
}
export async function prepareConfiguredEvaluation(
  configPath = resolve(appRoot, 'harness.config.json'),
  env = process.env,
  manifestPath = undefined,
) {
  const {readHarnessSettings} = await import('../dist/settings.js');
  const {loadConfig} = await import('../dist/runtime.js');
  const path = resolve(configPath);
  const settings = readHarnessSettings(path);
  const e = settings.evaluation;
  if (!e) throw Error('Missing config.evaluation');
  const evaluationModel = e.model ?? settings.model;
  const environment = {
    PRICING_CONFIG_FILE: path,
    ...(evaluationModel
      ? {
          PRICING_PROVIDER: evaluationModel.provider,
          PRICING_MODEL: evaluationModel.id,
          PRICING_THINKING_LEVEL: evaluationModel.thinkingLevel,
        }
      : {}),
  };
  const config = loadConfig({
    ...env,
    ...environment,
    PRICING_WORKSPACE: '/private/tmp/pricing-configured-preview',
    PRICING_PYTHON: env.PRICING_PYTHON ?? resolve(appRoot, '.venv/bin/python'),
  });
  const manifest = JSON.parse(await readFile(manifestPath ?? resolve(appRoot, e.manifestPath), 'utf8'));
  Object.assign(manifest, {
    id: `configured-${manifest.id}`,
    provider: config.provider,
    model: config.modelId,
    thinkingLevel: config.thinkingLevel,
    maxLiveBatchSeconds: e.maxBatchSeconds,
    maxEstimatedCostUSD: e.maxEstimatedCostUSD,
  });
  // These fields describe an old experiment; snapshot the effective settings instead.
  delete manifest.requestSeconds;
  delete manifest.finalizationSeconds;
  delete manifest.modelAttemptsPerPrompt;
  return {
    manifest,
    turns: validateConfiguredManifest(manifest),
    environment,
    config,
    limits: {seconds: e.maxBatchSeconds, estimatedUSD: e.maxEstimatedCostUSD},
    evidenceFolder: e.evidenceFolder,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  let path = process.env.PRICING_CONFIG_FILE ?? resolve(appRoot, 'harness.config.json');
  let manifestPath;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) path = resolve(args[++i]);
    else if (args[i] === '--manifest' && args[i + 1]) manifestPath = resolve(args[++i]);
    else if (args[i] !== '--dry-run')
      throw Error('Usage: node scripts/eval-configured.mjs [--config path] [--manifest path] [--dry-run]');
  }
  (async () => {
    try {
      process.loadEnvFile(resolve(appRoot, '.env'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const experiment = await prepareConfiguredEvaluation(path, process.env, manifestPath);
    await main({
      ...experiment,
      validateManifest: validateConfiguredManifest,
      evaluationSettings: {
        configFile: experiment.config.configFile,
        provider: experiment.config.provider,
        modelId: experiment.config.modelId,
        thinkingLevel: experiment.config.thinkingLevel,
        workflowLimits: experiment.config.workflowLimits,
      },
    });
  })().catch(error => {
    process.stderr.write('Configured evaluation stopped: ' + error.message + '\n');
    process.exitCode = 1;
  });
}
