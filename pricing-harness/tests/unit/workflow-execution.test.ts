import {expect, it} from 'vitest';
import {mkdtemp, writeFile, readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {venvPython} from '../fixtures/venv-python.js';
import {toShellPath} from '../../src/runtime.js';
it('records actual generic raw-source reads and executed DuckDB queries rather than declared source names', async () => {
  const root = await mkdtemp(join(tmpdir(), 'execution-'));
  const script = join(root, 'check.py'),
    source = join(root, 'source.csv'),
    record = join(root, 'record.json');
  await writeFile(source, 'amount\n10\n');
  await writeFile(
    script,
    `import duckdb,json\nc=duckdb.connect()\nvalue=c.execute("select sum(amount) from read_csv_auto('${toShellPath(source)}')").fetchone()[0]\nprint(json.dumps({'actual':value,'sourcePaths':['imaginary.csv']}))\n`,
  );
  await promisify(execFile)(venvPython, [
    resolve('bundled/harness-tools/record_execution.py'),
    '--script',
    script,
    '--root',
    root,
    '--record',
    record,
  ]);
  const data = JSON.parse(await readFile(record, 'utf8'));
  expect(data.reads.some((p: string) => p.endsWith('source.csv'))).toBe(true);
  expect(data.reads.some((p: string) => p.endsWith('imaginary.csv'))).toBe(false);
  expect(data.queries.some((q: string) => q.includes('sum(amount)'))).toBe(true);
  expect(data.success).toBe(true);
});
it('keeps first-use cache preparation provenance resolvable after the helper atomically renames its cache', async () => {
  const root = await mkdtemp(join(tmpdir(), 'execution-cache-')),
    source = join(root, 'source.csv'),
    script = join(root, 'prepare.py'),
    record = join(root, 'record.json');
  await writeFile(source, 'amount\n10\n');
  await writeFile(
    script,
    `import sys,json\nfrom pathlib import Path\nsys.path.insert(0,${JSON.stringify(resolve('bundled/harness-tools'))})\nfrom data_workspace import prepare_source,ImportOptions\np=prepare_source(Path(${JSON.stringify(source)}),Path(${JSON.stringify(join(root, 'cache'))}),ImportOptions(format='csv',delimiter=','))\nprint(json.dumps({'rows':p.row_count}))\n`,
  );
  await promisify(execFile)(venvPython, [
    resolve('bundled/harness-tools/record_execution.py'),
    '--script',
    script,
    '--root',
    root,
    '--record',
    record,
  ]);
  const audit = JSON.parse(await readFile(record, 'utf8'));
  expect(audit.reads).toContain('source.csv');
  for (const path of audit.reads) await expect(readFile(join(root, path))).resolves.toBeTruthy();
  expect(audit.reads.some((path: string) => path.endsWith('source.duckdb'))).toBe(true);
});
it('does not attribute an observed rename to a replacement file with another identity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'execution-identity-')),
    script = join(root, 'check.py'),
    record = join(root, 'record.json');
  await writeFile(
    script,
    `from pathlib import Path\nimport os\nr=Path(${JSON.stringify(root)})\n(r/'temp').mkdir()\n(r/'temp/read.txt').write_text('read value')\n(r/'replacement.txt').write_text('unrelated')\n(r/'temp/read.txt').read_text()\nos.rename(r/'temp',r/'final')\nos.replace(r/'replacement.txt',r/'final/read.txt')\n`,
  );
  await promisify(execFile)(venvPython, [
    resolve('bundled/harness-tools/record_execution.py'),
    '--script',
    script,
    '--root',
    root,
    '--record',
    record,
  ]);
  const audit = JSON.parse(await readFile(record, 'utf8'));
  expect(audit.reads).toContain(join('temp', 'read.txt'));
  expect(audit.reads).not.toContain(join('final', 'read.txt'));
});
