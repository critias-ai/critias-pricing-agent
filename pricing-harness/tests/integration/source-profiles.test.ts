import {expect, it} from 'vitest';
import {existsSync} from 'node:fs';
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {createSourceProfiler} from '../../src/agent/workflow/source-profiles.js';
import {createFlow} from '../fixtures/workflow-flow.js';
import {venvPython} from '../fixtures/venv-python.js';
import {toShellPath} from '../../src/runtime.js';
const python = venvPython;
it('writes profiles to a file and names it in the first prompt', async () => {
  const f = await createFlow({
    profileSources: async () => [
      {
        path: 'files/source.csv',
        sha256: 's',
        kind: 'csv',
        profiles: [{schemaVersion: 1, rowCount: 1, columnCount: 1, profiledColumns: 1, columns: []}],
      },
    ],
  });
  await f.run();
  const path = join(f.paths.metadata, 'source-profiles.json');
  expect(f.requests[0]!.prompt).toContain(toShellPath(path));
  expect(JSON.parse(await readFile(path, 'utf8'))[0].path).toBe('files/source.csv');
});
it.skipIf(!existsSync(python))('profiles a real CSV with the bundled Python helper', async () => {
  const root = await mkdtemp(join(tmpdir(), 'profiles-'));
  await mkdir(join(root, 'files'));
  await writeFile(join(root, 'files/s.csv'), 'amount,label\n1.5,A\n2,B\n');
  const profile = createSourceProfiler(
    {pythonPath: python, bundledRoot: resolve('bundled'), workspaceRoot: root},
    join(root, 'cache'),
  );
  const [result] = (await profile([
    {id: '1', name: 's.csv', relativePath: 'files/s.csv', bytes: 1, sha256: 'abc', addedAt: '', kind: 'csv'},
  ])) as any;
  expect(result.profiles[0].columns.map((c: any) => c.inferredType)).toEqual(['decimal', 'text']);
});
