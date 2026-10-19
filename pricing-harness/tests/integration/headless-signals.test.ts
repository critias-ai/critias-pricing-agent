import {expect, it} from 'vitest';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
// Windows has no SIGTERM: Node terminates the process outright.
const posixOnly = it.skipIf(process.platform === 'win32');
posixOnly.each([false, true])('exits on SIGTERM with stdin open (active=%s)', async active => {
  const child = spawn(process.execPath, ['--import', 'tsx', resolve('tests/fixtures/headless-process.ts')], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let text = '',
    terminated = false;
  child.stdout.on('data', chunk => {
    text += chunk;
    // Send one signal; later output can arrive after the shutdown handler is removed.
    if (!terminated && (active ? text.includes('"type":"accepted"') : text.includes('READY'))) {
      terminated = true;
      child.kill('SIGTERM');
    }
  });
  if (active)
    child.stdin.write(
      JSON.stringify({type: 'submit', request: {requestId: 'signal-test', text: 'question', fileIds: []}}) + '\n',
    );
  const code = await new Promise<number | null>((r, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('headless did not exit with stdin open'));
    }, 10000);
    child.on('close', value => {
      clearTimeout(timer);
      r(value);
    });
    child.on('error', reject);
  });
  expect(code).toBe(0);
});
