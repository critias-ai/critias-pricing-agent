import {expect, it} from 'vitest';
import {mkdtemp, readFile, writeFile, mkdir, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
it('preserves sources, detects changes, and publishes complete manifests only', async () => {
  const ws = await import('../../src/workspace.js');
  const fm = await import('../../src/files.js');
  const root = await mkdtemp(join(tmpdir(), 'pricing '));
  const paths = await ws.openWorkspace(root);
  const store = await fm.openFileStore(paths, {maxUploadBytes: 100});
  const file = await store.saveUpload(Readable.from(['a,b\n1,2\n']), '../sales.csv');
  expect(await readFile(join(root, file.relativePath), 'utf8')).toBe('a,b\n1,2\n');
  const inputs = await store.snapshotSources();
  await writeFile(join(root, file.relativePath), 'a,b\n1,3\n');
  expect(await store.checkSourcesUnchanged(inputs)).toEqual([file.id]);
  await expect(store.saveUpload(Readable.from(['x'.repeat(101)]), 'big.csv')).rejects.toThrow(/limit/);
  const run = '41e779d0-971d-4aad-a87c-342e6277c1ed';
  await mkdir(join(paths.outputs, run));
  await writeFile(join(paths.outputs, run, 'results.csv'), 'x\n1\n');
  await writeFile(
    join(paths.outputs, run, 'manifest.json'),
    JSON.stringify({schemaVersion: 1, runId: run, files: [{name: 'results.csv', mediaType: 'text/csv'}]}),
  );
  await store.registerPublishedRun(run);
  expect(store.listArtifacts()).toHaveLength(1);
  await symlink('/etc/passwd', join(paths.outputs, run, 'escape.txt'));
  await writeFile(
    join(paths.outputs, run, 'manifest.json'),
    JSON.stringify({schemaVersion: 1, runId: run, files: [{name: 'escape.txt', mediaType: 'text/plain'}]}),
  );
  await expect(store.registerPublishedRun(run)).rejects.toThrow(/escape/);
});
