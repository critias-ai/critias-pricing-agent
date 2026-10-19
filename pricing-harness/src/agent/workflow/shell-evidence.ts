import {randomUUID} from 'node:crypto';
import {readdir, stat, writeFile} from 'node:fs/promises';
import {join, relative} from 'node:path';
import {hashFile} from '../../workspace.js';
import type {Execution} from './contracts.js';

const PYTHON = /(^|[\s;&|(/])python(3(\.\d+)?)?\b/;

type Shell = {execute: (...args: any[]) => Promise<{content: {type: string; text?: string}[]; isError?: boolean}>};

// Python run through bash is evidence like execute_analysis: the command (with any inline script) and its output are
// recorded, and CSV files written while it ran become presentable results. Other commands are not recorded.
export function recordPythonRuns<T extends Shell>(
  shell: T,
  o: {
    stageDir: string;
    root: string;
    onRecorded: (name: string, sha256: string) => void;
    onExecution: (record: Execution) => void;
  },
): T {
  return {
    ...shell,
    execute: async (...args: any[]) => {
      const command = String(args[1]?.command ?? '');
      const startedAt = Date.now();
      const result = await shell.execute(...args);
      if (result.isError || !PYTHON.test(command)) return result; // a failed command is not evidence
      const id = randomUUID(),
        script = join(o.stageDir, `bash-${id}.sh`),
        output = join(o.stageDir, `execution-${id}.txt`);
      await writeFile(script, command + '\n');
      await writeFile(output, result.content.map(c => (c.type === 'text' ? (c.text ?? '') : '')).join('\n') + '\n');
      for (const name of await readdir(o.stageDir)) {
        if (!name.endsWith('.csv')) continue;
        const file = join(o.stageDir, name);
        if ((await stat(file)).mtimeMs >= startedAt - 50) o.onRecorded(name, (await hashFile(file)).sha256);
      }
      const ref = async (path: string) => ({path: relative(o.root, path), sha256: (await hashFile(path)).sha256});
      o.onExecution({id, script: await ref(script), output: await ref(output), success: true});
      return result;
    },
  };
}
