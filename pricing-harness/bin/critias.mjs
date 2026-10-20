#!/usr/bin/env node
// Command-line entry for the npm package: sets up Python once, then starts the app.
import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const windows = process.platform === 'win32';
// The Python environment and an optional shared .env live here, so a package update keeps them.
const home = resolve(process.env.CRITIAS_HOME || join(homedir(), '.critias'));
const [command, ...rest] = process.argv.slice(2);

const usage = `Critias ${pkg.version}, the open-source pricing analyst

Usage:
  critias [workspace-folder]   start the app (default folder: ~/CritiasWorkspace)
  critias models [provider]    list model IDs for openai, openrouter, google or anthropic
  critias --version | --help

Settings: a key and a model per provider in .env, read from the current folder and from ${join(home, '.env')}.
Example: ANTHROPIC_API_KEY=... and ANTHROPIC_MODEL=... See https://critias.ai/install`;

function fail(message) {
  console.error(`critias: ${message}`);
  process.exit(1);
}
function run(file, args) {
  const result = spawnSync(file, args, {stdio: 'inherit'});
  if (result.error || result.status !== 0)
    fail(`"${[file, ...args].join(' ')}" failed${result.error ? `: ${result.error.message}` : ''}`);
}
function python() {
  if (process.env.PRICING_PYTHON) return process.env.PRICING_PYTHON;
  const venv = join(home, 'venv'),
    exe = join(venv, windows ? 'Scripts' : 'bin', windows ? 'python.exe' : 'python'),
    stamp = join(venv, 'requirements.sha256'),
    wanted = createHash('sha256')
      .update(readFileSync(join(root, 'requirements.txt')))
      .digest('hex');
  if (existsSync(exe) && existsSync(stamp) && readFileSync(stamp, 'utf8') === wanted) return exe;
  console.log('Setting up the Python environment (first run, or after an update; needs Python 3.12 and a network).');
  mkdirSync(home, {recursive: true});
  if (!existsSync(exe)) {
    const bootstrap = process.env.PRICING_BOOTSTRAP_PYTHON
      ? [process.env.PRICING_BOOTSTRAP_PYTHON]
      : windows
        ? ['py', '-3.12']
        : ['python3.12'];
    run(bootstrap[0], [...bootstrap.slice(1), '-m', 'venv', venv]);
  }
  run(exe, ['-m', 'pip', 'install', '-r', join(root, 'requirements.txt')]);
  writeFileSync(stamp, wanted);
  return exe;
}

if (command === '--help' || command === '-h') {
  console.log(usage);
} else if (command === '--version' || command === '-v') {
  console.log(pkg.version);
} else if (command === 'models') {
  process.exit(
    spawnSync(process.execPath, [join(root, 'scripts/list-models.mjs'), ...rest], {stdio: 'inherit'}).status ?? 1,
  );
} else if (command?.startsWith('-')) {
  fail(`unknown option ${command}\n\n${usage}`);
} else {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 19)) fail('Node 22.19 or newer is required.');
  if (windows) {
    // The analyst's shell commands run in Git for Windows' bash.exe, as the agent SDK requires.
    const bash = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]
      .filter(Boolean)
      .map(p => join(p, 'Git', 'bin', 'bash.exe'));
    if (!bash.some(existsSync)) fail('Git for Windows is required: install it from https://git-scm.com/download/win');
  }
  const loaded = [join(process.cwd(), '.env'), join(home, '.env')].filter(existsSync);
  for (const file of loaded) process.loadEnvFile(file); // never overrides a variable already set
  if (!loaded.length)
    console.log(`No .env found. Put a key and a model in ${join(home, '.env')} (see critias --help).`);
  const workspace = resolve(command ?? join(homedir(), 'CritiasWorkspace'));
  mkdirSync(workspace, {recursive: true});
  const env = {...process.env, PRICING_WORKSPACE: workspace, PRICING_PYTHON: python(), PYTHONUTF8: '1'};
  const server = spawn(process.execPath, [join(root, 'dist/server.js')], {stdio: 'inherit', env});
  process.on('SIGTERM', () => server.kill('SIGTERM'));
  server.on('exit', code => process.exit(code ?? 1));
}
