import type {AnswerKey, Condition, CsvCheck, EvalCase, Outcome, Row} from './spec.js';
function decimal(value: string) {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) throw new Error('Not a canonical decimal');
  const [mantissa, exponent = '0'] = value.toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa!.split('.');
  let scale = fraction.length - Number(exponent);
  if (Math.abs(scale) > 1000) throw new Error('Decimal exponent too large');
  let integer = BigInt((whole === '+' || whole === '-' ? whole + '0' : whole || '0') + fraction);
  if (scale < 0) {
    integer *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return {integer, scale};
}
function near(a: string, b: string, tolerance: string) {
  try {
    const nums = [decimal(a), decimal(b), decimal(tolerance)];
    const scale = Math.max(...nums.map(n => n.scale));
    const [x, y, t] = nums.map(n => n.integer * 10n ** BigInt(scale - n.scale));
    const diff = x! - y!;
    return (diff < 0n ? -diff : diff) <= t!;
  } catch {
    return false;
  }
}
export function tolerance(column: string, money: string) {
  if (/^price/i.test(column)) return money; // price_40_margin is a price, not a margin
  if (/bps/i.test(column)) return '0.000001';
  if (/pp|pct|share/i.test(column)) return '0.01'; // pocket_margin_pct is in %, not a fraction
  if (/margin|rate/i.test(column)) return '0.0000000001';
  return money;
}
const isNumber = (value: string) => /^[+-]?(?:\d|\.\d)/.test(value);
export function compareRows(
  candidate: Row[],
  expected: Row[],
  keys: string[],
  columns: string[],
  moneyTolerance: string,
  partial = false,
): string[] {
  const failures: string[] = [],
    key = (row: Row) => keys.map(k => row[k] ?? '').join('|');
  const actual = new Map<string, Row>();
  for (const row of candidate) {
    const id = key(row);
    if (actual.has(id)) failures.push(`Duplicate row: ${id}`);
    actual.set(id, row);
  }
  const wanted = new Set(expected.map(key));
  for (const row of expected) {
    const id = key(row),
      value = actual.get(id);
    if (!value) {
      failures.push(`Missing row: ${id}`);
      continue;
    }
    for (const column of columns) {
      const target = row[column],
        observed = value[column];
      if (target === undefined) continue; // the key leaves this value open
      if (observed === undefined) {
        failures.push(`Missing column ${column}: ${id}`);
        continue;
      }
      const isFlag = ['true', 'false'].includes(target.toLowerCase());
      if (
        isFlag
          ? observed.toLowerCase() !== target.toLowerCase()
          : isNumber(target)
            ? !near(observed, target, tolerance(column, moneyTolerance))
            : observed !== target
      )
        failures.push(`Mismatch ${column}: ${id} (expected ${target}, got ${observed})`);
    }
  }
  if (!partial) for (const id of actual.keys()) if (!wanted.has(id)) failures.push(`Unexpected row: ${id}`);
  return failures;
}
export function parseCSV(text: string): Row[] {
  const rows: string[][] = [],
    row: string[] = [];
  let cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' && !quoted) {
      row.push(cell.replace(/\r$/, ''));
      rows.push([...row]);
      row.length = 0;
      cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('Malformed CSV quote');
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV header');
  return rows
    .filter(r => r.length !== 1 || r[0] !== '')
    .map(r => {
      if (r.length !== headers.length) throw new Error('CSV width mismatch');
      return Object.fromEntries(headers.map((h, i) => [h, r[i]!]));
    });
}
// Every number written in a reply, as a plain value: "£1,234.5", "98.3%" and "−8.74 pp" give 1234.5, 98.3, -8.74.
export function replyNumbers(text: string) {
  return [...text.replace(/[−–]/g, '-').matchAll(/-?\d[\d,]*(?:\.\d+)?/g)].map(m => Number(m[0].replace(/,/g, '')));
}
const FALL = /\b(fell|falls?|down|decreased?|declined?|lower|loss|lost|dropped|drops?|reduced?)\b[^.\d]{0,25}$/i;
// Whether a reply gives the key figure, near its label and with its sign when the key asks for them.
export function hasFigure(text: string, figure: NonNullable<AnswerKey['replyNumbers']>[number]) {
  const t = text.replace(/[−–]/g, '-');
  return [...t.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)].some(m => {
    const n = Number(m[0].replace(/,/g, '')),
      start = m.index!,
      before = t.slice(Math.max(0, start - 40), start);
    if (Math.abs(Math.abs(n) - Math.abs(figure.value)) > figure.tolerance) return false;
    const near = t.slice(Math.max(0, start - 60), start + m[0].length + 60).toLowerCase();
    if (figure.label && !near.includes(figure.label.toLowerCase())) return false;
    const negative = n < 0 || /-\s*[£$€]\s*$/.test(before) || FALL.test(before);
    return !figure.signed || negative === figure.value < 0;
  });
}
// A question that waits on the user's answer; an offer such as "Want a chart?" is not one.
export function blockingQuestion(text: string) {
  const offer = /^(want|would you like|shall i|should i|do you want|happy to|let me know|if you)/i;
  const lead = /^(?:[*_#>\-\s]|question:)+/i; // bullets, bold and a "Question:" label
  const choice = /^should i\b.*\bor\b/i; // "Should I apply X, or use Y?" asks for a choice, not an offer
  return (text.match(/[^.?!\n]*\?/g) ?? []).some(q => {
    const s = q.trim().replace(lead, '');
    return !offer.test(s) || choice.test(s);
  });
}
const UNDEFINED = /^(nan|[+-]?inf(inity)?|#div\/0!?)$/i;
// Why one run fails the case; empty when it passes.
export function scoreOutcome(spec: EvalCase, key: AnswerKey, outcome: Outcome): string[] {
  if (outcome.error) return [outcome.error];
  const failures: string[] = [];
  for (const check of spec.csvChecks) {
    const candidate = outcome.files[check.file];
    if (!candidate) {
      failures.push(`Missing CSV: ${check.file}`);
      continue;
    }
    if (candidate.some(row => Object.values(row).some(v => UNDEFINED.test(v.trim()))))
      failures.push(`${check.file}: NaN or Inf cell (write blank instead)`);
    const listed = new Set(candidate.map(row => check.keyColumns.map(k => row[k] ?? '').join('|')));
    for (const id of key.hardNegatives?.[check.file] ?? [])
      if (listed.has(id)) failures.push(`${check.file}: false positive ${id}`);
    const expected = key.files[check.file];
    if (expected)
      failures.push(
        ...compareRows(
          candidate,
          expected,
          check.keyColumns,
          check.valueColumns,
          key.moneyTolerance,
          check.partial,
        ).map(e => `${check.file}: ${e}`),
      );
  }
  for (const figure of key.replyNumbers ?? []) {
    const reply = figure.turn ? outcome.replies[figure.turn - 1] : outcome.replies.at(-1);
    if (!hasFigure(reply ?? '', figure))
      failures.push(
        `Reply${figure.turn ? ` ${figure.turn}` : ''} lacks ${figure.value} (±${figure.tolerance})${figure.label ? ` near "${figure.label}"` : ''}`,
      );
  }
  spec.turns.forEach((turn, i) => {
    if (turn.expectQuestion && (!blockingQuestion(outcome.replies[i] ?? '') || outcome.acted?.[i]))
      failures.push(`Turn ${i + 1}: expected a question`);
    if (turn.expectQuestion === false && blockingQuestion(outcome.replies[i] ?? ''))
      failures.push(`Turn ${i + 1}: asked a question it did not need`);
  });
  if (spec.expectChart && outcome.charts === 0) failures.push('No chart shown');
  if (outcome.reads) {
    for (const file of spec.expectReads?.must ?? [])
      if (!outcome.reads.some(r => r.endsWith(file))) failures.push(`Did not read ${file}`);
    for (const file of spec.expectReads?.mustNot ?? [])
      if (outcome.reads.some(r => r.endsWith(file))) failures.push(`Read ${file}, which it should not`);
  }
  for (const tool of spec.expectTools?.mustNot ?? [])
    if (outcome.tools?.includes(tool)) failures.push(`Called ${tool}, which it should not`);
  if (outcome.context !== undefined) {
    const start = outcome.contextStart ?? '';
    if (spec.expectContext?.unchanged && outcome.context !== start) failures.push('context.md changed');
    if (spec.expectContext?.keep)
      for (const line of start.split('\n').filter(l => l.trim() && !/^Last updated:/.test(l))) // the header date is meant to change
        if (!outcome.context.includes(line)) failures.push(`context.md lost or reworded: ${line.slice(0, 80)}`);
    for (const p of spec.expectContext?.must ?? [])
      if (!new RegExp(p, 'i').test(outcome.context)) failures.push(`context.md lacks ${p}`);
    for (const p of spec.expectContext?.mustNot ?? [])
      if (new RegExp(p, 'i').test(outcome.context)) failures.push(`context.md saved unconfirmed ${p}`);
  }
  return failures;
}
export type Spread = {file: string; row: string; column: string; values: string[]};
// Where repeated runs disagree with each other, whatever the answer key says.
export function spread(checks: CsvCheck[], outcomes: Outcome[], moneyTolerance: string): Spread[] {
  const out: Spread[] = [];
  for (const check of checks) {
    const tables = outcomes.map(o => o.files[check.file]);
    const present = tables.filter((t): t is Row[] => !!t);
    if (present.length && present.length < tables.length)
      out.push({
        file: check.file,
        row: '(file)',
        column: '',
        values: [`saved by ${present.length} of ${tables.length}`],
      });
    if (present.length < 2) continue;
    const key = (row: Row) => check.keyColumns.map(k => row[k] ?? '').join('|');
    const maps = present.map(t => new Map(t.map(r => [key(r), r])));
    for (const id of new Set(maps.flatMap(m => [...m.keys()]))) {
      const rows = maps.map(m => m.get(id));
      if (rows.some(r => !r)) {
        out.push({
          file: check.file,
          row: id,
          column: '(row)',
          values: [`in ${rows.filter(Boolean).length} of ${rows.length}`],
        });
        continue;
      }
      for (const column of check.valueColumns) {
        const values = rows.map(r => r![column] ?? '');
        const numbers = values.map(Number);
        const differs =
          values.every(isNumber) && numbers.every(Number.isFinite)
            ? Math.max(...numbers) - Math.min(...numbers) > Number(tolerance(column, moneyTolerance)) + 1e-12
            : new Set(values.map(v => v.toLowerCase())).size > 1;
        if (differs) out.push({file: check.file, row: id, column, values});
      }
    }
  }
  return out;
}
export type CaseResult = {
  id: string;
  outcomes: Outcome[];
  failures: string[][];
  spread: Spread[];
  consistencyChecked: boolean;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export function report(condition: Condition | undefined, results: CaseResult[], started: string, live = true) {
  const runs = results.flatMap(r => r.failures);
  const passed = runs.filter(f => !f.length).length;
  const checked = results.filter(r => r.consistencyChecked);
  const consistent = checked.filter(r => !r.spread.length).length;
  const metrics = results.flatMap(r => r.outcomes.map(o => o.metrics).filter(m => !!m));
  const cost = metrics.reduce((a, m) => a + m.costUSD, 0);
  const lines = [
    `# Eval report ${started}`,
    '',
    !live
      ? 'Answer-key check: known-correct scripts scored against the answer keys. No model was run.'
      : condition
        ? `Model \`${condition.model}\` (thinking ${condition.thinking}), commit ${condition.commit}, plugin ${condition.versions.pricing ?? '?'}, bundle ${condition.bundleFingerprint.slice(0, 12)}.`
        : 'Live run, but no turn completed, so the model and versions are unknown.',
    '',
    `**${passed} of ${runs.length} runs passed.${checked.length ? ` ${consistent} of ${checked.length} cases gave the same figures on every repeat.` : ''}** Cost $${cost.toFixed(3)}.`,
    '',
    '| Case | Runs passed | Same figures | Model calls | Tool calls | Tool errors | Invalid calls | Cards read | Cost $ | Seconds |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of results) {
    const m = r.outcomes.map(o => o.metrics).filter(x => !!x);
    const avg = (f: (x: (typeof m)[number]) => number, digits = 1) => (m.length ? mean(m.map(f)).toFixed(digits) : '-');
    lines.push(
      `| ${r.id} | ${r.failures.filter(f => !f.length).length} of ${r.failures.length} | ${r.consistencyChecked ? (r.spread.length ? 'no' : 'yes') : '-'} | ${avg(x => x.modelCalls)} | ${avg(x => x.toolCalls)} | ${avg(x => x.toolErrors)} | ${avg(x => x.invalidCalls)} | ${avg(x => x.cards ?? 0)} | ${avg(x => x.costUSD, 3)} | ${avg(x => x.seconds, 0)} |`,
    );
  }
  for (const r of results) {
    const failed = r.failures.map((f, i) => [i, f] as const).filter(([, f]) => f.length);
    if (!failed.length && !r.spread.length) continue;
    lines.push('', `## ${r.id}`);
    for (const [i, f] of failed)
      lines.push(`- Run ${i + 1}: ${f.slice(0, 5).join('; ')}${f.length > 5 ? ` (+${f.length - 5} more)` : ''}`);
    for (const s of r.spread.slice(0, 8))
      lines.push(`- Runs disagree: ${s.file} ${s.row} ${s.column}: ${s.values.join(' / ')}`);
    if (r.spread.length > 8) lines.push(`- (+${r.spread.length - 8} more disagreements)`);
  }
  return lines.join('\n') + '\n';
}
