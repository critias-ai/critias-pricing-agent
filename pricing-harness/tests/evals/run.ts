// Eval loop: `npm run eval:oracle` checks the answer keys for free; `npm run eval` runs the analyst (paid).
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createInterface} from 'node:readline';
import {cp, mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve, join, dirname, basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import type {RunRecord} from '../../src/contracts.js';
import type {AnswerKey, Condition, EvalCase, Outcome, RunMetrics} from './spec.js';
import {parseCSV, report, scoreOutcome, spread, type CaseResult} from './verify.js';
import {judge} from './judge.js';
const execute = promisify(execFile);
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const CASES = join(ROOT, 'tests/evals/cases');
const python = existsSync(join(ROOT, '.venv/bin/python')) ? join(ROOT, '.venv/bin/python') : 'python3';
const TURN_MS = 900_000;

export async function loadCase(id: string) {
  const spec = JSON.parse(await readFile(join(CASES, `${id}.json`), 'utf8')) as EvalCase;
  const key = JSON.parse(await readFile(join(ROOT, 'tests/evals/keys', `${id}.json`), 'utf8')) as AnswerKey;
  return {spec, key, inputDir: resolve(CASES, spec.inputDir)};
}

// Held-out data: the same generator with another seed. The solution is the key, so there is nothing stored to
// leak; only files the main key grades are graded, at its tolerance, and reply figures are skipped.
const HOLDOUT = join(ROOT, 'tests/evals/inputs/retail-holdout');
export async function holdoutKey(spec: EvalCase, key: AnswerKey): Promise<AnswerKey> {
  const {files} = await runSolution(spec, HOLDOUT);
  return {
    moneyTolerance: key.moneyTolerance,
    files: Object.fromEntries(Object.keys(key.files).map(f => [f, files[f]!])),
  };
  // rubric and replyNumbers are written for seed 7, so the holdout leaves them out
}

// The answer key's own check: a known-correct script must pass the same scoring the analyst gets.
export async function runSolution(spec: EvalCase, inputDir: string): Promise<Outcome> {
  const {stdout} = await execute(python, ['-I', resolve(CASES, spec.solution!), inputDir, spec.id], {timeout: 60000});
  const out = JSON.parse(stdout) as {files: Outcome['files']; reply: string; replies?: string[]};
  return {files: out.files, replies: out.replies ?? [out.reply], charts: 0};
}

async function newest(dir: string, name: string) {
  let best: {path: string; mtime: number} | undefined;
  for (const entry of await readdir(dir, {recursive: true}).catch(() => [] as string[])) {
    if (basename(entry) !== name || entry.startsWith('files/')) continue; // the analyst's output, never a source
    const path = join(dir, entry),
      mtime = (await stat(path)).mtimeMs;
    if (!best || mtime > best.mtime) best = {path, mtime};
  }
  return best?.path;
}

// People turns never name files; one closing turn asks for the files the grader reads.
export function saveTurn(spec: EvalCase) {
  const asks = spec.csvChecks.flatMap(c => (c.ask ? [c.ask] : []));
  return asks.length
    ? `Thanks. For my records, please save these, using the figures you already gave me, unrounded: ${asks.join('; ')}.`
    : undefined;
}

// A provider refusing for quota or rate reasons is not a test result. Only the provider's own error text, kept in the
// analyst's session files, is searched, so figures in the data can't look like an error code.
export const USAGE_LIMIT =
  /\b(429|402)\b|rate.?limit|usage.?limit|quota|insufficient|too many requests|limit (reached|exceeded)/i;
async function providerErrors(ws: string) {
  const found: string[] = [];
  for (const entry of await readdir(join(ws, '.pricing/workflow'), {recursive: true}).catch(() => [] as string[]))
    if (/sessions\/[^/]+\.jsonl$/.test(entry))
      for (const m of (await readFile(join(ws, '.pricing/workflow', entry), 'utf8')).matchAll(
        /"errorMessage":"((?:[^"\\]|\\.)*)"/g,
      ))
        found.push(m[1]!);
  return found;
}

const contextOf = (spec: EvalCase) =>
  spec.contextFile ? readFile(resolve(CASES, spec.contextFile), 'utf8') : Promise.resolve('');

