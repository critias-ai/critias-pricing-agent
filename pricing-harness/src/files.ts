import {mkdir, readdir, rename, rm, writeFile, stat} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Readable, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {basename, extname, join, relative} from 'node:path';
import {randomUUID} from 'node:crypto';
import {atomicJSON, hashFile, readJSON, safePath, type WorkspacePaths} from './workspace.js';
import {HarnessError, type SourceFile, type Artifact, type PublishedManifest, type RunRecord} from './contracts.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validId = (id: string) => uuid.test(id);
function kind(name: string): SourceFile['kind'] {
  const kinds: Record<string, SourceFile['kind']> = {'.csv': 'csv', '.xlsx': 'xlsx', '.txt': 'text', '.md': 'markdown'};
  const result = kinds[extname(name).toLowerCase()];
  if (!result) throw new HarnessError('UNSUPPORTED_FORMAT', 'Use CSV, XLSX, TXT or MD', 415);
  return result;
}
export async function openFileStore(paths: WorkspacePaths, options: {maxUploadBytes: number}) {
  let sources = await readJSON<SourceFile[]>(join(paths.metadata, 'files.json'), []),
    artifacts = await readJSON<Artifact[]>(join(paths.metadata, 'outputs.json'), []);
  let chain = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = chain.then(fn);
    chain = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  const persist = () => atomicJSON(join(paths.metadata, 'files.json'), sources);
  async function adopt(dir: string) {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await safePath(paths.files, relative(paths.files, full));
        await adopt(full);
      } else if (
        entry.isFile() &&
        !entry.name.endsWith('.partial') &&
        !sources.some(s => s.relativePath === relative(paths.root, full))
      ) {
        let type: SourceFile['kind'];
        try {
          type = kind(entry.name);
        } catch {
          continue;
        }
        await safePath(paths.files, relative(paths.files, full));
        sources.push({
          id: randomUUID(),
          name: entry.name,
          relativePath: relative(paths.root, full),
          kind: type,
          addedAt: new Date().toISOString(),
          ...(await hashFile(full)),
        });
      } else if (entry.isSymbolicLink()) {
        await safePath(paths.files, relative(paths.files, full));
        throw new Error('Symlink sources are unsupported');
      }
    }
  }
  await adopt(paths.files);
  await persist();
  return {
    listSources: () => structuredClone(sources),
    listArtifacts: () => structuredClone(artifacts),
    // Streaming happens outside the serial queue so a slow or stalled client cannot hold up run start or cancel;
    // only the rename and metadata update are serialised. truncated() reports a stream the multipart limit cut short.
    saveUpload: async (input: Readable, name: string, truncated: () => boolean = () => false) => {
      const leaf = basename(name.replaceAll('\\', '/')).replace(/[\x00-\x1f]/g, '_');
      if (!leaf || leaf === '.' || leaf === '..') throw new HarnessError('INVALID_FILE', 'Invalid filename');
      const type = kind(leaf),
        id = randomUUID(),
        dir = join(paths.files, id);
      await mkdir(dir);
      await safePath(paths.files, id);
      const temp = join(dir, `${leaf}.partial`),
        final = join(dir, leaf);
      let bytes = 0;
      try {
        await pipeline(
          input,
          new Transform({
            transform(chunk, _encoding, callback) {
              bytes += chunk.length;
              callback(
                bytes > options.maxUploadBytes
                  ? new HarnessError('FILE_TOO_LARGE', 'File exceeds upload limit', 413)
                  : null,
                chunk,
              );
            },
          }),
          createWriteStream(temp, {flags: 'wx'}),
        );
        if (truncated()) throw new HarnessError('FILE_TOO_LARGE', 'File exceeds upload limit', 413);
        return await serial(async () => {
          await rename(temp, final);
          const file: SourceFile = {
            id,
            name: leaf,
            relativePath: relative(paths.root, final),
            kind: type,
            addedAt: new Date().toISOString(),
            ...(await hashFile(final)),
          };
          sources.push(file);
          await persist();
          return file;
        });
      } catch (e) {
        await rm(dir, {recursive: true, force: true});
        sources = sources.filter(s => s.id !== id);
        throw e;
      }
    },
    resolveSources: async (ids: string[]) => {
      const selected = ids.map(id => {
        const file = sources.find(s => s.id === id);
        if (!file) throw new HarnessError('FILE_NOT_FOUND', 'Selected source not found', 404);
        return file;
      });
      for (const file of selected)
        await safePath(paths.files, relative(paths.files, join(paths.root, file.relativePath)));
      return structuredClone(selected);
    },
    snapshotSources: () =>
      serial(async () => {
        const next: SourceFile[] = [];
        for (const file of sources) {
          const path = await safePath(paths.files, relative(paths.files, join(paths.root, file.relativePath)));
          next.push({...file, ...(await hashFile(path))});
        }
        sources = next;
        await persist();
        return structuredClone(sources);
      }),
    checkSourcesUnchanged: async (inputs: Pick<SourceFile, 'id' | 'relativePath' | 'sha256'>[]) => {
      const changed: string[] = [];
      for (const file of inputs) {
        try {
          const path = await safePath(paths.files, relative(paths.files, join(paths.root, file.relativePath)));
          if ((await hashFile(path)).sha256 !== file.sha256) changed.push(file.id);
        } catch {
          changed.push(file.id);
        }
      }
      return changed;
    },
    registerPublishedRun: (runId: string) =>
      serial(async () => {
        if (!validId(runId)) throw new Error('Invalid run ID');
        const dir = join(paths.outputs, runId);
        let manifest: PublishedManifest;
        try {
          manifest = await readJSON<PublishedManifest>(
            await safePath(paths.outputs, `${runId}/manifest.json`),
            null as never,
          );
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
          throw e;
        }
        if (!manifest || manifest.schemaVersion !== 1 || manifest.runId !== runId || !Array.isArray(manifest.files))
          throw new Error('Invalid artifact manifest');
        const next: Artifact[] = [];
        const seen = new Set<string>();
        for (const file of manifest.files) {
          if (
            typeof file.name !== 'string' ||
            basename(file.name) !== file.name ||
            file.name.endsWith('.partial') ||
            file.name === 'manifest.json' ||
            seen.has(file.name)
          )
            throw new Error('Invalid artifact name');
          seen.add(file.name);
          const media: Record<string, string> = {
            '.html': 'text/html',
            '.csv': 'text/csv',
            '.py': 'text/x-python',
            '.json': 'application/json',
            '.png': 'image/png',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
          };
          if (media[extname(file.name)] !== file.mediaType) throw new Error('Unsupported artifact media type');
          const path = await safePath(dir, file.name);
          await safePath(paths.outputs, relative(paths.outputs, path));
          if (!(await stat(path)).isFile()) throw new Error('Artifact must be a file');
          const existing = artifacts.find(a => a.runId === runId && a.name === file.name);
          const hashed = await hashFile(path);
          if (existing && existing.sha256 !== hashed.sha256) throw new Error('Published artifact changed');
          next.push({
            id: existing?.id ?? randomUUID(),
            runId,
            name: file.name,
            relativePath: relative(paths.root, path),
            mediaType: file.mediaType,
            ...hashed,
          });
        }
        if (artifacts.some(a => a.runId === runId && !next.some(n => n.name === a.name)))
          throw new Error('Published artifact cannot be removed from manifest');
        artifacts = [...artifacts.filter(a => a.runId !== runId), ...next];
        await atomicJSON(join(paths.metadata, 'outputs.json'), artifacts);
      }),
    resolveArtifact: async (id: string) => {
      const artifact = artifacts.find(a => a.id === id);
      if (!artifact) throw new HarnessError('OUTPUT_NOT_FOUND', 'Output not found', 404);
      const path = await safePath(paths.outputs, relative(paths.outputs, join(paths.root, artifact.relativePath)));
      if ((await hashFile(path)).sha256 !== artifact.sha256)
        throw new HarnessError('OUTPUT_CHANGED', 'Published artifact changed; download withheld', 409);
      return {artifact, path};
    },
  };
}
export type FileStore = Awaited<ReturnType<typeof openFileStore>>;
export async function loadRuns(paths: WorkspacePaths) {
  const runs: RunRecord[] = [];
  for (const dir of await readdir(paths.analyses, {withFileTypes: true})) {
    if (!dir.isDirectory() || !validId(dir.name)) continue;
    // A folder whose run.json is not written yet (a run starting, or one stopped mid-start) is skipped.
    const path = await safePath(paths.analyses, `${dir.name}/run.json`).catch(() => undefined);
    const run = path && (await readJSON<RunRecord>(path, null as never));
    if (!run) continue;
    if (run.state === 'running' || run.state === 'cancelling') {
      run.state = 'interrupted';
      run.endedAt = new Date().toISOString();
      run.error = {code: 'INTERRUPTED', message: 'Previous process stopped; this request was not resubmitted'};
      run.checkpoint = undefined;
      run.outcome = {kind: 'no-verified-answer', reason: 'process interrupted before delivery'};
      await atomicJSON(path, run);
    }
    runs.push(run);
  }
  return runs.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
