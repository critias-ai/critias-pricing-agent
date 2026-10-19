import {expect, it} from 'vitest';
import {createStageBashOperations} from '../../src/agent/workflow/supervised-shell.js';
import {venvPython} from '../fixtures/venv-python.js';
import {toShellPath} from '../../src/runtime.js';

const run = (command: string, signal?: AbortSignal) => {
  let output = '';
  return createStageBashOperations()
    .exec(command, process.cwd(), {onData: (b: Buffer) => (output += b), env: process.env, signal})
    .then(r => ({...r, output}));
};

it('runs the analyst shell and the venv Python', async () => {
  const r = await run(`echo ok && "${toShellPath(venvPython)}" -c "print(6*7)"`);
  expect(r).toMatchObject({exitCode: 0});
  expect(r.output).toMatch(/ok\s+42/);
});

it('stops a running command when aborted', async () => {
  const controller = new AbortController();
  const started = Date.now();
  setTimeout(() => controller.abort(), 300);
  const r = await run(`"${toShellPath(venvPython)}" -c "import time; time.sleep(30)"`, controller.signal);
  expect(r.exitCode).not.toBe(0);
  expect(Date.now() - started).toBeLessThan(10000);
});
