import {mkdir, readFile, writeFile, rename, realpath, stat, rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import {join, relative, resolve, isAbsolute, dirname} from 'node:path';
import type {BigIntStats} from 'node:fs';
export type WorkspacePaths = {
  root: string;
  metadata: string;
  context: string;
  sessions: string;
  files: string;
  analyses: string;
  outputs: string;
  cache: string;
  tmp: string;
};
export async function openWorkspace(root: string): Promise<WorkspacePaths> {
  await mkdir(root, {recursive: true});
  root = await realpath(root);
  const metadata = join(root, '.pricing');
  const paths = {
    root,
    metadata,
    context: join(metadata, 'context.md'),
    sessions: join(metadata, 'sessions'),
    files: join(root, 'files'),
    analyses: join(root, 'analyses'),
    outputs: join(root, 'outputs'),
    cache: join(metadata, 'data-cache'),
    tmp: join(metadata, 'tmp'),
  };
  for (const key of ['metadata', 'sessions', 'files', 'analyses', 'outputs', 'cache', 'tmp'] as const) {
    await mkdir(paths[key], {recursive: true});
    await safePath(root, relative(root, paths[key]));
  }
  try {
    await writeFile(
      paths.context,
      '# Confirmed business context\n\nNo business definitions have been confirmed yet. Ask before adding reusable facts.\n',
      {flag: 'wx'},
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
  }
  return paths;
}
export async function atomicJSON(path: string, value: unknown) {
  await mkdir(dirname(path), {recursive: true});
  const temp = `${path}.${randomUUID()}.partial`;
  try {
    await writeFile(temp, JSON.stringify(value, null, 2) + '\n');
    await rename(temp, path);
  } finally {
    await rm(temp, {force: true});
  }
}
export async function readJSON<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw e;
  }
}
// The SDK's write and edit tools rewrite a path before opening it ('@' prefix, '~', file:// URLs, unicode spaces,
// Git Bash drive paths on Windows). A guard that checks the raw argument would judge a different file, so such
// paths are refused rather than re-implementing the SDK's rules.
export const sdkRewrittenPath = (path: string) =>
  /^[@~]|^file:|[\u00a0\u2000-\u200a\u202f\u205f\u3000]/i.test(path) ||
  (process.platform === 'win32' && /^\/[a-z](\/|$)/i.test(path));
export async function safePath(root: string, path: string): Promise<string> {
  const target = resolve(root, path),
    rel = relative(resolve(root), target);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Path escape rejected');
  const realRoot = await realpath(root),
    real = await realpath(target),
    realRel = relative(realRoot, real);
  if (realRel.startsWith('..') || isAbsolute(realRel)) throw new Error('Symlink escape rejected');
  return real;
}
type HashEntry = {dev: bigint; ino: bigint; size: bigint; mtimeNs: bigint; ctimeNs: bigint; sha256: string};
const hashCache = new Map<string, HashEntry>();
const hashCounters = {computed: 0, cached: 0};
export function hashCacheStats() {
  return {...hashCounters};
}
export function clearHashCache() {
  hashCache.clear();
  hashCounters.computed = 0;
  hashCounters.cached = 0;
}
const sameIdentity = (a: Omit<HashEntry, 'sha256'>, b: BigIntStats) =>
  a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
// A content hash is reused only while device, inode, size, mtime and ctime are unchanged.
// ctime cannot be set by user tools, so touch-and-restore edits still force a fresh hash.
export async function hashFile(path: string) {
  const key = resolve(path),
    before = await stat(key, {bigint: true}),
    cached = hashCache.get(key);
  if (cached && sameIdentity(cached, before)) {
    hashCounters.cached++;
    return {sha256: cached.sha256, bytes: Number(before.size)};
  }
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(key)) hash.update(chunk);
  const sha256 = hash.digest('hex');
  hashCounters.computed++;
  const after = await stat(key, {bigint: true});
  if (hashCache.size > 10000) hashCache.clear();
  if (
    sameIdentity(
      {dev: before.dev, ino: before.ino, size: before.size, mtimeNs: before.mtimeNs, ctimeNs: before.ctimeNs},
      after,
    )
  )
    hashCache.set(key, {
      dev: after.dev,
      ino: after.ino,
      size: after.size,
      mtimeNs: after.mtimeNs,
      ctimeNs: after.ctimeNs,
      sha256,
    });
  else hashCache.delete(key);
  return {sha256, bytes: Number(after.size)};
}
