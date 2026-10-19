import type {ChatMessage} from '../../contracts.js';
import {loadCheckpoint} from './checkpoints.js';
import {bindExploration} from './exploration.js';

const unavailable = 'The verified result could not be restored. Rerun the analysis to explore it.';

export async function restoreExplorations(
  root: string,
  conversationId: string,
  messages: ChatMessage[],
): Promise<ChatMessage[]> {
  return Promise.all(
    messages.map(async message => {
      if (!message.exploration) return message;
      const ref = message.exploration.checkpoint;
      const checkpoint =
        message.exploration.schemaVersion === 1 ? await loadCheckpoint(root, ref, conversationId) : null;
      if (!checkpoint || checkpoint.runId !== message.exploration.runId) {
        const {exploration: _removed, ...rest} = message;
        return {...rest, explorationNotice: unavailable};
      }
      const rebuilt = await bindExploration(root, checkpoint, ref);
      if (!rebuilt.result) {
        const {exploration: _removed, ...rest} = message;
        return {...rest, explorationNotice: unavailable};
      }
      return {...message, exploration: rebuilt.result};
    }),
  );
}
