// Offline bounded workflow fixture: executed synthetic calculations, no provider calls.
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {venvPython} from '../fixtures/venv-python.js';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openWorkspace, atomicJSON, readJSON} from '../../src/workspace.js';
import {openFileStore, loadRuns} from '../../src/files.js';
import {loadConfig} from '../../src/runtime.js';
import {buildServer} from '../../src/server.js';
import {EventView} from '../../src/agent/events.js';
import {RunController} from '../../src/agent/runs.js';
import {validateBundle} from '../../src/agent/bundle.js';
import {restoreExplorations} from '../../src/agent/workflow/exploration-restore.js';
import {loadCurrentConversation, saveConversation} from '../../src/conversations.js';
import {createChatFixtureRunner} from '../fixtures/chat-workflow.js';
import type {AgentHandle} from '../../src/agent/session.js';
const paths = await openWorkspace(await mkdtemp(join(tmpdir(), 'browser-chat-workspace-'))),
  files = await openFileStore(paths, {maxUploadBytes: 1048576});
const config = loadConfig({
    PRICING_WORKSPACE: paths.root,
    PRICING_PROVIDER: 'openrouter',
    PRICING_MODEL: 'offline-synthetic-fixture',
    PRICING_PYTHON: venvPython,
    PRICING_PORT: '4318',
  }),
  bundle = await validateBundle(config.bundledRoot);
const health = {
  agent: {ready: true, detail: 'Offline synthetic fixture'},
  python: {ready: true, detail: 'Fixture Python'},
  reports: {ready: false, detail: 'Retired'},
  preview: {ready: false, detail: 'Retired'},
  vision: {ready: false, detail: 'Retired'},
};
const createSession = async () =>
  ({
    session: {sessionId: randomUUID(), messages: [], subscribe: () => () => {}, dispose: () => {}},
    manager: {getBranch: () => []},
    bundle,
  }) as unknown as AgentHandle;
const runner = createChatFixtureRunner(),
  handle = await createSession(),
  view = new EventView(handle, {runs: [], artifacts: []});
view.useLogical();
const controller = new RunController({
  config,
  paths,
  files,
  health,
  handle,
  view,
  createSession,
  workflowRunner: runner,
});
const app = {config, paths, files, bundle, health, view, controller};
const server = await buildServer(app);
const streams = new Set<import('node:http').ServerResponse>();
server.addHook('onRequest', async (request, reply) => {
  if (request.url === '/api/events') {
    streams.add(reply.raw);
    reply.raw.on('close', () => streams.delete(reply.raw));
  }
});
server.get('/test/counters', async () => runner.counters);
server.get('/test/submissions', async () => ({submissions: runner.counters.submissions}));
server.post('/test/enable-workflow', async () => ({enabled: true}));
server.post('/test/disconnect', async () => {
  for (const stream of streams) stream.destroy();
  return {disconnected: true};
});
server.post('/test/restart', async () => {
  await app.controller.close();
  for (const stream of streams) stream.destroy();
  const saved = await loadCurrentConversation(paths);
  if (saved) {
    saved.messages = await restoreExplorations(paths.root, saved.sessionId, saved.messages);
    await saveConversation(paths, saved, false);
  }
  const next = await createSession();
  app.view = new EventView(next, {runs: await loadRuns(paths), artifacts: files.listArtifacts()});
  app.view.useLogical(saved);
  app.controller = new RunController({
    config,
    paths,
    files,
    health,
    handle: next,
    view: app.view,
    createSession,
    workflowRunner: runner,
  });
  return {restarted: true};
});
server.post('/test/tamper-conversation', async () => {
  const path = join(paths.metadata, 'workflow', app.view.snapshot().sessionId, 'conversation.json');
  const saved = await readJSON<any>(path, {});
  for (const message of saved.messages ?? [])
    if (message.exploration) message.exploration.tables[0].rows[0].cells.revenue.value = 999;
  await atomicJSON(path, saved);
  return {tampered: true};
});
server.post('/test/change-source', async () => {
  for (const source of files.listSources()) await writeFile(join(paths.root, source.relativePath), 'changed');
  return {changed: true};
});
server.post('/test/activity', async () => {
  setTimeout(() => app.view.settle(), 100);
  return {updated: true};
});
await server.listen({port: 4318, host: '127.0.0.1'});
process.on('SIGTERM', () => void server.close());
