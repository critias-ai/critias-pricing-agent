import {expect, it} from 'vitest';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openWorkspace} from '../../src/workspace.js';
import {openFileStore} from '../../src/files.js';
import type {Application} from '../../src/application.js';
it('serves stable snapshots, rejects busy uploads, and gives structured errors', async () => {
  const {buildServer} = await import('../../src/server.js');
  const paths = await openWorkspace(await mkdtemp(join(tmpdir(), 'http ')));
  const files = await openFileStore(paths, {maxUploadBytes: 1024});
  let busy = false;
  const snapshot = () => ({
    serverInstanceId: 'server',
    sequence: 0,
    sessionId: 'session',
    busy,
    activeRun: null,
    runs: [],
    messages: [],
    artifacts: [],
  });
  const app = {
    paths,
    files,
    config: {port: 4317, maxUploadBytes: 1024, modelId: 'explicit', appRoot: process.cwd()},
    bundle: {skillNames: []},
    health: {},
    controller: {snapshot, close: async () => {}},
    view: {subscribe: () => () => {}},
  } as unknown as Application;
  const server = await buildServer(app);
  const headers = {host: '127.0.0.1:4317'};
  expect((await server.inject({url: '/api/session', headers})).json().sessionId).toBe('session');
  busy = true;
  expect((await server.inject({method: 'POST', url: '/api/files', headers})).statusCode).toBe(409);
  busy = false;
  expect(
    (await server.inject({url: '/api/session', headers: {host: 'evil.example', origin: 'http://evil.example'}}))
      .statusCode,
  ).toBe(403);
  const error = await server.inject({url: '/api/outputs/missing', headers});
  expect(error.statusCode).toBe(404);
  expect(error.json().error.code).toBe('OUTPUT_NOT_FOUND');
  expect(JSON.stringify(error.json())).not.toContain('stack');
  await server.close();
});
