import {mkdir, copyFile, readFile, writeFile} from 'node:fs/promises';
import {join, relative} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hashFile, safePath} from '../../workspace.js';
import type {ExplorationSpec} from '../../exploration.js';
import type {Checkpoint, FileRef} from './contracts.js';

export async function stableRefs(root: string, refs: FileRef[]) {
  const same = async (r: FileRef) => (await safePath(root, r.path).then(hashFile, () => null))?.sha256 === r.sha256;
  return (await Promise.all(refs.map(same))).every(Boolean);
}

// Freezes a presentation: copies the result files it reads, so the delivered values cannot change afterwards.
// `recorded` maps each file name the analyst may present to the file an executed query or script produced.
export async function sealPresentation(
  root: string,
  stageDir: string,
  spec: ExplorationSpec,
  recorded: Map<string, string>,
  sources: FileRef[],
  meta: Pick<Checkpoint, 'runId' | 'conversationId'>,
) {
  const id = randomUUID(),
    dir = join(root, '.pricing', 'workflow', meta.conversationId, 'checkpoints', id);
  await mkdir(dir, {recursive: true});
  const files: Checkpoint['files'] = [];
  for (const name of new Set(spec.tables.map(t => t.file))) {
    const expected = recorded.get(name);
    const refusal = `${name} is not an unchanged output of an executed query or script`;
    if (!expected) throw new Error(refusal);
    const source = await safePath(root, relative(root, join(stageDir, name)));
    const hash = (await hashFile(source)).sha256;
    if (expected !== hash) throw new Error(refusal);
    const target = join(dir, `${files.length}-${name.replace(/[^A-Za-z0-9._-]/g, '_')}`);
    await copyFile(source, target);
    files.push({name, path: relative(root, target), sha256: hash});
  }
  const checkpoint: Checkpoint = {
    schemaVersion: 2,
    id,
    ...meta,
    sources,
    files,
    createdAt: new Date().toISOString(),
    exploration: spec,
  };
  const target = join(dir, 'checkpoint.json');
  await writeFile(target, JSON.stringify(checkpoint, null, 2) + '\n', {flag: 'wx'});
  return {checkpoint, ref: {path: relative(root, target), sha256: (await hashFile(target)).sha256}};
}

export async function loadCheckpoint(root: string, ref: FileRef, conversationId: string): Promise<Checkpoint | null> {
  try {
    if (!(await stableRefs(root, [ref]))) return null;
    const checkpoint = JSON.parse(await readFile(await safePath(root, ref.path), 'utf8')) as Checkpoint;
    if (
      checkpoint.schemaVersion !== 2 ||
      checkpoint.conversationId !== conversationId ||
      !(await stableRefs(root, [...checkpoint.files, ...checkpoint.sources]))
    )
      return null;
    return checkpoint;
  } catch {
    return null;
  }
}
