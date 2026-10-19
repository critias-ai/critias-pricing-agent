import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {
  analystNudges,
  contextAppendOnly,
  copiedShare,
  editErrorHint,
  lintHints,
  loadLints,
  pacing,
  repeatedShare,
  sqlErrorHint,
} from '../../src/agent/workflow/nudges.js';
import {withheldResult} from '../../src/agent/workflow/reply-figures.js';
import {requiredReport} from '../fixtures/lints.js';
import {toShellPath} from '../../src/runtime.js';

it('turns known DuckDB errors into one-line fixes', () => {
  expect(sqlErrorHint('Parser Error: syntax error at or near "value"')).toContain('AS "value"');
  expect(sqlErrorHint('Catalog Error: View with name "flags" already exists!')).toContain(
    'CREATE OR REPLACE VIEW flags',
  );
  expect(sqlErrorHint('Binder Error: Referenced column "status" not found in FROM clause!')).toContain('"status"');
  expect(sqlErrorHint('Binder Error: Ambiguous reference to column name "id"')).toContain('Qualify');
  expect(sqlErrorHint('ZeroDivisionError')).toBeUndefined();
});
it('explains edit mismatches', () => {
  expect(editErrorHint('Found 2 occurrences of the text in a.py. The text must be unique.')).toMatch(/not unique/);
  expect(editErrorHint('Could not find edits[0] in a.py.')).toMatch(/does not match/);
});
it('measures how much of a new script already exists', () => {
  const line = (i: number) => `result_${i} = conn.execute("SELECT * FROM table_${i}").fetchall()`;
  const old = Array.from({length: 20}, (_, i) => line(i)).join('\n');
  const copy = Array.from({length: 20}, (_, i) => line(i)).join('\n') + '\nprint(result_0)\n';
  const fresh = Array.from({length: 20}, (_, i) => line(i + 100)).join('\n');
  expect(copiedShare(copy, [old])).toBeGreaterThan(0.9);
  expect(copiedShare(fresh, [old])).toBe(0);
  expect(copiedShare('a = 1\nb = 2', [old])).toBe(0);
});
it('detects a computed result held back behind a question', () => {
  expect(withheldResult('Which basis should I use for rebates?')).toBe(true);
  expect(withheldResult('Margin was 40.7% on £1,884,195.10. Confirm the rebate treatment?')).toBe(false);
  expect(withheldResult('Done.')).toBe(false);
});

it('measures how much of a statement repeats earlier ones', () => {
  const cte =
    'WITH cls AS (SELECT product_id, MIN(item_type) AS item_type FROM product_master GROUP BY product_id), costed AS (SELECT s.line_id, s.product_id FROM sales_transactions AS s JOIN cls ON cls.product_id = s.product_id)';
  expect(
    repeatedShare(`${cte} SELECT COUNT(*) FROM costed WHERE line_id IS NOT NULL`, [cte + ' SELECT 1']),
  ).toBeGreaterThan(0.5);
  expect(
    repeatedShare('SELECT reporting_month, SUM(net_amount) AS total FROM finance_monthly GROUP BY reporting_month', [
      cte,
    ]),
  ).toBe(0);
});
it('states effort once at 40% and the time left every time', () => {
  expect(pacing(5 * 60000, 15 * 60000)).toBe('[time left: 5 min]');
  expect(pacing(2 * 60000, 15 * 60000)).toMatch(/Wrap up now/);
});

// A minimal pi: records handlers so the registered hooks can be driven directly.
const fakePi = () => {
  const handlers: Record<string, ((e: any, ctx?: any) => any)[]> = {};
  const levels: string[] = [];
  return {
    pi: {
      on: (n: string, h: (e: any, ctx?: any) => any) => (handlers[n] ??= []).push(h),
      setThinkingLevel: (l: string) => levels.push(l),
    },
    levels,
    call: (n: string, e: any, ctx?: any) => handlers[n]?.map(h => h(e, ctx)).find(r => r),
    result: (e: any) => {
      let ev = {...e};
      for (const h of handlers.tool_result ?? []) {
        const r = h(ev);
        if (r?.content) ev = {...ev, content: r.content};
      }
      return ev.content[0].text as string;
    },
  };
};
const stage = () => mkdtempSync(join(tmpdir(), 'nudge-'));

