import {createHash} from 'node:crypto';
import {mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {EventLog, redactSecrets} from './event-log.js';
import {buildStagePrompt, completeReply, deliverPrompt, followUpPrompt, recheckPrompt} from './stage-prompt.js';
import {harnessNote} from './role-prompts.js';
import {compactProfiles, type SourceProfile} from './source-profiles.js';
import {compactFindings, type CompactFindings, type DataFindings} from './data-findings.js';
import {lintApplies, lintHints, loadLints} from './nudges.js';
import {bindExploration} from './exploration.js';
import {unverifiedFigures, withheldResult} from './reply-figures.js';
import {WorkflowBudget} from './budget.js';
import {failureMessage} from './delivery.js';
import {loadCheckpoint, sealPresentation, stableRefs} from './checkpoints.js';
import {clip, STEP_DETAIL_CHARS, STEP_SUMMARY_CHARS, StepTracker} from './steps.js';
import {atomicJSON, readJSON, type WorkspacePaths} from '../../workspace.js';
import type {HarnessConfig} from '../../runtime.js';
import type {BundleInfo} from '../bundle.js';
import type {AssistantMessageOptions, RunRecord, SourceFile, Step} from '../../contracts.js';
import type {FileRef, Runner} from './contracts.js';
import type {ExplorationSpec} from '../../exploration.js';
export class WorkflowOrchestrator {
  constructor(
    private options: {
      config: HarnessConfig;
      paths: WorkspacePaths;
      bundle: BundleInfo;
      runner: Runner;
      onMessage: (text: string, options?: AssistantMessageOptions) => unknown;
      onStep?: (step: Step) => void;
      onCheckpoint?: () => Promise<void>;
      onInvalidate?: () => Promise<void>;
      explorationEnabled?: boolean;
      profileSources?: (sources: SourceFile[]) => Promise<SourceProfile[]>;
      findData?: (sources: SourceFile[]) => Promise<DataFindings | undefined>;
    },
  ) {}
  async execute(run: RunRecord, question: string, sources: SourceFile[], signal: AbortSignal) {
    const log = new EventLog(join(this.options.paths.analyses, run.id, 'events.jsonl'), redactSecrets);
    const stepLog = new EventLog(join(this.options.paths.analyses, run.id, 'steps.jsonl'), redactSecrets);
    const steps = new StepTracker(run.id, step => {
      const redacted = JSON.parse(redactSecrets(step)) as Step;
      const safe = {
        ...redacted,
        summary: clip(redacted.summary, STEP_SUMMARY_CHARS),
        ...(redacted.detail === undefined ? {} : {detail: clip(redacted.detail, STEP_DETAIL_CHARS)}),
      };
      void stepLog.append(safe);
      this.options.onStep?.(safe);
    });
    try {
      return await this.executeWithLog(run, question, sources, signal, log, steps);
    } finally {
      await log.flush();
      await stepLog.flush();
    }
  }
  // One analyst turn on the conversation's session. Replies are checked, not repaired, by the controller.
  private async executeWithLog(
    run: RunRecord,
    question: string,
    sources: SourceFile[],
    signal: AbortSignal,
    log: EventLog,
    steps: StepTracker,
  ): Promise<{
    outcome: NonNullable<RunRecord['outcome']>;
    checkpoint?: FileRef;
    workflow: NonNullable<RunRecord['workflow']>;
  }> {
    const {config, paths, bundle, runner} = this.options;
    const budget = new WorkflowBudget(config.workflowLimits, Date.now, Date.parse(run.startedAt));
    const until = budget.started + budget.limits.milliseconds;
    const conversation = run.sessionId;
    if (!/^[a-zA-Z0-9 _-]+$/.test(conversation)) throw new Error('Invalid conversation ID');
    const sourceRefs = sources.map(s => ({path: s.relativePath, sha256: s.sha256}));
    const statePath = join(paths.metadata, 'workflow', conversation, 'state.json');
    const stageDir = join(paths.metadata, 'workflow', conversation, 'analyst');
    // Result files an executed query or script produced in this conversation: name -> sha256.
    const recorded = new Map<string, string>();
    let presented: ExplorationSpec | undefined;
    const turn = async (prompt: string, fresh: boolean) => {
      await mkdir(stageDir, {recursive: true});
      const step = steps.stageStart();
      try {
        const result = await runner.execute(
          {
            schemaVersion: 1,
            runId: run.id,
            conversationId: conversation,
            stageDir,
            config,
            bundle,
            prompt,
            fresh,
            sources: sourceRefs,
            until,
            recorded: Object.fromEntries(recorded),
          },
          budget,
          signal,
          event => {
            void log.append({at: new Date().toISOString(), role: 'analyst', ...event});
            steps.event(event);
            if (event.type === 'recorded') recorded.set(event.name, event.sha256);
            if (event.type === 'present') presented = event.spec;
          },
        );
        return result.text.trim();
      } finally {
        steps.stageEnd(step);
      }
    };
    const outputs = async () =>
      Promise.all(
        (await readdir(stageDir)).filter(f => f.startsWith('execution-')).map(f => readFile(join(stageDir, f), 'utf8')),
      );
    try {
      const key = createHash('sha256')
        .update(JSON.stringify([bundle.fingerprint, sourceRefs.map(s => s.path + s.sha256).sort()]))
        .digest('hex');
      // Each turn gets a new orchestrator, so what must outlive a turn is kept in the conversation state:
      // recorded result files, and required-report lints already applied (asked for once, not on every follow-up).
      const state = await readJSON<{sessionKey?: string; settled?: string[]; recorded?: Record<string, string>}>(
        statePath,
        {},
      );
      const fresh = state.sessionKey !== key;
      const settled = new Set(fresh ? [] : (state.settled ?? []));
      for (const [name, sha] of Object.entries(fresh ? {} : (state.recorded ?? {}))) recorded.set(name, sha);
      const saveState = () =>
        atomicJSON(statePath, {sessionKey: key, settled: [...settled], recorded: Object.fromEntries(recorded)});
      let prompt = followUpPrompt(question, until);
      if (fresh) {
        await rm(stageDir, {recursive: true, force: true});
        await rm(statePath, {force: true});
        const profiles = compactProfiles((await this.options.profileSources?.(sources)) ?? []);
        const profilesPath = join(paths.metadata, 'source-profiles.json');
        await writeFile(profilesPath, JSON.stringify(profiles));
        let dataFindings: CompactFindings | undefined;
        try {
          const found = await this.options.findData?.(sources);
          dataFindings = found && compactFindings(found);
        } catch (error) {
          await log.append({type: 'data_findings', error: String((error as Error).message).slice(0, 300)});
        }
        const context = await readFile(paths.context, 'utf8');
        const known = {question, until, stageDir, context, sources, profilesPath, dataFindings, paths, config};
        prompt = buildStagePrompt(known);
      }
      const priorOutputs = (await outputs().catch(() => [])).length; // the stage folder may not exist yet
      let reply = await turn(prompt, fresh);
      await saveState();
      if (!reply) throw new Error('The analyst gave no reply');
      // One extra turn at most: a computed result must not be withheld behind a question, and plugin
      // lints on the reply (for example how rates are shown) are applied once.
      const lints = loadLints(config.bundledRoot);
      const nudges = [
        ...((await outputs()).length > priorOutputs && withheldResult(reply) ? [deliverPrompt] : []),
        ...lintHints(reply, lints, 'reply', new Set(settled)).map(h => `Revise your reply: ${h}`),
      ];
      for (const lint of lints) if (lint.when === 'absent' && lintApplies(lint, reply, 'reply')) settled.add(lint.id);
      if (nudges.length) {
        try {
          reply = (await turn(harnessNote(`${nudges.join(' ')} ${completeReply}`), false)) || reply;
        } catch (error) {
          if (signal.aborted) throw error;
        }
      }
      let missing = unverifiedFigures(reply, await outputs());
      // One follow-up in the same session replaces handoff repair: figures must come from a script that ran.
      if (missing.length) {
        try {
          reply = (await turn(recheckPrompt(missing), false)) || reply;
          missing = unverifiedFigures(reply, await outputs());
        } catch (error) {
          if (signal.aborted) throw error;
        }
      }
      await saveState();
      let notice = missing.length ? `Not verified against an executed script: ${missing.join(', ')}.` : '';
      let rich: Awaited<ReturnType<typeof bindExploration>> = {issues: []};
      if (presented && this.options.explorationEnabled !== false) {
        try {
          const {checkpoint, ref} = await sealPresentation(paths.root, stageDir, presented, recorded, sourceRefs, {
            runId: run.id,
            conversationId: conversation,
          });
          run.checkpoint = ref;
          await this.options.onCheckpoint?.();
          rich = await bindExploration(paths.root, checkpoint, ref);
          if (rich.issues.length) notice += ` Some views could not be shown: ${rich.issues.join('; ')}.`;
        } catch (error) {
          notice += ` The requested views could not be delivered: ${(error as Error).message}.`;
        }
      }
      if (signal.aborted) throw new Error('cancelled');
      await this.options.onMessage([reply, notice.trim()].filter(Boolean).join('\n\n'), {
        runId: run.id,
        ...(rich.result ? {exploration: rich.result} : {}),
      });
      // The delivered figures stay valid only while their frozen evidence and the sources are unchanged.
      if (run.checkpoint && !(await loadCheckpoint(paths.root, run.checkpoint, conversation)))
        throw new Error('evidence changed');
      if (!(await stableRefs(paths.root, sourceRefs))) throw new Error('source changed');
      run.outcome = {kind: 'complete'};
    } catch (error) {
      await this.options.onInvalidate?.();
      run.checkpoint = undefined;
      run.outcome = {kind: 'no-verified-answer', reason: (error as Error).message};
      await this.options.onMessage(failureMessage((error as Error).message), {runId: run.id});
    }
    return {
      outcome: run.outcome,
      checkpoint: run.checkpoint,
      workflow: {schemaVersion: 1, thinkingLevel: config.thinkingLevel, budget: budget.metrics()},
    };
  }
}
