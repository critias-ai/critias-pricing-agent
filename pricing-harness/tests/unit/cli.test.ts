import {expect, it} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFileSync} from 'node:fs';
const run = promisify(execFile);
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
it('prints its version and usage without starting the app', async () => {
  expect((await run(process.execPath, ['bin/critias.mjs', '--version'])).stdout.trim()).toBe(version);
  const help = (await run(process.execPath, ['bin/critias.mjs', '--help'])).stdout;
  expect(help).toContain('critias models [provider]');
  expect(help).toContain('ANTHROPIC_MODEL');
});
it('rejects an unknown option', async () => {
  await expect(run(process.execPath, ['bin/critias.mjs', '--nope'])).rejects.toMatchObject({code: 1});
});
