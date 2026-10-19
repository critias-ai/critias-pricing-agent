import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {basename, join, resolve, sep} from 'node:path';
import {toShellPath as sh} from '../../runtime.js';
import type {ExtensionFactory} from '@earendil-works/pi-coding-agent';

// Hooks that fire at the moment of behaviour. The harness states tool, SQL-dialect and safety facts only.
// Business rules arrive as lints shipped with the plugin, so a different plugin brings its own.
// Every hook below is independent: delete its entry in HOOKS (and its function) to remove it, or switch one off for an
// experiment with PRICING_HOOKS_OFF=name,name.
// 'same-rows' runs inside the query tool (bundled/harness-tools/same_rows.py) because it needs the SQL session.
// 'peer-ratio' also runs there (bundled/harness-tools/peer_ratio.py): it notes far-from-median rows in what SQL sums.
// 'offsets' too (bundled/harness-tools/offsets.py): it notes groups whose negative rows cancel much of a sum.
export const hookOff = (name: string) =>
  (process.env.PRICING_HOOKS_OFF ?? '')
    .split(',')
    .map(s => s.trim())
    .includes(name);
const quoted = (s: string) => `"${s}"`;

// DuckDB error text -> the one-line fix, so the model does not reason its way back to a known answer.
export function sqlErrorHint(error: string): string | undefined {
  let m = error.match(/syntax error at or near "([^"]+)"/);
  if (m && m[1]!.toUpperCase() !== 'AS')
    return `${quoted(m[1]!)} is an SQL keyword used as an alias. Write AS ${quoted(m[1]!)} or pick another alias; always write AS.`;
  m = error.match(/(?:View|Table) with name "([^"]+)" already exists/);
  if (m) return `Use CREATE OR REPLACE VIEW ${m[1]}.`;
  m = error.match(/Referenced column "([^"]+)" not found/);
  if (m)
    return `Column ${quoted(m[1]!)} is not in that table. Check the candidate columns in the error or run DESCRIBE; source columns are VARCHAR.`;
  m = error.match(/Ambiguous reference to column name "([^"]+)"/);
  if (m) return `Qualify ${quoted(m[1]!)} with its table alias.`;
  if (/Conversion Error/.test(error)) return 'Source columns are VARCHAR: use TRY_CAST and handle blanks.';
  return undefined;
}

export function editErrorHint(error: string): string | undefined {
  if (/occurrences|must be unique/i.test(error))
    return 'The text to replace is not unique. Include two or three surrounding lines.';
  if (/Could not find|must match exactly/i.test(error))
    return 'The text does not match the file. Read the lines you are changing and copy them exactly.';
  return undefined;
}

const significant = (source: string) =>
  source
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length >= 25 && !line.startsWith('#'));

// Share of the new script's significant lines that already exist in the given texts.
export function copiedShare(content: string, existing: string[]): number {
  const mine = significant(content);
  if (mine.length < 15) return 0;
  const known = new Set(existing.flatMap(significant));
  return mine.filter(line => known.has(line)).length / mine.length;
}

// Packages are fixed for the run; installing is refused in code, not asked for in the prompt.
export const installsPackages = (command: string) =>
  /\b(?:pip3?|python3?\s+-m\s+pip|uv\s+pip|conda|mamba|poetry|npm|pnpm|yarn|apt(?:-get)?|brew)\s+(?:install|add|i)\b/i.test(
    command,
  );

// context.md keeps what the user confirmed. Facts and change-log entries are bullets (the plugin's context format):
// they may be added, never removed or reworded. Headers, headings and placeholder text may change.
export function contextAppendOnly(before: string, after: string): string | undefined {
  const bullet = (l: string) => /^\s*[-*+]\s+\S/.test(l);
  const kept = new Set(after.split('\n').map(l => l.trim()));
  const lost = before
    .split('\n')
    .map(l => l.trim())
    .find(l => bullet(l) && !kept.has(l));
  return lost
    ? `.pricing/context.md is append-only: this change would remove or reword "${lost.trim().slice(0, 80)}". Add the new or corrected fact as a new line instead.`
    : undefined;
}

