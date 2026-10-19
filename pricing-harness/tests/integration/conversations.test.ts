import {expect, it} from 'vitest';
import {mkdtemp, readFile, access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {atomicJSON, openWorkspace} from '../../src/workspace.js';
import {openFileStore} from '../../src/files.js';
import {loadConfig} from '../../src/runtime.js';
import {RunController} from '../../src/agent/runs.js';
import {EventView} from '../../src/agent/events.js';
import {
  listConversations,
  loadConversation,
  loadCurrentConversation,
  saveConversation,
} from '../../src/conversations.js';
import type {ChatMessage} from '../../src/contracts.js';
const said = (role: ChatMessage['role'], text: string): ChatMessage => ({id: text, role, text, complete: true});
const workspace = async () => openWorkspace(await mkdtemp(join(tmpdir(), 'conversations-')));
it('lists saved conversations newest first, titled by the first question, without empty ones', async () => {
  const paths = await workspace();
  await saveConversation(paths, {
    sessionId: 'a',
    messages: [said('user', 'Why did   margin fall?'), said('assistant', 'x')],
  });
  await new Promise(r => setTimeout(r, 5));
  await saveConversation(paths, {sessionId: 'b', messages: [said('user', 'Q'.repeat(100))]});
  await saveConversation(paths, {sessionId: 'empty', messages: []});
  const list = await listConversations(paths);
  expect(list.map(c => c.id)).toEqual(['b', 'a']);
  expect(list[1]).toMatchObject({title: 'Why did margin fall?', messageCount: 2});
  expect(list[0]!.title).toHaveLength(80);
  expect(JSON.parse(await readFile(join(paths.metadata, 'workflow/current.json'), 'utf8'))).toEqual({
    sessionId: 'empty',
  });
});
it('rejects conversation IDs that could leave the workflow folder', async () => {
  const paths = await workspace();
  for (const id of ['../x', 'a/b', '', ' a']) await expect(loadConversation(paths, id)).rejects.toThrow(/Invalid/);
});
it('moves the single pre-history conversation file into its own folder once', async () => {
  const paths = await workspace();
  await atomicJSON(join(paths.metadata, 'workflow/conversation.json'), {
    sessionId: 'old',
    messages: [said('user', 'Hi')],
  });
  expect((await loadCurrentConversation(paths))?.messages).toHaveLength(1);
  await expect(access(join(paths.metadata, 'workflow/conversation.json'))).rejects.toThrow();
  expect((await loadConversation(paths, 'old'))?.title).toBe('Hi');
  expect((await loadCurrentConversation(paths))?.sessionId).toBe('old');
});
it('opens a saved conversation without moving it up the list, and refuses while busy', async () => {
  const paths = await workspace(),
    files = await openFileStore(paths, {maxUploadBytes: 1000});
  const config = loadConfig({
    PRICING_WORKSPACE: paths.root,
    PRICING_PROVIDER: 'openrouter',
    PRICING_MODEL: 'fixture',
    PRICING_PYTHON: '/usr/bin/python3',
  });
  const handle = {
    session: {sessionId: 'now', messages: [], subscribe: () => () => {}, dispose: () => {}},
    manager: {},
    bundle: {fingerprint: 'fixture', pricingVersion: '', visualizationVersion: '', skillPaths: [], skillNames: []},
  } as any;
  const view = new EventView(handle, {runs: [], artifacts: []});
  view.useLogical();
  const health = {agent: {ready: true, detail: ''}, python: {ready: true, detail: ''}};
  const controller = new RunController({config, paths, files, handle, view, health, createSession: async () => handle});
  await saveConversation(paths, {sessionId: 'older', messages: [said('user', 'First'), said('assistant', 'Answer')]});
  const before = (await loadConversation(paths, 'older'))!.updatedAt;
  await saveConversation(paths, {sessionId: 'now', messages: [said('user', 'Second')]});
  await new Promise(r => setTimeout(r, 5));
  const opened = await controller.openConversation('older');
  expect(opened.sessionId).toBe('older');
  expect(opened.messages.map(m => m.text)).toEqual(['First', 'Answer']);
  expect((await loadConversation(paths, 'older'))!.updatedAt).toBe(before);
  expect((await loadCurrentConversation(paths))?.sessionId).toBe('older');
  await expect(controller.openConversation('missing')).rejects.toMatchObject({status: 404});
  view.reserve();
  (controller as any).busy = true;
  await expect(controller.openConversation('now')).rejects.toMatchObject({code: 'BUSY'});
});
