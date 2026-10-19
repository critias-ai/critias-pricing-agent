import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir, writeFile, readFile, readdir, stat} from 'node:fs/promises';
import {join, relative, resolve, dirname, isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createBashToolDefinition, type ToolDefinition} from '@earendil-works/pi-coding-agent';
import {createPricingSession, analysisEnvironment} from '../session.js';
import {resolveModel, toShellPath} from '../../runtime.js';
import {hashFile, safePath} from '../../workspace.js';
import type {StageRequest, StageResult, Execution} from './contracts.js';
import {createStageBashOperations} from './supervised-shell.js';
import {retryTransient, runawayPrompt} from './transient-error.js';
import {filePathParameters, toolFilePath} from './tool-input.js';
import {analystPrompt, analystTools} from './role-prompts.js';
import {PRELOADED} from './stage-prompt.js';
import {ModelTiming} from './model-timing.js';
import {bindExploration, normalizeExploration} from './exploration.js';
import {CHART_KINDS} from '../../exploration.js';
import {Type} from 'typebox';
import {workerStepEvents} from './steps.js';
import {analystNudges, loadLints} from './nudges.js';
import {createQueryTool} from './query-tool.js';
import {recordPythonRuns} from './shell-evidence.js';
import {openWorkspace} from '../../workspace.js';
const send = (message: unknown) => process.send?.(message);
const pending = new Map<string, () => void>();
let session: Awaited<ReturnType<typeof createPricingSession>>['session'] | undefined;
const gate = (kind: string) =>
  new Promise<void>(r => {
    const id = randomUUID();
    pending.set(id, r);
    send({type: 'gate', id, kind});
  });
