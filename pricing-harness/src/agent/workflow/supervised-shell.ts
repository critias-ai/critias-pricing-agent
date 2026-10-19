import {spawn} from 'node:child_process';
import {getShellConfig, type BashOperations} from '@earendil-works/pi-coding-agent';
import {killTree} from './kill-tree.js';
// Keep normal shell/tool descendants in the supervised worker's process group.
// Native execution is not a security sandbox for hostile scripts.
// On Windows the SDK finds Git for Windows' bash.exe.
export function createStageBashOperations(): BashOperations {
  const {shell, args} = getShellConfig();
  return {
    exec: (command, cwd, options) =>
      new Promise((resolve, reject) => {
        const child = spawn(shell, [...args, command], {
          cwd,
          env: options.env,
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        });
        const stop = () => killTree(child, 'SIGTERM');
        const timeout = options.timeout ? setTimeout(stop, options.timeout * 1000) : undefined;
        options.signal?.addEventListener('abort', stop, {once: true});
        if (options.signal?.aborted) stop();
        child.stdout.on('data', options.onData);
        child.stderr.on('data', options.onData);
        child.on('error', reject);
        child.on('close', (code, signal) => {
          clearTimeout(timeout);
          options.signal?.removeEventListener('abort', stop);
          resolve({exitCode: code ?? (signal ? 143 : 1)});
        });
      }),
  };
}
