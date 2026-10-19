import {mkdir, cp, readFile, writeFile, appendFile, readdir, stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join, resolve, relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID, createHash} from 'node:crypto';
const repoRoot = resolve(import.meta.dirname, '../..');
export const manifestPath = join(
  repoRoot,
  'pricing-harness/docs/superpowers/plans/2026-10-08-bounded-agent-workflow/focused-evaluation.json',
);
export function validateManifest(m) {
  const turns =
    m.scenarios?.flatMap(s =>
      s.messages.map((prompt, i) => ({
        scenario: s.id,
        workspaceGroup: s.workspaceGroup,
        warm: s.warm,
        prompt,
        message: i + 1,
        after: s.after,
      })),
    ) ?? [];
  if (
    m.schemaVersion !== 1 ||
    m.provider !== 'openrouter' ||
    m.model !== 'openai/gpt-6-luna' ||
    m.thinkingLevel !== 'high' ||
    m.execution !== 'sequential' ||
    m.plannedMessages !== 9 ||
    turns.length !== 9 ||
    m.scenarios.length !== 5 ||
    new Set(turns.map(t => t.workspaceGroup)).size !== 3 ||
    m.maxLiveBatchSeconds !== 3600 ||
    m.maxEstimatedCostUSD !== 5 ||
    m.automaticRecoveryMessages !== 0
  )
    throw Error('Expected approved five-scenario/nine-message manifest and limits');
  return turns;
}
export function stopReason({elapsedSeconds, cost, usageComplete}, limits = {seconds: 3600, estimatedUSD: 5}) {
  if (!usageComplete) return 'missing SDK usage/cost; further paid turns stopped';
  if (elapsedSeconds >= limits.seconds) return 'live batch time limit';
  if (cost >= limits.estimatedUSD) return 'live batch estimated cost limit';
  return null;
}
export function redact(value, secrets = []) {
  let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  for (const secret of secrets) if (secret && secret.length > 8) text = text.replaceAll(secret, '[REDACTED]');
  return text;
}
export async function prepareWorkspace(pack, workspace, context) {
  await mkdir(join(workspace, 'files'), {recursive: true});
  for (const sub of ['data', 'company'])
    await cp(join(pack, sub), join(workspace, 'files', sub), {recursive: true, mode: constants.COPYFILE_FICLONE});
  await cp(join(pack, 'data_dictionary.md'), join(workspace, 'files/data_dictionary.md'));
  await mkdir(join(workspace, '.pricing'), {recursive: true});
  if (context) await writeFile(join(workspace, '.pricing/context.md'), context);
}
async function inventory(root) {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) {
        const bytes = await readFile(path);
        files.push({
          path: relative(root, path),
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
      }
    }
  }
  await walk(root);
  return files;
}
export function collectExplorations(messages = []) {
  return messages
    .filter(message => message.role === 'assistant' && message.exploration)
    .map(message => message.exploration);
}
async function copyHistoricalOutputs(source, target) {
  try {
    await stat(source);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  await cp(source, target, {recursive: true, mode: constants.COPYFILE_FICLONE});
}
export async function main(options = {}) {
  const limits = options.limits ?? {seconds: 3600, estimatedUSD: 5};
  const manifest = options.manifest ?? JSON.parse(await readFile(options.manifestPath ?? manifestPath, 'utf8'));
  const turns = (options.validateManifest ?? validateManifest)(manifest);
  if (process.argv.includes('--dry-run')) {
    process.stdout.write(
      JSON.stringify({
        planned: turns,
        limits,
        ...(options.evaluationSettings ? {settings: options.evaluationSettings} : {}),
        paidCalls: false,
      }) + '\n',
    );
    return;
  }
  // .env contains local credentials only; it is never copied into evidence or a product workspace.
  try {
    process.loadEnvFile(join(repoRoot, 'pricing-harness/.env'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // Historical entry points retain environment-only budgets; configured runs opt in.
  const runtimeEnv = {...process.env, PRICING_CONFIG_FILE: '', ...options.environment};
  if (
    runtimeEnv.PRICING_PROVIDER !== manifest.provider ||
    runtimeEnv.PRICING_MODEL !== manifest.model ||
    runtimeEnv.PRICING_THINKING_LEVEL !== manifest.thinkingLevel
  )
    throw Error('Configure the exact approved manifest provider/model/thinking level before evaluation');
  const {createApplication} = await import('../dist/application.js');
  const {loadConfig} = await import('../dist/runtime.js');
  const runId = new Date().toISOString().replaceAll(':', '-') + '-' + randomUUID().slice(0, 8);
  const evidence = join(repoRoot, options.evidenceFolder ?? '.cache/focused-agent-workflow-2026-10-08', runId);
  const workspaceRoot = join('/private/tmp', 'pricing-focused-' + runId);
  await mkdir(evidence, {recursive: true});
  const secrets = Object.entries(process.env)
    .filter(([k, v]) => /API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(k) && v && v.length > 8)
    .map(([, v]) => v);
  const save = (path, x) => writeFile(path, redact(x, secrets) + '\n');
  await save(join(evidence, 'manifest.json'), manifest);
  if (options.evaluationSettings) await save(join(evidence, 'evaluation-settings.json'), options.evaluationSettings);
  await save(join(evidence, 'run.json'), {
    runId,
    workspaceRoot,
    mode: 'native exploratory; no OS sandbox',
    startedAt: new Date().toISOString(),
    model: manifest.model,
    thinkingLevel: manifest.thinkingLevel,
    compiledFiles: await inventory(join(repoRoot, 'pricing-harness/dist')),
  });
  const records = [];
  let cumulativeCost = 0,
    usageComplete = true;
  const start = Date.now();
  let app,
    group,
    writeChain = Promise.resolve();
  let unsub = () => {};
  let rankingCheckpoint = false;
  const elapsed = () => (Date.now() - start) / 1000;
  const close = async () => {
    unsub();
    if (app) await app.controller.close();
    await writeChain;
    app = undefined;
  };
  try {
    for (const turn of turns) {
      const stop = stopReason({elapsedSeconds: elapsed(), cost: cumulativeCost, usageComplete}, limits);
      if (stop) {
        const record = {...turn, status: 'not-submitted', reason: stop};
        records.push(record);
        await save(join(evidence, `${turn.scenario}-${turn.message}.json`), record);
        continue;
      }
      if (group !== turn.workspaceGroup) {
        await close();
        group = turn.workspaceGroup;
        const workspace = join(workspaceRoot, group);
        await prepareWorkspace(
          join(repoRoot, 'sample_data_1/user_pack'),
          workspace,
          turn.warm ? manifest.warmFixtureContext : undefined,
        );
        const config = options.config
          ? {...options.config, workspaceRoot: workspace}
          : loadConfig({
              ...runtimeEnv,
              PRICING_WORKSPACE: workspace,
              PRICING_PYTHON: process.env.PRICING_PYTHON ?? join(repoRoot, 'pricing-harness/.venv/bin/python'),
            });
        app = await createApplication(config);
        await save(join(evidence, group + '-configuration.json'), {
          config: app.config,
          health: app.health,
          bundle: app.bundle,
          inputs: app.files.listSources(),
        });
        if (!app.health.agent.ready || !app.health.python.ready) throw Error('Focused runtime is not ready');
        unsub = app.view.subscribe(event => {
          writeChain = writeChain.then(() =>
            appendFile(
              join(evidence, group + '-events.jsonl'),
              redact({at: new Date().toISOString(), event}, secrets) + '\n',
            ),
          );
        });
        rankingCheckpoint = false;
      }
      if (turn.scenario === 'F03' && turn.message === 2 && !rankingCheckpoint) {
        const record = {
          ...turn,
          status: 'blocked',
          reason: 'prior latest-quarter ranking produced no verified cohort; no expected answer supplied',
        };
        records.push(record);
        await save(join(evidence, `${turn.scenario}-${turn.message}.json`), record);
        continue;
      }
      const key = `${turn.scenario}-${turn.message}`;
      const before = app.controller.snapshot();
      const contextBefore = await readFile(app.paths.context, 'utf8');
      const preturn = join(evidence, 'pre-turn', key);
      await cp(app.paths.root, preturn, {recursive: true, mode: constants.COPYFILE_FICLONE});
      await save(join(evidence, key + '-pre-state.json'), {
        snapshot: before,
        context: contextBefore,
        workspace: app.paths.root,
        restoreFrom: preturn,
        hashes: await inventory(preturn),
      });
      const turnStart = Date.now();
      process.stdout.write(
        JSON.stringify({type: 'start', key, elapsedSeconds: elapsed(), estimatedCostUSD: cumulativeCost}) + '\n',
      );
      const accepted = await app.controller.submit({requestId: randomUUID(), text: turn.prompt, fileIds: []});
      const timer = setTimeout(() => void app.controller.cancel(), Math.max(1, (limits.seconds - elapsed()) * 1000));
      const run = await app.controller.waitForRun(accepted.runId);
      clearTimeout(timer);
      await writeChain;
      const snapshot = app.controller.snapshot();
      const previousIds = new Set(before.messages.map(m => m.id));
      const messages = snapshot.messages.filter(m => !previousIds.has(m.id));
      const response = messages
        .filter(m => m.role === 'assistant')
        .map(m => m.text)
        .join('\n\n');
      const artifacts = snapshot.artifacts.filter(a => a.runId === run.id);
      const budget = run.workflow?.budget;
      const cost = budget?.estimatedCostUSD;
      if (typeof cost !== 'number' || !Number.isFinite(cost) || !budget?.usageComplete) usageComplete = false;
      if (typeof cost === 'number' && Number.isFinite(cost)) cumulativeCost += cost;
      const record = {
        ...turn,
        status: run.outcome?.kind ?? run.state,
        prompt: turn.prompt,
        response,
        messages,
        explorations: collectExplorations(messages),
        run,
        seconds: (Date.now() - turnStart) / 1000,
        firstVerifiedAnswerSeconds: run.workflow?.firstVerifiedAnswerAt
          ? (Date.parse(run.workflow.firstVerifiedAnswerAt) - Date.parse(run.startedAt)) / 1000
          : null,
        words: response.trim().split(/\s+/).filter(Boolean).length,
        artifacts,
        contextBefore,
        contextAfter: await readFile(app.paths.context, 'utf8'),
        estimatedCostUSD: cost ?? null,
        cumulativeEstimatedCostUSD: cumulativeCost,
        usageComplete: budget?.usageComplete ?? false,
      };
      records.push(record);
      await save(join(evidence, key + '.json'), record);
      await save(join(evidence, key + '-snapshot.json'), snapshot);
      await cp(join(app.paths.analyses, run.id), join(evidence, 'analyses', key), {
        recursive: true,
        mode: constants.COPYFILE_FICLONE,
      });
      await copyHistoricalOutputs(join(app.paths.outputs, run.id), join(evidence, 'outputs', key));
      await cp(join(app.paths.metadata, 'workflow'), join(evidence, 'workflow-state', key), {
        recursive: true,
        mode: constants.COPYFILE_FICLONE,
      });
      rankingCheckpoint = !!run.checkpoint && ['complete', 'verified-partial'].includes(run.outcome?.kind);
      process.stdout.write(
        JSON.stringify({
          type: 'end',
          key,
          status: record.status,
          seconds: record.seconds,
          cost: record.estimatedCostUSD,
          usageComplete: record.usageComplete,
          words: record.words,
        }) + '\n',
      );
      await save(join(evidence, 'summary.json'), {
        records: records.map(({response, messages, contextBefore, contextAfter, ...r}) => r),
        elapsedSeconds: elapsed(),
        cumulativeEstimatedCostUSD: cumulativeCost,
        usageComplete,
      });
    }
  } finally {
    await close();
    await save(join(evidence, 'summary.json'), {
      records: records.map(({response, messages, contextBefore, contextAfter, ...r}) => r),
      elapsedSeconds: elapsed(),
      cumulativeEstimatedCostUSD: cumulativeCost,
      usageComplete,
    });
  }
  process.stdout.write(
    JSON.stringify({
      type: 'finished',
      evidence,
      elapsedSeconds: elapsed(),
      estimatedCostUSD: cumulativeCost,
      usageComplete,
    }) + '\n',
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error => {
    process.stderr.write('Focused evaluation stopped: ' + error.message + '\n');
    process.exitCode = 1;
  });
