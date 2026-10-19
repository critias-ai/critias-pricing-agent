import type {ExternalStoreAdapter, ThreadMessageLike} from '@assistant-ui/react';
import type {ChatMessage} from '../contracts.js';
type AppendMessage = Parameters<ExternalStoreAdapter<ChatMessage>['onNew']>[0];
const converted = new WeakMap<ChatMessage, ThreadMessageLike>();
// Snapshot updates replace only changed message objects, so identity is a sound cache key.
export function toThreadMessage(message: ChatMessage): ThreadMessageLike {
  let like = converted.get(message);
  if (!like) {
    like = {
      id: message.id,
      role: message.role,
      content: [{type: 'text', text: message.text}],
      ...(message.role === 'assistant' ? {status: {type: 'complete', reason: 'stop'} as const} : {}),
    };
    converted.set(message, like);
  }
  return like;
}
export const appendText = (message: Pick<AppendMessage, 'content'>) =>
  message.content
    .flatMap(part => (part.type === 'text' ? [part.text] : []))
    .join('\n')
    .trim();
export function firstAssistantIdByRun(messages: readonly ChatMessage[]) {
  const first = new Map<string, string>();
  for (const m of messages) if (m.role === 'assistant' && m.runId && !first.has(m.runId)) first.set(m.runId, m.id);
  return first;
}