it('blocks installs, and a hook can be switched off by name', () => {
  const on = fakePi();
  analystNudges({stageDir: stage()})(on.pi as any);
  expect(on.call('tool_call', {toolName: 'bash', input: {command: 'pip install x'}})?.block).toBe(true);
  const off = fakePi();
  analystNudges({stageDir: stage(), off: ['no-installs']})(off.pi as any);
  expect(off.call('tool_call', {toolName: 'bash', input: {command: 'pip install x'}})).toBeUndefined();
});
it('reports a slow query and a repeated statement under the result', () => {
  const dir = stage();
  const cte =
    'WITH cls AS (SELECT product_id, MIN(item_type) AS item_type FROM product_master GROUP BY product_id), costed AS (SELECT s.line_id, s.product_id FROM sales_transactions AS s JOIN cls ON cls.product_id = s.product_id)';
  writeFileSync(join(dir, 'query-1.sql'), cte + ' SELECT 1\n');
  const f = fakePi();
  analystNudges({stageDir: dir, slowMs: 0})(f.pi as any);
  const event = {toolName: 'query', toolCallId: 'a', input: {sql: cte + ' SELECT 2'}, isError: false};
  f.call('tool_call', event);
  const out = f.result({...event, content: [{type: 'text', text: 'OK'}]});
  expect(out).toMatch(/OK\n\nHint: this statement took \d+ s/);
  expect(out).toMatch(/repeats earlier ones/);
});
it('drops thinking to the focus level after the first success', () => {
  const f = fakePi();
  analystNudges({stageDir: stage(), level: 'high', focus: 'low'})(f.pi as any);
  f.call('before_agent_start', {});
  f.result({toolName: 'query', toolCallId: 'a', input: {}, isError: false, content: [{type: 'text', text: 'OK'}]});
  f.call('before_agent_start', {});
  expect(f.levels).toEqual(['high', 'low', 'low']);
});

it('stops a tool call whose arguments keep growing, once, and starts over on the next call', () => {
  let stopped = 0;
  const seen: number[] = [];
  const f = fakePi();
  analystNudges({stageDir: stage(), runawayChars: 100, onRunaway: n => seen.push(n)})(f.pi as any);
  const update = (assistantMessageEvent: any) =>
    f.call('message_update', {assistantMessageEvent}, {signal: {}, abort: () => stopped++});
  update({type: 'toolcall_start'});
  update({type: 'toolcall_delta', delta: 'x'.repeat(60)});
  expect(stopped).toBe(0);
  update({type: 'toolcall_delta', delta: 'x'.repeat(60)});
  expect(stopped).toBe(1);
  expect(seen).toEqual([120]);
  update({type: 'toolcall_start'});
  update({type: 'toolcall_delta', delta: 'x'.repeat(60)});
  expect(stopped).toBe(1);
});

it('a plugin lint can require a report that is missing, only where it applies', () => {
  const required = (reply: string) =>
    lintHints(reply, [requiredReport], 'reply').some(h => h.includes('does not report the outlier check'));
  expect(required('Gross margin fell 7.59 pp, from 47.70% to 40.11%.')).toBe(true);
  expect(required('Gross margin fell 7.59 pp. 53 lines (£39,628) sit at least 10× their product median price.')).toBe(
    false,
  );
  expect(required('No lines were priced ten times their median. Gross margin fell 7.59 pp.')).toBe(false);
  // A reply about something else is not asked for the check.
  expect(required('I recorded the confirmed quarter definition in context.md.')).toBe(false);
});

it('keeps confirmed facts in context.md, but lets the header and placeholder text change', () => {
  const before =
    '# Confirmed business context\n\nNo business definitions have been confirmed yet. Ask before adding reusable facts.\n\n' +
    '## Confirmed by the user (2026-10-12)\n- Use gross profit as the margin layer. [scope: rankings]\n\n## Change log\n- 2026-10-12: Added margin layer.\n';
  // What intake does when it adopts the documented header and drops the placeholder: allowed.
  const reheaded =
    '# Pricing context: Northbridge\nScope: not stated\nLast updated: 2026-10-15\n\n## Margins\n- Use gross profit as the margin layer. [scope: rankings]\n' +
    '- Exclude lines without a cost. [scope: margins; confirmed 2026-10-15; user]\n\n## Change log\n- 2026-10-12: Added margin layer.\n- 2026-10-15: Added cost rule.\n';
  expect(contextAppendOnly(before, reheaded)).toBeUndefined();
  // A confirmed fact or a change-log entry may not disappear or be reworded.
  expect(
    contextAppendOnly(before, before.replace('- Use gross profit as the margin layer.', '- Use net profit.')),
  ).toMatch(/Use gross profit/);
  expect(contextAppendOnly(before, before.replace('- 2026-10-12: Added margin layer.\n', ''))).toMatch(
    /Added margin layer/,
  );
});

