import {harnessNote} from './role-prompts.js';
export const isTransientFailure = (text: string) =>
  /429|overload|timeout|timed.out|socket|rate.limit|50[0234]|terminated|stream.ended|connection.error|ECONNRESET|ECONNREFUSED|fetch.failed/i.test(
    text,
  );
// The session already holds the stage prompt and all work so far; repeating the prompt would restart the task.
export const resumePrompt = harnessNote(
  'The previous model request failed before completing. Continue the task from where you stopped.',
);
export const runawayPrompt = harnessNote(
  'Your last tool call kept growing and was stopped before it ran. Issue it again shorter: one statement, or write long code to a file in parts.',
);
type RetrySession = {
  messages: readonly {role: string; stopReason?: string; errorMessage?: string}[];
  prompt: (text: string, options?: {expandPromptTemplates?: boolean}) => Promise<void>;
};
// Each retry passes the shared budget gate, which throws once the retry allowance is spent.
export async function retryTransient<S extends RetrySession>(session: S, gate: (kind: 'retry') => Promise<void>) {
  const lastAssistant = () => session.messages.filter(m => m.role === 'assistant').at(-1) as S['messages'][number];
  let last = lastAssistant();
  while (last?.stopReason === 'error' && isTransientFailure(last.errorMessage ?? '')) {
    await gate('retry');
    await session.prompt(resumePrompt, {expandPromptTemplates: false});
    last = lastAssistant();
  }
  return last;
}
