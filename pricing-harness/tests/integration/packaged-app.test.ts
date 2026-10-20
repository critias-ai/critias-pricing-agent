import {expect, it} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir, mkdtemp, symlink, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
// Release packaging runs on macOS (npm pack, tar, /tmp); Windows installs from a clone.
const test = it.skipIf(process.platform === 'win32');
test('packs eight complete skills, the knowledge cards and helpers without test answers, then resolves them outside cwd', async () => {
  const run = promisify(execFile),
    root = resolve('.'),
    directory = await mkdtemp(join(tmpdir(), 'installed harness '));
  await mkdir(join(root, '.cache/packages'), {recursive: true});
  const {stdout} = await run(
    'npm',
    [
      'pack',
      '--offline',
      '--json',
      '--ignore-scripts',
      '--pack-destination',
      join(root, '.cache/packages'),
      '--cache',
      join(root, '.cache/npm'),
    ],
    {cwd: root, maxBuffer: 1024 * 1024},
  );
  const packed = JSON.parse(stdout)[0];
  const names = packed.files.map((f: {path: string}) => f.path);
  expect(names.filter((name: string) => name.endsWith('SKILL.md'))).toHaveLength(8);
  expect(names).toContain('bundled/pricing-plugin/LICENSE');
  expect(names).toContain('scripts/start-macos.sh');
  expect(names).toContain('bin/critias.mjs');
  expect(names).toContain('scripts/start-windows.ps1');
  expect(names).toContain('npm-shrinkwrap.json');
  expect(names.some((name: string) => /tests\/|__pycache__|\.pyc$|^workspace\/|^\.env$/.test(name))).toBe(false);
  await run('tar', ['-xzf', join(root, '.cache/packages', packed.filename), '-C', directory]);
  const install = join(directory, 'package');
  await symlink(join(root, 'node_modules'), join(install, 'node_modules'), 'dir');
  const script = `const {loadConfig}=await import(${JSON.stringify(pathToFileURL(join(install, 'dist/runtime.js')).href)});const {validateBundle}=await import(${JSON.stringify(pathToFileURL(join(install, 'dist/agent/bundle.js')).href)});const c=loadConfig({PRICING_WORKSPACE:'/tmp/workspace',PRICING_PROVIDER:'openrouter',PRICING_MODEL:'explicit-model',PRICING_PYTHON:'/usr/bin/python3'});console.log(JSON.stringify({root:c.appRoot,skills:(await validateBundle(c.bundledRoot)).skillNames}));`;
  // macOS temporary directories can use /var aliases for /private/var.
  const output = await run(process.execPath, ['--input-type=module', '-e', script], {cwd: '/tmp'});
  const result = JSON.parse(output.stdout);
  expect(result.root).toBe(await realpath(install));
  expect(result.skills).toHaveLength(8 + 17);
});
