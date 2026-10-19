import {expect, it} from 'vitest';
import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EventLog, truncateLarge, redactSecrets, MAX_EVENT_STRING_CHARS} from '../../src/agent/workflow/event-log.js';
it('keeps every line parseable and ordered when large records are appended concurrently', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'event-log-')), 'events.jsonl');
  const log = new EventLog(path);
  const big = 'x'.repeat(700_000);
  for (let i = 0; i < 20; i++) void log.append({i, result: big});
  await log.flush();
  const lines = (await readFile(path, 'utf8')).trim().split('\n');
  expect(lines).toHaveLength(20);
  const parsed = lines.map(line => JSON.parse(line));
  expect(parsed.map(r => r.i)).toEqual([...Array(20).keys()]);
  expect(parsed[0].result.length).toBeLessThan(MAX_EVENT_STRING_CHARS + 100);
});
it('truncates nested strings and leaves other values unchanged', () => {
  expect(truncateLarge({a: ['ok', {b: 'y'.repeat(10)}], n: 3}, 5)).toEqual({
    a: ['ok', {b: 'yyyyy…[truncated 5 chars]'}],
    n: 3,
  });
  expect(truncateLarge(42)).toBe(42);
});
it('redacts configured secrets from serialized records', () => {
  process.env.TEST_EVENT_API_KEY = 'super-secret-value';
  try {
    expect(redactSecrets({note: 'super-secret-value'})).toBe('{"note":"[REDACTED]"}');
  } finally {
    delete process.env.TEST_EVENT_API_KEY;
  }
});