// Plugin files a tool call opened, relative to the plugin root: by the read tool, or named in a shell command.
export function pluginReads(operation: string) {
  let op: {tool?: string; args?: {path?: string; command?: string}};
  try {
    op = JSON.parse(operation);
  } catch {
    return [];
  }
  const paths =
    op.tool === 'read' ? [op.args?.path ?? ''] : op.tool === 'bash' ? (op.args?.command ?? '').split(/[\s'"]+/) : [];
  return paths.flatMap(p => {
    const m = /(?:pricing-plugin\/|^)(skills\/\S+\.md)$/.exec(p) ?? /(harness-skills\/\S+\.md)$/.exec(p);
    return m ? [m[1]!] : [];
  });
}

async function events(ws: string, runId: string) {
  const text = await readFile(join(ws, 'analyses', runId, 'events.jsonl'), 'utf8').catch(() => '');
  return text.split('\n').flatMap(line => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

export async function runLive(spec: EvalCase, inputDir: string, dir: string, stopAt = Infinity) {
  const ws = join(dir, 'ws');
  await mkdir(join(ws, '.pricing'), {recursive: true});
  await cp(inputDir, join(ws, 'files'), {recursive: true});
  for (const upload of spec.uploads ?? []) await cp(resolve(CASES, upload), join(ws, 'files', basename(upload)));
  if (spec.contextFile) await cp(resolve(CASES, spec.contextFile), join(ws, '.pricing/context.md'));
  const contextStart = await contextOf(spec);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PRICING_WORKSPACE: ws,
    PRICING_PYTHON: python,
    PRICING_DUCKDB_MEMORY: '2GB',
    PRICING_DUCKDB_THREADS: '2',
  };
  delete env.PRICING_CONFIG_FILE;
  const child = spawn(
    process.execPath,
    ['--env-file-if-exists=.env', 'node_modules/tsx/dist/cli.mjs', 'src/headless.ts'],
    {
      cwd: ROOT,
      env,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  const trace: string[] = [],
    ends: any[] = [];
  let closed = false,
    wake = () => {};
  const stderr: Buffer[] = [];
  child.stderr.on('data', chunk => stderr.push(chunk));
  createInterface({input: child.stdout}).on('line', line => {
    trace.push(line);
    try {
      const message = JSON.parse(line);
      if (message.type === 'turn_end' || message.type === 'error') ends.push(message), wake();
    } catch {}
  });
  child.on('close', () => ((closed = true), wake()));
  const waitFor = (count: number) =>
    new Promise<void>(done => {
      const timer = setTimeout(done, Math.max(0, Math.min(TURN_MS, stopAt - Date.now())));
      wake = () => {
        if (ends.length >= count || closed) clearTimeout(timer), done();
      };
      wake();
    });
  const outcome: Outcome = {files: {}, replies: [], charts: 0};
  const runs: RunRecord[] = [];
  const save = saveTurn(spec),
    texts = [...spec.turns.map(t => t.text), ...(save ? [save] : [])];
  try {
    for (const [i, text] of texts.entries()) {
      child.stdin.write(JSON.stringify({type: 'submit', request: {requestId: randomUUID(), text, fileIds: []}}) + '\n');
      await waitFor(i + 1);
      const end = ends[i];
      if (!end) {
        outcome.error = `Turn ${i + 1}: ${closed ? 'harness stopped (see stderr.txt)' : 'timed out'}`;
        break;
      }
      if (end.type === 'error') {
        outcome.error = `Turn ${i + 1}: request failed`;
        break;
      }
      runs.push(end.run);
      const reply = end.snapshot.messages.filter((m: any) => m.role === 'assistant' && m.runId === end.run.id).at(-1);
      if (i < spec.turns.length) outcome.replies.push(reply?.text ?? ''); // the save turn's reply is not graded
      if (end.run.state !== 'completed') {
        outcome.error = `Turn ${i + 1}: run ${end.run.state}`;
        break;
      }
    }
    child.stdin.end(JSON.stringify({type: 'close'}) + '\n');
    await new Promise<void>(done => (closed ? done() : (child.once('close', () => done()), setTimeout(done, 60000))));
  } finally {
    if (!closed) process.kill(-child.pid!, 'SIGKILL');
    await writeFile(join(dir, 'trace.jsonl'), trace.join('\n') + '\n');
    await writeFile(join(dir, 'stderr.txt'), Buffer.concat(stderr));
  }
  for (const check of spec.csvChecks) {
    const path = await newest(ws, check.file);
    try {
      if (path) outcome.files[check.file] = parseCSV(await readFile(path, 'utf8'));
    } catch {} // unreadable counts as missing
  }
  const metrics: RunMetrics = {
    seconds: 0,
    costUSD: 0,
    modelCalls: 0,
    toolCalls: 0,
    toolErrors: 0,
    invalidCalls: 0,
    cards: 0,
  };
  const reads = new Set<string>(),
    tools = new Set<string>();
  outcome.acted = [];
  for (const [i, run] of runs.entries()) {
    const budget = run.workflow?.budget;
    metrics.seconds += (budget?.elapsedMs ?? 0) / 1000;
    metrics.costUSD += budget?.estimatedCostUSD ?? 0;
    metrics.modelCalls += budget?.counters.model ?? 0;
    metrics.toolCalls += budget?.counters.tool ?? 0;
    for (const e of await events(ws, run.id)) {
      if (e.type === 'present') outcome.charts += e.spec?.charts?.length ?? 0;
      // Writing a file is acting before the answer; showing the scenarios with present is what shared rules §3 asks.
      if (e.type === 'tool_start' && ['write', 'edit'].includes(e.tool) && i < spec.turns.length)
        outcome.acted[i] = true;
      if (e.type === 'operation') for (const path of pluginReads(e.operation)) reads.add(path);
      if (e.type === 'tool_start' && i < spec.turns.length) tools.add(e.tool);
      if (e.type !== 'tool_end' || !e.isError) continue;
      metrics.toolErrors++;
      if (/^(Validation failed for tool|Tool \S+ not found)/.test(String(e.error ?? ''))) metrics.invalidCalls++;
    }
  }
  if (outcome.error) {
    const limit = (await providerErrors(ws)).find(e => USAGE_LIMIT.test(e));
    if (limit) outcome.error = `Usage limit: ${outcome.error} (${limit.slice(0, 200)})`;
  }
  outcome.reads = [...reads].sort();
  metrics.cards = outcome.reads.filter(r => r.startsWith('skills/knowledge/') && !r.endsWith('/index.md')).length;
  outcome.context = await readFile(join(ws, '.pricing/context.md'), 'utf8').catch(() => '');
  outcome.contextStart = contextStart;
  outcome.tools = [...tools].sort();
  outcome.metrics = metrics;
  return {outcome, run: runs[0]};
}

async function condition(run: RunRecord): Promise<Condition> {
  const git = (args: string[]) => execute('git', args, {cwd: ROOT}).then(r => r.stdout.trim());
  const commit =
    (await git(['rev-parse', '--short', 'HEAD'])) +
    ((await git(['status', '--porcelain', '--', 'src', 'bundled'])) ? '+changes' : '');
  return {
    model: run.modelId,
    thinking: run.workflow?.thinkingLevel ?? '?',
    commit,
    versions: run.versions,
    bundleFingerprint: run.bundleFingerprint,
  };
}

export async function main(args: string[]) {
  const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const oracle = args.includes('--oracle'),
    holdout = args.includes('--holdout'),
    judged = args.includes('--judge');
  const repeats = Number(option('--repeats') ?? 3);
  const maxUSD = Number(option('--max-usd') ?? 3);
  // Whole-run cut-off: no case starts after it, and turns still running when it passes count as timed out.
  const stopAt = Date.now() + Number(option('--max-minutes') ?? Infinity) * 60_000;
  const ids =
    option('--cases')?.split(',') ??
    (await readdir(CASES))
      .filter(f => f.endsWith('.json'))
      .map(f => f.slice(0, -5))
      .sort();
  if (!oracle && !process.env.PRICING_MODEL)
    throw new Error('Set PRICING_MODEL (for example anthropic/claude-haiku-5.5); paid runs are never implicit');
  const started = new Date().toISOString().replace(/[:.]/g, '-');
  const out = join(ROOT, '.cache/evals', `${oracle ? 'oracle' : 'live'}${holdout ? '-holdout' : ''}-${started}`);
  await mkdir(out, {recursive: true});
  const results: CaseResult[] = [];
  let stamp: Condition | undefined,
    spent = 0,
    stopped = '';
  for (const id of ids) {
    let {spec, key, inputDir} = await loadCase(id);
    if (holdout) {
      if (spec.inputDir !== '../inputs/retail' || !spec.solution) continue;
      [key, inputDir] = [await holdoutKey(spec, key), HOLDOUT];
    }
    if (oracle && judged) {
      // The judge's own check (paid): each hand-written reply must fail exactly its listed items, 3 times out of 3.
      if (!key.rubric || !key.judgeOracle) continue;
      const turns = spec.turns.map(t => t.text),
        context = await contextOf(spec);
      const checks = await Promise.all(
        key.judgeOracle.flatMap(({replies, fails}) =>
          [1, 2, 3].map(async () => {
            const got = (await judge(turns, replies, key.rubric!, context, key.judgeTruth))
              .map(f => f.split(/[ :]/)[1]!)
              .sort();
            return got.join() === [...fails].sort().join()
              ? []
              : [`Judge failed ${got.join() || 'none'}, expected ${fails.join() || 'none'}`];
          }),
        ),
      );
      results.push({
        id,
        outcomes: checks.map(() => ({files: {}, replies: [], charts: 0})),
        failures: checks,
        spread: [],
        consistencyChecked: false,
      });
      continue;
    }
    if (oracle) {
      if (!spec.solution) continue;
      const outcome = await runSolution(spec, inputDir);
      const scored = {...spec, turns: spec.turns.map(t => ({text: t.text})), expectChart: false};
      results.push({
        id,
        outcomes: [outcome],
        failures: [scoreOutcome(scored, key, outcome)],
        spread: [],
        consistencyChecked: false,
      });
      continue;
    }
    if (Date.now() >= stopAt) {
      console.error(`Stopped before ${id}: --max-minutes reached`);
      break;
    }
    if (spent >= maxUSD) {
      console.error(`Stopped before ${id}: $${spent.toFixed(3)} spent, cap $${maxUSD}`);
      break;
    }
    const runs = await Promise.all(
      Array.from({length: repeats}, (_, i) =>
        runLive(spec, inputDir, join(out, `${id}-${i + 1}`), stopAt).catch((e: Error) => ({
          outcome: {files: {}, replies: [], charts: 0, error: e.message} as Outcome,
          run: undefined,
        })),
      ),
    );
    const outcomes = runs.map(r => r.outcome);
    spent += outcomes.reduce((a, o) => a + (o.metrics?.costUSD ?? 0), 0);
    const first = runs.find(r => r.run)?.run;
    if (!stamp && first) stamp = await condition(first);
    results.push({
      id,
      outcomes,
      failures: await Promise.all(
        outcomes.map(async o => [
          ...scoreOutcome(spec, key, o),
          ...(key.rubric && !o.error
            ? await judge(
                spec.turns.map(t => t.text),
                o.replies,
                key.rubric,
                await contextOf(spec),
                key.judgeTruth,
                (answer, metrics) => {
                  o.judgeAnswer = answer;
                  o.judgeMetrics = metrics;
                },
              ).catch((e: Error) => [
                `${USAGE_LIMIT.test(e.message) ? 'Usage limit (judge)' : 'Judge error'}: ${e.message}`,
              ])
            : []),
        ]),
      ),
      spread: spread(spec.csvChecks, outcomes, key.moneyTolerance),
      consistencyChecked: outcomes.filter(o => spec.csvChecks.some(c => o.files[c.file])).length > 1,
    });
    console.error(
      `${id}: ${results.at(-1)!.failures.filter(f => !f.length).length}/${repeats} passed, $${spent.toFixed(3)} so far`,
    );
    if (results.at(-1)!.failures.some(f => f.some(x => x.startsWith('Usage limit')))) {
      stopped = `usage limit hit in ${id}; cases after it were not run`;
      console.error(`Stopped: ${stopped}`);
      break;
    }
  }
  const text = report(stamp, results, started, !oracle) + (stopped ? `\nStopped: ${stopped}.\n` : '');
  await writeFile(join(out, 'report.md'), text);
  await writeFile(join(out, 'results.json'), JSON.stringify({condition: stamp, stopped, results}, null, 2));
  process.stdout.write(text + `\nSaved in ${out}\n`);
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main(process.argv.slice(2)).then(
    results => {
      // The answer-key check is a gate; live runs report without failing the command.
      if (process.argv.includes('--oracle') && results.some(r => r.failures.some(f => f.length))) process.exitCode = 1;
    },
    error => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    },
  );
