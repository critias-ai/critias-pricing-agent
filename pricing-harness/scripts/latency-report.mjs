#!/usr/bin/env node
// Summarise one analysis directory: provider wait (first token) versus generation, per role.
// Usage: node scripts/latency-report.mjs <workspace>/analyses/<run-id>
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/latency-report.mjs <analysis directory>');
  process.exit(2);
}
const rows = [];
let skipped = 0;
for (const line of readFileSync(join(dir, 'events.jsonl'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try {
    rows.push(JSON.parse(line));
  } catch {
    skipped++;
  }
}
const roles = new Map();
for (const r of rows) {
  if (!r.role || !r.at) continue;
  const s = roles.get(r.role) ?? {
    first: r.at,
    last: r.at,
    requests: 0,
    firstToken: 0,
    generation: 0,
    gate: 0,
    tokens: 0,
    noFirstToken: 0,
  };
  if (r.at < s.first) s.first = r.at;
  if (r.at > s.last) s.last = r.at;
  if (r.type === 'model_timing') {
    s.requests++;
    s.gate += r.gateWaitMs ?? 0;
    s.generation += r.generationMs ?? 0;
    s.tokens += r.outputTokens ?? 0;
    if (r.timeToFirstTokenMs == null) s.noFirstToken++;
    else s.firstToken += r.timeToFirstTokenMs;
  }
  roles.set(r.role, s);
}
const sec = ms => (ms / 1000).toFixed(1);
console.log('role         wall_s  requests  first_token_s  generation_s  output_tokens  tokens_per_s');
for (const [role, s] of roles) {
  const wall = Date.parse(s.last) - Date.parse(s.first);
  console.log(
    `${role.padEnd(11)} ${sec(wall).padStart(7)} ${String(s.requests).padStart(9)} ${sec(s.firstToken).padStart(14)} ${sec(s.generation).padStart(13)} ${String(s.tokens).padStart(14)} ${(s.generation ? s.tokens / (s.generation / 1000) : 0).toFixed(1).padStart(13)}`,
  );
}
if (skipped) console.log(`${skipped} unparseable line(s) skipped`);
