import {expect, it} from 'vitest';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
it('prints first-token and generation totals per role and skips corrupt lines', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'latency-'));
  const lines = [
    {at: '2026-10-10T10:00:00.000Z', role: 'analyst', type: 'configuration'},
    {
      at: '2026-10-10T10:00:10.000Z',
      role: 'analyst',
      type: 'model_timing',
      gateWaitMs: 1,
      timeToFirstTokenMs: 2000,
      generationMs: 5000,
      outputTokens: 500,
    },
  ].map(l => JSON.stringify(l));
  await writeFile(join(dir, 'events.jsonl'), lines.join('\n') + '\n{"broken\n');
  const out = execFileSync(process.execPath, ['scripts/latency-report.mjs', dir], {encoding: 'utf8'});
  expect(out).toMatch(/analyst\s+10\.0\s+1\s+2\.0\s+5\.0\s+500\s+100\.0/);
  expect(out).toContain('1 unparseable line(s) skipped');
});
