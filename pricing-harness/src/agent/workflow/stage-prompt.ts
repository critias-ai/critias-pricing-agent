import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {HarnessConfig} from '../../runtime.js';
import type {WorkspacePaths} from '../../workspace.js';
import type {SourceFile} from '../../contracts.js';
import type {CompactFindings} from './data-findings.js';
import {defang, harnessNote} from './role-prompts.js';
import {toShellPath as sh} from '../../runtime.js';
export type StagePromptInput = {
  question: string;
  context: string;
  stageDir: string;
  paths: Pick<WorkspacePaths, 'root' | 'cache' | 'tmp'>;
  config: Pick<HarnessConfig, 'pythonPath' | 'bundledRoot' | 'duckdbMemoryLimit' | 'duckdbThreads'>;
  sources: Pick<SourceFile, 'relativePath' | 'sha256' | 'kind'>[];
  dataFindings?: CompactFindings;
  until: number;
  profilesPath: string;
};
const deadline = (end: number) =>
  `${new Date(end - 60000).toISOString()} (${Math.round((end - 60000 - Date.now()) / 60000)} minutes from now)`;
// The routing skill (which lists every other skill) and the rules every skill defers to are loaded up front, so
// the analyst starts with them in context and reads only the skill that fits the request.
export const PRELOADED = [
  'pricing-plugin/skills/pricing-triage/SKILL.md',
  'pricing-plugin/skills/references/shared-rules.md',
  'pricing-plugin/skills/knowledge/metric-verification.md',
];
export function preloadedMethod(bundledRoot: string): string {
  return PRELOADED.map(rel => {
    try {
      const text = readFileSync(join(bundledRoot, rel), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
      return `<${rel}>\n${text.trim()}\n</${rel}>`;
    } catch {
      return '';
    }
  })
    .filter(Boolean)
    .join('\n\n');
}

export function buildStagePrompt(p: StagePromptInput): string {
  return `Question: ${p.question}
Working directory: ${sh(p.stageDir)}
Python: ${sh(p.config.pythonPath)} (duckdb and pandas installed)
Deadline: ${deadline(p.until)}.
Confirmed business context (${sh(join(p.paths.root, '.pricing/context.md'))}):
${defang(p.context)}
Sources (relative to ${sh(p.paths.root)}):
${defang(p.sources.map(s => s.relativePath).join('\n'))}

Scripts: read files the query tool saved (\`save\`); do filtering, grouping and sums of source rows in SQL first.

Column profiles for every CSV (inferred types, null and blank counts, ranges, frequent values): ${sh(p.profilesPath)}

Method, preloaded (read the skill that fits the request; the routing skill lists them):
${preloadedMethod(p.config.bundledRoot)}
${
  p.dataFindings
    ? `
Data findings: code-detected anomalies in the CSV and XLSX sources, largest value at stake first. "gaps" lists sources the checks could not read and checks that could not run; where your answer depends on one, check that risk yourself. They are facts, not decisions. Check whether a finding touches the rows your answer depends on and bound its effect as the shared rules describe: if it cannot change the conclusion, deliver and name the finding ids and the amount; if it could, show both results and ask. Never drop or rewrite rows on your own judgement. Full list: ${sh(p.dataFindings.findingsDir)}/findings.json
${defang(JSON.stringify(p.dataFindings))}`
    : ''
}`;
}
export const followUpPrompt = (question: string, until: number) =>
  `Follow-up question: ${question}\n\nDeadline: ${deadline(until)}.\nAlready in this conversation: the routing skill, shared rules, metric verification, context.md and every file you read earlier. Read one again only if it may have changed.`;
// A follow-up that is answered with only the corrected part would replace the full answer the user receives.
export const completeReply = 'Send your complete reply again, not only the changed part.';
export const deliverPrompt =
  'You ran analyses but your reply shows no result. Deliver the result on the basis you used, with its range and what was left out, and put your question last.';
export const recheckPrompt = (figures: string[]) =>
  harnessNote(
    `These figures in your reply do not appear in any executed output: ${figures.join(', ')}. Recompute them with a script or remove them. ${completeReply}`,
  );
