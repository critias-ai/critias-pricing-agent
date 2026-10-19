import type {ChatMessage, HarnessEvent, SessionSnapshot} from '../contracts.js';
export function reduceEvent(state: SessionSnapshot, event: HarnessEvent): SessionSnapshot {
  if (event.type === 'settled') {
    const next = event.payload.snapshot;
    if (next.serverInstanceId !== state.serverInstanceId || next.sessionId !== state.sessionId) return next;
    if (next.sequence <= state.sequence) return state;
    // Keep unchanged message objects so their charts don't redraw and lose zoom on every settle.
    const old = new Map(state.messages.map(m => [m.id, m]));
    const same = (m: ChatMessage) => old.get(m.id) && JSON.stringify(old.get(m.id)) === JSON.stringify(m);
    return {...next, messages: next.messages.map(m => (same(m) ? old.get(m.id)! : m))};
  }
  if (
    event.serverInstanceId !== state.serverInstanceId ||
    event.sessionId !== state.sessionId ||
    event.sequence <= state.sequence
  )
    return state;
  const next = {...state, sequence: event.sequence};
  if (event.type === 'message') {
    const index = next.messages.findIndex(m => m.id === event.payload.id);
    next.messages = [...next.messages];
    if (index < 0) next.messages.push(event.payload);
    else next.messages[index] = event.payload;
  }
  if (event.type === 'status') next.busy = true;
  return next;
}
