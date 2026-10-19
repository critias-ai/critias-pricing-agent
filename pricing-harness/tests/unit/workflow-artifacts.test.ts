import {expect, it} from 'vitest';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {openWorkspace, atomicJSON} from '../../src/workspace.js';
import {openFileStore, loadRuns} from '../../src/files.js';
it('refuses to serve a published artifact after its registered hash changes', async () => {
  const paths = await openWorkspace(await mkdtemp(join(tmpdir(), 'artifact-hash-')));
  const files = await openFileStore(paths, {maxUploadBytes: 1000});
  const id = randomUUID(),
    dir = join(paths.outputs, id);
  await mkdir(dir);
  await writeFile(join(dir, 'results.csv'), '10');
  await atomicJSON(join(dir, 'manifest.json'), {
    schemaVersion: 1,
    runId: id,
    files: [{name: 'results.csv', mediaType: 'text/csv'}],
  });
  await files.registerPublishedRun(id);
  const artifact = files.listArtifacts()[0]!;
  await files.resolveArtifact(artifact.id);
  await writeFile(join(dir, 'results.csv'), '999');
  await expect(files.resolveArtifact(artifact.id)).rejects.toThrow(/changed/i);
});
it('does not bless a changed previously published artifact or omit it on re-registration', async () => {
  const paths = await openWorkspace(await mkdtemp(join(tmpdir(), 'artifact-reregister-')));
  const files = await openFileStore(paths, {maxUploadBytes: 1000});
  const id = randomUUID(),
    dir = join(paths.outputs, id);
  await mkdir(dir);
  await writeFile(join(dir, 'results.csv'), '10');
  await atomicJSON(join(dir, 'manifest.json'), {
    schemaVersion: 1,
    runId: id,
    files: [{name: 'results.csv', mediaType: 'text/csv'}],
  });
  await files.registerPublishedRun(id);
  await writeFile(join(dir, 'results.csv'), '999');
  await expect(files.registerPublishedRun(id)).rejects.toThrow(/changed/i);
  await writeFile(join(dir, 'results.csv'), '10');
  await atomicJSON(join(dir, 'manifest.json'), {schemaVersion: 1, runId: id, files: []});
  await expect(files.registerPublishedRun(id)).rejects.toThrow(/omit|remove/i);
});

it('restores an interrupted run with a missing checkpoint as unverified instead of failing startup', async () => {
  const paths = await openWorkspace(await mkdtemp(join(tmpdir(), 'checkpoint-missing-'))),
    id = randomUUID();
  await mkdir(join(paths.analyses, id));
  await atomicJSON(join(paths.analyses, id, 'run.json'), {
    schemaVersion: 1,
    id,
    sessionId: 'chat',
    requestId: 'request',
    state: 'running',
    startedAt: new Date().toISOString(),
    inputs: [],
    selectedFileIds: [],
    provider: 'openrouter',
    modelId: 'explicit',
    bundleFingerprint: 'hash',
    versions: {piSdk: '1', pricing: '1', visualization: '1'},
    checkpoint: {path: '.pricing/missing-checkpoint.json', sha256: 'missing'},
  });
  await mkdir(join(paths.analyses, '00000000-0000-4000-8000-000000000000')); // a run still starting: no run.json yet
  const runs = await loadRuns(paths);
  expect(runs).toHaveLength(1);
  expect(runs[0]?.state).toBe('interrupted');
  expect(runs[0]?.outcome?.kind).toBe('no-verified-answer');
  expect(runs[0]?.checkpoint).toBeUndefined();
});
