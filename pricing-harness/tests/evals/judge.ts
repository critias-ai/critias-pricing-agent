// Rubric judge for open-ended cases: one model call per run, from another family than the analyst's. Thinking is off
// unless PRICING_JUDGE_THINKING names a level.
// A "must" item passes only with a quote found in the replies; a "must_not" item fails only with one.
import {dirname, join, resolve} from 'node:path';
import type {ThinkingLevel} from '@earendil-works/pi-ai';
import {resolveModel, type HarnessConfig} from '../../src/runtime.js';
import type {JudgeMetrics, RubricItem} from './spec.js';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '../..');
export type Verdict = {id: string; pass: boolean; quote: string};
// Quotes are compared as plain words: Markdown marks and list bullets are dropped, and a quote shortened with "..."
// must match each of its parts, in order. Bullets are dropped mid-line too, as judges quote list items run together.
const flat = (text: string) =>
  text
    .replace(/[*_`#>]/g, '')
    .replace(/(^|\s)(?:[-+]|\d{1,2}\.)(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const found = (said: string, quote: string) => {
  const parts = flat(quote)
    .split(/\.\.\.|…/)
    .map(s => s.trim())
    .filter(Boolean);
  let from = 0;
  for (const part of parts) {
    const at = said.indexOf(part, from);
    if (at < 0) return false;
    from = at + part.length;
  }
  return parts.length > 0;
};

export function judgePrompt(turns: string[], replies: string[], rubric: RubricItem[], context = '', truth = '') {
  const talk = turns.map(
    (t, i) => `### Manager, turn ${i + 1}\n${t}\n\n### Analyst, turn ${i + 1}\n${replies[i] ?? ''}`,
  );
  const items = rubric.map(
    r => `- ${r.id} (${r.kind === 'must' ? 'the analyst must do this' : 'the analyst must not do this'}): ${r.text}`,
  );
  return [
    "You grade an analyst's replies against a rubric. Judge what the replies say, using the facts below to tell a right claim from a wrong one.",
    '',
    ...(context ? ['## What the company has confirmed', context, ''] : []),
    ...(truth ? ['## What is true in this data (the analyst did not see this)', truth, ''] : []),
    ...talk,
    '',
    '## Rubric',
    ...items,
    '',
    'For each item give pass: true when the replies meet it (for a "must not" item: when they do not do it).',
    'A generic caveat or hedge does not meet an item: the passage must address its specific point.',
    'quote: an exact, short passage copied from the analyst\'s replies that shows your verdict; for a passed "must not" item use "".',
    'Answer with JSON only: [{"id": "...", "pass": true, "quote": "..."}], one entry per item.',
  ].join('\n');
}

// The rubric ids that fail, with the evidence, for one judge answer.
export function grade(answer: string, replies: string[], rubric: RubricItem[]) {
  let verdicts: Verdict[] = [];
  try {
    verdicts = JSON.parse(answer.slice(answer.indexOf('['), answer.lastIndexOf(']') + 1));
  } catch {}
  const said = flat(replies.join('\n'));
  return rubric.flatMap(item => {
    const v = verdicts.find(x => x?.id === item.id);
    const quoted = !!v?.quote && found(said, String(v.quote));
    const pass = item.kind === 'must' ? !!v?.pass && quoted : !!v && (v.pass || !quoted);
    return pass ? [] : [`Rubric ${item.id} failed${v?.quote ? `: "${String(v.quote).slice(0, 160)}"` : ''}`];
  });
}

const family = (id: string, provider: string) => (id.includes('/') ? id.split('/')[0] : provider);

// keep: receives the judge's raw answer, so a later grading fix can re-score it without another call, and the call's
// tokens, cost and seconds, so the report shows the judge apart from the analyst.
export async function judge(
  turns: string[],
  replies: string[],
  rubric: RubricItem[],
  context = '',
  truth = '',
  keep: (answer: string, metrics: JudgeMetrics) => void = () => {},
) {
  try {
    process.loadEnvFile(join(ROOT, '.env')); // the runner, unlike the harness it starts, has not read .env
  } catch {}
  const modelId = process.env.PRICING_JUDGE_MODEL?.trim();
  if (!modelId) throw new Error('Set PRICING_JUDGE_MODEL to grade rubric cases');
  const provider = process.env.PRICING_JUDGE_PROVIDER ?? process.env.PRICING_PROVIDER ?? 'openrouter';
  const analyst = process.env.PRICING_MODEL?.trim();
  if (analyst && family(modelId, provider) === family(analyst, process.env.PRICING_PROVIDER ?? 'openrouter'))
    throw new Error('PRICING_JUDGE_MODEL must come from another model family than the analyst');
  const {runtime, model} = await resolveModel({provider, modelId, maxOutputTokens: 32000} as HarnessConfig); // high reasoning used up 8,000 and left no answer
  const level = process.env.PRICING_JUDGE_THINKING?.trim();
  const started = Date.now();
  const reply = await runtime.completeSimple(
    model,
    {messages: [{role: 'user', content: judgePrompt(turns, replies, rubric, context, truth), timestamp: Date.now()}]},
    level && level !== 'off' ? {reasoning: level as ThinkingLevel} : {},
  );
  if (reply.stopReason === 'error') throw new Error(reply.errorMessage ?? 'judge call failed');
  const answer = reply.content.flatMap(c => (c.type === 'text' ? [c.text] : [])).join('');
  keep(answer, {
    seconds: (Date.now() - started) / 1000,
    inputTokens: reply.usage?.input ?? 0,
    outputTokens: reply.usage?.output ?? 0,
    costUSD: reply.usage?.cost?.total ?? 0,
  });
  return grade(answer, replies, rubric);
}