// A lint fires when its pattern is found, or, with when: 'absent', when a text it applies to (matching `if`, when
// given) lacks it: a report the plugin requires that is missing.
export type Lint = {
  id: string;
  applies: ('code' | 'reply')[];
  pattern: string;
  flags?: string;
  hint: string;
  when?: 'present' | 'absent';
  if?: string;
};
export function loadLints(bundledRoot: string): Lint[] {
  try {
    const file = join(bundledRoot, 'pricing-plugin/skills/references/lints.json');
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as {schemaVersion?: number; lints?: Lint[]};
    return parsed.schemaVersion === 1 && Array.isArray(parsed.lints) ? parsed.lints : [];
  } catch {
    return [];
  }
}
// Whether a lint looks at this text at all: the right kind, and its `if` condition (when given) matches.
export function lintApplies(lint: Lint, text: string, applies: 'code' | 'reply'): boolean {
  try {
    return lint.applies.includes(applies) && (!lint.if || new RegExp(lint.if, lint.flags ?? '').test(text));
  } catch {
    return false;
  }
}
// Hints for the lints that match and have not been shown yet; shown ids are remembered in `seen`.
export function lintHints(text: string, lints: Lint[], applies: 'code' | 'reply', seen = new Set<string>()): string[] {
  const hints: string[] = [];
  for (const lint of lints) {
    if (!lint.applies.includes(applies) || seen.has(lint.id)) continue;
    try {
      const found = new RegExp(lint.pattern, lint.flags ?? '').test(text);
      if (lint.if && !new RegExp(lint.if, lint.flags ?? '').test(text)) continue;
      if (lint.when === 'absent' ? !found : found) {
        seen.add(lint.id);
        hints.push(lint.hint);
      }
    } catch {
      /* A malformed pattern is ignored, never fatal. */
    }
  }
  return hints;
}

// Time left, plus a wrap-up instruction once under a fifth of the allowance remains.
export function pacing(leftMs: number, totalMs: number): string {
  if (leftMs <= 0) return '[time is up: reply now with what you have]';
  const minutes = Math.max(1, Math.round(leftMs / 60000));
  return leftMs <= totalMs * 0.2
    ? `[time left: ${minutes} min. Wrap up now: deliver the result you have, with its range and what is missing]`
    : `[time left: ${minutes} min]`;
}

// Share of this statement's 12-word runs that earlier statements already contain.
const runs = (sql: string) => {
  const words = sql.toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 12 <= words.length; i++) out.add(words.slice(i, i + 12).join(' '));
  return out;
};
export function repeatedShare(sql: string, earlier: string[]): number {
  const mine = runs(sql);
  if (mine.size < 10) return 0;
  const known = new Set(earlier.flatMap(e => [...runs(e)]));
  return [...mine].filter(r => known.has(r)).length / mine.size;
}

const text = (content: unknown) =>
  Array.isArray(content) ? content.map((c: any) => (typeof c?.text === 'string' ? c.text : '')).join('\n') : '';

export type NudgeOptions = {
  stageDir: string;
  level?: string; // the configured thinking level
  focus?: string; // the level once an analysis has run, or 'keep'
  until?: number; // epoch ms the turn must end by
  totalMs?: number;
  contextPath?: string;
  lints?: Lint[];
  slowMs?: number; // a statement slower than this is reported
  off?: string[]; // hook names to leave out
  runawayChars?: number; // a tool call whose arguments grow past this is stopped
  onRunaway?: (chars: number) => void;
  skillsRoot?: string; // the bundled plugin's skills folder, for the skill-read gate
  preloaded?: string[]; // skill files already in the analyst's context, relative to skillsRoot
  sources?: string[]; // the conversation's source files, for the source-read hold
  moreSkills?: string[]; // skill folders outside skillsRoot the gate also lists (the harness's own)
};

type Pi = Parameters<ExtensionFactory>[0];
type Hook = (pi: Pi, o: NudgeOptions) => void;

