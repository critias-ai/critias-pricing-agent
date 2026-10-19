import {randomUUID} from 'node:crypto';
import {mkdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {HarnessError, type RunRecord, type RunAccepted, type SubmitRequest} from '../contracts.js';
import {atomicJSON, type WorkspacePaths} from '../workspace.js';
import type {FileStore} from '../files.js';
import type {HarnessConfig, Health} from '../runtime.js';
import type {AgentHandle} from './session.js';
import type {Runner} from './workflow/contracts.js';
import {StageRunner} from './workflow/stage-runner.js';
import {WorkflowOrchestrator} from './workflow/orchestrator.js';
import {createSourceProfiler} from './workflow/source-profiles.js';
import {createFindingDetector} from './workflow/data-findings.js';
import {EventView} from './events.js';
import {loadConversation, saveConversation} from '../conversations.js';
import {restoreExplorations} from './workflow/exploration-restore.js';
export class RunController {
  private abortWorkflow: AbortController | null = null;
  private busy = false;
  private pending = new Map<string, Promise<RunAccepted>>();
  private completions = new Map<string, Promise<RunRecord>>();
  private active: RunRecord | null = null;
  private task: Promise<void> | null = null;
  private handle: AgentHandle;
  constructor(
    private options: {
      workflowRunner?: Runner;
      config: HarnessConfig;
      paths: WorkspacePaths;
      handle: AgentHandle;
      view: EventView;
      files: FileStore;
      health: Health;
      createSession: (fresh: boolean) => Promise<AgentHandle>;
      explorationEnabled?: boolean;
    },
  ) {
    this.handle = options.handle;
    for (const run of options.view.snapshot().runs) this.completions.set(run.id, Promise.resolve(run));
  }
  snapshot() {
    return this.options.view.snapshot();
  }
  submit(input: SubmitRequest): Promise<RunAccepted> {
    if (
      !input ||
      typeof input.requestId !== 'string' ||
      !input.requestId ||
      input.requestId.length > 128 ||
      typeof input.text !== 'string' ||
      !input.text.trim() ||
      input.text.length > 100000 ||
      !Array.isArray(input.fileIds) ||
      input.fileIds.some(id => typeof id !== 'string')
    )
      return Promise.reject(new HarnessError('INVALID_REQUEST', 'Provide requestId, a question, and fileIds'));
    const previous = this.pending.get(input.requestId);
    if (previous) return previous;
    if (this.busy) return Promise.reject(new HarnessError('BUSY', 'An analysis is busy', 409, true));
    if (!this.options.health.agent.ready || !this.options.health.python.ready)
      return Promise.reject(new HarnessError('NOT_READY', 'Check model credentials and Python setup', 503));
    this.busy = true;
    this.options.view.reserve();
    const acceptance = Promise.resolve()
      .then(() => this.start(input, Date.now()))
      .catch(e => {
        this.busy = false;
        this.options.view.release();
        this.pending.delete(input.requestId);
        throw e;
      });
    this.pending.set(input.requestId, acceptance);
    return acceptance;
  }
  private async start(input: SubmitRequest, submittedAt: number): Promise<RunAccepted> {
    const {files, paths, config, view} = this.options;
    await files.resolveSources(input.fileIds);
    const sources = await files.snapshotSources();
    const id = randomUUID(),
      analysis = join(paths.analyses, id);
    await mkdir(analysis);
    await mkdir(join(paths.tmp, id));
    const run: RunRecord = {
      schemaVersion: 1,
      id,
      requestId: input.requestId,
      sessionId: view.snapshot().sessionId,
      state: 'running',
      startedAt: new Date(submittedAt).toISOString(),
      inputs: sources.map(({id, relativePath, sha256}) => ({id, relativePath, sha256})),
      selectedFileIds: input.fileIds,
      bundleFingerprint: this.handle.bundle.fingerprint,
      provider: config.provider,
      modelId: config.modelId,
      versions: {
        piSdk: '1.0.4',
        pricing: this.handle.bundle.pricingVersion,
        visualization: this.handle.bundle.visualizationVersion,
      },
    };
    await atomicJSON(join(analysis, 'run.json'), run);
    this.active = run;
    view.setRun(run);
    {
      this.abortWorkflow = new AbortController();
      const signal = this.abortWorkflow.signal;
      view.appendLogical('user', input.text, {runId: id});
      await this.persistConversation();
      let resolveDone!: (run: RunRecord) => void;
      this.completions.set(id, new Promise(r => (resolveDone = r)));
      const workflow = new WorkflowOrchestrator({
        config,
        paths,
        bundle: this.handle.bundle,
        profileSources: createSourceProfiler(config, paths.cache),
        findData: createFindingDetector(config, paths.cache),
        runner: this.options.workflowRunner ?? new StageRunner(),
        explorationEnabled: this.options.explorationEnabled,
        onMessage: async (text, options) => {
          const message = view.appendLogical('assistant', text, options);
          await this.persistConversation();
          return message.id;
        },
        onStep: step => view.step(step),
        onInvalidate: async () => {
          view.invalidateExplorations(
            run.id,
            'The verified result is no longer available. Rerun the analysis to restore it.',
          );
          await this.persistConversation();
        },
        onCheckpoint: async () => {
          await atomicJSON(join(paths.analyses, run.id, 'run.json'), run);
          view.setRun(run);
        },
      });
      this.task = workflow
        .execute(
          run,
          input.text,
          input.fileIds.length ? sources.filter(s => input.fileIds.includes(s.id)) : sources,
          signal,
        )
        .then(
          result => {
            Object.assign(run, result);
            return this.finish(run);
          },
          () =>
            this.finish(run, {
              code: 'WORKFLOW_FAILED',
              message: 'Bounded workflow failed; retained files require review',
            }),
        )
        .then(final => resolveDone(final))
        .catch(() => {
          run.state = 'failed';
          this.busy = false;
          this.active = null;
          view.settleRun(run, files.listArtifacts());
          resolveDone(structuredClone(run));
        });
      return {runId: id, sessionId: run.sessionId, requestId: input.requestId};
    }
  }

  private async finish(run: RunRecord, error?: RunRecord['error']) {
    const {files, paths, view} = this.options;
    run.state = run.state === 'cancelling' ? 'cancelled' : error ? 'failed' : 'completed';
    run.error = error;
    if (run.outcome?.kind === 'no-verified-answer' && run.state === 'completed') {
      run.state = 'failed';
      run.error = {
        code: 'NO_VERIFIED_ANSWER',
        message: 'No checked answer; analysis files are retained for review',
      };
    }
    const changed = await files.checkSourcesUnchanged(run.inputs);
    if (changed.length) {
      run.state = 'failed';
      run.error = {code: 'SOURCE_CHANGED', message: 'A source changed during analysis; rerun with stable inputs'};
      run.outcome = {kind: 'no-verified-answer', reason: 'source changed'};
      run.checkpoint = undefined;
      view.invalidateExplorations(run.id, 'Source data changed during analysis. Rerun to restore this result.');
      await this.persistConversation();
    }
    run.endedAt = new Date().toISOString();
    await atomicJSON(join(paths.analyses, run.id, 'run.json'), run);
    await rm(join(paths.tmp, run.id), {recursive: true, force: true});
    this.busy = false;
    this.active = null;
    this.abortWorkflow = null;
    if (run.error) view.error(run.error.code, run.error.message);
    view.settleRun(run, files.listArtifacts());
    return structuredClone(run);
  }
  private async persistConversation() {
    const {sessionId, messages} = this.options.view.snapshot();
    await saveConversation(this.options.paths, {sessionId, messages});
  }
  // Shows a saved conversation; the next question resumes its analyst from .pricing/workflow/<id>/.
  async openConversation(id: string) {
    if (this.busy) throw new HarnessError('BUSY', 'An analysis is busy', 409);
    this.busy = true;
    this.options.view.reserve();
    try {
      const saved = await loadConversation(this.options.paths, id);
      if (!saved) throw new HarnessError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
      saved.messages = await restoreExplorations(this.options.paths.root, id, saved.messages);
      await saveConversation(this.options.paths, saved, false);
      this.options.view.useLogical(saved);
      this.options.view.release();
      this.options.view.settle();
      return this.snapshot();
    } finally {
      this.busy = false;
      this.options.view.release();
    }
  }
  async waitForRun(id: string) {
    const promise = this.completions.get(id);
    if (!promise) throw new HarnessError('RUN_NOT_FOUND', 'Run not found', 404);
    return promise;
  }
  async cancel() {
    if (this.busy && !this.active) {
      await Promise.allSettled([...this.pending.values()]);
    }
    if (this.active) {
      this.active.state = 'cancelling';
      this.options.view.setRun(this.active);
      if (this.abortWorkflow) this.abortWorkflow.abort();
      else await this.handle.session.abort();
      await this.task;
    }
    return this.snapshot();
  }
  async newSession() {
    if (this.busy) throw new HarnessError('BUSY', 'An analysis is busy', 409);
    this.busy = true;
    this.options.view.reserve();
    try {
      const next = await this.options.createSession(true);
      this.handle.session.dispose();
      this.handle = next;
      this.options.view.bind(next);
      this.options.view.useLogical();
      await this.persistConversation();
      this.options.view.release();
      this.options.view.settle();
      return this.snapshot();
    } finally {
      this.busy = false;
      this.options.view.release();
    }
  }
  async close() {
    await this.cancel();
    this.options.view.dispose();
    this.handle.session.dispose();
  }
}