it('waits for a task skill and a knowledge card before the first calculation, once per conversation', () => {
  const dir = stage();
  const skillsRoot = join(process.cwd(), 'bundled/pricing-plugin/skills');
  const preloaded = ['pricing-triage/SKILL.md', 'references/shared-rules.md', 'knowledge/metric-verification.md'];
  const f = fakePi();
  const visualize = join(process.cwd(), 'bundled/harness-skills/analysis-visualize');
  analystNudges({stageDir: dir, skillsRoot, preloaded, moreSkills: [visualize]})(f.pi as any);
  const query = {toolName: 'query', input: {sql: 'SELECT 1'}};
  const read = (path: string) => f.result({toolName: 'read', input: {path}, content: [{type: 'text', text: 'x'}]});
  const stopped = f.call('tool_call', query);
  expect(stopped?.block).toBe(true);
  expect(stopped.reason).toContain('pricing-analyze: Use when calculating');
  expect(stopped.reason).not.toContain('pricing-triage:');
  expect(stopped.reason).toContain(`knowledge cards in ${toShellPath(join(skillsRoot, 'knowledge'))}`);
  expect(stopped.reason).toContain(
    `analysis-visualize: Show an answer's figures in the chat as a table with a chart. Use for any series over time, ranking, bridge, breakdown, distribution or comparison of two measures. (${toShellPath(visualize)}/SKILL.md)`,
  );
  read(join(skillsRoot, 'pricing-analyze/SKILL.md'));
  read(join(skillsRoot, 'knowledge/metric-verification.md')); // already in context: does not count
  expect(f.call('tool_call', {toolName: 'bash', input: {command: 'python3 a.py'}})?.block).toBe(true);
  // Reading the card through bash counts too.
  f.result({
    toolName: 'bash',
    input: {command: `cat ${skillsRoot}/knowledge/margin-drivers.md`},
    content: [{type: 'text', text: 'x'}],
  });
  expect(f.call('tool_call', query)).toBeUndefined();
  // A follow-up turn on the same stage folder is not stopped again.
  const next = fakePi();
  analystNudges({stageDir: dir, skillsRoot, preloaded})(next.pi as any);
  expect(next.call('tool_call', query)).toBeUndefined();
});

it('holds a Python run that names a source file once per turn', () => {
  const dir = stage();
  const f = fakePi();
  analystNudges({stageDir: dir, sources: ['files/data/sales_transactions.csv'], off: ['skill-read']})(f.pi as any);
  writeFileSync(join(dir, 'bridge.py'), "duckdb.read_csv('../files/data/sales_transactions.csv')");
  writeFileSync(join(dir, 'chart.py'), "pd.read_csv('item_q.csv')");
  // A script that reads a saved result runs.
  expect(f.call('tool_call', {toolName: 'execute_analysis', input: {filePath: 'chart.py'}})).toBeUndefined();
  expect(f.call('tool_call', {toolName: 'bash', input: {command: 'python3 chart.py'}})).toBeUndefined();
  const held = f.call('tool_call', {toolName: 'execute_analysis', input: {filePath: 'bridge.py'}});
  expect(held?.block).toBe(true);
  expect(held.reason).toContain('reads a source file directly');
  // Sent again, it runs.
  expect(f.call('tool_call', {toolName: 'bash', input: {command: `cd ${dir} && python3 bridge.py`}})).toBeUndefined();
  // Commands that are not Python runs are left alone.
  const next = fakePi();
  analystNudges({stageDir: dir, sources: ['files/data/sales_transactions.csv'], off: ['skill-read']})(next.pi as any);
  expect(
    next.call('tool_call', {toolName: 'bash', input: {command: 'head -3 files/data/sales_transactions.csv'}}),
  ).toBeUndefined();
  expect(next.call('tool_call', {toolName: 'bash', input: {command: `cd ${dir} && python3 bridge.py`}})?.block).toBe(
    true,
  );
});
