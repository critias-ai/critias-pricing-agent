import type {FileRef} from './agent/workflow/contracts.js';
import type {ExplorationResult} from './exploration.js';
import type {WorkflowBudget} from './agent/workflow/budget.js';
export type SourceFile = {
  id: string;
  name: string;
  relativePath: string;
  bytes: number;
  sha256: string;
  addedAt: string;
  kind: 'csv' | 'xlsx' | 'text' | 'markdown';
};
export type RunState = 'running' | 'cancelling' | 'completed' | 'cancelled' | 'failed' | 'interrupted';
export type RunRecord = {
  schemaVersion: 1;
  id: string;
  sessionId: string;
  requestId: string;
  state: RunState;
  startedAt: string;
  endedAt?: string;
  inputs: Pick<SourceFile, 'id' | 'relativePath' | 'sha256'>[];
  selectedFileIds: string[];
  bundleFingerprint: string;
  provider: string;
  modelId: string;
  versions: Record<string, string>;
  error?: {code: string; message: string};
  outcome?: {kind: 'complete' | 'no-verified-answer'; reason?: string};
  checkpoint?: FileRef;
  workflow?: {
    schemaVersion: 1;
    thinkingLevel?: string;
    budget: ReturnType<WorkflowBudget['metrics']>;
  };
};
export type Artifact = {
  id: string;
  runId: string;
  name: string;
  relativePath: string;
  mediaType: string;
  bytes: number;
  sha256: string;
};
export type PublishedManifest = {schemaVersion: 1; runId: string; files: {name: string; mediaType: string}[]};
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  complete: boolean;
  runId?: string;
  exploration?: ExplorationResult;
  explorationNotice?: string;
};
export type AssistantMessageOptions = Pick<ChatMessage, 'runId' | 'exploration' | 'explorationNotice'>;
export type StepStage = 'analyse';
export type StepKind = 'stage' | 'tool' | 'model';
export type StepState = 'waiting' | 'running' | 'done' | 'retried' | 'skipped';
// One unit of visible work in a run; later events with the same stepId replace earlier ones.
export type Step = {
  runId: string;
  stepId: string;
  stage: StepStage;
  kind: StepKind;
  name: string;
  state: StepState;
  startedAt: string;
  endedAt?: string;
  summary: string;
  detail?: string;
};
export type SessionSnapshot = {
  serverInstanceId: string;
  sequence: number;
  sessionId: string;
  busy: boolean;
  activeRun: RunRecord | null;
  runs: RunRecord[];
  messages: ChatMessage[];
  artifacts: Artifact[];
  activeSteps: Step[];
};
export type HarnessEvent = {serverInstanceId: string; sequence: number; sessionId: string; runId: string | null} & (
  | {type: 'hello'; payload: {sequence: number}}
  | {type: 'message'; payload: ChatMessage}
  | {type: 'step'; payload: Step}
  | {
      type: 'status';
      payload: {
        phase: 'running' | 'cancelling';
        detail: string;
        startedAt?: string;
      };
    }
  | {type: 'error'; payload: {code: string; message: string; retryable: boolean}}
  | {type: 'settled'; payload: {snapshot: SessionSnapshot}}
);
export type SubmitRequest = {requestId: string; text: string; fileIds: string[]; thinkingLevel?: string};
export type RunAccepted = {runId: string; sessionId: string; requestId: string};
export class HarnessError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public retryable = false,
  ) {
    super(message);
  }
}
