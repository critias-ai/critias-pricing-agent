import {expect, it} from 'vitest';
import {mkdtempSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {recordPythonRuns} from '../../src/agent/workflow/shell-evidence.js';
import type {Execution} from '../../src/agent/workflow/contracts.js';

it('records Python run through bash as evidence, and nothing else', async () => {
  const stageDir = mkdtempSync(join(tmpdir(), 'shell-'));
  const records: Execution[] = [],
    saved: string[] = [];
  const shell = {
    execute: async (_id: string, args: {command: string}) => {
      if (args.command.includes('fails')) return {content: [{type: 'text', text: 'Traceback'}], isError: true};
      if (args.command.includes('csv')) writeFileSync(join(stageDir, 'out.csv'), 'a\n1\n');
      return {content: [{type: 'text', text: 'margin 38.95'}]};
    },
  };
  const bash = recordPythonRuns(shell, {
    stageDir,
    root: stageDir,
    onRecorded: name => saved.push(name),
    onExecution: r => records.push(r),
  });
  await bash.execute('1', {command: 'ls'});
  await bash.execute('2', {command: 'python3 fails.py'});
  expect(records).toHaveLength(0);
  await bash.execute('3', {command: "cat > a.py <<'EOF'\nprint(1)\nEOF\npython3 a.py csv"});
  expect(records).toHaveLength(1);
  expect(readFileSync(join(stageDir, records[0]!.output.path), 'utf8')).toContain('margin 38.95');
  expect(readFileSync(join(stageDir, records[0]!.script.path), 'utf8')).toContain('print(1)');
  expect(saved).toEqual(['out.csv']);
  expect(readdirSync(stageDir).filter(f => f.startsWith('execution-'))).toHaveLength(1);
});
