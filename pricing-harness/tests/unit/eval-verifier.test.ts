import {expect, it} from 'vitest';
import {
  blockingQuestion,
  compareRows,
  hasFigure,
  replyNumbers,
  report,
  scoreOutcome,
  spread,
  tolerance,
} from '../evals/verify.js';
import type {EvalCase, Outcome} from '../evals/spec.js';
import {pluginReads, saveTurn, USAGE_LIMIT} from '../evals/run.js';
import {grade} from '../evals/judge.js';
it('checks membership and exact boundaries independently', () => {
  const expected = [
    {product: 'A', revenue: '50000', margin: '.35', deviation_bps: '500', outlier: 'true', detail_needed: 'false'},
    {product: 'B', revenue: '90000', margin: '.30', deviation_bps: '0', outlier: 'false', detail_needed: 'true'},
  ];
  const columns = ['revenue', 'margin', 'deviation_bps', 'outlier', 'detail_needed'];
  expect(compareRows(expected, expected, ['product'], columns, '.01')).toEqual([]);
  expect(compareRows(expected.slice(0, 1), expected, ['product'], ['revenue'], '.01')).toContain('Missing row: B');
  const broken = [{...expected[0], detail_needed: 'true'}, expected[1]!];
  expect(compareRows(broken, expected, ['product'], ['detail_needed'], '.01').length).toBe(1);
  expect(compareRows(expected, expected.slice(0, 1), ['product'], ['revenue'], '.01')).toEqual(['Unexpected row: B']);
  expect(compareRows(expected, expected.slice(0, 1), ['product'], ['revenue'], '.01', true)).toEqual([]);
});
it('keeps money, margin and bps tolerances distinct', () => {
  expect(tolerance('price_40_margin', '1')).toBe('1');
  expect(tolerance('pocket_margin_pct', '1')).toBe('0.01');
  const expected = [{id: 'a', revenue: '1', margin: '.3', deviation_bps: '499.99'}];
  const columns = ['revenue', 'margin', 'deviation_bps'];
  expect(
    compareRows(
      [{id: 'a', revenue: '1.009', margin: '.30000000009', deviation_bps: '499.9900009'}],
      expected,
      ['id'],
      columns,
      '.01',
    ),
  ).toEqual([]);
  expect(
    compareRows(
      [{id: 'a', revenue: '1.011', margin: '.30000001', deviation_bps: '500'}],
      expected,
      ['id'],
      columns,
      '.01',
    ),
  ).toHaveLength(3);
});
it('reads figures from a reply however they are written', () => {
  expect(replyNumbers('Sales £1,234.50 (98.3%), margin fell −8.74 pp')).toEqual([1234.5, 98.3, -8.74]);
});
const spec: EvalCase = {
  id: 'c',
  inputDir: '.',
  turns: [{text: 'ask', expectQuestion: true}, {text: 'answer'}],
  csvChecks: [{file: 'bridge.csv', keyColumns: ['step'], valueColumns: ['gbp'], partial: true}],
  expectChart: true,
};
const outcome = (price: string, reply = 'Change was -1.11 pp', charts = 1): Outcome => ({
  files: {
    'bridge.csv': [
      {step: 'start', gbp: '100'},
      {step: 'price', gbp: price},
      {step: 'end', gbp: '90'},
    ],
  },
  replies: ['Which basis?', reply],
  charts,
});
const key = {
  moneyTolerance: '1',
  files: {
    'bridge.csv': [
      {step: 'start', gbp: '100'},
      {step: 'end', gbp: '90.4'},
    ],
  },
  replyNumbers: [{value: -1.11, tolerance: 0.02}],
};
it('scores a run against the key, the reply, questions and charts', () => {
  expect(scoreOutcome(spec, key, outcome('-5'))).toEqual([]);
  expect(scoreOutcome(spec, key, {...outcome('-5', 'fell 1.11 points', 0), replies: ['Done.', 'fell 1.11']})).toEqual([
    'Turn 1: expected a question',
    'No chart shown',
  ]);
  expect(scoreOutcome(spec, key, outcome('-5', 'about 2 pp'))).toEqual(['Reply lacks -1.11 (±0.02)']);
  expect(scoreOutcome(spec, key, {files: {}, replies: [], charts: 0, error: 'Turn 1: timed out'})).toEqual([
    'Turn 1: timed out',
  ]);
});
it('reads reply figures from the turn the key names', () => {
  const turned = {...key, replyNumbers: [{value: 7, tolerance: 0, turn: 1}]};
  expect(scoreOutcome(spec, turned, {...outcome('-5'), replies: ['It fell 7?', 'No figures here.']})).toEqual([]);
  expect(scoreOutcome(spec, turned, {...outcome('-5'), replies: ['None?', 'It fell 7.']})).toEqual([
    'Reply 1 lacks 7 (±0)',
  ]);
});
it('passes a rubric item only on quoted evidence', () => {
  const rubric = [
    {id: 'R1', kind: 'must' as const, text: 'names S08'},
    {id: 'R2', kind: 'must_not' as const, text: 'calls it elasticity'},
  ];
  const replies = ['Losing S08 is the  biggest driver.'];
  const answer = (v: object[]) => 'Here: ' + JSON.stringify(v);
  expect(
    grade(
      answer([
        {id: 'R1', pass: true, quote: 'losing s08 is the biggest'},
        {id: 'R2', pass: true, quote: ''},
      ]),
      replies,
      rubric,
    ),
  ).toEqual([]);
  expect(
    grade(
      answer([
        {id: 'R1', pass: true, quote: 'S08 was lost'},
        {id: 'R2', pass: false, quote: 'elasticity'},
      ]),
      replies,
      rubric,
    ),
  ).toEqual(['Rubric R1 failed: "S08 was lost"']);
  expect(grade(answer([{id: 'R2', pass: false, quote: 'biggest driver'}]), replies, rubric)).toEqual([
    'Rubric R1 failed',
    'Rubric R2 failed: "biggest driver"',
  ]);
  expect(grade('not json', replies, rubric)).toEqual(['Rubric R1 failed', 'Rubric R2 failed']);
});
it('asks for every graded file in one closing save turn', () => {
  expect(saveTurn({...spec, csvChecks: [{...spec.csvChecks[0]!, ask: 'bridge.csv with columns step,gbp'}]})).toBe(
    'Thanks. For my records, please save these, using the figures you already gave me, unrounded: bridge.csv with columns step,gbp.',
  );
  expect(saveTurn(spec)).toBeUndefined();
});
it('finds where repeats disagree, even when each passes the key', () => {
  expect(spread(spec.csvChecks, [outcome('-5'), outcome('-5.4')], '1')).toEqual([]);
  expect(spread(spec.csvChecks, [outcome('-5'), outcome('7')], '1')).toEqual([
    {file: 'bridge.csv', row: 'price', column: 'gbp', values: ['-5', '7']},
  ]);
  expect(spread(spec.csvChecks, [outcome('-5'), {files: {}, replies: [], charts: 0}], '1')[0]?.values).toEqual([
    'saved by 1 of 2',
  ]);
  const text = report(
    undefined,
    [
      {
        id: 'c',
        outcomes: [outcome('-5'), outcome('7')],
        failures: [[], ['x']],
        spread: spread(spec.csvChecks, [outcome('-5'), outcome('7')], '1'),
        consistencyChecked: true,
      },
    ],
    'now',
  );
  expect(text).toContain('**1 of 2 runs passed. 0 of 1 cases gave the same figures on every repeat.**');
  expect(text).toContain('Runs disagree: bridge.csv price gbp: -5 / 7');
});
it('ties a key figure to its label and sign', () => {
  const figure = {value: -14559.29, tolerance: 1, label: 'gross profit', signed: true};
  expect(hasFigure('Storage gross profit fell £14,559.29 this year.', figure)).toBe(true);
  expect(hasFigure('Storage gross profit moved -£14,559.29.', figure)).toBe(true);
  expect(hasFigure('Storage gross profit rose £14,559.29.', figure)).toBe(false);
  expect(hasFigure('Sales were 14,559.29 and margin was steady; profit is in the appendix.', figure)).toBe(false);
  expect(hasFigure('It rose 14,559.29.', {value: 14559.29, tolerance: 1})).toBe(true);
});
it('reads a rounded k or m figure to its stated precision', () => {
  expect(hasFigure('Stripe paid out €312.1k in 2025.', {value: 312143.47, tolerance: 1})).toBe(true);
  expect(hasFigure('December MRR was €30.8k.', {value: 30792.19, tolerance: 1})).toBe(true);
  expect(hasFigure('December MRR was €31.2k.', {value: 30792.19, tolerance: 1})).toBe(false);
  expect(hasFigure('Sales were £1.2m.', {value: 1234567, tolerance: 1})).toBe(true);
  expect(hasFigure('We kept 12 months of data.', {value: 12000000, tolerance: 1})).toBe(false);
});
it('counts only questions that wait on the user', () => {
  expect(blockingQuestion('Here are the totals. Want a chart?')).toBe(false);
  expect(blockingQuestion('Before I compute margin: are the December rows in both files the same sales?')).toBe(true);
  expect(blockingQuestion('**Would you like** the detail?')).toBe(false);
});
it('fails NaN cells, listed hard negatives, unread or forbidden cards and unconfirmed context', () => {
  const check = {
    id: 'x',
    inputDir: '.',
    turns: [{text: 'q', expectQuestion: true}],
    csvChecks: [{file: 'o.csv', keyColumns: ['sku'], valueColumns: ['gap'], partial: true}],
    expectReads: {must: ['peer-comparisons.md'], mustNot: ['price-waterfall.md']},
    expectContext: {must: ['GBP'], mustNot: ['freight']},
  } satisfies EvalCase;
  const key = {moneyTolerance: '1', files: {'o.csv': [{sku: 'A', gap: '10'}]}, hardNegatives: {'o.csv': ['B']}};
  const run = (o: Partial<Outcome>): Outcome => ({
    files: {'o.csv': [{sku: 'A', gap: '10'}]},
    replies: ['Which basis?'],
    charts: 0,
    ...o,
  });
  expect(scoreOutcome(check, key, run({}))).toEqual([]);
  expect(
    scoreOutcome(
      check,
      key,
      run({
        files: {
          'o.csv': [
            {sku: 'A', gap: '10'},
            {sku: 'B', gap: 'NaN'},
          ],
        },
      }),
    ),
  ).toEqual(['o.csv: NaN or Inf cell (write blank instead)', 'o.csv: false positive B']);
  expect(
    scoreOutcome(
      check,
      key,
      run({reads: ['skills/knowledge/methods/price-waterfall.md'], context: 'Freight is 4%', replies: ['Done.']}),
    ),
  ).toEqual([
    'Turn 1: expected a question',
    'Did not read peer-comparisons.md',
    'Read price-waterfall.md, which it should not',
    'context.md lacks GBP',
    'context.md saved unconfirmed freight',
  ]);
});
it('finds plugin files opened by the read tool or a shell command', () => {
  const op = (tool: string, args: object) => JSON.stringify({tool, args});
  expect(pluginReads(op('read', {path: '/x/bundled/pricing-plugin/skills/pricing-analyze/SKILL.md'}))).toEqual([
    'skills/pricing-analyze/SKILL.md',
  ]);
  expect(
    pluginReads(op('bash', {command: "cat '/x/pricing-plugin/skills/knowledge/margin-drivers.md' | head"})),
  ).toEqual(['skills/knowledge/margin-drivers.md']);
  expect(pluginReads(op('read', {path: 'files/sales.csv'}))).toEqual([]);
  expect(pluginReads('not json')).toEqual([]);
});
it('checks that saved context keeps every line, or is unchanged, and that banned tools stay unused', () => {
  const base = {id: 'x', inputDir: '.', turns: [{text: 'q'}], csvChecks: []};
  const start = '# Pricing context: X\n- Net sales = q × p. [confirmed]\n';
  const run = (o: Partial<Outcome>): Outcome => ({files: {}, replies: ['ok'], charts: 0, contextStart: start, ...o});
  const keep = {...base, expectContext: {keep: true, must: ['april']}} satisfies EvalCase;
  expect(
    scoreOutcome(keep, {moneyTolerance: '1', files: {}}, run({context: start + '- Year starts in April.\n'})),
  ).toEqual([]);
  expect(
    scoreOutcome(keep, {moneyTolerance: '1', files: {}}, run({context: '- Net sales = quantity × price.\n- April.\n'})),
  ).toEqual([
    'context.md lost or reworded: # Pricing context: X',
    'context.md lost or reworded: - Net sales = q × p. [confirmed]',
  ]);
  const still = {...base, expectContext: {unchanged: true}, expectTools: {mustNot: ['query']}} satisfies EvalCase;
  expect(scoreOutcome(still, {moneyTolerance: '1', files: {}}, run({context: start, tools: ['read']}))).toEqual([]);
  expect(scoreOutcome(still, {moneyTolerance: '1', files: {}}, run({context: start + 'x', tools: ['query']}))).toEqual([
    'Called query, which it should not',
    'context.md changed',
  ]);
  expect(
    pluginReads(JSON.stringify({tool: 'read', args: {path: '/b/harness-skills/analysis-visualize/SKILL.md'}})),
  ).toEqual(['harness-skills/analysis-visualize/SKILL.md']);
});
it('lets the context header date change under keep', () => {
  const spec = {
    id: 'x',
    inputDir: '.',
    turns: [{text: 'q'}],
    csvChecks: [],
    expectContext: {keep: true},
  } satisfies EvalCase;
  const start = '# Pricing context: X\nLast updated: 2026-10-01\n- A fact.\n';
  const outcome = {
    files: {},
    replies: ['ok'],
    charts: 0,
    contextStart: start,
    context: start.replace('10-01', '10-16'),
  };
  expect(scoreOutcome(spec, {moneyTolerance: '1', files: {}}, outcome)).toEqual([]);
});
it('matches judge quotes across Markdown and "..." shortening', () => {
  const rubric = [{id: 'R1', kind: 'must' as const, text: 'labels it general'}];
  const replies = ['- **Margin (general definition):** profit over price.\n- **Markup:** profit over cost.'];
  const pass = (quote: string) => grade(JSON.stringify([{id: 'R1', pass: true, quote}]), replies, rubric);
  expect(pass('Margin (general definition): profit over price. Markup: profit over cost.')).toEqual([]);
  expect(pass('**Margin (general definition):** ... profit over cost')).toEqual([]);
  expect(pass('profit over cost ... Margin')).toEqual(['Rubric R1 failed: "profit over cost ... Margin"']);
  expect(pass('...')).toEqual(['Rubric R1 failed: "..."']);
});
it('fails a turn that asks a question it did not need', () => {
  const spec = {id: 'x', inputDir: '.', turns: [{text: 'q', expectQuestion: false}], csvChecks: []} satisfies EvalCase;
  const run = (reply: string): Outcome => ({files: {}, replies: [reply], charts: 0});
  expect(scoreOutcome(spec, {moneyTolerance: '1', files: {}}, run('Margin fell 2.4 pp. Want a chart?'))).toEqual([]);
  expect(scoreOutcome(spec, {moneyTolerance: '1', files: {}}, run('Should returns stay in the totals?'))).toEqual([
    'Turn 1: asked a question it did not need',
  ]);
});
it('recognises a provider usage limit, not an ordinary failure', () => {
  for (const text of [
    '429 Too Many Requests',
    'You have reached your usage limit',
    'Rate limit exceeded',
    'Insufficient credits',
  ])
    expect(USAGE_LIMIT.test(text), text).toBe(true);
  for (const text of ['Provider error: the model stopped before finishing', 'socket hang up', 'Invalid tool arguments'])
    expect(USAGE_LIMIT.test(text), text).toBe(false);
});
it('reads past a "Question:" label before deciding whether a question is an offer', () => {
  expect(blockingQuestion('**Question:** do you want the split by SKU?')).toBe(false);
  expect(blockingQuestion('**Question:** should returns stay in the totals?')).toBe(true);
});
it('counts a "Should I" question that names alternatives as a real question, not an offer', () => {
  expect(blockingQuestion('**Should I apply the attached Brightwater rules here, or use a different basis?**')).toBe(
    true,
  );
  expect(blockingQuestion('Should I run the item-level bridge next?')).toBe(false);
  expect(blockingQuestion('Want a chart or a table?')).toBe(false);
});
it('reads a blank cell as zero, and only as zero', () => {
  const expected = [
    {sku: 'K08', sales: '0.00', pct: '-100.0000'},
    {sku: 'G09', sales: '0.00', pct: '5'},
  ];
  const got = [
    {sku: 'K08', sales: '', pct: ''},
    {sku: 'G09', sales: '', pct: '5'},
  ];
  expect(compareRows(got, expected, ['sku'], ['sales', 'pct'], '1')).toEqual([
    'Mismatch pct: K08 (expected -100.0000, got )',
  ]);
});
it('accepts a question that follows provisional figures', () => {
  const ask = {...spec, turns: [{text: 'What happened?', expectQuestion: true}], expectChart: false};
  const figures = 'Margin fell 1.11 points. **Are the rebates already in the net price?**';
  expect(scoreOutcome(ask, key, {...outcome('-5'), replies: [figures]})).toEqual([]);
});
it('matches row keys whatever their case', () => {
  const expected = [{channel: 'internet', amount: '10'}];
  expect(compareRows([{channel: 'Internet', amount: '10'}], expected, ['channel'], ['amount'], '1')).toEqual([]);
});
it('does not count a context line that says something does not apply', () => {
  const base = {
    id: 'x',
    inputDir: '.',
    turns: [{text: 'q'}],
    csvChecks: [],
    expectContext: {mustNot: ['Brightwater Supplies']},
  };
  const run = (context: string): Outcome => ({files: {}, replies: ['ok'], charts: 0, context});
  const key = {moneyTolerance: '1', files: {}};
  expect(scoreOutcome(base as any, key, run('- The Brightwater Supplies file does not apply here.'))).toEqual([]);
  expect(scoreOutcome(base as any, key, run('## Confirmed by user (Brightwater Supplies, this project)'))).toEqual([
    'context.md saved unconfirmed Brightwater Supplies',
  ]);
});
