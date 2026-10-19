import {beforeEach, expect, it} from 'vitest';
import {mkdtemp, writeFile, utimes, stat, rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hashFile, hashCacheStats, clearHashCache} from '../../src/workspace.js';
beforeEach(() => clearHashCache());
const file = async (content: string) => {
  const path = join(await mkdtemp(join(tmpdir(), 'hash-cache-')), 'a.csv');
  await writeFile(path, content);
  return path;
};
it('reuses an unchanged file hash and recomputes after a same-size edit', async () => {
  const path = await file('amount\n10\n');
  const first = await hashFile(path);
  const second = await hashFile(path);
  expect(second).toEqual(first);
  expect(hashCacheStats()).toEqual({computed: 1, cached: 1});
  await writeFile(path, 'amount\n20\n');
  const third = await hashFile(path);
  expect(third.sha256).not.toBe(first.sha256);
  expect(hashCacheStats().computed).toBe(2);
});
it('recomputes when content changes and mtime is restored', async () => {
  const path = await file('a\n1\n');
  const original = await stat(path);
  await hashFile(path);
  await writeFile(path, 'a\n2\n');
  await utimes(path, original.atime, original.mtime);
  const again = await hashFile(path);
  expect(hashCacheStats().computed).toBe(2);
  expect(again.bytes).toBe(4);
});
it('recomputes when a file is replaced by rename', async () => {
  const path = await file('a\n1\n');
  const first = await hashFile(path);
  const temp = path + '.tmp';
  await writeFile(temp, 'a\n9\n');
  await rename(temp, path);
  const second = await hashFile(path);
  expect(second.sha256).not.toBe(first.sha256);
  expect(hashCacheStats().computed).toBe(2);
});
