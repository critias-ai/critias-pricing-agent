import type {ChatMessage, RunRecord} from '../contracts.js';
export type OutcomeStatus = 'no-checked-answer';
export type MessageOutcome = {status?: OutcomeStatus; retryQuestion?: string};
// B9: the outcome belongs to the last assistant message of its run.
export function messageOutcome(
  messages: readonly ChatMessage[],
  runs: readonly RunRecord[],
  index: number,
): MessageOutcome {
  const message = messages[index];
  if (!message || message.role !== 'assistant' || !message.runId) return {};
  if (messages.slice(index + 1).some(m => m.role === 'assistant' && m.runId === message.runId)) return {};
  if (runs.find(r => r.id === message.runId)?.outcome?.kind !== 'no-verified-answer') return {};
  const question =
    messages.find(m => m.role === 'user' && m.runId === message.runId)?.text ??
    messages
      .slice(0, index)
      .reverse()
      .find(m => m.role === 'user')?.text;
  return {status: 'no-checked-answer', ...(question ? {retryQuestion: question} : {})};
}
export const announcement = (outcome: MessageOutcome) => (outcome.status ? 'No checked answer' : 'Answer ready');