// Adds lines under a tool's result. Handlers chain, so each hook appends to what earlier ones left.
const after = (pi: Pi, lines: (event: any) => (string | undefined)[] | undefined) =>
  pi.on('tool_result', event => {
    const add = (lines(event) ?? []).filter(Boolean);
    return add.length
      ? {content: [{type: 'text' as const, text: `${text(event.content)}\n\n${add.join('\n')}`}]}
      : undefined;
  });
const analysisTool = (name: string) => name === 'execute_analysis' || name === 'query';
const scriptFiles = (dir: string, ext: string) =>
  readdirSync(dir)
    .filter(f => f.endsWith(ext))
    .map(f => readFileSync(join(dir, f), 'utf8'));

// Skills the analyst can pick from: name and description of each SKILL.md, for the skill-read gate.
export function skillList(skillsRoot: string, preloaded: string[] = []) {
  return readdirSync(skillsRoot)
    .filter(d => existsSync(join(skillsRoot, d, 'SKILL.md')) && !preloaded.includes(`${d}/SKILL.md`))
    .map(d => describe(join(skillsRoot, d)));
}
const describe = (dir: string) =>
  `${basename(dir)}: ${(/^description:\s*(.+)$/m.exec(readFileSync(join(dir, 'SKILL.md'), 'utf8'))?.[1] ?? '').trim()}`;
