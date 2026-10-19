import {useEffect, useState} from 'react';
import {api} from './api.js';
type Summary = {id: string; title: string; updatedAt: string; messageCount: number};
const when = (iso: string) => {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
    : date.toLocaleDateString([], {day: 'numeric', month: 'short'});
};
// Saved conversations, newest first. `refresh` changes whenever the list may have changed (a switch or a finished run).
export function Conversations(props: {
  current?: string;
  disabled: boolean;
  refresh: string;
  open: (id: string) => void;
  start: () => void;
}) {
  const [list, setList] = useState<Summary[] | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    api<{conversations: Summary[]}>('/conversations')
      .then(v => alive && (setList(v.conversations), setError('')))
      .catch(e => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [props.refresh]);
  // A new conversation has no saved messages yet, so it is shown as a placeholder until its first question.
  const unsaved = !!list && !!props.current && !list.some(c => c.id === props.current);
  return (
    <nav className="sidebar" aria-label="Conversations">
      <button type="button" className="new-conversation" disabled={props.disabled} onClick={props.start}>
        New conversation
      </button>
      <h2>Conversations</h2>
      {error && <p role="alert">{error}</p>}
      {!error && !list && <p>Loading…</p>}
      <ul>
        {unsaved && (
          <li>
            <button type="button" disabled aria-current="true">
              <span>Untitled conversation</span>
            </button>
          </li>
        )}
        {list?.map(c => (
          <li key={c.id}>
            <button
              type="button"
              disabled={props.disabled || c.id === props.current}
              aria-current={c.id === props.current ? 'true' : undefined}
              title={c.title}
              onClick={() => props.open(c.id)}
            >
              <span>{c.title}</span>
              <small>{when(c.updatedAt)}</small>
            </button>
          </li>
        ))}
      </ul>
      {list && !list.length && !unsaved && <p>No saved conversations yet.</p>}
    </nav>
  );
}
