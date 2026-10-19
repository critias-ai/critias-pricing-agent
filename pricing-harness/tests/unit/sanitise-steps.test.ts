import {expect, it} from 'vitest';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir, homedir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

// Dev tool for fixtures recorded on macOS; it does not handle Windows home directories.
const posixOnly = it.skipIf(process.platform === 'win32');
posixOnly('redacts machine identifiers while preserving recorded step transitions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sanitise-steps-'));
  const input = join(directory, 'steps.jsonl');
  const source = [
    {
      runId: 'private-run-id',
      stepId: 'private-model-id',
      stage: 'analyse',
      kind: 'model',
      name: 'model',
      state: 'waiting',
      startedAt: '2026-10-12T10:00:00.000Z',
      summary: 'Waiting for model',
    },
    {
      runId: 'private-run-id',
      stepId: 'private-model-id',
      stage: 'analyse',
      kind: 'model',
      name: 'model',
      state: 'running',
      startedAt: '2026-10-12T10:00:00.000Z',
      summary: 'Thinking',
    },
    {
      runId: 'private-run-id',
      stepId: 'private-tool-id',
      stage: 'analyse',
      kind: 'tool',
      name: 'read',
      state: 'done',
      startedAt: '2026-10-12T10:00:02.000Z',
      endedAt: '2026-10-12T10:00:03.000Z',
      summary: `Read ${homedir()}/private/source.csv`,
      detail: '/private/tmp/pricing-assistant-ui-steps-a1b2/workspace/error.log',
    },
    {
      runId: 'private-run-id',
      stepId: 'private-clipped-path-id',
      stage: 'analyse',
      kind: 'tool',
      name: 'bash',
      state: 'done',
      startedAt: '2026-10-12T10:00:04.000Z',
      summary: 'Ran command: /Users…',
    },
  ];
  await writeFile(input, source.map(step => JSON.stringify(step)).join('\n') + '\n');

  const output = execFileSync(process.execPath, ['scripts/sanitise-steps.mjs', input], {encoding: 'utf8'});
  const recorded = output
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));

  expect(recorded.map(step => [step.runId, step.stepId, step.state])).toEqual([
    ['recorded-run', 'step-1', 'waiting'],
    ['recorded-run', 'step-1', 'running'],
    ['recorded-run', 'step-2', 'done'],
    ['recorded-run', 'step-3', 'done'],
  ]);
  expect(JSON.stringify(recorded)).not.toContain('private-run-id');
  expect(JSON.stringify(recorded)).not.toContain('private-model-id');
  expect(JSON.stringify(recorded)).not.toContain('/private/tmp');
  expect(JSON.stringify(recorded)).not.toContain('/Users');
  expect(JSON.stringify(recorded)).not.toContain(homedir());
  expect(recorded[2].summary).toBe('Read ~/private/source.csv');
  expect(recorded[2].detail).toBe('~/workspace/error.log');
  expect(recorded[3].summary).toBe('Ran command: [path]');
  expect(recorded[1].startedAt).toBe('2026-10-12T10:00:00.000Z');
  expect(recorded[2].endedAt).toBe('2026-10-12T10:00:03.000Z');
});
