import {spawnSync, type ChildProcess} from 'node:child_process';
// Windows has no process groups: taskkill /T stops the child and everything it started (bash, Python).
export function killTree(child: ChildProcess, signal: NodeJS.Signals) {
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {windowsHide: true});
  } else child.kill(signal);
}
