import type {Step, StepState} from '../../contracts.js';

export const STEP_SUMMARY_CHARS = 200;
export const STEP_DETAIL_CHARS = 1000;
const stage = 'analyse';
const STAGE_SUMMARY = {analyse: 'Analysing'};
const TOKEN_EVENTS = ['text_delta', 'thinking_delta', 'toolcall_start', 'toolcall_delta'];
export const clip = (text: string, limit: number) => (text.length > limit ? `${text.slice(0, limit - 1)}…` : text);
const fileName = (path: unknown) =>
  String(path ?? '')
    .split(/[\\/]/)
    .filter(Boolean)
    .at(-1) ?? '';

// Fixed per-tool wording from the call's arguments; never model-written.
export function toolSummary(tool: string, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  const summary =
    tool === 'execute_analysis'
      ? `Ran ${fileName(a.filePath)}`
      : tool === 'query'
        ? `Query: ${clip(
            String(a.sql ?? '')
              .replace(/\s+/g, ' ')
              .trim(),
            60,
          )}`
        : tool === 'read'
          ? `Read ${fileName(a.path)}`
          : tool === 'write'
            ? `Wrote ${fileName(a.path)}`
            : tool === 'edit'
              ? `Edited ${fileName(a.path)}`
              : tool === 'bash'
                ? `Ran command: ${clip(
                    String(a.command ?? '')
                      .replace(/\s+/g, ' ')
                      .trim(),
                    60,
                  )}`
                : tool;
  return clip(summary, STEP_SUMMARY_CHARS);
}

const resultText = (result: unknown) =>
  ((result as {content?: {type: string; text?: string}[]})?.content ?? [])
    .filter(c => c.type === 'text')
    .map(c => c.text ?? '')
    .join('\n');

// Compact step events a stage worker sends to the controller for one SDK session event.
export function workerStepEvents(raw: unknown, model: {tokenSeen: boolean}): Record<string, unknown>[] {
  const event = raw as {type: string; [key: string]: any};
  if (event.type === 'tool_execution_start')
    return [
      {
        type: 'tool_start',
        callId: event.toolCallId,
        tool: event.toolName,
        summary: toolSummary(event.toolName, event.args),
      },
    ];
  if (event.type === 'tool_execution_end')
    return [
      {
        type: 'tool_end',
        callId: event.toolCallId,
        isError: event.isError === true,
        ...(event.isError ? {error: clip(resultText(event.result), STEP_DETAIL_CHARS)} : {}),
      },
    ];
  if (event.type === 'message_update' && !model.tokenSeen && TOKEN_EVENTS.includes(event.assistantMessageEvent?.type)) {
    model.tokenSeen = true;
    return [{type: 'model_first_token'}];
  }
  return [];
}

// Turns stage boundaries and worker step events into upserted UI steps for one run.
export class StepTracker {
  private stages = 0;
  private models = 0;
  private tools = 0;
  // Provider call IDs are not unique per run; each call gets its own tool-N step.
  private calls = new Map<string, string>();
  private open = new Map<string, Step>();
  private model?: Step;

  constructor(
    private runId: string,
    private publish: (step: Step) => void,
    private now: () => string = () => new Date().toISOString(),
  ) {}

  stageStart(): string {
    const step: Step = {
      runId: this.runId,
      stepId: `stage-${++this.stages}`,
      stage,
      kind: 'stage',
      name: stage,
      state: 'running',
      startedAt: this.now(),
      summary: STAGE_SUMMARY[stage],
    };
    this.open.set(step.stepId, step);
    this.emit(step);
    return step.stepId;
  }

  // Closes the stage and anything its worker left open.
  stageEnd(stageId: string) {
    const endedAt = this.now();
    this.calls.clear();
    for (const step of [...this.open.values()]) if (step.kind !== 'stage') this.close(step, 'done', endedAt);
    const stage = this.open.get(stageId);
    if (stage) this.close(stage, 'done', endedAt);
  }

  event(event: Record<string, any>) {
    if (event.type === 'tool_start') {
      const step: Step = {
        runId: this.runId,
        stepId: `tool-${++this.tools}`,
        stage,
        kind: 'tool',
        name: String(event.tool),
        state: 'running',
        startedAt: this.now(),
        summary: clip(String(event.summary ?? event.tool), STEP_SUMMARY_CHARS),
      };
      this.calls.set(String(event.callId), step.stepId);
      this.open.set(step.stepId, step);
      this.emit(step);
    }
    if (event.type === 'tool_end') {
      const stepId = this.calls.get(String(event.callId));
      this.calls.delete(String(event.callId));
      const step = stepId ? this.open.get(stepId) : undefined;
      if (step)
        this.close(
          step,
          event.isError ? 'retried' : 'done',
          this.now(),
          event.isError ? clip(String(event.error ?? ''), STEP_DETAIL_CHARS) : undefined,
        );
    }
    if (event.type === 'model_start') {
      this.model = {
        runId: this.runId,
        stepId: `model-${++this.models}`,
        stage,
        kind: 'model',
        name: 'model',
        state: 'waiting',
        startedAt: this.now(),
        summary: 'Waiting for model',
      };
      this.open.set(this.model.stepId, this.model);
      this.emit(this.model);
    }
    if (event.type === 'model_first_token' && this.model) {
      this.model = {...this.model, state: 'running', summary: 'Thinking'};
      this.open.set(this.model.stepId, this.model);
      this.emit(this.model);
    }
    if (event.type === 'model_timing' && this.model) this.close(this.model, 'done', this.now());
  }

  private close(step: Step, state: StepState, endedAt: string, detail?: string) {
    this.open.delete(step.stepId);
    if (this.model?.stepId === step.stepId) this.model = undefined;
    this.emit({...step, state, endedAt, ...(detail ? {detail} : {})});
  }

  private emit(step: Step) {
    this.publish({...step});
  }
}
