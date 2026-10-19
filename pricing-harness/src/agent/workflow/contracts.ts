import type {HarnessConfig} from '../../runtime.js';
import type {BundleInfo} from '../bundle.js';
import type {WorkflowBudget} from './budget.js';
import type {ExplorationSpec} from '../../exploration.js';
export type FileRef = {path: string; sha256: string};
export type Execution = {
  id: string;
  script: FileRef;
  output: FileRef;
  success: boolean;
  accessed?: FileRef[];
  provenance?: FileRef;
};
export type StageRequest = {
  schemaVersion: 1;
  runId: string;
  conversationId: string;
  stageDir: string;
  config: HarnessConfig;
  bundle: BundleInfo;
  prompt: string;
  fresh: boolean;
  sources?: FileRef[];
  until?: number;
  recorded?: Record<string, string>;
};
export type StageResult = {
  schemaVersion: 1;
  sessionId: string;
  text: string;
};
// A presented result, frozen: the result files it was built from, the sources, and what to show.
export type Checkpoint = {
  schemaVersion: 2;
  id: string;
  runId: string;
  conversationId: string;
  sources: FileRef[];
  files: (FileRef & {name: string})[];
  createdAt: string;
  exploration: ExplorationSpec;
};
export interface Runner {
  execute(
    request: StageRequest,
    budget: WorkflowBudget,
    signal: AbortSignal,
    onEvent: (event: Record<string, any>) => void,
  ): Promise<StageResult>;
  readonly activeCount: number;
}