const PYTHON_RUN = /(^|[\s;&|(/])python(3(\.\d+)?)?\b/;

const HOOKS: Record<string, Hook> = {
  // The first calculation waits until the analyst has opened a task skill and a knowledge card beyond what is
  // preloaded. The harness does not pick them: the routing skill in context does. What was read is kept in the
  // stage folder, so follow-up turns are not stopped again.
  'skill-read'(pi, o) {
    if (!o.skillsRoot) return;
    const root = resolve(o.skillsRoot);
    const marker = join(o.stageDir, 'skills-read.json');
    const seen = new Set<string>(existsSync(marker) ? (JSON.parse(readFileSync(marker, 'utf8')) as string[]) : []);
    const preloaded = new Set(o.preloaded ?? []);
    let blocks = 0;
    const note = (path: string) => {
      const full = resolve(o.stageDir, path);
      const rel = full.slice(root.length + 1).replaceAll(sep, '/');
      if (!full.startsWith(root + sep) || preloaded.has(rel) || seen.has(rel)) return;
      seen.add(rel);
      writeFileSync(marker, JSON.stringify([...seen]));
    };
    const ready = () =>
      [...seen].some(f => /^[^/]+\/SKILL\.md$/.test(f)) && [...seen].some(f => f.startsWith('knowledge/'));
    pi.on('tool_result', event => {
      if (event.isError) return;
      const input = event.input as Record<string, any>;
      if (event.toolName === 'read' && typeof input.path === 'string') note(input.path);
      if (event.toolName === 'bash')
        for (const m of String(input.command ?? '').matchAll(/[^\s'"|;&<>]*skills\/[^\s'"|;&<>]+\.md/g)) note(m[0]);
    });
    pi.on('tool_call', event => {
      const input = event.input as Record<string, any>;
      const calculates =
        analysisTool(event.toolName) || (event.toolName === 'bash' && PYTHON_RUN.test(String(input.command ?? '')));
      if (!calculates || ready() || blocks >= 2) return;
      blocks++;
      return {
        block: true,
        reason:
          `Not run yet: before calculating, read the skill for this task and the knowledge card its steps point to for your question (the routing skill in your context helps you choose). Skills in ${sh(root)}; knowledge cards in ${sh(join(root, 'knowledge'))}:\n` +
          [
            ...skillList(root, o.preloaded),
            ...(o.moreSkills ?? []).map(d => `${describe(d)} (${sh(join(d, 'SKILL.md'))})`),
          ]
            .map(l => `- ${l}`)
            .join('\n'),
      };
    });
  },
  // Source rows reach scripts only through the query tool, where the SQL checks see them. A Python run whose command
  // or script names a source file is held once per turn; sent again, it runs.
  'source-read'(pi, o) {
    const names = (o.sources ?? []).map(p => p.split('/').pop()!).filter(Boolean);
    if (!names.length) return;
    let held = false;
    const script = (path: unknown) => {
      const file = typeof path === 'string' ? resolve(o.stageDir, path) : '';
      return file.endsWith('.py') && existsSync(file) ? readFileSync(file, 'utf8') : '';
    };
    pi.on('tool_call', event => {
      const input = event.input as Record<string, any>;
      const command = String(input.command ?? '');
      const body =
        event.toolName === 'execute_analysis'
          ? script(input.filePath)
          : event.toolName === 'bash' && PYTHON_RUN.test(command)
            ? [command, ...[...command.matchAll(/[^\s'"|;&<>]+\.py\b/g)].map(m => script(m[0]))].join('\n')
            : '';
      if (held || !names.some(n => body.includes(n))) return;
      held = true;
      return {
        block: true,
        reason:
          'Not run yet: this script reads a source file directly, so the checks on SQL do not see it. Filter, group and sum source rows with the query tool, `save` the result, and have the script read that file.',
      };
    });
  },
  // Think fully until an analysis has run once in this conversation; then the work is mechanical.
  'focus-thinking'(pi, o) {
    const focus = o.focus ?? process.env.PRICING_FOCUS_THINKING ?? 'low';
    let ran = false;
    const think = (to: string | undefined) => {
      if (to && to !== 'keep') pi.setThinkingLevel(to as Parameters<typeof pi.setThinkingLevel>[0]);
    };
    pi.on('before_agent_start', () => think(ran ? focus : o.level));
    pi.on('tool_result', event => {
      if (!analysisTool(event.toolName)) return;
      if (!event.isError) ran = true;
      think(focus);
    });
  },
  'no-installs'(pi) {
    pi.on('tool_call', event => {
      if (event.toolName === 'bash' && installsPackages(String((event.input as any).command ?? '')))
        return {
          block: true,
          reason: 'Packages are fixed for this run; installing is not available. Use what is installed.',
        };
    });
  },
  'context-append-only'(pi, o) {
    pi.on('tool_call', event => {
      if (event.toolName !== 'write' && event.toolName !== 'edit') return;
      const input = event.input as Record<string, any>;
      const target = typeof input.path === 'string' ? resolve(o.stageDir, input.path) : '';
      if (!o.contextPath || target !== o.contextPath || !existsSync(target)) return;
      const before = readFileSync(target, 'utf8');
      let after = before;
      if (event.toolName === 'write') after = String(input.content ?? '');
      else
        for (const e of (input.edits as {oldText?: string; newText?: string}[] | undefined) ?? [input])
          if (typeof e.oldText === 'string' && after.includes(e.oldText))
            after = after.replace(e.oldText, e.newText ?? '');
      const reason = contextAppendOnly(before, after);
      return reason ? {block: true, reason} : undefined;
    });
  },
  'reuse-scripts'(pi, o) {
    const warned = new Set<string>();
    pi.on('tool_call', event => {
      if (event.toolName !== 'write') return;
      const {path, content} = event.input as {path?: string; content?: string};
      if (!path?.endsWith('.py') || typeof content !== 'string' || warned.has(path)) return;
      const target = resolve(o.stageDir, path);
      const existing = existsSync(target) ? [readFileSync(target, 'utf8')] : [];
      const share = copiedShare(content, existing.length ? existing : scriptFiles(o.stageDir, '.py'));
      if (share < (existing.length ? 0.7 : 0.5)) return;
      warned.add(path);
      return {
        block: true,
        reason: existing.length
          ? `${Math.round(share * 100)}% of this file is unchanged. Use edit on just the lines that change.`
          : `${Math.round(share * 100)}% of this script already exists in your other scripts. Move the shared loading and joins into one module (for example common.py), import it, and write only what is new.`,
      };
    });
  },
  'error-hints'(pi) {
    let failures = 0;
    after(pi, event => {
      const body = text(event.content);
      if (event.toolName === 'edit' && event.isError) {
        const hint = editErrorHint(body);
        return hint ? [`Hint: ${hint}`] : [];
      }
      if (!analysisTool(event.toolName)) return;
      if (!event.isError) return void (failures = 0);
      failures++;
      const hint = sqlErrorHint(body);
      return [
        hint && `Hint: ${hint}`,
        failures >= 2
          ? 'Hint: Two runs failed in a row. Do not rewrite the script: edit only the failing line, or run that query alone with LIMIT 5.'
          : undefined,
      ];
    });
  },
  // Plugin lints look at the SQL or code the model just ran or wrote.
  'plugin-lints'(pi, o) {
    const shown = new Set<string>();
    after(pi, event => {
      const input = event.input as Record<string, any>;
      const py = String(input.path ?? '').endsWith('.py');
      const edits = (input.edits as {newText?: string}[] | undefined) ?? [input as {newText?: string}];
      const code =
        event.toolName === 'query'
          ? String(input.sql ?? '')
          : event.toolName === 'write' && py
            ? String(input.content ?? '')
            : event.toolName === 'edit' && py
              ? edits.map(e => e.newText ?? '').join('\n')
              : '';
      return code ? lintHints(code, o.lints ?? [], 'code', shown).map(h => `Check: ${h}`) : [];
    });
  },
  // The model cannot see how long a statement took; tell it when that was long.
  'slow-query'(pi, o) {
    const started = new Map<string, number>();
    pi.on('tool_call', event => void (event.toolName === 'query' && started.set(event.toolCallId, Date.now())));
    after(pi, event => {
      const t0 = started.get(event.toolCallId);
      const seconds = t0 ? Math.round((Date.now() - t0) / 1000) : 0;
      return seconds * 1000 >= (o.slowMs ?? 20000)
        ? [
            `Hint: this statement took ${seconds} s. Functions around join keys (UPPER, TRIM, CAST) stop fast joins: apply them once in a view. A measure you will query again is computed once with CREATE TABLE ... AS.`,
          ]
        : [];
    });
  },
  // Large statements written again from earlier ones: point at the views that persist.
  'repeated-sql'(pi, o) {
    const share = new Map<string, number>();
    let hints = 0;
    pi.on('tool_call', event => {
      if (event.toolName !== 'query') return;
      const sql = String((event.input as any).sql ?? '');
      if (/^\s*create\b/i.test(sql)) return; // already defining the shared part
      share.set(event.toolCallId, repeatedShare(sql, scriptFiles(o.stageDir, '.sql')));
    });
    after(pi, event => {
      const s = share.get(event.toolCallId) ?? 0;
      if (s < 0.5 || hints >= 2) return [];
      hints++;
      return [
        `Hint: ${Math.round(s * 100)}% of this statement repeats earlier ones. Define the shared part once with CREATE OR REPLACE VIEW, then select from it; views stay available in later calls and turns.`,
      ];
    });
  },
  // Largest legitimate tool call seen in 77 runs: 25k characters (a script); the others stay under 18k.
  'runaway-stream'(pi, o) {
    let chars = 0;
    pi.on('message_update', (event, ctx) => {
      const e = event.assistantMessageEvent;
      if (e.type === 'toolcall_start') chars = 0;
      else if (e.type === 'toolcall_delta' && (chars += e.delta.length) > (o.runawayChars ?? 40000) && ctx.signal) {
        o.onRunaway?.(chars);
        ctx.abort();
      }
    });
  },
  // The one place the harness speaks about effort: how much time is left, and when to stop tracing.
  pacing(pi, o) {
    const window = o.until ? o.until - Date.now() : 0;
    let braked = false;
    after(pi, () => {
      if (!o.until || !o.totalMs) return [];
      const used = window > 0 ? 1 - (o.until - Date.now()) / window : 0;
      const brake =
        used >= 0.4 && !braked
          ? '[40% of the time is used. If you are still tracing a difference that is smaller than the smallest difference the answer relies on, stop: deliver on the basis you have and state the untraced amount.]'
          : undefined;
      if (brake) braked = true;
      return [brake, pacing(o.until - Date.now(), o.totalMs)];
    });
  },
};

export const analystNudges =
  (o: NudgeOptions): ExtensionFactory =>
  pi => {
    const off = new Set(o.off ?? (process.env.PRICING_HOOKS_OFF ?? '').split(',').map(s => s.trim()));
    for (const [name, hook] of Object.entries(HOOKS)) if (!off.has(name)) hook(pi, o);
  };