process.on('message', (raw: any) => {
  if (raw.type === 'allow') {
    pending.get(raw.id)?.();
    pending.delete(raw.id);
  }
  if (raw.type === 'abort') void session?.abort();
  if (raw.type === 'start')
    void execute(raw.request).catch(error => send({type: 'error', message: (error as Error).message}));
});
async function execute(request: StageRequest) {
  const emit = (event: Record<string, any>) => send({type: 'event', event});
  const {config, stageDir} = request;
  await mkdir(stageDir, {recursive: true});
  const operations = new Map<string, unknown>();
  // Result files an executed query or script produced: the only files `present` accepts. name -> sha256.
  const recorded = new Map<string, string>(Object.entries(request.recorded ?? {}));
  const noteRecorded = (name: string, sha256: string) => {
    recorded.set(name, sha256);
    send({type: 'event', event: {type: 'recorded', name, sha256}});
  };
  const exec = promisify(execFile);
  const cachePath = (await openWorkspace(config.workspaceRoot)).cache;
  const localPath = async (path: string) => {
    const resolved = await safePath(stageDir, relative(stageDir, resolve(config.workspaceRoot, path)));
    return resolved;
  };
  // The analyst may write in its stage directory (.pricing/workflow/<conversation>/analyst) and to .pricing/context.md.
  const contextPath = resolve(stageDir, '../../../context.md');
  const writablePath = async (path: string) => {
    const target = resolve(stageDir, path);
    if (target === contextPath) return;
    const rel = relative(stageDir, target);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Stage write escape');
    try {
      await safePath(stageDir, relative(stageDir, target));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    let parent = dirname(target);
    while (parent !== stageDir) {
      try {
        await safePath(stageDir, relative(stageDir, parent));
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        parent = dirname(parent);
      }
    }
  };
  const shell = createBashToolDefinition(stageDir, {
    operations: createStageBashOperations(),
    exposeSessionEnvironment: false,
    spawnHook: context => ({...context, env: analysisEnvironment(context.env)}),
  });
  const bash = recordPythonRuns(shell, {
    stageDir,
    root: config.workspaceRoot,
    onRecorded: noteRecorded,
    onExecution: record => send({type: 'event', event: {type: 'execution', record}}),
  });
  const generated: ToolDefinition = {
    name: 'execute_analysis',
    executionMode: 'sequential',
    label: 'Execute generated analysis',
    description:
      'Execute a Python script generated in this stage; filePath is its absolute path. The script is stopped after 120 s. Records stdout and script hashes as evidence.',
    parameters: filePathParameters,
    execute: async (_id, args: any) => {
      const script = await localPath(toolFilePath(args));
      if (!script.endsWith('.py')) throw new Error('Expected generated Python script');
      const before = await hashFile(script);
      const auditPath = join(stageDir, `provenance-${randomUUID()}.json`);
      const startedAt = Date.now();
      const result = await exec(
        config.pythonPath,
        [
          join(config.bundledRoot, 'harness-tools/record_execution.py'),
          '--script',
          script,
          '--root',
          config.workspaceRoot,
          '--record',
          auditPath,
        ],
        {
          cwd: stageDir,
          env: analysisEnvironment(process.env),
          timeout: 120000,
          maxBuffer: 1024 * 1024,
        },
      ).catch((e: Error & {killed?: boolean; code?: number; stderr?: string}) => {
        const why = e.killed ? 'killed after 120 s' : `exit code ${e.code}`;
        throw new Error(`Script failed (${why}).\nstderr:\n${String(e.stderr ?? '').slice(-3000)}`);
      });
      const id = randomUUID(),
        output = join(stageDir, `execution-${id}.txt`);
      await writeFile(output, result.stdout);
      if ((await hashFile(script)).sha256 !== before.sha256) throw new Error('Script changed during execution');
      const audit = JSON.parse(await readFile(auditPath, 'utf8')) as {success: boolean; reads: string[]};
      if (!audit.success) throw new Error('Generated execution did not complete');
      const accessed = await Promise.all(
        audit.reads.map(async (path: string) => ({
          path,
          sha256: (await hashFile(await safePath(config.workspaceRoot, path))).sha256,
        })),
      );
      // CSV files written while the script ran are its results; the model's own write/edit calls never count.
      for (const name of await readdir(stageDir)) {
        if (!name.endsWith('.csv')) continue;
        const file = join(stageDir, name);
        if ((await stat(file)).mtimeMs >= startedAt - 50) noteRecorded(name, (await hashFile(file)).sha256);
      }
      const record: Execution = {
        accessed,
        provenance: {path: relative(config.workspaceRoot, auditPath), sha256: (await hashFile(auditPath)).sha256},
        id,
        script: {path: relative(config.workspaceRoot, script), sha256: before.sha256},
        output: {path: relative(config.workspaceRoot, output), sha256: (await hashFile(output)).sha256},
        success: true,
      };
      send({type: 'event', event: {type: 'execution', record}});
      return {
        details: {},
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              executionId: id,
              output: record.output.path,
              stdout:
                result.stdout.slice(0, 8000) +
                (result.stdout.length > 8000
                  ? `\n(truncated: the full output is in ${toShellPath(record.output.path)})`
                  : ''),
              stderr: result.stderr.slice(0, 2000),
            }),
          },
        ],
      };
    },
  };
  // One SQL session per stage; its results are recorded like script output but never replace a handoff.
  const query = await createQueryTool({
    pythonPath: config.pythonPath,
    helperPath: join(config.bundledRoot, 'harness-tools/query_server.py'),
    root: config.workspaceRoot,
    stageDir,
    cache: cachePath,
    sources: request.sources ?? [],
    memory: config.duckdbMemoryLimit,
    threads: config.duckdbThreads,
    onExecution: executed => send({type: 'event', event: {type: 'query', record: executed}}),
    onRecorded: noteRecorded,
  });
  const present: ToolDefinition = {
    name: 'present',
    executionMode: 'sequential',
    label: 'Present results',
    description:
      'Show tables and charts to the user from result files an executed query or script wrote (save a query with ' +
      '`save`). A table names a CSV file, the column that identifies each row, and the columns to show with a label ' +
      'and unit; a chart names a table and one to four of its columns of one unit: line (over time), bar (compare or ' +
      'rank), stacked (parts of a whole), waterfall (a bridge: one column of steps, with level rows named in totals) ' +
      'or scatter (two measures per row: x names the horizontal column). Values are read from the file. ' +
      'Call it once, after the figures are final; the views appear with your reply.',
    parameters: Type.Object({
      tables: Type.Array(
        Type.Object({
          id: Type.String(),
          title: Type.String(),
          file: Type.String({description: 'CSV file name in the working folder'}),
          rowKey: Type.String({description: 'column that identifies a row'}),
          rowLabel: Type.Optional(Type.String({description: 'column shown as the row name'})),
          rowHeader: Type.Optional(Type.String()),
          columns: Type.Array(
            Type.Object({
              key: Type.String(),
              label: Type.String(),
              unit: Type.String({description: 'GBP, %, pp, units...'}),
            }),
          ),
        }),
      ),
      charts: Type.Optional(
        Type.Array(
          Type.Object({
            id: Type.String(),
            title: Type.String(),
            kind: Type.Union(CHART_KINDS.map(k => Type.Literal(k))),
            tableId: Type.String(),
            series: Type.Array(Type.String()),
            x: Type.Optional(Type.String({description: 'scatter: column for the horizontal axis'})),
            totals: Type.Optional(
              Type.Array(Type.String(), {description: 'waterfall: row keys drawn from zero as levels (start, end)'}),
            ),
          }),
        ),
      ),
    }),
    execute: async (_id, args: any) => {
      const {spec, issues} = normalizeExploration({tables: args?.tables, charts: args?.charts ?? []});
      if (!spec) throw new Error(issues.join('; ') || 'No valid table');
      const files: {name: string; path: string; sha256: string}[] = [];
      for (const name of new Set(spec.tables.map(t => t.file))) {
        const file = join(stageDir, name);
        const sha256 = await hashFile(file).then(
          h => h.sha256,
          () => '',
        );
        if (!sha256 || recorded.get(name) !== sha256)
          throw new Error(
            `${name} is not an unchanged output of an executed query or script. Save it with the query tool's save option, or have a script write it.`,
          );
        files.push({name, path: relative(config.workspaceRoot, file), sha256});
      }
      // Dry run with the same binder the controller uses, so mistakes surface now.
      const bound = await bindExploration(
        config.workspaceRoot,
        {
          schemaVersion: 2,
          id: 'dry',
          runId: 'dry',
          conversationId: 'dry',
          sources: [],
          files,
          createdAt: '',
          exploration: spec,
        },
        {path: 'dry', sha256: ''},
      );
      if (!bound.result) throw new Error(bound.issues.join('; '));
      send({type: 'event', event: {type: 'present', spec}});
      const notes = [...issues, ...bound.issues];
      return {
        details: {},
        content: [
          {
            type: 'text',
            text: `Presented ${bound.result.tables.length} table(s) and ${bound.result.charts.length} chart(s).${notes.length ? ` Not shown: ${notes.join('; ')}` : ''}`,
          },
        ],
      };
    },
  };
  const tools = [bash as unknown as ToolDefinition, generated, present, ...(query ? [query.tool] : [])];
  const toolNames = query ? [...analystTools, 'present', 'query'] : [...analystTools, 'present'];
  let runaway = false; // set when the stream hook stopped a tool call that kept growing
  const {runtime, model} = await resolveModel(config);
  const handle = await createPricingSession({
    config,
    bundle: request.bundle,
    modelRuntime: runtime,
    model,
    fresh: request.fresh,
    stage: {
      directory: stageDir,
      systemPrompt: analystPrompt,
      tools,
      toolNames,
      extensions: [
        analystNudges({
          stageDir,
          level: config.thinkingLevel,
          until: request.until ? request.until - 60000 : undefined,
          totalMs: config.workflowLimits.milliseconds,
          contextPath,
          lints: loadLints(config.bundledRoot),
          skillsRoot: join(config.bundledRoot, 'pricing-plugin/skills'),
          preloaded: PRELOADED.map(p => p.replace(/^pricing-plugin\/skills\//, '')),
          sources: (request.sources ?? []).map(s => s.path),
          moreSkills: [join(config.bundledRoot, 'harness-skills/analysis-visualize')],
          onRunaway: chars => {
            runaway = true;
            emit({type: 'runaway', chars});
          },
        }),
      ],
    },
  });
  session = handle.session;
  session.setAutoRetryEnabled(false);
  const stream = session.agent.streamFunction;
  const timing = new ModelTiming();
  const modelActivity = {tokenSeen: false};
  let inflight = false;
  session.agent.streamFunction = async (...args) => {
    // A request cancelled for compaction or overflow recovery never reports usage and is not billed.
    if (inflight)
      send({
        type: 'event',
        event: {type: 'usage', usage: {input: 0, output: 0, cost: {total: 0}}, stopReason: 'abandoned'},
      });
    inflight = true;
    const waitStarted = Date.now();
    await gate('model');
    timing.start(Date.now(), Date.now() - waitStarted);
    modelActivity.tokenSeen = false;
    emit({type: 'model_start'});
    return stream(...args);
  };
  const before = session.agent.beforeToolCall;
  session.agent.beforeToolCall = async (context, signal) => {
    await gate('tool');
    const args = context.toolCall.arguments as Record<string, unknown>;
    if (!toolNames.includes(context.toolCall.name))
      throw Error('Tool unavailable in this stage: ' + context.toolCall.name);
    if (['write', 'edit'].includes(context.toolCall.name)) await writablePath(String(args.path));
    if (
      context.toolCall.name === 'bash' &&
      /render_report|preview_report|write_html|\.write_html/.test(String(args.command))
    )
      throw new Error('Report generation is retired; return optional in-chat exploration bindings');

    return before?.(context, signal);
  };
  session.subscribe(event => {
    for (const step of workerStepEvents(event, modelActivity)) emit(step);
    if (event.type === 'tool_execution_start') operations.set(event.toolCallId, event.args);
    if (
      event.type === 'message_update' &&
      ['text_delta', 'thinking_delta', 'toolcall_start', 'toolcall_delta'].includes(event.assistantMessageEvent.type)
    )
      timing.token(Date.now());
    if (event.type === 'message_end' && event.message.role === 'assistant') {
      inflight = false;
      // A failed request returns no usage and bills nothing; count it as zero so the retry is not blocked.
      const failed = ['error', 'aborted'].includes(event.message.stopReason) && !event.message.usage;
      const usage = failed ? {input: 0, output: 0, cost: {total: 0}} : event.message.usage;
      send({type: 'event', event: {type: 'usage', usage, stopReason: event.message.stopReason}});
      const record = timing.end(Date.now(), event.message.usage?.output);
      if (record) send({type: 'event', event: {type: 'model_timing', ...record}});
    }
    if (event.type === 'tool_execution_end')
      send({
        type: 'event',
        event: {
          type: 'operation',
          operation: JSON.stringify({tool: event.toolName, args: operations.get(event.toolCallId)}),
          result: JSON.stringify(event.result),
          isError: event.isError,
        },
      });
  });
  send({
    type: 'event',
    event: {
      type: 'configuration',
      sessionId: session.sessionId,
      provider: session.model?.provider,
      modelId: session.model?.id,
      thinkingLevel: session.thinkingLevel,
    },
  });
  let result: StageResult;
  try {
    await session.prompt(request.prompt, {expandPromptTemplates: false});
    const active = session;
    const read = async () => {
      let last = await retryTransient(active, gate);
      // A stopped runaway call is resumed once per retry slot, like a transient failure.
      while (runaway && last?.role === 'assistant' && last.stopReason === 'aborted') {
        runaway = false;
        await gate('retry');
        await active.prompt(runawayPrompt, {expandPromptTemplates: false});
        last = await retryTransient(active, gate);
      }
      if (!last || last.role !== 'assistant' || last.stopReason === 'error' || last.stopReason === 'aborted')
        throw new Error('Provider did not complete stage');
      return last.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
    };
    result = {schemaVersion: 1, sessionId: active.sessionId, text: await read()};
  } finally {
    query?.close();
    session.dispose();
  }
  send({type: 'result', result});
}
