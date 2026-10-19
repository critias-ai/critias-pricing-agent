import {mkdtemp, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';
import {hashFile, openWorkspace} from '../../src/workspace.js';
import {loadConfig, type HarnessConfig} from '../../src/runtime.js';
import {WorkflowOrchestrator} from '../../src/agent/workflow/orchestrator.js';
import type {Execution, Runner, StageRequest} from '../../src/agent/workflow/contracts.js';
import type {Step} from '../../src/contracts.js';
import type {ExplorationSpec} from '../../src/exploration.js';
// What one scripted analyst turn does: it prints, writes result files, and may present them.
export type FlowTurn = {
  text?: string;
  printed?: string;
  results?: {name: string; text: string}[];
  present?: ExplorationSpec;
  events?: Record<string, any>[];
  fail?: string;
};
export type FlowOptions = {
  turn?: (call: number, request: StageRequest) => FlowTurn;
  configure?: (config: HarnessConfig) => void;
  profileSources?: (sources: any[]) => Promise<any[]>;
  findData?: (sources: any[]) => Promise<any>;
};
// Orchestrator with a fake stage runner: real controller checks, scripted analyst turns.
export async function createFlow(options: FlowOptions = {}) {
  const paths = await openWorkspace(await mkdtemp(join(tmpdir(), 'flow-'))),
    root = paths.root;
  const writeSource = async (text: string) => {
    await writeFile(join(paths.files, 'source.csv'), text);
    return {
      id: 'source',
      name: 'source.csv',
      relativePath: 'files/source.csv',
      kind: 'csv' as const,
      addedAt: '',
      ...(await hashFile(join(paths.files, 'source.csv'))),
    };
  };
  let source = await writeSource('amount\n10\n');
  const requests: StageRequest[] = [],
    messages: {id: string; text: string; options?: any}[] = [],
    steps: Step[] = [];
  let calls = 0;
  const runner: Runner = {
    activeCount: 0,
    execute: async (request, budget, _signal, event) => {
      const call = ++calls;
      requests.push(request);
      budget.debit('model');
      budget.usage({input: 1, output: 1, cost: {total: 0.01}});
      const turn = options.turn?.(call, request) ?? {printed: 'revenue 10'};
      for (const extra of turn.events ?? []) event(extra);
      if (turn.fail) throw Error(turn.fail);
      await mkdir(request.stageDir, {recursive: true});
      const ref = async (path: string) => ({path: relative(root, path), sha256: (await hashFile(path)).sha256});
      const executions: Execution[] = [];
      if (turn.printed !== undefined || turn.results?.length) {
        const script = join(request.stageDir, `analysis-${call}.py`),
          output = join(request.stageDir, `execution-${call}.txt`);
        await writeFile(script, '# analysis of source.csv');
        await writeFile(output, `${turn.printed ?? ''}\n`);
        const record: Execution = {
          id: `execution-${call}`,
          success: true,
          script: await ref(script),
          output: await ref(output),
        };
        for (const result of turn.results ?? []) {
          const file = join(request.stageDir, result.name);
          await writeFile(file, result.text);
          event({type: 'recorded', name: result.name, sha256: (await hashFile(file)).sha256});
        }
        executions.push(record);
        event({type: 'execution', record});
      }
      if (turn.present) event({type: 'present', spec: turn.present});
      return {
        schemaVersion: 1 as const,
        sessionId: 'analyst-session',
        text: turn.text ?? 'Revenue was £10.',
        executions,
      };
    },
  };
  const config = loadConfig({
    PRICING_WORKSPACE: root,
    PRICING_PROVIDER: 'openrouter',
    PRICING_MODEL: 'explicit',
    PRICING_THINKING_LEVEL: 'medium',
    PRICING_PYTHON: '/usr/bin/python3',
    PRICING_CONFIG_FILE: '',
  });
  options.configure?.(config);
  // A new orchestrator per turn, as in the app (runs.ts): nothing may rely on its memory between turns.
  const orchestrator = () =>
    new WorkflowOrchestrator({
      config,
      paths,
      bundle: {
        fingerprint: 'x',
        pricingVersion: '',
        pricingCommit: '',
        visualizationVersion: '',
        skillPaths: [],
        skillNames: [],
      },
      runner,
      onMessage: (text, opts) => {
        const id = 'm' + messages.length;
        messages.push({id, text, options: opts});
        return id;
      },
      onStep: step => steps.push(step),
      profileSources: options.profileSources,
      findData: options.findData,
    });
  let n = 0;
  const run = async (question = 'Review revenue', signal = new AbortController().signal) => {
    await mkdir(join(paths.analyses, 'run' + (n + 1)), {recursive: true});
    return orchestrator().execute(
      {
        schemaVersion: 1,
        id: 'run' + ++n,
        sessionId: 'chat',
        requestId: 'request' + n,
        startedAt: new Date().toISOString(),
        inputs: [source],
        modelId: 'explicit',
        provider: 'openrouter',
        bundleFingerprint: 'x',
        state: 'running',
      } as any,
      question,
      [source],
      signal,
    );
  };
  return {
    root,
    paths,
    run,
    requests,
    messages,
    config,
    steps,
    stageDir: join(paths.metadata, 'workflow', 'chat', 'analyst'),
    changeSource: async (text: string) => {
      source = await writeSource(text);
    },
  };
}
