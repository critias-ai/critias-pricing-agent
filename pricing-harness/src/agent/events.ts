import {randomUUID} from 'node:crypto';
import type {AgentSessionEvent} from '@earendil-works/pi-coding-agent';
import type {AgentHandle} from './session.js';
import type {
  Artifact,
  AssistantMessageOptions,
  ChatMessage,
  HarnessEvent,
  RunRecord,
  SessionSnapshot,
  Step,
} from '../contracts.js';
type Body = HarnessEvent extends infer E ? (E extends HarnessEvent ? Pick<E, 'type' | 'payload'> : never) : never;
export class EventView {
  private state: SessionSnapshot;
  private listeners = new Set<(event: HarnessEvent) => void>();
  private unsubscribe: () => void = () => {};
  constructor(handle: AgentHandle, initial: {runs: RunRecord[]; artifacts: Artifact[]}) {
    this.state = {
      serverInstanceId: randomUUID(),
      sequence: 0,
      sessionId: handle.session.sessionId,
      busy: false,
      activeRun: null,
      messages: [],
      activeSteps: [],
      ...initial,
    };
    this.bind(handle);
  }
  useLogical(saved?: {sessionId: string; messages: ChatMessage[]}) {
    this.unsubscribe();
    this.unsubscribe = () => {};
    this.state.messages = saved?.messages ?? [];
    if (saved) this.state.sessionId = saved.sessionId;
  }
  appendLogical(role: ChatMessage['role'], text: string, options: AssistantMessageOptions = {}) {
    const message: ChatMessage = {id: randomUUID(), role, text, complete: true, ...options};
    this.state.messages.push(message);
    this.emit({type: 'message', payload: message});
    return message;
  }
  invalidateExplorations(runId: string, notice: string) {
    let changed = false;
    this.state.messages = this.state.messages.map(message => {
      if (message.runId !== runId || !message.exploration) return message;
      changed = true;
      const {exploration: _removed, ...rest} = message;
      return {...rest, explorationNotice: notice};
    });
    if (changed)
      for (const message of this.state.messages.filter(
        message => message.runId === runId && message.explorationNotice === notice,
      ))
        this.emit({type: 'message', payload: message});
  }
  setArtifacts(artifacts: Artifact[]) {
    this.state.artifacts = structuredClone(artifacts);
    this.settle();
  }
  snapshot() {
    return structuredClone(this.state);
  }
  subscribe(listener: (event: HarnessEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  bind(handle: AgentHandle) {
    this.unsubscribe();
    this.state.sessionId = handle.session.sessionId;
    this.state.messages = [];
    const branch = handle.manager.getBranch?.();
    const messages = branch
      ? branch.filter(e => e.type === 'message').map(e => (e.type === 'message' ? e.message : null))
      : handle.session.messages;
    for (const message of messages) this.message(message, true, false);
    this.unsubscribe = handle.session.subscribe(e => this.onEvent(e));
  }
  reserve() {
    this.state.busy = true;
  }
  release() {
    this.state.busy = false;
  }
  setRun(run: RunRecord) {
    if (this.state.activeRun?.id !== run.id) this.state.activeSteps = [];
    this.state.busy = true;
    this.state.activeRun = structuredClone(run);
    this.upsertRun(run);
    this.emit({
      type: 'status',
      payload: {
        phase: run.state === 'cancelling' ? 'cancelling' : 'running',
        detail: run.state,
        startedAt: run.startedAt,
      },
    });
  }
  step(step: Step) {
    if (step.runId !== this.state.activeRun?.id) return;
    const index = this.state.activeSteps.findIndex(s => s.stepId === step.stepId);
    if (index < 0) this.state.activeSteps.push(structuredClone(step));
    else this.state.activeSteps[index] = structuredClone(step);
    this.emit({type: 'step', payload: step});
  }
  settleRun(run: RunRecord, artifacts: Artifact[]) {
    this.state.activeSteps = [];
    this.state.busy = false;
    this.state.activeRun = null;
    this.upsertRun(run);
    this.state.artifacts = structuredClone(artifacts);
    this.settle();
  }
  settle() {
    this.state.sequence++;
    const snapshot = this.snapshot();
    this.publish({...this.envelope(), type: 'settled', payload: {snapshot}});
  }
  error(code: string, message: string) {
    this.emit({type: 'error', payload: {code, message, retryable: false}});
  }
  dispose() {
    this.unsubscribe();
    this.listeners.clear();
  }
  private upsertRun(run: RunRecord) {
    const index = this.state.runs.findIndex(r => r.id === run.id);
    if (index < 0) this.state.runs.push(structuredClone(run));
    else this.state.runs[index] = structuredClone(run);
  }
  private envelope() {
    return {
      serverInstanceId: this.state.serverInstanceId,
      sequence: this.state.sequence,
      sessionId: this.state.sessionId,
      runId: this.state.activeRun?.id ?? null,
    };
  }
  private publish(event: HarnessEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* A disconnected view must not abort analysis. */
      }
    }
  }
  private emit(body: Body) {
    this.state.sequence++;
    this.publish({...this.envelope(), ...body} as HarnessEvent);
  }
  private message(raw: unknown, complete: boolean, publish = true) {
    const m = raw as {role?: string; content?: string | {type: string; text?: string}[]; timestamp?: number};
    if (m.role !== 'user' && m.role !== 'assistant') return;
    let text =
      typeof m.content === 'string'
        ? m.content
        : (m.content ?? [])
            .filter(c => c.type === 'text')
            .map(c => c.text ?? '')
            .join('');
    text = text.replace(/^<harness-run>[\s\S]*?<\/harness-run>\n\n/, '');
    const id = `${m.role}-${m.timestamp ?? 0}`;
    const message: ChatMessage = {id, role: m.role, text, complete};
    const index = this.state.messages.findIndex(old => old.id === id);
    if (index < 0) this.state.messages.push(message);
    else this.state.messages[index] = message;
    if (publish) this.emit({type: 'message', payload: message});
  }
  private onEvent(event: AgentSessionEvent) {
    if (event.type === 'message_start' || event.type === 'message_update' || event.type === 'message_end')
      this.message(event.message, event.type === 'message_end');
  }
}
