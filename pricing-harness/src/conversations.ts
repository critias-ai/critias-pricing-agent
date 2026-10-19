import {readdir, rename} from 'node:fs/promises';
import {join} from 'node:path';
import {HarnessError, type ChatMessage} from './contracts.js';
import {atomicJSON, readJSON, type WorkspacePaths} from './workspace.js';
// Each conversation's visible chat lives beside its analyst folder: .pricing/workflow/<id>/conversation.json.
export type Conversation = {sessionId: string; title?: string; updatedAt?: string; messages: ChatMessage[]};
export type ConversationSummary = {id: string; title: string; updatedAt: string; messageCount: number};
const validId = (id: string) => /^[a-zA-Z0-9 _-]+$/.test(id) && id.trim() === id;
const folder = (paths: WorkspacePaths) => join(paths.metadata, 'workflow');
const file = (paths: WorkspacePaths, id: string) => {
  if (!validId(id)) throw new HarnessError('INVALID_CONVERSATION', 'Invalid conversation ID');
  return join(folder(paths), id, 'conversation.json');
};
const titleOf = (messages: ChatMessage[]) => {
  const text =
    messages
      .find(m => m.role === 'user')
      ?.text.replace(/\s+/g, ' ')
      .trim() ?? '';
  return text.length > 80 ? text.slice(0, 79) + '…' : text;
};
// `changed` false keeps the last-updated time, so reopening a conversation doesn't move it to the top of the list.
export async function saveConversation(
  paths: WorkspacePaths,
  {sessionId, messages, updatedAt}: Conversation,
  changed = true,
) {
  await atomicJSON(file(paths, sessionId), {
    sessionId,
    title: titleOf(messages),
    updatedAt: changed || !updatedAt ? new Date().toISOString() : updatedAt,
    messages,
  });
  await atomicJSON(join(folder(paths), 'current.json'), {sessionId});
}
export async function loadConversation(paths: WorkspacePaths, id: string) {
  return readJSON<Conversation | undefined>(file(paths, id), undefined);
}
// The conversation open when the app last stopped. Moves the single pre-history file into its own folder once.
export async function loadCurrentConversation(paths: WorkspacePaths) {
  const legacy = join(folder(paths), 'conversation.json');
  const old = await readJSON<Conversation | undefined>(legacy, undefined);
  if (old && validId(old.sessionId)) {
    await saveConversation(paths, old);
    await rename(legacy, legacy + '.moved');
  }
  const current = await readJSON<{sessionId?: string}>(join(folder(paths), 'current.json'), {});
  return current.sessionId && validId(current.sessionId) ? loadConversation(paths, current.sessionId) : undefined;
}
export async function listConversations(paths: WorkspacePaths): Promise<ConversationSummary[]> {
  const entries = await readdir(folder(paths), {withFileTypes: true}).catch(() => []);
  const found = await Promise.all(
    entries
      .filter(e => e.isDirectory() && validId(e.name))
      .map(async e => {
        const saved = await loadConversation(paths, e.name).catch(() => undefined);
        if (!saved?.messages.length) return undefined;
        return {
          id: e.name,
          title: saved.title || titleOf(saved.messages) || 'Untitled conversation',
          updatedAt: saved.updatedAt ?? '',
          messageCount: saved.messages.length,
        };
      }),
  );
  return found.filter(c => c !== undefined).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
