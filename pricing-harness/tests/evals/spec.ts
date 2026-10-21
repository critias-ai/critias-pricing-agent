export type Row = Record<string, string>;
// A CSV the analyst is asked to save; partial: the answer key lists only some rows (others are allowed).
// ask: how the runner's save turn, sent after the people turns, asks for this file in plain words.
export type CsvCheck = {file: string; keyColumns: string[]; valueColumns: string[]; partial?: boolean; ask?: string};
export type EvalCase = {
  id: string;
  inputDir: string;
  contextFile?: string;
  // Extra files the user uploads beside inputDir's, such as another company's context file.
  uploads?: string[];
  // expectQuestion: true needs a blocking question in that turn; false fails one (over-asking).
  turns: {text: string; expectQuestion?: boolean}[];
  csvChecks: CsvCheck[];
  expectChart?: boolean;
  // Routing, over the whole conversation: plugin files (path endings, e.g. "peer-comparisons.md") that must and must
  // not be read. A read is necessary, not sufficient, so must-not is the main assertion.
  expectReads?: {must?: string[]; mustNot?: string[]};
  // What .pricing/context.md holds after the run: case-insensitive patterns for confirmed facts, and for anything
  // unconfirmed that must not be saved. keep: every line of the starting context is still there, word for word.
  // unchanged: the file was not changed at all.
  expectContext?: {must?: string[]; mustNot?: string[]; keep?: boolean; unchanged?: boolean};
  // Tools that must not be called anywhere in the conversation, such as "query" for a definition question.
  expectTools?: {mustNot: string[]};
  // Known-correct script: `python3 -I <solution> <inputDir> <caseId>` prints {"files": {...}, "reply": "..."}.
  solution?: string;
};
// The answer key, kept in keys/<id>.json. replyNumbers must appear (by absolute value) in the reply to people
// turn `turn` (1-based; default the last); with `label`, within a few words of it; with `signed`, with its sign,
// written or as a word such as "fell". hardNegatives: per file, key-column ids that must not be listed (an outlier
// list's clear non-outliers); the file's key rows are the required ones, and anything else is ignored. rubric is graded by judge.ts on live runs; judgeOracle holds hand-written
// replies with the rubric ids each must fail, for `--oracle --judge`.
export type RubricItem = {id: string; text: string; kind: 'must' | 'must_not'};
export type AnswerKey = {
  canary?: string; // marks the file so it can be filtered out of model training data
  moneyTolerance: string;
  files: Record<string, Row[]>;
  replyNumbers?: {value: number; tolerance: number; turn?: number; label?: string; signed?: boolean}[];
  hardNegatives?: Record<string, string[]>;
  // The planted truth, given to the judge beside the context file.
  judgeTruth?: string;
  rubric?: RubricItem[];
  judgeOracle?: {replies: string[]; fails: string[]}[];
};
// What one run produced, whether from the live analyst or from a solution script.
export type Outcome = {
  files: Record<string, Row[]>;
  replies: string[];
  charts: number;
  error?: string;
  // Live runs only: plugin files read and the saved context.
  reads?: string[];
  context?: string;
  contextStart?: string;
  judgeAnswer?: string;
  judgeMetrics?: JudgeMetrics;
  tools?: string[];
  metrics?: RunMetrics;
};
// One rubric judge call. costUSD is the provider's price list applied to the tokens, also under a subscription login.
export type JudgeMetrics = {seconds: number; inputTokens: number; outputTokens: number; costUSD: number};
export type RunMetrics = {
  seconds: number;
  costUSD: number;
  modelCalls: number;
  toolCalls: number;
  toolErrors: number;
  invalidCalls: number;
  // Distinct knowledge cards read over the conversation, so bulk-reading shows up.
  cards: number;
};
export type Condition = {
  model: string;
  thinking: string;
  commit: string;
  versions: Record<string, string>;
  bundleFingerprint: string;
};
