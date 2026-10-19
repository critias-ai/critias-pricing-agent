import {memo, useContext, useRef} from 'react';
import {MessagePrimitive} from '@assistant-ui/react';
import {ThreadContext} from './thread-context.js';
import {MarkdownText} from './MarkdownText.js';
import {RunSummary} from './RunningView.js';
import {Exploration} from './exploration/Exploration.js';
import {messageOutcome} from './outcome.js';
const PARTS = {Text: MarkdownText};
// data-renders lets the browser test prove step events don't re-render messages (F11 acceptance 4).
export const Message = memo(function Message({id}: {id: string}) {
  const thread = useContext(ThreadContext);
  const renders = useRef(0);
  renders.current++;
  const index = thread.messages.findIndex(m => m.id === id);
  const message = thread.messages[index];
  if (!message) return null;
  const outcome = messageOutcome(thread.messages, thread.runs, index);
  const finishedRun =
    message.runId && thread.firstByRun.get(message.runId) === message.id
      ? thread.runs.find(run => run.id === message.runId && run.endedAt)
      : undefined;
  return (
    <MessagePrimitive.Root className={`message ${message.role}`} data-renders={renders.current}>
      {finishedRun && <RunSummary run={finishedRun} />}
      <div className="message-head">
        <span className="message-role">{message.role === 'user' ? 'You' : 'Pricing assistant'}</span>
        {outcome.status && <span className="badge">No checked answer</span>}
      </div>
      {message.role === 'user' ? (
        <p className="user-text">{message.text}</p>
      ) : (
        <MessagePrimitive.Parts components={PARTS} />
      )}
      {message.exploration && <Exploration result={message.exploration} />}
      {message.explorationNotice && <p className="exploration-notice">{message.explorationNotice}</p>}
      {outcome.retryQuestion && !thread.busy && (
        <button type="button" className="retry" onClick={() => thread.retry(outcome.retryQuestion!)}>
          Retry
        </button>
      )}
    </MessagePrimitive.Root>
  );
});
