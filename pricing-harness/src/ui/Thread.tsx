import {ThreadPrimitive, useAui} from '@assistant-ui/react';
import type {ActiveRun} from './useSession.js';
import {Message} from './Message.js';
import {RunningView} from './RunningView.js';
const EXAMPLES = [
  'How have margins in product group X changed over the last five years?',
  'Which customers had the largest price increases this year?',
  'Where are discounts eroding margin the most?',
];
function EmptyState() {
  const aui = useAui();
  return (
    <div className="empty">
      <span className="eyebrow">Start with a question</span>
      <h1>
        Turn sales data into
        <br />
        clear pricing decisions.
      </h1>
      <p>Add your files, describe the business context, and ask what you want to understand.</p>
      <div className="examples">
        {EXAMPLES.map(example => (
          <button type="button" key={example} className="example" onClick={() => aui.composer().setText(example)}>
            “{example}”
          </button>
        ))}
      </div>
    </div>
  );
}
// The running view sits after the messages; it is not a message, so step updates never touch the list.
export function Thread({activeRun}: {activeRun: ActiveRun | null}) {
  return (
    <ThreadPrimitive.Root className="thread">
      <ThreadPrimitive.Viewport className="conversation">
        <ThreadPrimitive.Empty>
          <EmptyState />
        </ThreadPrimitive.Empty>
        <ThreadPrimitive.Messages>{({message}) => <Message id={message.id} />}</ThreadPrimitive.Messages>
        {activeRun && <RunningView runId={activeRun.id} startedAt={activeRun.startedAt} />}
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
